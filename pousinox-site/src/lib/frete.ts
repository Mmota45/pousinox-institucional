import { supabaseAdmin } from './supabase'
import type {
  Volume, FreteOpcao, FreteCotacao, FreteProprioComponente,
  FreteRecomendacao, FreteParametro, CotacaoExternaResult,
} from '../types/frete'

// ── Distância rodoviária via Nominatim + OSRM (APIs abertas) ─────────────────

async function geocodarCEP(cep: string): Promise<{ lat: number; lon: number } | null> {
  const limpo = cep.replace(/\D/g, '')

  // 1. Buscar endereço via ViaCEP
  const viaResp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
  if (!viaResp.ok) return null
  const via = await viaResp.json()
  if (via.erro) return null

  // 2. Geocodar cidade+UF via Nominatim
  const q = `${via.localidade}, ${via.uf}, Brazil`
  const nomResp = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
    { headers: { 'User-Agent': 'Pousinox-ERP/1.0' } },
  )
  if (!nomResp.ok) return null
  const data = await nomResp.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

export interface DistanciaResult {
  distancia_km: number
  duracao_horas: number
  origem: { lat: number; lon: number }
  destino: { lat: number; lon: number }
  rota_coords: [number, number][]
}

export async function calcularDistanciaKm(cepOrigem: string, cepDestino: string): Promise<DistanciaResult | null> {
  const [orig, dest] = await Promise.all([geocodarCEP(cepOrigem), geocodarCEP(cepDestino)])
  if (!orig || !dest) return null

  const resp = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${orig.lon},${orig.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`,
  )
  if (!resp.ok) return null
  const data = await resp.json()
  if (!data.routes?.length) return null

  const rota = data.routes[0]
  const idaKm = Math.round(rota.distance / 1000)
  const idaHoras = rota.duration / 3600

  // GeoJSON coords are [lon, lat] — Leaflet needs [lat, lon]
  const rota_coords: [number, number][] = (rota.geometry?.coordinates || [])
    .map((c: [number, number]) => [c[1], c[0]] as [number, number])

  return {
    distancia_km: idaKm * 2,
    duracao_horas: Math.round(idaHoras * 2 * 10) / 10,
    origem: orig,
    destino: dest,
    rota_coords,
  }
}

// ── Cálculos de volume/peso ──────────────────────────────────────────────────

export function calcularPesoCubado(volumes: Volume[]): number {
  return volumes.reduce((acc, v) => {
    const cubagem = (v.comprimento_cm * v.largura_cm * v.altura_cm) / 6000
    return acc + cubagem * v.quantidade
  }, 0)
}

export function calcularTotaisVolumes(volumes: Volume[]) {
  const peso_real = volumes.reduce((s, v) => s + v.peso_kg * v.quantidade, 0)
  const peso_cubado = calcularPesoCubado(volumes)
  const peso_taxado = Math.max(peso_real, peso_cubado)
  const qtd_total = volumes.reduce((s, v) => s + v.quantidade, 0)
  return { peso_real, peso_cubado, peso_taxado, qtd_total }
}

function maiorDimensao(volumes: Volume[]): { comprimento: number; largura: number; altura: number } {
  if (!volumes.length) return { comprimento: 20, largura: 15, altura: 10 }
  let c = 0, l = 0, a = 0
  for (const v of volumes) {
    if (v.comprimento_cm > c) c = v.comprimento_cm
    if (v.largura_cm > l) l = v.largura_cm
    if (v.altura_cm > a) a = v.altura_cm
  }
  return { comprimento: c || 20, largura: l || 15, altura: a || 10 }
}

// ── Cotação externa (Correios + Braspress) ───────────────────────────────────

export async function cotarFreteExterno(
  cep_destino: string,
  volumes: Volume[],
  valor_mercadoria: number,
  cotado_por: string,
): Promise<{ cotacao: FreteCotacao; opcoes: FreteOpcao[] }> {
  const totais = calcularTotaisVolumes(volumes)
  const dims = maiorDimensao(volumes)

  const { data, error } = await supabaseAdmin.functions.invoke('calcular-frete', {
    body: {
      cep_destino: cep_destino.replace(/\D/g, ''),
      peso_kg: totais.peso_taxado || 1,
      comprimento_cm: dims.comprimento,
      largura_cm: dims.largura,
      altura_cm: dims.altura,
    },
  })

  const raw = data as CotacaoExternaResult | null

  if (error || !raw) {
    const cotacao: FreteCotacao = {
      provedor: 'correios',
      cep_origem: '37550360',
      cep_destino,
      peso_total_kg: totais.peso_real,
      peso_cubado_kg: totais.peso_cubado,
      peso_taxado_kg: totais.peso_taxado,
      valor_mercadoria,
      sucesso: false,
      erro: error?.message || 'Sem resposta',
      cotado_em: new Date().toISOString(),
      cotado_por,
      valido_ate: null,
      opcoes: [],
    }
    return { cotacao, opcoes: [] }
  }

  const opcoes: FreteOpcao[] = (raw.opcoes || [])
    .filter(o => !o.erro && o.preco > 0)
    .map(o => ({
      provedor: o.codigo === 'braspress' ? 'braspress' as const : 'correios' as const,
      servico: o.servico,
      codigo: o.codigo,
      custo: o.preco,
      preco_venda: o.preco,
      margem_pct: 0,
      prazo_dias: o.prazo || null,
      prazo_texto: o.prazo ? `${o.prazo} dias úteis` : '',
      componentes_json: null,
      selecionada: false,
      obs: '',
    }))

  const valido_ate = new Date()
  valido_ate.setDate(valido_ate.getDate() + 3)

  const cotacao: FreteCotacao = {
    provedor: 'correios',
    cep_origem: raw.cep_origem || '37550360',
    cep_destino,
    peso_total_kg: totais.peso_real,
    peso_cubado_kg: totais.peso_cubado,
    peso_taxado_kg: totais.peso_taxado,
    valor_mercadoria,
    sucesso: true,
    erro: null,
    cotado_em: new Date().toISOString(),
    cotado_por,
    valido_ate: valido_ate.toISOString(),
    opcoes,
  }

  return { cotacao, opcoes }
}

// ── Frete próprio ────────────────────────────────────────────────────────────

export function calcularFreteProprio(
  componentes: FreteProprioComponente[],
  distanciaKm: number,
  dias: number,
  valorMercadoria: number,
  parametros: FreteParametro[],
): FreteOpcao {
  const param = (chave: string) => parametros.find(p => p.chave === chave)?.valor ?? 0

  const calc = componentes.map(c => {
    let valor = c.valor
    let formula = c.formula

    if (valor === 0 && !formula) {
      switch (c.chave) {
        case 'combustivel':
          valor = distanciaKm * param('combustivel_km')
          formula = `${distanciaKm}km × R$${param('combustivel_km').toFixed(2)}/km`
          break
        case 'pedagio':
          valor = distanciaKm * param('pedagio_medio_km')
          formula = `${distanciaKm}km × R$${param('pedagio_medio_km').toFixed(2)}/km`
          break
        case 'motorista':
          valor = dias * param('motorista_dia')
          formula = `${dias}d × R$${param('motorista_dia').toFixed(2)}/dia`
          break
        case 'ajudante':
          valor = dias * param('ajudante_dia')
          formula = `${dias}d × R$${param('ajudante_dia').toFixed(2)}/dia`
          break
        case 'depreciacao':
          valor = distanciaKm * param('depreciacao_km')
          formula = `${distanciaKm}km × R$${param('depreciacao_km').toFixed(2)}/km`
          break
        case 'manutencao':
          valor = distanciaKm * param('manutencao_km')
          formula = `${distanciaKm}km × R$${param('manutencao_km').toFixed(2)}/km`
          break
        case 'seguro':
          valor = valorMercadoria * (param('seguro_pct') / 100)
          formula = `${param('seguro_pct')}% × R$${valorMercadoria.toFixed(2)}`
          break
        case 'gris':
          valor = valorMercadoria * (param('gris_pct') / 100)
          formula = `${param('gris_pct')}% × R$${valorMercadoria.toFixed(2)}`
          break
      }
    }

    return { ...c, valor: Math.round(valor * 100) / 100, formula }
  })

  const subtotal = calc.reduce((s, c) => s + c.valor, 0)
  const admPct = param('administrativo_pct')
  const contPct = param('contingencia_pct')
  const margemPct = param('margem_pct')

  const admIdx = calc.findIndex(c => c.chave === 'administrativo')
  if (admIdx >= 0 && calc[admIdx].valor === 0) {
    calc[admIdx].valor = Math.round(subtotal * admPct / 100 * 100) / 100
    calc[admIdx].formula = `${admPct}% × R$${subtotal.toFixed(2)}`
  }

  const contIdx = calc.findIndex(c => c.chave === 'contingencia')
  if (contIdx >= 0 && calc[contIdx].valor === 0) {
    calc[contIdx].valor = Math.round(subtotal * contPct / 100 * 100) / 100
    calc[contIdx].formula = `${contPct}% × R$${subtotal.toFixed(2)}`
  }

  const custoTotal = calc.reduce((s, c) => s + c.valor, 0)
  const precoVenda = Math.round(custoTotal * (1 + margemPct / 100) * 100) / 100

  return {
    provedor: 'proprio',
    servico: 'Frete Próprio',
    codigo: 'proprio',
    custo: Math.round(custoTotal * 100) / 100,
    preco_venda: precoVenda,
    margem_pct: margemPct,
    prazo_dias: dias,
    prazo_texto: `${dias} dia${dias > 1 ? 's' : ''}`,
    componentes_json: calc,
    selecionada: false,
    obs: '',
  }
}

// ── Recomendação ─────────────────────────────────────────────────────────────

function minBy<T>(arr: T[], fn: (item: T) => number): T {
  return arr.reduce((best, item) => fn(item) < fn(best) ? item : best)
}

function maxBy<T>(arr: T[], fn: (item: T) => number): T {
  return arr.reduce((best, item) => fn(item) > fn(best) ? item : best)
}

export function recomendarOpcao(opcoes: FreteOpcao[]): FreteRecomendacao {
  const validas = opcoes.filter(o => o.custo > 0)
  const vazio: FreteRecomendacao = {
    melhor_preco: null, melhor_prazo: null, melhor_margem: null,
    recomendada: null, motivo: 'Sem opções disponíveis',
  }
  if (!validas.length) return vazio

  const melhor_preco = minBy(validas, o => o.preco_venda)
  const comPrazo = validas.filter(o => o.prazo_dias != null)
  const melhor_prazo = comPrazo.length ? minBy(comPrazo, o => o.prazo_dias!) : null
  const melhor_margem = maxBy(validas, o => o.margem_pct)

  const rapidas = validas.filter(o => o.prazo_dias != null && o.prazo_dias <= 10)
  const recomendada = rapidas.length ? minBy(rapidas, o => o.preco_venda) : melhor_preco

  return {
    melhor_preco, melhor_prazo, melhor_margem, recomendada,
    motivo: rapidas.length
      ? `Melhor preço com entrega em até 10 dias (${recomendada.servico})`
      : `Melhor preço geral (${melhor_preco.servico})`,
  }
}

// ── Persistência ─────────────────────────────────────────────────────────────

export async function salvarCotacao(
  orcamento_id: number,
  cotacao: FreteCotacao,
  opcoes: FreteOpcao[],
) {
  const { data: cot, error: e1 } = await supabaseAdmin
    .from('orcamento_frete_cotacoes')
    .insert({
      orcamento_id,
      provedor: cotacao.provedor,
      cep_origem: cotacao.cep_origem,
      cep_destino: cotacao.cep_destino,
      peso_total_kg: cotacao.peso_total_kg,
      peso_cubado_kg: cotacao.peso_cubado_kg,
      peso_taxado_kg: cotacao.peso_taxado_kg,
      valor_mercadoria: cotacao.valor_mercadoria,
      volumes_json: cotacao.opcoes ? undefined : null,
      raw_response: cotacao as unknown,
      sucesso: cotacao.sucesso,
      erro: cotacao.erro,
      cotado_por: cotacao.cotado_por,
      valido_ate: cotacao.valido_ate,
    })
    .select('id')
    .single()

  if (e1 || !cot) throw new Error(e1?.message || 'Erro ao salvar cotação')

  if (opcoes.length) {
    const rows = opcoes.map(o => ({
      cotacao_id: cot.id,
      orcamento_id,
      provedor: o.provedor,
      servico: o.servico,
      codigo: o.codigo,
      custo: o.custo,
      preco_venda: o.preco_venda,
      prazo_dias: o.prazo_dias,
      prazo_texto: o.prazo_texto,
      componentes_json: o.componentes_json,
      selecionada: false,
      obs: o.obs || '',
    }))

    const { data: inserted, error: e2 } = await supabaseAdmin
      .from('orcamento_frete_opcoes')
      .insert(rows)
      .select('*')

    if (e2) throw new Error(e2.message)
    return { cotacao_id: cot.id as number, opcoes_inseridas: inserted || [] }
  }

  return { cotacao_id: cot.id as number, opcoes_inseridas: [] }
}

export async function carregarFrete(orcamento_id: number) {
  const [volRes, cotRes, opcRes] = await Promise.all([
    supabaseAdmin.from('orcamento_volumes').select('*').eq('orcamento_id', orcamento_id).order('ordem'),
    supabaseAdmin.from('orcamento_frete_cotacoes').select('*').eq('orcamento_id', orcamento_id).order('cotado_em', { ascending: false }),
    supabaseAdmin.from('orcamento_frete_opcoes').select('*').eq('orcamento_id', orcamento_id).order('criado_em'),
  ])

  return {
    volumes: (volRes.data || []) as Volume[],
    cotacoes: (cotRes.data || []) as FreteCotacao[],
    opcoes: (opcRes.data || []) as FreteOpcao[],
  }
}

export async function salvarVolumes(orcamento_id: number, volumes: Volume[]) {
  await supabaseAdmin.from('orcamento_volumes').delete().eq('orcamento_id', orcamento_id)
  if (!volumes.length) return

  const rows = volumes.map((v, i) => ({
    orcamento_id,
    descricao: v.descricao || `Volume ${i + 1}`,
    quantidade: v.quantidade,
    peso_kg: v.peso_kg,
    comprimento_cm: v.comprimento_cm,
    largura_cm: v.largura_cm,
    altura_cm: v.altura_cm,
    ordem: i,
  }))

  const { error } = await supabaseAdmin.from('orcamento_volumes').insert(rows)
  if (error) throw new Error(error.message)
}

export async function selecionarOpcaoDB(opcao_id: number, orcamento_id: number) {
  await supabaseAdmin
    .from('orcamento_frete_opcoes')
    .update({ selecionada: false })
    .eq('orcamento_id', orcamento_id)

  await supabaseAdmin
    .from('orcamento_frete_opcoes')
    .update({ selecionada: true })
    .eq('id', opcao_id)
}

export async function carregarParametros(): Promise<FreteParametro[]> {
  const { data } = await supabaseAdmin.from('frete_parametros').select('chave, valor, unidade, descricao')
  return (data || []) as FreteParametro[]
}

export async function salvarParametro(chave: string, valor: number, usuario: string) {
  const { error } = await supabaseAdmin
    .from('frete_parametros')
    .update({ valor, atualizado_em: new Date().toISOString(), atualizado_por: usuario })
    .eq('chave', chave)
  if (error) throw new Error(error.message)
}
