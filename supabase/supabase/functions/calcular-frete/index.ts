const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CEP_ORIGEM = '37550360'

// Limites Correios
const LIMITE_PESO_KG = 30
const LIMITE_DIM_CM = 100
const LIMITE_SOMA_CM = 200

interface FreteRequest {
  cep_destino: string
  peso_kg: number
  comprimento_cm: number
  largura_cm: number
  altura_cm: number
  valor_mercadoria?: number
  categoria?: string
  produto_id?: number
}

interface OpcaoFrete {
  servico: string
  codigo: string
  preco: number
  prazo: number
  prazo_texto?: string
  erro: string | null
}

function limparCep(cep: string): string {
  return cep.replace(/\D/g, '')
}

function elegiveisCorreios(peso: number, comp: number, larg: number, alt: number): boolean {
  const soma = comp + larg + alt
  const maxDim = Math.max(comp, larg, alt)
  return peso <= LIMITE_PESO_KG && maxDim <= LIMITE_DIM_CM && soma <= LIMITE_SOMA_CM
}

function ajustarDimensoes(comp: number, larg: number, alt: number) {
  return {
    comprimento: Math.max(comp, 16),
    largura: Math.max(larg, 11),
    altura: Math.max(alt, 2),
  }
}

// Códigos de serviço Correios
const SERVICOS_CORREIOS = [
  { codigo: '03220', nome: 'SEDEX' },
  { codigo: '03298', nome: 'PAC' },
]

// Cache do token (válido por ~1h)
let tokenCache: { token: string; expira: number } | null = null

async function autenticarCorreios(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expira) return tokenCache.token

  const cnpj = Deno.env.get('BRASPRESS_CNPJ') ?? '' // mesmo CNPJ
  const senha = Deno.env.get('CORREIOS_SENHA') ?? ''
  const cartao = Deno.env.get('CORREIOS_CARTAO') ?? ''

  const resp = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(`${cnpj}:${senha}`)}`,
    },
    body: JSON.stringify({ numero: cartao }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Auth Correios ${resp.status}: ${txt}`)
  }

  const data = await resp.json()
  const token = data.token as string
  // Cache por 50 minutos (token dura ~1h)
  tokenCache = { token, expira: Date.now() + 50 * 60 * 1000 }
  return token
}

