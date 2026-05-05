import { useState, useRef, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminClientes.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'

// ── Utilitários de parsing ────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseBRL(v: string): number | null {
  if (!v) return null
  const n = parseFloat(v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseData(v: string): string | null {
  if (!v) return null
  const [d, m, y] = v.split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseCnpj(v: string): string {
  return v.replace(/\D/g, '')
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ResultadoImport {
  cabecalho: { total: number; novos: number; erros: number }
  itens: { total: number; inseridos: number; erros: number }
  clientes: { total: number; novos: number; atualizados: number }
}

interface Cliente {
  id: number
  cnpj: string
  razao_social: string | null
  primeira_compra: string | null
  ultima_compra: string | null
  total_nfs: number
  total_gasto: number
}

interface ClienteRFM {
  id: number
  cnpj: string
  razao_social: string | null
  ultima_compra: string | null
  total_nfs: number
  total_gasto: number
  rfm_recencia: number | null
  rfm_frequencia: number | null
  rfm_valor: number | null
  rfm_score: number | null
  rfm_segmento: string | null
  rfm_calculado_em: string | null
}

const SEGMENTO_CONFIG: Record<string, { label: string; css: string; acao: string; estrategia: string }> = {
  VIP:        { label: 'VIP',        css: 'badgeVIP',        acao: 'Upsell / Fidelização',    estrategia: 'Contato direto, oferta exclusiva, prioridade no atendimento'  },
  Recorrente: { label: 'Recorrente', css: 'badgeRecorrente', acao: 'Retenção',                estrategia: 'Manter relacionamento ativo, antecipar necessidades'          },
  Regular:    { label: 'Regular',    css: 'badgeRegular',    acao: 'Engajamento',             estrategia: 'Aumentar frequência de compra com promoções pontuais'         },
  Novo:       { label: 'Novo',       css: 'badgeNovo',       acao: 'Onboarding',              estrategia: 'Garantir boa primeira experiência, facilitar segunda compra'  },
  'Em Risco': { label: 'Em Risco',   css: 'badgeEmRisco',   acao: 'Reativação urgente',      estrategia: 'Contato proativo imediato — risco de perda do cliente'        },
  Inativo:    { label: 'Inativo',    css: 'badgeInativo',    acao: 'Reativação',              estrategia: 'Campanha de retorno — oferta para reativar relacionamento'    },
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminClientes() {
  const [aba, setAba] = useState<'importar' | 'clientes' | 'rfm' | 'recebidas'>('importar')

  // Import
  const [arquivoCab, setArquivoCab]     = useState<File | null>(null)
  const [arquivoItens, setArquivoItens] = useState<File | null>(null)
  const [importando, setImportando]     = useState(false)
  const [progresso, setProgresso]       = useState('')
  const [resultado, setResultado]       = useState<ResultadoImport | null>(null)
  const [erroImport, setErroImport]     = useState<string | null>(null)
  const refCab   = useRef<HTMLInputElement>(null)
  const refItens = useRef<HTMLInputElement>(null)

  // Clientes
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [busca, setBusca]         = useState('')
  const [loadingCli, setLoadingCli] = useState(false)
  const lpCli = useLoadingProgress(1)
  const [buscado, setBuscado]     = useState(false)
  const [sortCol, setSortCol]     = useState<keyof Cliente>('total_gasto')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')

  // Enriquecimento CNPJ
  const [enriquecendo, setEnriquecendo] = useState(false)
  const [enriqProgresso, setEnriqProgresso] = useState('')

  async function enriquecerClientes() {
    setEnriquecendo(true)
    setEnriqProgresso('Buscando clientes sem cidade...')
    const { data: semCidade } = await supabaseAdmin
      .from('clientes')
      .select('id, cnpj')
      .is('cidade', null)
      .not('cnpj', 'is', null)
      .limit(500)
    if (!semCidade?.length) {
      setEnriqProgresso('✅ Todos os clientes já têm cidade preenchida!')
      setEnriquecendo(false)
      return
    }
    let ok = 0, erros = 0
    for (let i = 0; i < semCidade.length; i++) {
      const c = semCidade[i]
      setEnriqProgresso(`Consultando ${i + 1}/${semCidade.length}... (${ok} atualizados, ${erros} erros)`)
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c.cnpj}`)
        if (!res.ok) { erros++; continue }
        const d = await res.json()
        const updates: Record<string, string | null> = {}
        if (d.municipio) updates.cidade = d.municipio
        if (d.uf) updates.uf = d.uf
        if (d.descricao_situacao_cadastral) updates.segmento = d.cnae_fiscal_descricao || null
        if (d.porte) updates.porte = d.porte
        if (d.nome_fantasia) updates.nome_fantasia = d.nome_fantasia
        if (Object.keys(updates).length) {
          await supabaseAdmin.from('clientes').update(updates).eq('id', c.id)
          ok++
        }
      } catch { erros++ }
      // Rate limit: 3 req/s
      if (i < semCidade.length - 1) await new Promise(r => setTimeout(r, 350))
    }
    setEnriqProgresso(`✅ Concluído: ${ok} atualizados, ${erros} erros de ${semCidade.length} consultados`)
    setEnriquecendo(false)
    if (ok > 0) buscarClientes()
  }

  // Normalização de segmentos
  const [normalizando, setNormalizando] = useState(false)
  const [normProgresso, setNormProgresso] = useState('')

  const SEGMENTO_ALIAS: Record<string, string> = {
    'Comércio varejista de mercado': 'Supermercados',
    'Comércio varejista de mercadorias em geral': 'Supermercados',
    'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados': 'Supermercados',
    'Atacado': 'Supermercados',
    'Comércio atacadista de mercado': 'Supermercados',
    'Comércio atacadista de mercadorias em geral': 'Supermercados',
    'Comércio atacadista': 'Supermercados',
    'Restaurantes e similares': 'Restaurantes',
    'Restaurantes e outros': 'Restaurantes',
    'Lanchonetes, casas de chá, de sucos e similares': 'Restaurantes',
    'Panificação': 'Padarias e Confeitarias',
    'Padaria': 'Padarias e Confeitarias',
    'Padarias': 'Padarias e Confeitarias',
    'Confeitaria': 'Padarias e Confeitarias',
    'Confeitarias': 'Padarias e Confeitarias',
    'Hotéis': 'Hotelaria',
    'Hotéis e similares': 'Hotelaria',
    'Alojamento': 'Hotelaria',
    'Hospitalar': 'Saúde',
    'Hospital': 'Saúde',
    'Hospitais': 'Saúde',
    'Laboratórios': 'Saúde',
    'Laboratório': 'Saúde',
    'Fabricação de medicamentos alopáticos para uso humano': 'Saúde',
    'Fabricação de medicamentos': 'Saúde',
    'Atividades de atendimento em pronto-socorro e unidades hospitalares': 'Saúde',
    'Atividades de atendimento hospitalar': 'Saúde',
    'Fabricação de máquinas e equipamentos': 'Indústria',
    'Comércio varejista especializado de eletrodomésticos': 'Varejo Especializado',
    'Comércio varejista especializado': 'Varejo Especializado',
  }

  async function normalizarSegmentos() {
    setNormalizando(true)
    let total = 0
    for (const [de, para] of Object.entries(SEGMENTO_ALIAS)) {
      setNormProgresso(`Normalizando "${de}" → "${para}"...`)
      // Match exato
      const { data: d1 } = await supabaseAdmin
        .from('clientes')
        .update({ segmento: para })
        .eq('segmento', de)
        .select('id')
      // Match por prefixo (CNAE truncado)
      const { data: d2 } = await supabaseAdmin
        .from('clientes')
        .update({ segmento: para })
        .like('segmento', `${de}%`)
        .neq('segmento', para)
        .select('id')
      const c1 = d1?.length ?? 0
      const c2 = d2?.length ?? 0
      const count = (c1 || 0) + (c2 || 0)
      total += count || 0
    }
    setNormProgresso(`✅ ${total} clientes normalizados`)
    setNormalizando(false)
    if (total > 0) buscarClientes()
  }

  // NFs Recebidas
  const [arquivoRecCab,   setArquivoRecCab]   = useState<File | null>(null)
  const [arquivoRecItens, setArquivoRecItens] = useState<File | null>(null)
  const [importandoRec,   setImportandoRec]   = useState(false)
  const [progressoRec,    setProgressoRec]    = useState('')
  const [resultadoRec,    setResultadoRec]    = useState<{ cabecalho: number; itens: number; lancamentos: number; duplicatas: number } | null>(null)
  const [erroRec,         setErroRec]         = useState<string | null>(null)
  const refRecCab   = useRef<HTMLInputElement>(null)
  const refRecItens = useRef<HTMLInputElement>(null)

  // NFs Recebidas — listagem com status financeiro
  interface NfRecebida {
    id: number
    numero: string | null
    serie: string | null
    cnpj_fornecedor: string | null
    emissao: string | null
    total: number
    status: string | null
    lancamento_id: number | null
    fin_status: string | null   // joined de fin_lancamentos.status
  }
  const [nfsRecebidas,       setNfsRecebidas]       = useState<NfRecebida[]>([])
  const [loadingNfs,         setLoadingNfs]         = useState(false)
  const [nfsCarregadas,      setNfsCarregadas]      = useState(false)
  const [nfsFiltro,          setNfsFiltro]          = useState<'todas' | 'sem_lanc' | 'pendente' | 'pago'>('todas')

  async function carregarNfsRecebidas() {
    setLoadingNfs(true)
    const { data } = await supabaseAdmin
      .from('nf_recebidas_cabecalho')
      .select('id, numero, serie, cnpj_fornecedor, emissao, total, status, lancamento_id, fin_lancamentos(status)')
      .order('emissao', { ascending: false })
      .limit(300)
    setNfsRecebidas(
      (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        fin_status: (r.fin_lancamentos as Record<string, string> | null)?.status ?? null,
      })) as NfRecebida[]
    )
    setNfsCarregadas(true)
    setLoadingNfs(false)
  }

  // RFM
  const [clientesRFM, setClientesRFM]       = useState<ClienteRFM[]>([])
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [loadingRFM, setLoadingRFM]         = useState(false)
  const [recalculando, setRecalculando]     = useState(false)
  const [autoRecalcFeito, setAutoRecalcFeito] = useState(false)
  const [rfmMsg, setRfmMsg]                 = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [rfmBuscado, setRfmBuscado]         = useState(false)

  // ── Import ──────────────────────────────────────────────────────────────────

  async function importar() {
    if (!arquivoCab && !arquivoItens) { setErroImport('Selecione ao menos um arquivo.'); return }
    setImportando(true)
    setErroImport(null)
    setResultado(null)

    const res: ResultadoImport = {
      cabecalho: { total: 0, novos: 0, erros: 0 },
      itens: { total: 0, inseridos: 0, erros: 0 },
      clientes: { total: 0, novos: 0, atualizados: 0 },
    }

    // ── 1. Importar cabeçalho ─────────────────────────────────────────────
    if (arquivoCab) {
      setProgresso('Lendo NFs...')
      const texto = await arquivoCab.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1) // pula header

      res.cabecalho.total = dados.length

      const lote: object[] = []
      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 8) continue
        const chave = c[4]?.trim() || null
        lote.push({
          serie:        c[0] || null,
          numero:       c[1],
          cnpj:         parseCnpj(c[2]) || null,
          destinatario: c[3] || null,
          chave_acesso: chave,
          origem:       c[5] || null,
          status:       c[6] || null,
          emissao:      parseData(c[7]),
          total:        parseBRL(c[8]) ?? 0,
        })
      }

      // Upsert em lotes de 200
      for (let i = 0; i < lote.length; i += 200) {
        const chunk = lote.slice(i, i + 200)
        setProgresso(`Importando NFs... ${i + chunk.length}/${lote.length}`)
        const { error } = await supabaseAdmin
          .from('nf_cabecalho')
          .upsert(chunk, { onConflict: 'chave_acesso', ignoreDuplicates: false })
        if (error) res.cabecalho.erros += chunk.length
        else res.cabecalho.novos += chunk.length
      }
    }

    // ── 2. Importar itens ──────────────────────────────────────────────────
    if (arquivoItens) {
      setProgresso('Lendo itens das NFs...')
      const texto = await arquivoItens.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1)

      res.itens.total = dados.length

      // Coleta números de NF para limpar antes de reinserir
      const numerosNF = [...new Set(dados.map(l => parseCsvLine(l)[0]).filter(Boolean))]
      if (numerosNF.length > 0) {
        setProgresso('Limpando itens antigos...')
        for (let i = 0; i < numerosNF.length; i += 100) {
          await supabaseAdmin
            .from('nf_itens')
            .delete()
            .in('numero', numerosNF.slice(i, i + 100))
        }
      }

      const lote: object[] = []
      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 10) continue
        lote.push({
          numero:         c[0],
          cnpj:           parseCnpj(c[1]) || null,
          destinatario:   c[2] || null,
          emissao:        parseData(c[3]),
          codigo:         c[4] || null,
          ncm:            c[5] || null,
          ean:            c[6] || null,
          descricao:      c[7] || null,
          cfop:           c[8] || null,
          quantidade:     parseBRL(c[9]),
          valor_unitario: parseBRL(c[10]),
          origem_cst:     c[11] || null,
          valor_icms:     parseBRL(c[12]),
          valor_icms_st:  parseBRL(c[13]),
          cst_pis:        c[14] || null,
          valor_pis:      parseBRL(c[15]),
          cst_cofins:     c[16] || null,
          valor_cofins:   parseBRL(c[17]),
          valor_ipi:      parseBRL(c[18]),
          valor_total:    parseBRL(c[19]),
        })
      }

      for (let i = 0; i < lote.length; i += 200) {
        const chunk = lote.slice(i, i + 200)
        setProgresso(`Importando itens... ${i + chunk.length}/${lote.length}`)
        const { error } = await supabaseAdmin.from('nf_itens').insert(chunk)
        if (error) res.itens.erros += chunk.length
        else res.itens.inseridos += chunk.length
      }
    }

    // ── 3. Consolidar clientes ─────────────────────────────────────────────
    setProgresso('Consolidando clientes...')
    const { data: nfs } = await supabaseAdmin
      .from('nf_cabecalho')
      .select('cnpj, destinatario, emissao, total')
      .eq('status', 'Autorizadas')

    if (nfs && nfs.length > 0) {
      const mapa = new Map<string, {
        razao_social: string
        datas: string[]
        total_nfs: number
        total_gasto: number
      }>()

      for (const nf of nfs) {
        if (!nf.cnpj) continue
        const cnpj = nf.cnpj.replace(/\D/g, '')
        const ex = mapa.get(cnpj)
        if (ex) {
          if (nf.emissao) ex.datas.push(nf.emissao)
          ex.total_nfs++
          ex.total_gasto += nf.total ?? 0
        } else {
          mapa.set(cnpj, {
            razao_social: nf.destinatario ?? '',
            datas: nf.emissao ? [nf.emissao] : [],
            total_nfs: 1,
            total_gasto: nf.total ?? 0,
          })
        }
      }

      const clientesUpsert = Array.from(mapa.entries()).map(([cnpj, v]) => {
        const datas = v.datas.sort()
        return {
          cnpj,
          razao_social: v.razao_social,
          primeira_compra: datas[0] ?? null,
          ultima_compra: datas[datas.length - 1] ?? null,
          total_nfs: v.total_nfs,
          total_gasto: Math.round(v.total_gasto * 100) / 100,
          atualizado_em: new Date().toISOString(),
        }
      })

      res.clientes.total = clientesUpsert.length

      for (let i = 0; i < clientesUpsert.length; i += 200) {
        const chunk = clientesUpsert.slice(i, i + 200)
        const { error } = await supabaseAdmin
          .from('clientes')
          .upsert(chunk, { onConflict: 'cnpj' })
        if (!error) res.clientes.novos += chunk.length
      }
    }

    // ── 4. Cruzar com prospeccao ───────────────────────────────────────────
    setProgresso('Cruzando com base de prospecção...')
    const { data: clis } = await supabaseAdmin.from('clientes').select('cnpj')
    if (clis && clis.length > 0) {
      // prospeccao.cnpj é armazenado como dígitos puros (14 chars) — usa sem formatação
      const cnpjs = clis.map(c => c.cnpj.replace(/\D/g, ''))
      for (let i = 0; i < cnpjs.length; i += 500) {
        await supabaseAdmin
          .from('prospeccao')
          .update({ cliente_ativo: true })
          .in('cnpj', cnpjs.slice(i, i + 500))
      }
    }

    setResultado(res)
    setProgresso('')
    setImportando(false)
  }

  // ── Import NFs Recebidas ────────────────────────────────────────────────────

  async function importarRecebidas() {
    if (!arquivoRecCab && !arquivoRecItens) { setErroRec('Selecione ao menos um arquivo.'); return }
    setImportandoRec(true)
    setErroRec(null)
    setResultadoRec(null)

    let totalCab = 0, totalItens = 0, totalLanc = 0, totalDup = 0

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    if (arquivoRecCab) {
      setProgressoRec('Lendo cabeçalho de NFs recebidas...')
      const texto = await arquivoRecCab.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1)

      // Busca chaves já existentes (idempotência)
      const chavesCsv = dados.map(l => parseCsvLine(l)[4]?.trim()).filter(Boolean)
      const { data: existentes } = await supabaseAdmin
        .from('nf_recebidas_cabecalho')
        .select('chave_acesso, lancamento_id')
        .in('chave_acesso', chavesCsv)
      const mapaExistentes = new Map((existentes ?? []).map(e => [e.chave_acesso, e.lancamento_id]))

      const loteNovo: object[] = []
      const nfsParaLancar: { chave: string; numero: string; cnpj: string; emissao: string | null; total: number }[] = []

      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 8) continue
        const chave = c[4]?.trim() || null
        const status = c[6]?.trim() || ''

        if (chave && mapaExistentes.has(chave)) { totalDup++; continue }

        loteNovo.push({
          serie:           c[0] || null,
          numero:          c[1] || null,
          cnpj_fornecedor: parseCnpj(c[2]) || null,
          uf:              c[3] || null,
          chave_acesso:    chave,
          origem_nf:       c[5] || null,
          status,
          emissao:         parseData(c[7]),
          total:           parseBRL(c[8]) ?? 0,
        })

        if (status === 'Autorizadas' && chave) {
          nfsParaLancar.push({
            chave,
            numero: c[1] || '',
            cnpj:   parseCnpj(c[2]) || '',
            emissao: parseData(c[7]),
            total:  parseBRL(c[8]) ?? 0,
          })
        }
      }

      // Upsert cabeçalho em lotes
      for (let i = 0; i < loteNovo.length; i += 200) {
        const chunk = loteNovo.slice(i, i + 200)
        setProgressoRec(`Importando cabeçalho... ${i + chunk.length}/${loteNovo.length}`)
        const { error } = await supabaseAdmin
          .from('nf_recebidas_cabecalho')
          .upsert(chunk, { onConflict: 'chave_acesso', ignoreDuplicates: true })
        if (!error) totalCab += chunk.length
      }

      // Cria fin_lancamentos para NFs novas autorizadas
      for (const nf of nfsParaLancar) {
        // Checa se já existe lançamento com essa nf_chave
        const { data: lancExist } = await supabaseAdmin
          .from('fin_lancamentos')
          .select('id')
          .eq('nf_chave', nf.chave)
          .maybeSingle()

        let lancId: number | null = lancExist?.id ?? null

        if (!lancId) {
          const descricao = `NF ${nf.numero}${nf.cnpj ? ' — ' + nf.cnpj : ''}`
          const { data: novoLanc } = await supabaseAdmin
            .from('fin_lancamentos')
            .insert({
              tipo:             'despesa',
              descricao,
              valor:            nf.total,
              data_competencia: nf.emissao ?? new Date().toISOString().slice(0, 10),
              data_vencimento:  nf.emissao ?? new Date().toISOString().slice(0, 10),
              status:           'pendente',
              origem:           'nf',
              nf_chave:         nf.chave,
            })
            .select('id')
            .single()
          lancId = novoLanc?.id ?? null
          if (lancId) totalLanc++
        }

        // Vincula lancamento_id de volta ao cabeçalho
        if (lancId) {
          await supabaseAdmin
            .from('nf_recebidas_cabecalho')
            .update({ lancamento_id: lancId })
            .eq('chave_acesso', nf.chave)
        }
      }
    }

    // ── Itens ───────────────────────────────────────────────────────────────
    if (arquivoRecItens) {
      setProgressoRec('Lendo itens de NFs recebidas...')
      const texto = await arquivoRecItens.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1)

      // Limpa itens dos números presentes no arquivo
      const numeros = [...new Set(dados.map(l => parseCsvLine(l)[0]).filter(Boolean))]
      for (let i = 0; i < numeros.length; i += 100) {
        await supabaseAdmin.from('nf_recebidas_itens').delete().in('numero', numeros.slice(i, i + 100))
      }

      const loteItens: object[] = []
      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 10) continue
        loteItens.push({
          numero:          c[0] || null,
          cnpj_fornecedor: parseCnpj(c[1]) || null,
          uf:              c[2] || null,
          emissao:         parseData(c[3]),
          codigo:          c[4] || null,
          ncm:             c[5] || null,
          ean:             c[6] || null,
          descricao:       c[7] || null,
          cfop:            c[8] || null,
          quantidade:      parseBRL(c[9]),
          valor_unitario:  parseBRL(c[10]),
          origem_cst:      c[11] || null,
          valor_icms_st:   parseBRL(c[12]),
          cst_pis:         c[13] || null,
          valor_pis:       parseBRL(c[14]),
          cst_cofins:      c[15] || null,
          valor_cofins:    parseBRL(c[16]),
          valor_ipi:       parseBRL(c[17]),
          valor_total:     parseBRL(c[18]),
        })
      }

      for (let i = 0; i < loteItens.length; i += 200) {
        const chunk = loteItens.slice(i, i + 200)
        setProgressoRec(`Importando itens... ${i + chunk.length}/${loteItens.length}`)
        const { error } = await supabaseAdmin.from('nf_recebidas_itens').insert(chunk)
        if (!error) totalItens += chunk.length
      }
    }

    setResultadoRec({ cabecalho: totalCab, itens: totalItens, lancamentos: totalLanc, duplicatas: totalDup })
    setProgressoRec('')
    setImportandoRec(false)
    carregarNfsRecebidas()
  }

  // ── Auto-trigger RFM quando dados estão desatualizados (> 24h) ───────────────
  // Complementa o pg_cron: garante atualização mesmo que o cron não tenha rodado
  // (ex: primeira abertura do painel, falha de agendamento).

  useEffect(() => {
    if (aba !== 'rfm' || !rfmBuscado || recalculando || autoRecalcFeito) return
    const calc = clientesRFM[0]?.rfm_calculado_em
    const stale = !calc || Date.now() - new Date(calc).getTime() > 24 * 3600 * 1000
    if (stale) {
      setAutoRecalcFeito(true)
      recalcularRFM(true) // silent: não exibe popup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesRFM, rfmBuscado, aba])

  // ── Clientes ────────────────────────────────────────────────────────────────

  function toggleSort(col: keyof Cliente) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const clientesSorted = [...clientes].sort((a, b) => {
    const va = a[sortCol] ?? ''; const vb = b[sortCol] ?? ''
    const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  async function buscarClientes() {
    setLoadingCli(true)
    lpCli.reset()
    setBuscado(true)
    let q = supabaseAdmin
      .from('clientes')
      .select('*')
      .order('total_gasto', { ascending: false })
      .limit(200)
    if (busca.trim()) q = q.ilike('razao_social', `%${busca.trim()}%`)
    const { data } = await q
    lpCli.step()
    setClientes((data ?? []) as Cliente[])
    setLoadingCli(false)
  }

  async function buscarClientesRFM(segmento = filtroSegmento) {
    setLoadingRFM(true)
    setRfmBuscado(true)
    let q = supabaseAdmin
      .from('clientes')
      .select('id, cnpj, razao_social, ultima_compra, total_nfs, total_gasto, rfm_recencia, rfm_frequencia, rfm_valor, rfm_score, rfm_segmento, rfm_calculado_em')
      .not('rfm_segmento', 'is', null)
      .order('rfm_score', { ascending: false })
      .limit(500)
    if (segmento) q = q.eq('rfm_segmento', segmento)
    const { data } = await q
    setClientesRFM((data ?? []) as ClienteRFM[])
    setLoadingRFM(false)
  }

  async function recalcularRFM(silent = false) {
    setRecalculando(true)
    if (!silent) setRfmMsg(null)
    const { data, error } = await supabaseAdmin.rpc('fn_calcular_rfm')
    if (error) {
      if (!silent) setRfmMsg({ tipo: 'erro', texto: 'Erro ao recalcular: ' + error.message })
    } else {
      const res = data as { atualizados: number }
      if (!silent) setRfmMsg({ tipo: 'ok', texto: `RFM recalculado — ${res.atualizados} clientes atualizados.` })
      buscarClientesRFM(filtroSegmento)
    }
    setRecalculando(false)
  }

  function fmtBRL(v: number) {
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtData(v: string | null) {
    if (!v) return '—'
    const [y, m, d] = v.split('-')
    return `${d}/${m}/${y}`
  }

  function fmtCnpj(v: string) {
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  // ── IA: Análise de carteira RFM ──────────────────────────────────────────
  const analisarCarteira = useCallback(async () => {
    if (!clientesRFM.length) return 'Sem dados RFM. Recalcule primeiro.'
    const segmentos: Record<string, number> = {}
    let totalGasto = 0
    clientesRFM.forEach(c => {
      segmentos[c.rfm_segmento || 'sem_segmento'] = (segmentos[c.rfm_segmento || 'sem_segmento'] || 0) + 1
      totalGasto += c.total_gasto || 0
    })
    const resumoSeg = Object.entries(segmentos).map(([s, n]) => `${s}: ${n} clientes`).join(', ')
    const r = await aiChat({
      prompt: `Carteira de ${clientesRFM.length} clientes da Pousinox (fixadores de porcelanato inox):\nSegmentos RFM: ${resumoSeg}\nTotal gasto: R$ ${totalGasto.toFixed(2)}\nTop 5 clientes: ${clientesRFM.slice(0, 5).map(c => `${c.razao_social} (score ${c.rfm_score}, R$ ${(c.total_gasto || 0).toFixed(2)})`).join('; ')}\n\nAnalise: concentração de receita, saúde da carteira, risco de churn por segmento. Sugira 3-5 ações concretas (retenção VIPs, reativação inativos, desenvolvimento de novos).`,
      system: 'Analista de CRM B2B da Pousinox. Responda direto com dados e ações priorizadas. Português brasileiro.',
      model: 'groq',
    })
    return r.error ? `Erro: ${r.error}` : r.content
  }, [clientesRFM])

  // ── IA: Identificar produtos padrão ──────────────────────────────────────
  const identificarProdutosPadrao = useCallback(async () => {
    const { data: itens } = await supabaseAdmin
      .from('nf_itens')
      .select('descricao, quantidade, valor_unitario')
      .order('descricao')
      .limit(500)
    if (!itens?.length) return 'Sem itens de NF para analisar.'
    // Agrupar por descrição similar
    const grupos: Record<string, { qtd: number; valor: number; ocorrencias: number }> = {}
    itens.forEach(i => {
      const desc = (i.descricao || '').toUpperCase().trim()
      if (!desc) return
      if (!grupos[desc]) grupos[desc] = { qtd: 0, valor: 0, ocorrencias: 0 }
      grupos[desc].qtd += Number(i.quantidade) || 0
      grupos[desc].valor += Number(i.valor_unitario) || 0
      grupos[desc].ocorrencias++
    })
    // Top 30 mais vendidos
    const top = Object.entries(grupos)
      .sort((a, b) => b[1].ocorrencias - a[1].ocorrencias)
      .slice(0, 30)
      .map(([desc, d]) => `${desc}: ${d.ocorrencias}x vendido, qtd total ${d.qtd}, preço médio R$ ${(d.valor / d.ocorrencias).toFixed(2)}`)
      .join('\n')
    const r = await aiChat({
      prompt: `Itens mais vendidos nas NFs da Pousinox (fixadores de porcelanato inox):\n\n${top}\n\nAnalise e identifique:\n1. Quais itens têm potencial para virar PRODUTO PADRÃO de catálogo (vendidos para múltiplos clientes, demanda recorrente)\n2. Agrupe descrições similares que são o mesmo produto\n3. Sugira nome padronizado, preço sugerido e prioridade de cadastro\n4. Indique quais já parecem ter SKU definido vs quais são sob medida`,
      system: 'Analista de produto da Pousinox. Identifique padrões de venda para padronização do catálogo. Português brasileiro.',
      model: 'groq',
    })
    return r.error ? `Erro: ${r.error}` : r.content
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {/* Abas */}
      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'importar' ? styles.abaAtiva : ''}`} onClick={() => setAba('importar')}>
          ↑ Importar NFs
        </button>
        <button className={`${styles.aba} ${aba === 'clientes' ? styles.abaAtiva : ''}`} onClick={() => { setAba('clientes'); if (!buscado) buscarClientes() }}>
          👥 Clientes
        </button>
        <button className={`${styles.aba} ${aba === 'rfm' ? styles.abaAtiva : ''}`} onClick={() => { setAba('rfm'); if (!rfmBuscado) buscarClientesRFM() }}>
          📊 RFM
        </button>
        <button className={`${styles.aba} ${aba === 'recebidas' ? styles.abaAtiva : ''}`} onClick={() => { setAba('recebidas'); if (!nfsCarregadas) carregarNfsRecebidas() }}>
          ↓ NFs Recebidas
        </button>
      </div>

      {/* ── Aba Importar ── */}
      {aba === 'importar' && (
        <div className={styles.importWrap}>

          <div className={styles.info}>
            Importe os dois relatórios exportados do NFSTOK. O sistema consolida os clientes automaticamente e cruza com a base de prospecção.
          </div>

          <div className={styles.uploadRow}>
            {/* NF Cabeçalho */}
            <div
              className={`${styles.uploadBox} ${arquivoCab ? styles.uploadBoxOk : ''}`}
              onClick={() => refCab.current?.click()}
            >
              <input ref={refCab} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoCab(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📋</div>
              <div className={styles.uploadTitulo}>Relatório de NFs</div>
              <div className={styles.uploadSub}>
                {arquivoCab ? arquivoCab.name : 'Clique para selecionar o CSV de notas fiscais'}
              </div>
              <div className={styles.uploadDica}>nfe-emitidas_*.csv</div>
            </div>

            {/* NF Itens */}
            <div
              className={`${styles.uploadBox} ${arquivoItens ? styles.uploadBoxOk : ''}`}
              onClick={() => refItens.current?.click()}
            >
              <input ref={refItens} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoItens(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📦</div>
              <div className={styles.uploadTitulo}>Relatório de Itens</div>
              <div className={styles.uploadSub}>
                {arquivoItens ? arquivoItens.name : 'Clique para selecionar o CSV de itens'}
              </div>
              <div className={styles.uploadDica}>itens-nf-es-emitidas_*.csv</div>
            </div>
          </div>

          {erroImport && (
            <div className={styles.erro}>{erroImport}</div>
          )}

          <button
            className={styles.importBtn}
            onClick={importar}
            disabled={importando || (!arquivoCab && !arquivoItens)}
          >
            {importando ? progresso || 'Importando...' : '↑ Importar arquivos'}
          </button>

          {resultado && (
            <div className={styles.resultado}>
              <div className={styles.resultTitulo}>✅ Importação concluída</div>
              <div className={styles.resultGrid}>
                {arquivoCab && (
                  <div className={styles.resultCard}>
                    <span className={styles.resultLabel}>Notas Fiscais</span>
                    <span className={styles.resultVal}>{resultado.cabecalho.novos.toLocaleString('pt-BR')}</span>
                    <span className={styles.resultSub}>de {resultado.cabecalho.total.toLocaleString('pt-BR')} linhas</span>
                    {resultado.cabecalho.erros > 0 && <span className={styles.resultErro}>{resultado.cabecalho.erros} erros</span>}
                  </div>
                )}
                {arquivoItens && (
                  <div className={styles.resultCard}>
                    <span className={styles.resultLabel}>Itens importados</span>
                    <span className={styles.resultVal}>{resultado.itens.inseridos.toLocaleString('pt-BR')}</span>
                    <span className={styles.resultSub}>de {resultado.itens.total.toLocaleString('pt-BR')} linhas</span>
                    {resultado.itens.erros > 0 && <span className={styles.resultErro}>{resultado.itens.erros} erros</span>}
                  </div>
                )}
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>Clientes consolidados</span>
                  <span className={styles.resultVal}>{resultado.clientes.total.toLocaleString('pt-BR')}</span>
                  <span className={styles.resultSub}>base atualizada</span>
                </div>
              </div>
              <button className={styles.verClientesBtn} onClick={() => { setAba('clientes'); buscarClientes() }}>
                Ver clientes →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Clientes ── */}
      {aba === 'clientes' && (
        <div className={styles.clientesWrap}>
          <div className={styles.buscaRow}>
            <input
              className={styles.buscaInput}
              type="text"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarClientes()}
            />
            <button className={styles.buscarBtn} onClick={buscarClientes} disabled={loadingCli}>
              {loadingCli ? 'Buscando...' : 'Buscar'}
            </button>
            <button className={styles.buscarBtn} onClick={enriquecerClientes} disabled={enriquecendo} style={{ marginLeft: 8, background: '#059669' }}>
              {enriquecendo ? '⏳ Enriquecendo...' : '🔄 Enriquecer cadastros'}
            </button>
            <button className={styles.buscarBtn} onClick={normalizarSegmentos} disabled={normalizando} style={{ marginLeft: 8, background: '#7c3aed' }}>
              {normalizando ? '⏳ Normalizando...' : '🏷 Normalizar segmentos'}
            </button>
          </div>
          {enriqProgresso && (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: enriqProgresso.startsWith('✅') ? '#059669' : '#64748b', background: '#f0fdf4', borderRadius: 6, marginTop: 8 }}>
              {enriqProgresso}
            </div>
          )}
          {normProgresso && (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: normProgresso.startsWith('✅') ? '#7c3aed' : '#64748b', background: '#f5f3ff', borderRadius: 6, marginTop: 8 }}>
              {normProgresso}
            </div>
          )}

          {loadingCli && <AdminLoading total={lpCli.total} current={lpCli.current} label="Carregando clientes..." />}

          {!loadingCli && buscado && clientes.length === 0 && (
            <div className={styles.vazio}>Nenhum cliente encontrado. Importe os arquivos primeiro.</div>
          )}

          {!loadingCli && clientes.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.tableInfo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{clientes.length} clientes</span>
                <AiActionButton label="Produtos padrão" icon="🏷️" modelName="Groq" action={identificarProdutosPadrao} />
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {(['razao_social', 'cnpj', 'primeira_compra', 'ultima_compra', 'total_nfs', 'total_gasto'] as (keyof Cliente)[]).map((col) => {
                        const labels: Record<string, string> = { razao_social: 'Cliente', cnpj: 'CNPJ', primeira_compra: 'Primeira compra', ultima_compra: 'Última compra', total_nfs: 'NFs', total_gasto: 'Total gasto' }
                        const sortable = col !== 'cnpj'
                        const ativo = sortCol === col
                        return sortable ? (
                          <th key={col} className={styles.thSort} onClick={() => toggleSort(col)}>
                            <span className={styles.thSortInner}>
                              {labels[col]}
                              <span className={styles.thArrow} style={{ opacity: ativo ? 1 : 0.25 }}>
                                {ativo ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </span>
                          </th>
                        ) : (
                          <th key={col}>{labels[col]}</th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesSorted.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className={styles.nomeCliente}>{c.razao_social || '—'}</div>
                        </td>
                        <td className={styles.cnpj}>{fmtCnpj(c.cnpj)}</td>
                        <td className={styles.data}>{fmtData(c.primeira_compra)}</td>
                        <td className={styles.data}>{fmtData(c.ultima_compra)}</td>
                        <td className={styles.nfs}>{c.total_nfs}</td>
                        <td className={styles.valor}>{fmtBRL(c.total_gasto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba RFM ── */}
      {aba === 'rfm' && (
        <div className={styles.rfmWrap}>

          {/* Header: recalcular + filtro + timestamp */}
          {(() => {
            const calc = clientesRFM[0]?.rfm_calculado_em
            const stale = calc && Date.now() - new Date(calc).getTime() > 24 * 3600 * 1000
            const fmtCalc = calc
              ? new Date(calc).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : null
            return (
              <div className={styles.rfmHeader}>
                <div className={styles.rfmFiltros}>
                  <select
                    className={styles.filtroSelect}
                    value={filtroSegmento}
                    onChange={e => { setFiltroSegmento(e.target.value); buscarClientesRFM(e.target.value) }}>
                    <option value="">Todos os segmentos</option>
                    {Object.entries(SEGMENTO_CONFIG).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                  {fmtCalc && (
                    <span className={stale ? styles.rfmStale : styles.rfmTimestamp}>
                      {stale ? `⚠ Desatualizado · ${fmtCalc}` : `✓ Atualizado em ${fmtCalc}`}
                    </span>
                  )}
                  {recalculando && !rfmMsg && (
                    <span className={styles.rfmTimestamp}>Atualizando…</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <AiActionButton label="Análise de carteira" icon="📊" modelName="Groq" action={analisarCarteira} />
                  <button className={styles.recalcularBtn} onClick={() => recalcularRFM()} disabled={recalculando}>
                    {recalculando ? 'Recalculando...' : '↻ Recalcular RFM'}
                  </button>
                </div>
              </div>
            )
          })()}

          {rfmMsg && (
            <div className={`${styles.rfmMsg} ${rfmMsg.tipo === 'ok' ? styles.rfmMsgOk : styles.rfmMsgErro}`}>
              {rfmMsg.texto}
            </div>
          )}

          {loadingRFM && <div className={styles.loading}>Carregando...</div>}

          {!loadingRFM && rfmBuscado && clientesRFM.length === 0 && (
            <div className={styles.vazio}>
              Nenhum cliente com RFM calculado. Importe NFs e clique em "Recalcular RFM".
            </div>
          )}

          {!loadingRFM && clientesRFM.length > 0 && (
            <div className={styles.tableScroll}>
              <div className={styles.tableInfo}>{clientesRFM.length} clientes</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Segmento</th>
                    <th>Ação recomendada</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th style={{ textAlign: 'center' }}>R</th>
                    <th style={{ textAlign: 'center' }}>F</th>
                    <th style={{ textAlign: 'center' }}>V</th>
                    <th>Última compra</th>
                    <th>Total gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesRFM.map(c => {
                    const seg = c.rfm_segmento ?? ''
                    const cfg = SEGMENTO_CONFIG[seg]
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className={styles.nomeCliente}>{c.razao_social || '—'}</div>
                          <div className={styles.cnpjSub}>{fmtCnpj(c.cnpj)}</div>
                        </td>
                        <td>
                          {cfg ? (
                            <span className={styles[cfg.css as keyof typeof styles]}
                              title={cfg.estrategia}>
                              {cfg.label}
                            </span>
                          ) : (
                            <span className={styles.badgeRegular}>{seg || '—'}</span>
                          )}
                        </td>
                        <td>
                          {cfg ? (
                            <span className={styles.acaoLabel} title={cfg.estrategia}>
                              {cfg.acao}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong className={styles.scoreVal}>{c.rfm_score ?? '—'}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}><span className={styles.rfmPill}>{c.rfm_recencia ?? '—'}</span></td>
                        <td style={{ textAlign: 'center' }}><span className={styles.rfmPill}>{c.rfm_frequencia ?? '—'}</span></td>
                        <td style={{ textAlign: 'center' }}><span className={styles.rfmPill}>{c.rfm_valor ?? '—'}</span></td>
                        <td className={styles.data}>{fmtData(c.ultima_compra)}</td>
                        <td className={styles.valor}>{fmtBRL(c.total_gasto)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba NFs Recebidas ── */}
      {aba === 'recebidas' && (
        <div className={styles.importWrap}>

          <div className={styles.info}>
            Importe os relatórios de NFs recebidas do NFSTok. Cada NF autorizada gera automaticamente uma despesa pendente no financeiro. A baixa como pago só ocorre após conciliação com o extrato bancário.
          </div>

          <div className={styles.infoConciliacao}>
            💡 <strong>Fluxo:</strong> NF importada → despesa <em>pendente</em> no financeiro → extrato bancário confirma → status muda para <em>pago</em>
          </div>

          <div className={styles.uploadRow}>
            <div
              className={`${styles.uploadBox} ${arquivoRecCab ? styles.uploadBoxOk : ''}`}
              onClick={() => refRecCab.current?.click()}
            >
              <input ref={refRecCab} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoRecCab(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📋</div>
              <div className={styles.uploadTitulo}>Cabeçalho de NFs Recebidas</div>
              <div className={styles.uploadSub}>
                {arquivoRecCab ? arquivoRecCab.name : 'Clique para selecionar'}
              </div>
              <div className={styles.uploadDica}>nfe-recebidas_*.csv</div>
            </div>

            <div
              className={`${styles.uploadBox} ${arquivoRecItens ? styles.uploadBoxOk : ''}`}
              onClick={() => refRecItens.current?.click()}
            >
              <input ref={refRecItens} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoRecItens(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📦</div>
              <div className={styles.uploadTitulo}>Itens de NFs Recebidas</div>
              <div className={styles.uploadSub}>
                {arquivoRecItens ? arquivoRecItens.name : 'Clique para selecionar'}
              </div>
              <div className={styles.uploadDica}>itens-nf-es-recebidas_*.csv</div>
            </div>
          </div>

          {erroRec && <div className={styles.erro}>{erroRec}</div>}

          <button
            className={styles.importBtn}
            onClick={importarRecebidas}
            disabled={importandoRec || (!arquivoRecCab && !arquivoRecItens)}
          >
            {importandoRec ? progressoRec || 'Importando...' : '↓ Importar NFs recebidas'}
          </button>

          {resultadoRec && (
            <div className={styles.resultado}>
              <div className={styles.resultTitulo}>✅ Importação concluída</div>
              <div className={styles.resultGrid}>
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>NFs importadas</span>
                  <span className={styles.resultVal}>{resultadoRec.cabecalho}</span>
                  {resultadoRec.duplicatas > 0 && (
                    <span className={styles.resultSub}>{resultadoRec.duplicatas} já existiam (ignoradas)</span>
                  )}
                </div>
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>Itens importados</span>
                  <span className={styles.resultVal}>{resultadoRec.itens.toLocaleString('pt-BR')}</span>
                </div>
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>Despesas criadas</span>
                  <span className={styles.resultVal}>{resultadoRec.lancamentos}</span>
                  <span className={styles.resultSub}>pendentes no financeiro</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Listagem de NFs importadas com status financeiro ── */}
          {nfsCarregadas && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                  Documentos importados ({nfsRecebidas.length})
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {([
                    ['todas',    'Todas'],
                    ['sem_lanc', 'Sem lançamento'],
                    ['pendente', 'Pendente'],
                    ['pago',     'Pago'],
                  ] as const).map(([val, label]) => (
                    <button key={val}
                      onClick={() => setNfsFiltro(val)}
                      className={`${styles.aba} ${nfsFiltro === val ? styles.abaAtiva : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      {label}
                    </button>
                  ))}
                  <button onClick={carregarNfsRecebidas} disabled={loadingNfs}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#64748b' }}>
                    {loadingNfs ? '…' : '↻'}
                  </button>
                </div>
              </div>

              {loadingNfs ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '16px 0' }}>Carregando…</div>
              ) : (
                <div className={styles.tableWrap} style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className={styles.tabelaNfs}>
                    <thead>
                      <tr>
                        <th>NF / Série</th>
                        <th>CNPJ Fornecedor</th>
                        <th>Emissão</th>
                        <th>Valor</th>
                        <th>Status NF</th>
                        <th>Financeiro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfsRecebidas
                        .filter(nf => {
                          if (nfsFiltro === 'sem_lanc') return !nf.lancamento_id
                          if (nfsFiltro === 'pendente') return nf.fin_status === 'pendente'
                          if (nfsFiltro === 'pago')     return nf.fin_status === 'pago'
                          return true
                        })
                        .map(nf => (
                          <tr key={nf.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                              {nf.numero ?? '—'}{nf.serie ? ` / ${nf.serie}` : ''}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {nf.cnpj_fornecedor
                                ? nf.cnpj_fornecedor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem' }}>
                              {nf.emissao ? (() => { const [y,m,d] = nf.emissao!.split('-'); return `${d}/${m}/${y}` })() : '—'}
                            </td>
                            <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {nf.total != null ? 'R$ ' + Number(nf.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                                background: nf.status === 'Autorizadas' ? '#dcfce7' : '#f3f4f6',
                                color:      nf.status === 'Autorizadas' ? '#166534' : '#6b7280',
                              }}>{nf.status ?? '—'}</span>
                            </td>
                            <td>
                              {!nf.lancamento_id
                                ? <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>sem lançamento</span>
                                : nf.fin_status === 'pago'
                                  ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>✓ Pago #{nf.lancamento_id}</span>
                                  : nf.fin_status === 'pendente'
                                    ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>⏱ Pendente #{nf.lancamento_id}</span>
                                    : <span style={{ fontSize: '0.72rem', color: '#64748b' }}>#{nf.lancamento_id}</span>
                              }
                            </td>
                          </tr>
                        ))
                      }
                      {nfsRecebidas.filter(nf =>
                        nfsFiltro === 'todas'    ? true :
                        nfsFiltro === 'sem_lanc' ? !nf.lancamento_id :
                        nfsFiltro === 'pendente' ? nf.fin_status === 'pendente' :
                        nf.fin_status === 'pago'
                      ).length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px 0', fontSize: '0.85rem' }}>
                          Nenhum documento neste filtro.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