async function cotarCorreios(
  cepDestino: string,
  peso: number,
  comp: number,
  larg: number,
  alt: number,
): Promise<OpcaoFrete[]> {
  const dim = ajustarDimensoes(comp, larg, alt)
  const contrato = Deno.env.get('CORREIOS_CONTRATO') ?? ''

  try {
    const token = await autenticarCorreios()
    const resultados: OpcaoFrete[] = []

    // Cotar preço + prazo de cada serviço em paralelo
    const promises = SERVICOS_CORREIOS.map(async (svc) => {
      try {
        const precoParams = new URLSearchParams({
          cepOrigem: CEP_ORIGEM,
          cepDestino,
          psObjeto: String(peso * 1000), // gramas
          tpObjeto: '2', // caixa
          comprimento: String(dim.comprimento),
          largura: String(dim.largura),
          altura: String(dim.altura),
          nuContrato: contrato,
          nuDR: '20', // DR MG
          coProduto: svc.codigo,
        })

        const prazoParams = new URLSearchParams({
          cepOrigem: CEP_ORIGEM,
          cepDestino,
          coProduto: svc.codigo,
        })

        const [precoResp, prazoResp] = await Promise.all([
          fetch(`https://api.correios.com.br/preco/v1/nacional/${svc.codigo}?${precoParams}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`https://api.correios.com.br/prazo/v1/nacional/${svc.codigo}?${prazoParams}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ])

        if (!precoResp.ok) {
          console.error(`Correios ${svc.nome} preço erro: ${precoResp.status}`)
          return null
        }

        const precoData = await precoResp.json()
        const preco = parseFloat(precoData.pcFinal ?? precoData.pcBase ?? '0')

        let prazo = 0
        if (prazoResp.ok) {
          const prazoData = await prazoResp.json()
          prazo = parseInt(prazoData.prazoEntrega ?? prazoData.prazo ?? '0') || 0
        }

        if (preco > 0) {
          const prazoAjustado = ajustarPrazoCorte(prazo)
          return {
            servico: svc.nome,
            codigo: svc.codigo,
            preco,
            prazo: prazoAjustado.prazo,
            prazo_texto: prazoAjustado.prazo_texto,
            erro: null,
          }
        }
        return null
      } catch (e) {
        console.error(`Correios ${svc.nome}: ${(e as Error).message}`)
        return null
      }
    })

    const results = await Promise.all(promises)
    for (const r of results) {
      if (r) resultados.push(r)
    }

    return resultados
  } catch (e) {
    return [{ servico: 'Correios', codigo: '', preco: 0, prazo: 0, erro: `Erro: ${(e as Error).message}` }]
  }
}

async function cotarBraspress(
  cepDestino: string,
  peso: number,
  comp: number,
  larg: number,
  alt: number,
): Promise<OpcaoFrete | null> {
  const usuario = Deno.env.get('BRASPRESS_USUARIO') ?? ''
  const senha = Deno.env.get('BRASPRESS_SENHA') ?? ''
  const cnpj = Deno.env.get('BRASPRESS_CNPJ') ?? ''

  if (!usuario || !senha || !cnpj) {
    return null
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const resp = await fetch('https://api.braspress.com/v1/cotacao/calcular/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${usuario}:${senha}`)}`,
      },
      body: JSON.stringify({
        cnpjRemetente: cnpj,
        cnpjDestinatario: cnpj, // usa mesmo CNPJ remetente para cotação genérica
        modal: 'R',
        tipoFrete: '1',
        cepOrigem: parseInt(CEP_ORIGEM),
        cepDestino: parseInt(cepDestino),
        vlrMercadoria: 0,
        peso: peso,
        volumes: 1,
        cubagem: [{
          altura: alt / 100,
          largura: larg / 100,
          comprimento: comp / 100,
          volumes: 1,
        }],
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) {
      const errText = await resp.text()
      return { servico: 'Braspress', codigo: 'braspress', preco: 0, prazo: 0, erro: errText }
    }

    const data = await resp.json()
    const prazoBruto = data.prazo ?? 0
    const prazoAjustado = ajustarPrazoCorte(prazoBruto)
    return {
      servico: 'Braspress (Rodoviário)',
      codigo: 'braspress',
      preco: data.totalFrete ?? 0,
      prazo: prazoAjustado.prazo,
      prazo_texto: prazoAjustado.prazo_texto,
      erro: null,
    }
  } catch (e) {
    return { servico: 'Braspress', codigo: 'braspress', preco: 0, prazo: 0, erro: (e as Error).message }
  }
}

// Horário de corte para postagem/coleta (após esse horário, +1 dia útil)
let horarioCorteTransportadora = 15 // default 15h, carregado do banco

function proximoDiaUtil(): { diasAte: number; nome: string } {
  const agora = new Date()
  // Dia da semana em Brasília (0=dom, 6=sab)
  const offsetMs = -3 * 60 * 60 * 1000
  const brasilia = new Date(agora.getTime() + offsetMs + agora.getTimezoneOffset() * 60 * 1000)
  const dia = brasilia.getDay() // 0=dom..6=sab
  // Dias extras até próximo dia útil de postagem
  // Se após corte: postagem no próximo dia útil
  // Sex após corte → seg (+3), Sab → seg (+2), Dom → seg (+1)
  if (dia === 5) return { diasAte: 3, nome: 'segunda-feira' }  // sexta após corte → segunda
  if (dia === 6) return { diasAte: 2, nome: 'segunda-feira' }  // sábado → segunda
  if (dia === 0) return { diasAte: 1, nome: 'segunda-feira' }  // domingo → segunda
  return { diasAte: 1, nome: 'amanhã' }
}

function ajustarPrazoCorte(prazoDias: number): { prazo: number; prazo_texto: string } {
  const agora = new Date()
  const horaBrasilia = (agora.getUTCHours() - 3 + 24) % 24
  const aposCorte = horaBrasilia >= horarioCorteTransportadora

  if (!aposCorte) {
    // Dentro do horário — prazo normal
    // Mas se for sábado/domingo, ainda precisa ajustar
    const offsetMs = -3 * 60 * 60 * 1000
    const brasilia = new Date(agora.getTime() + offsetMs + agora.getTimezoneOffset() * 60 * 1000)
    const dia = brasilia.getDay()
    if (dia === 0 || dia === 6) {
      const { diasAte, nome } = proximoDiaUtil()
      const prazoFinal = prazoDias + diasAte
      return {
        prazo: prazoFinal,
        prazo_texto: `${prazoFinal} ${prazoFinal !== 1 ? 'dias úteis' : 'dia útil'} (postagem ${nome})`,
      }
    }
    return {
      prazo: prazoDias,
      prazo_texto: `${prazoDias} ${prazoDias !== 1 ? 'dias úteis' : 'dia útil'}`,
    }
  }

  // Após corte — postagem no próximo dia útil
  const { diasAte, nome } = proximoDiaUtil()
  const prazoFinal = prazoDias + diasAte
  return {
    prazo: prazoFinal,
    prazo_texto: `${prazoFinal} ${prazoFinal !== 1 ? 'dias úteis' : 'dia útil'} (postagem ${nome})`,
  }
}

interface FreteRegra {
  tipo: string
  descricao: string
  condicao_estados: string[] | null
  condicao_produto_id: number | null
  condicao_categoria: string | null
  condicao_valor_min: number | null
  condicao_valor_max: number | null
  valor: number
  prioridade: number
}

function regraMatch(regra: FreteRegra, uf: string, valorMercadoria: number, produtoId?: number, categoria?: string): boolean {
  if (regra.condicao_estados?.length && !regra.condicao_estados.includes(uf)) return false
  if (regra.condicao_valor_min != null && valorMercadoria < regra.condicao_valor_min) return false
  if (regra.condicao_valor_max != null && valorMercadoria > regra.condicao_valor_max) return false
  if (regra.condicao_produto_id != null && produtoId !== regra.condicao_produto_id) return false
  if (regra.condicao_categoria != null && categoria !== regra.condicao_categoria) return false
  return true
}

function aplicarRegra(regra: FreteRegra, preco: number): number | null {
  switch (regra.tipo) {
    case 'frete_gratis': return 0
    case 'desconto_pct': return Math.max(0, preco * (1 - regra.valor / 100))
    case 'desconto_fixo': return Math.max(0, preco - regra.valor)
    case 'acrescimo_fixo': return preco + regra.valor
    case 'bloqueio': return null // remove opção
    default: return preco
  }
}

// Coordenadas Pouso Alegre (origem)
const LAT_ORIGEM = -22.2299
const LNG_ORIGEM = -45.9363

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function cotarFreteProprio(cepDestino: string): Promise<OpcaoFrete | null> {
  try {
    // Config frete próprio (editável via tabela frete_proprio_config)
    const cfg = {
      raio_max_km: 100,
      valor_por_km: 3.00,
      frete_minimo: 30.00,
      faixa1_km: 30,
      faixa1_prazo: 'No mesmo dia',
      faixa2_prazo: '1 dia útil',
      horario_corte: '14:00',
    }

    // Tenta carregar config do banco (fallback para defaults acima)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://vcektwtpofypsgdgdjlx.supabase.co'
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      if (supabaseKey) {
        const cfgResp = await fetch(`${supabaseUrl}/rest/v1/frete_proprio_config?ativo=eq.true&limit=1`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        })
        if (cfgResp.ok) {
          const cfgArr = await cfgResp.json()
          if (cfgArr.length) Object.assign(cfg, cfgArr[0])
        }
      }
    } catch { /* usa defaults */ }

    // Buscar cidade do CEP via ViaCEP, depois coordenadas via Nominatim
    let cidade = '', uf = ''
    try {
      const viaResp = await fetch(`https://viacep.com.br/ws/${cepDestino}/json/`)
      if (viaResp.ok) {
        const viaData = await viaResp.json()
        if (!viaData.erro) { cidade = viaData.localidade; uf = viaData.uf }
      }
    } catch { /* ignora */ }

    // Fallback: BrasilAPI
    if (!cidade) {
      try {
        const brResp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDestino}`)
        if (brResp.ok) {
          const brData = await brResp.json()
          cidade = brData.city ?? ''; uf = brData.state ?? ''
        }
      } catch { /* ignora */ }
    }

    if (!cidade) return { servico: 'Próprio', codigo: 'proprio', preco: 0, prazo: 0, erro: 'Cidade não encontrada' }

    // Coordenadas via Nominatim (OpenStreetMap) — 1 req/s, sem rate limit agressivo
    const geoResp = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(uf)}&country=Brazil&format=json&limit=1`,
      { headers: { 'User-Agent': 'Pousinox-Frete/1.0' } },
    )
    if (!geoResp.ok) return { servico: 'Próprio', codigo: 'proprio', preco: 0, prazo: 0, erro: `Geo HTTP ${geoResp.status}` }
    const geoArr = await geoResp.json()
    if (!geoArr.length) return { servico: 'Próprio', codigo: 'proprio', preco: 0, prazo: 0, erro: `Sem coords para ${cidade}/${uf}` }

    const lat = parseFloat(geoArr[0].lat)
    const lng = parseFloat(geoArr[0].lon)
    const distancia = haversineKm(LAT_ORIGEM, LNG_ORIGEM, lat, lng)

    if (distancia > cfg.raio_max_km) return null

    const preco = Math.max(distancia * cfg.valor_por_km, cfg.frete_minimo)

    // Prazo baseado na faixa + dia útil
    const agora = new Date()
    const offsetMs = -3 * 60 * 60 * 1000
    const brasilia = new Date(agora.getTime() + offsetMs + agora.getTimezoneOffset() * 60 * 1000)
    const horaBr = brasilia.getHours()
    const diaSemana = brasilia.getDay() // 0=dom..6=sab
    const horaCorte = parseInt(cfg.horario_corte.split(':')[0])
    const dentroFaixa1 = distancia <= cfg.faixa1_km
    const fimDeSemana = diaSemana === 0 || diaSemana === 6
    let prazoTexto: string
    let prazoDias: number

    if (fimDeSemana) {
      // Fim de semana — entrega só a partir de segunda
      const diasAteSeg = diaSemana === 6 ? 2 : 1
      if (dentroFaixa1) {
        prazoTexto = `Entrega segunda-feira (pedido no fim de semana)`
        prazoDias = diasAteSeg
      } else {
        prazoDias = diasAteSeg + 1
        prazoTexto = `${prazoDias} dias úteis (postagem segunda-feira)`
      }
    } else if (dentroFaixa1) {
      if (horaBr < horaCorte) {
        prazoTexto = 'Entrega hoje (pedidos até ' + cfg.horario_corte.slice(0, 5) + ')'
        prazoDias = 0
      } else if (diaSemana === 5) {
        // Sexta após corte → segunda
        prazoTexto = 'Entrega segunda-feira (pedido após ' + cfg.horario_corte.slice(0, 5) + ')'
        prazoDias = 3
      } else {
        prazoTexto = 'Entrega amanhã (pedido após ' + cfg.horario_corte.slice(0, 5) + ')'
        prazoDias = 1
      }
    } else {
      if (horaBr >= horaCorte || diaSemana === 5) {
        const diasExtra = diaSemana === 5 ? 3 : 1
        prazoDias = 1 + diasExtra
        const postagem = diaSemana === 5 ? 'segunda-feira' : 'amanhã'
        prazoTexto = `${prazoDias} dias úteis (postagem ${postagem})`
      } else {
        prazoTexto = '1 dia útil'
        prazoDias = 1
      }
    }

    return {
      servico: `Entrega Rápida (${Math.round(distancia)}km)`,
      codigo: 'proprio',
      preco: Math.round(preco * 100) / 100,
      prazo: prazoDias,
      prazo_texto: prazoTexto,
      erro: null,
    }
  } catch (e) {
    return { servico: 'Próprio', codigo: 'proprio', preco: 0, prazo: 0, erro: `Erro: ${(e as Error).message}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: FreteRequest = await req.json()
    const { cep_destino, peso_kg, comprimento_cm, largura_cm, altura_cm, valor_mercadoria, categoria, produto_id } = body

    if (!cep_destino || !peso_kg) {
      return new Response(
        JSON.stringify({ error: 'cep_destino e peso_kg são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const cep = limparCep(cep_destino)
    if (cep.length !== 8) {
      return new Response(
        JSON.stringify({ error: 'CEP inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Carregar config e regras do banco
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://vcektwtpofypsgdgdjlx.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    let regrasAtivas: FreteRegra[] = []

    if (supabaseKey) {
      try {
        const [cfgResp, regrasResp] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/frete_config?ativo=eq.true&limit=1`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          }),
          fetch(`${supabaseUrl}/rest/v1/frete_regras?ativo=eq.true&order=prioridade.asc`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          }),
        ])
        if (cfgResp.ok) {
          const cfgArr = await cfgResp.json()
          if (cfgArr.length) {
            const hct = cfgArr[0].horario_corte_transportadora
            if (hct) horarioCorteTransportadora = parseInt(String(hct).split(':')[0]) || 15
          }
        }
        if (regrasResp.ok) {
          regrasAtivas = await regrasResp.json()
        }
      } catch { /* usa defaults */ }
    }

    const comp = comprimento_cm || 20
    const larg = largura_cm || 15
    const alt = altura_cm || 10

    // Descobrir UF do destino (para regras por estado)
    let ufDestino = ''
    try {
      const viaResp = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      if (viaResp.ok) {
        const viaData = await viaResp.json()
        if (!viaData.erro) ufDestino = viaData.uf ?? ''
      }
    } catch { /* ignora */ }

    // Correios, Braspress e frete próprio em paralelo
    const elegivel = elegiveisCorreios(peso_kg, comp, larg, alt)
    const [correiosResult, braspressResult, proprioResult] = await Promise.all([
      elegivel ? cotarCorreios(cep, peso_kg, comp, larg, alt) : Promise.resolve([]),
      cotarBraspress(cep, peso_kg, comp, larg, alt),
      cotarFreteProprio(cep),
    ])

    const opcoes: OpcaoFrete[] = [
      ...(proprioResult && !proprioResult.erro ? [proprioResult] : []),
      ...correiosResult.filter(o => !o.erro),
      ...(braspressResult && !braspressResult.erro ? [braspressResult] : []),
    ]

    // Aplicar regras condicionais
    let regraAplicada: { tipo: string; descricao: string } | null = null
    const valMerc = valor_mercadoria ?? 0

    if (regrasAtivas.length && ufDestino) {
      for (const regra of regrasAtivas) {
        if (regraMatch(regra, ufDestino, valMerc, produto_id, categoria)) {
          // Aplicar a primeira regra que match (menor prioridade = maior importância)
          if (regra.tipo === 'bloqueio') {
            // Remove todas as opções
            opcoes.length = 0
            regraAplicada = { tipo: regra.tipo, descricao: regra.descricao }
          } else {
            for (const op of opcoes) {
              const novoPreco = aplicarRegra(regra, op.preco)
              if (novoPreco !== null) {
                op.preco = Math.round(novoPreco * 100) / 100
              }
            }
            regraAplicada = { tipo: regra.tipo, descricao: regra.descricao }
          }
          break
        }
      }
    }

    opcoes.sort((a, b) => a.preco - b.preco)

    return new Response(
      JSON.stringify({
        cep_origem: CEP_ORIGEM,
        cep_destino: cep,
        uf_destino: ufDestino,
        peso_kg,
        dimensoes: { comprimento: comp, largura: larg, altura: alt },
        correios_elegivel: elegiveisCorreios(peso_kg, comp, larg, alt),
        regra_aplicada: regraAplicada,
        opcoes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
