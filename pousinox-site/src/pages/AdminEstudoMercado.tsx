import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { supabaseAdmin } from '../lib/supabase'
import { SearchableSelect } from '../components/SearchableSelect/SearchableSelect'
import s from './AdminEstudoMercado.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface Keyword {
  id: number
  termo: string
  cluster: string | null
  uf: string | null
  mesorregiao: string | null
  cidade: string | null
  segmento: string | null
  familia_produto: string | null
  volume_mensal: number
  intencao: string
  fonte: string
  camada: 'interna' | 'externa'
  trend_score: number | null
  variacao_yoy: number | null
  variacao_3m: number | null
  competicao: 'baixa' | 'media' | 'alta' | null
  ativo: boolean
  criado_em: string
}

interface NfRow { total: number; emissao: string; cnpj: string }
interface ClienteRow { cnpj: string; total_gasto: number | null; rfm_segmento: string | null }
interface ProspectRow { cnpj: string | null; uf: string | null; mesorregiao: string | null; segmento: string | null; cliente_ativo: boolean }

interface CrossUF {
  uf: string
  busca_volume: number
  vendas_total: number
  busca_norm: number
  vendas_norm: number
  score: number
  quadrant: 'oportunidade' | 'validado' | 'relacionamento' | 'baixa'
}

type TabId = 'visao' | 'busca' | 'externas' | 'cruzamento' | 'recomendacoes'

const INTENCAO_LABEL: Record<string, string> = {
  comercial: 'Comercial', transacional: 'Transacional',
  informacional: 'Informacional', navegacional: 'Navegacional',
}

const MESES_OPCOES = [
  { v: '3', l: 'Últimos 3 meses' }, { v: '6', l: 'Últimos 6 meses' },
  { v: '12', l: 'Últimos 12 meses' }, { v: '24', l: 'Últimos 24 meses' },
]

const FORM_ZERO = {
  termo: '', cluster: '', uf: '', mesorregiao: '', cidade: '',
  segmento: '', familia_produto: '', volume_mensal: '', intencao: 'comercial', fonte: 'manual',
}

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }
function fmtNum(v: number) { return v.toLocaleString('pt-BR') }
function normCnpj(v: string | null | undefined) { return (v ?? '').replace(/\D/g, '') }

function gerarResumo(crossing: CrossUF[]): string {
  if (!crossing.length) {
    return 'Ainda não há dados suficientes para uma leitura consolidada de demanda e presença neste recorte.'
  }

  const validados    = crossing.filter(r => r.quadrant === 'validado').map(r => r.uf)
  const oportunidades = crossing.filter(r => r.quadrant === 'oportunidade').map(r => r.uf)
  const relacionamento = crossing.filter(r => r.quadrant === 'relacionamento').map(r => r.uf)

  const listUFs = (ufs: string[]) =>
    ufs.length <= 2 ? ufs.join(' e ') : `${ufs.slice(0, -1).join(', ')} e ${ufs.at(-1)}`

  // Caso 1 — validados e oportunidades
  if (validados.length && oportunidades.length) {
    const v = validados.length === 1 ? `${validados[0]} aparece como mercado validado` : `${listUFs(validados)} aparecem como mercados validados`
    const o = oportunidades.length === 1
      ? `${oportunidades[0]} concentra a principal oportunidade de expansão`
      : `${listUFs(oportunidades)} concentram as principais oportunidades de expansão`
    return `${v} no período selecionado, enquanto ${o}.`
  }

  // Caso 2 — só oportunidades
  if (oportunidades.length && !validados.length) {
    const n = oportunidades.length
    const plural = n === 1 ? 'mercado a atacar' : 'mercados a atacar'
    const ufs = n <= 3 ? ` (${listUFs(oportunidades)})` : ''
    return `Este recorte mostra ${n} ${plural}${ufs}, com demanda acima da presença comercial atual da Pousinox.`
  }

  // Caso 3 — só validados
  if (validados.length && !oportunidades.length) {
    return `A presença comercial da Pousinox acompanha bem a demanda nas UFs analisadas — ${listUFs(validados)} ${validados.length === 1 ? 'está' : 'estão'} com mercado validado neste recorte.`
  }

  // Caso 4 — predomina relacionamento (baixa busca, alta venda)
  if (relacionamento.length >= crossing.length / 2) {
    return `O resultado sugere força comercial baseada em relacionamento, com menor pressão de busca ativa nas UFs analisadas${relacionamento.length <= 3 ? ` (${listUFs(relacionamento)})` : ''}.`
  }

  // Caso genérico — só baixa prioridade
  return 'Sem oportunidades relevantes neste recorte. A presença comercial acompanha a demanda nas UFs analisadas.'
}

function dataInicio(meses: string) {
  const d = new Date()
  d.setMonth(d.getMonth() - Number(meses))
  return d.toISOString().slice(0, 10)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminEstudoMercado() {
  const [tab, setTab] = useState<TabId>('visao')

  // Filtros globais
  const [meses, setMeses] = useState('12')
  const [filtroUF, setFiltroUF] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroFamilia, _setFiltroFamilia] = useState('')

  // Dados internos
  const [nfs, setNfs] = useState<NfRow[]>([])
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [prospectos, setProspectos] = useState<ProspectRow[]>([])
  const [loading, setLoading] = useState(false)

  // Keywords
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loadingKw, setLoadingKw] = useState(false)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(FORM_ZERO)
  const [editId, setEditId] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fileRef    = useRef<HTMLInputElement>(null)
  const fileRefExt = useRef<HTMLInputElement>(null)
  const [buscaExt, setBuscaExt] = useState('')
  const [filtroUFExt, setFiltroUFExt] = useState('')
  const [importandoExt, setImportandoExt] = useState(false)
  const [ufImport, setUfImport] = useState('')
  const [sortExt, setSortExt] = useState<{ col: string; asc: boolean }>({ col: 'volume_mensal', asc: false })
  const [sortScore, setSortScore] = useState<{ col: string; asc: boolean }>({ col: 'score', asc: false })

  // UFs distintas nos dados
  const ufsDisponiveis = useMemo(() => {
    const set = new Set<string>()
    prospectos.forEach(p => p.uf && set.add(p.uf))
    keywords.forEach(k => k.uf && set.add(k.uf))
    return Array.from(set).sort()
  }, [prospectos, keywords])

  const segmentosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    prospectos.forEach(p => p.segmento && set.add(p.segmento))
    keywords.forEach(k => k.segmento && set.add(k.segmento))
    return Array.from(set).sort()
  }, [prospectos, keywords])

  // ── Carregamento ──────────────────────────────────────────────────────────

  async function carregar() {
    setLoading(true)
    const inicio = dataInicio(meses)

    const [{ data: nfData }, { data: cliData }, { data: prospData }] = await Promise.all([
      supabaseAdmin.from('nf_cabecalho').select('total, emissao, cnpj').gte('emissao', inicio),
      supabaseAdmin.from('clientes').select('cnpj, total_gasto, rfm_segmento'),
      supabaseAdmin.from('prospeccao').select('cnpj, uf, mesorregiao, segmento, cliente_ativo').eq('cliente_ativo', true),
    ])
    setNfs((nfData ?? []) as NfRow[])
    setClientes((cliData ?? []) as ClienteRow[])
    setProspectos((prospData ?? []) as ProspectRow[])
    setLoading(false)
  }

  async function carregarKeywords() {
    setLoadingKw(true)
    const { data } = await supabaseAdmin
      .from('market_keywords')
      .select('*')
      .eq('ativo', true)
      .order('volume_mensal', { ascending: false })
    setKeywords((data ?? []) as Keyword[])
    setLoadingKw(false)
  }

  useEffect(() => { carregar(); carregarKeywords() }, []) // eslint-disable-line

  // ── Dados derivados ───────────────────────────────────────────────────────

  // cnpjs de clientes ativos filtrados por UF/segmento (via prospeccao)
  const cnpjsFiltrados = useMemo(() => {
    if (!filtroUF && !filtroSegmento) return null
    return new Set(
      prospectos
        .filter(p => p.cliente_ativo && (!filtroUF || p.uf === filtroUF) && (!filtroSegmento || p.segmento === filtroSegmento))
        .map(p => normCnpj(p.cnpj))
        .filter(Boolean)
    )
  }, [prospectos, filtroUF, filtroSegmento])

  const clientesFiltrados = useMemo(() =>
    clientes.filter(c => !cnpjsFiltrados || cnpjsFiltrados.has(normCnpj(c.cnpj)))
  , [clientes, cnpjsFiltrados])

  const nfsFiltradas = useMemo(() =>
    nfs.filter(n => !cnpjsFiltrados || cnpjsFiltrados.has(n.cnpj))
  , [nfs, cnpjsFiltrados])

  const kwFiltradas = useMemo(() => keywords.filter(k =>
    (!filtroUF || k.uf === filtroUF) &&
    (!filtroSegmento || k.segmento === filtroSegmento) &&
    (!filtroFamilia || k.familia_produto === filtroFamilia) &&
    (!busca || k.termo.toLowerCase().includes(busca.toLowerCase()) || (k.cluster ?? '').toLowerCase().includes(busca.toLowerCase()))
  ), [keywords, filtroUF, filtroSegmento, filtroFamilia, busca])

  // KPIs
  const kpis = useMemo(() => {
    const faturamento = nfsFiltradas.reduce((a, n) => a + (n.total ?? 0), 0)
    const clientesUnicos = new Set(nfsFiltradas.map(n => n.cnpj)).size
    const ticket = clientesUnicos > 0 ? faturamento / clientesUnicos : 0
    const cnpjsAtivos = new Set(clientesFiltrados.map(c => normCnpj(c.cnpj)))
    const ufsAtendidas = new Set(prospectos.filter(p => p.cliente_ativo && p.uf && cnpjsAtivos.has(normCnpj(p.cnpj))).map(p => p.uf)).size
    const volBusca = kwFiltradas.reduce((a, k) => a + (k.volume_mensal ?? 0), 0)
    return { faturamento, clientesUnicos, ticket, ufsAtendidas, volBusca }
  }, [nfsFiltradas, clientesFiltrados, kwFiltradas, prospectos])

  // Sales por UF — join clientes (total_gasto) com prospeccao (uf) via cnpj normalizado
  const vendasPorUF = useMemo(() => {
    const gastoPorCnpj = new Map(clientes.map(c => [normCnpj(c.cnpj), c.total_gasto ?? 0]))
    const map = new Map<string, number>()
    prospectos.filter(p => p.cliente_ativo && p.uf && p.cnpj).forEach(p => {
      const gasto = gastoPorCnpj.get(normCnpj(p.cnpj)) ?? 0
      map.set(p.uf!, (map.get(p.uf!) ?? 0) + gasto)
    })
    return Array.from(map.entries())
      .map(([uf, total]) => ({ uf, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
  }, [clientes, prospectos])

  // Keywords por UF
  const kwPorUF = useMemo(() => {
    const map = new Map<string, number>()
    keywords.filter(k => k.uf).forEach(k => {
      map.set(k.uf!, (map.get(k.uf!) ?? 0) + k.volume_mensal)
    })
    return map
  }, [keywords])

  // Cruzamento UF
  const crossing = useMemo((): CrossUF[] => {
    const ufs = new Set([...vendasPorUF.map(v => v.uf), ...Array.from(kwPorUF.keys())])
    if (!ufs.size) return []

    const rows = Array.from(ufs).map(uf => ({
      uf,
      busca_volume: kwPorUF.get(uf) ?? 0,
      vendas_total: vendasPorUF.find(v => v.uf === uf)?.total ?? 0,
      busca_norm: 0, vendas_norm: 0, score: 0, quadrant: 'baixa' as CrossUF['quadrant'],
    }))

    const maxBusca = Math.max(...rows.map(r => r.busca_volume), 1)
    const maxVendas = Math.max(...rows.map(r => r.vendas_total), 1)

    return rows.map(r => {
      const bn = r.busca_volume / maxBusca
      const vn = r.vendas_total / maxVendas
      const score = Math.round(bn * (1 - vn) * 100)
      const quadrant: CrossUF['quadrant'] =
        bn >= 0.5 && vn < 0.5  ? 'oportunidade'
        : bn >= 0.5 && vn >= 0.5 ? 'validado'
        : bn < 0.5  && vn >= 0.5 ? 'relacionamento'
        : 'baixa'
      return { ...r, busca_norm: bn, vendas_norm: vn, score, quadrant }
    }).sort((a, b) => b.score - a.score)
  }, [vendasPorUF, kwPorUF])

  // Sales por segmento — join clientes com prospeccao via cnpj
  const vendasPorSegmento = useMemo(() => {
    const gastoPorCnpj = new Map(clientes.map(c => [normCnpj(c.cnpj), c.total_gasto ?? 0]))
    const map = new Map<string, number>()
    prospectos.filter(p => p.cliente_ativo && p.cnpj).forEach(p => {
      const seg = p.segmento ?? 'Outros'
      map.set(seg, (map.get(seg) ?? 0) + (gastoPorCnpj.get(normCnpj(p.cnpj)) ?? 0))
    })
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [clientes, prospectos])

  // Chart cruzamento (BarChart comparativo por UF)
  const chartCross = useMemo(() => crossing.slice(0, 10).map(r => ({
    uf: r.uf,
    'Busca (norm.)': Math.round(r.busca_norm * 100),
    'Vendas (norm.)': Math.round(r.vendas_norm * 100),
  })), [crossing])

  // Max volume para barra relativa
  const maxVolKw = useMemo(() => Math.max(...kwFiltradas.map(k => k.volume_mensal), 1), [kwFiltradas])

  // ── Oportunidades Externas ────────────────────────────────────────────────

  const kwExternas = useMemo(() => keywords.filter(k =>
    k.camada === 'externa' &&
    (!filtroUFExt || k.uf === filtroUFExt) &&
    (!buscaExt || k.termo.toLowerCase().includes(buscaExt.toLowerCase()) || (k.cluster ?? '').toLowerCase().includes(buscaExt.toLowerCase()))
  ), [keywords, filtroUFExt, buscaExt])

  const maxVolExt = useMemo(() => Math.max(...kwExternas.map(k => k.volume_mensal), 1), [kwExternas])

  // Score externo por UF: combina volume, trend e gap de presença comercial
  const scoreExternoUF = useMemo(() => {
    const volPorUF = new Map<string, { volume: number; trend: number; termos: number }>()
    kwExternas.filter(k => k.uf).forEach(k => {
      const prev = volPorUF.get(k.uf!) ?? { volume: 0, trend: 0, termos: 0 }
      volPorUF.set(k.uf!, {
        volume: prev.volume + k.volume_mensal,
        trend: Math.max(prev.trend, k.trend_score ?? 0),
        termos: prev.termos + 1,
      })
    })
    const maxVol   = Math.max(...Array.from(volPorUF.values()).map(v => v.volume), 1)
    const maxVendas = Math.max(...vendasPorUF.map(v => v.total), 1)

    return Array.from(volPorUF.entries()).map(([uf, v]) => {
      const volNorm   = v.volume / maxVol
      const trendNorm = v.trend / 100
      const vendas    = vendasPorUF.find(r => r.uf === uf)?.total ?? 0
      const gapNorm   = 1 - (vendas / maxVendas)
      const score     = Math.round((volNorm * 0.5 + trendNorm * 0.2 + gapNorm * 0.3) * 100)
      return { uf, volume: v.volume, termos: v.termos, trend: v.trend, vendas, score }
    }).sort((a, b) => b.score - a.score)
  }, [kwExternas, vendasPorUF])

  // Recomendações
  const recomendacoes = useMemo(() => {
    const out: { tipo: CrossUF['quadrant'] | 'atencao'; titulo: string; sub: string; chips: string[] }[] = []
    const top = crossing.slice(0, 8)
    top.forEach(r => {
      if (r.quadrant === 'oportunidade') {
        out.push({
          tipo: 'oportunidade',
          titulo: `${r.uf} — Alta demanda de busca, baixa presença comercial`,
          sub: `Volume de busca ${fmtNum(r.busca_volume)}/mês · Vendas atuais ${fmtBRL(r.vendas_total)} · Score ${r.score}`,
          chips: ['Prospecção ativa', 'Conteúdo regional', 'Campanha direcionada'],
        })
      } else if (r.quadrant === 'validado') {
        out.push({
          tipo: 'validado',
          titulo: `${r.uf} — Mercado validado, ampliar presença`,
          sub: `Alta busca e alta venda. Boa aderência entre demanda e histórico. Score ${r.score}`,
          chips: ['Fidelização', 'Upsell', 'Casos de sucesso'],
        })
      } else if (r.quadrant === 'relacionamento') {
        out.push({
          tipo: 'atencao',
          titulo: `${r.uf} — Vendas por relacionamento, busca digital baixa`,
          sub: `Histórico forte mas baixo interesse de busca. Potencial SEO inexplorado. Score ${r.score}`,
          chips: ['SEO local', 'Conteúdo de caso', 'Google Business'],
        })
      }
    })

    // Recomendações de keywords — UFs sem venda e não cobertas pelo crossing
    const ufsJaCovertas = new Set(top.map(r => r.uf))
    const kwSemVendaPorUF = new Map<string, Keyword>()
    kwFiltradas
      .filter(k => k.uf && !ufsJaCovertas.has(k.uf) && !vendasPorUF.find(v => v.uf === k.uf))
      .forEach(k => {
        const atual = kwSemVendaPorUF.get(k.uf!)
        if (!atual || k.volume_mensal > atual.volume_mensal) kwSemVendaPorUF.set(k.uf!, k)
      })
    Array.from(kwSemVendaPorUF.values()).slice(0, 4).forEach(k => {
      const volTotal = kwPorUF.get(k.uf!) ?? k.volume_mensal
      out.push({
        tipo: 'oportunidade',
        titulo: `${k.uf} — Demanda de busca sem presença comercial registrada`,
        sub: `${fmtNum(volTotal)} buscas/mês na região · Maior termo: "${k.termo}" · Cluster: ${k.cluster ?? '—'}`,
        chips: ['Prospecção ativa', 'Criar página', k.segmento ?? ''].filter(Boolean),
      })
    })

    return out.slice(0, 12)
  }, [crossing, kwFiltradas, kwPorUF, vendasPorUF])

  // ── Keywords CRUD ─────────────────────────────────────────────────────────

  function abrirForm(kw?: Keyword) {
    if (kw) {
      setForm({
        termo: kw.termo, cluster: kw.cluster ?? '', uf: kw.uf ?? '',
        mesorregiao: kw.mesorregiao ?? '', cidade: kw.cidade ?? '',
        segmento: kw.segmento ?? '', familia_produto: kw.familia_produto ?? '',
        volume_mensal: String(kw.volume_mensal), intencao: kw.intencao, fonte: kw.fonte,
      })
      setEditId(kw.id)
    } else {
      setForm(FORM_ZERO)
      setEditId(null)
    }
    setShowForm(true)
  }

  async function salvarKeyword() {
    if (!form.termo.trim()) return
    setSalvando(true)
    const payload = {
      termo: form.termo.trim(), cluster: form.cluster || null,
      uf: form.uf || null, mesorregiao: form.mesorregiao || null,
      cidade: form.cidade || null, segmento: form.segmento || null,
      familia_produto: form.familia_produto || null,
      volume_mensal: Number(form.volume_mensal) || 0,
      intencao: form.intencao, fonte: form.fonte,
    }
    if (editId) {
      await supabaseAdmin.from('market_keywords').update(payload).eq('id', editId)
    } else {
      await supabaseAdmin.from('market_keywords').insert(payload)
    }
    setSalvando(false)
    setShowForm(false)
    carregarKeywords()
  }

  async function excluirKeyword(id: number) {
    if (!confirm('Excluir esta palavra-chave?')) return
    await supabaseAdmin.from('market_keywords').update({ ativo: false }).eq('id', id)
    setKeywords(prev => prev.filter(k => k.id !== id))
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const texto = await file.text()
    const linhas = texto.split('\n').filter(l => l.trim())
    const lote = linhas.slice(1).map(linha => {
      const c = linha.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      return {
        termo: c[0], cluster: c[1] || null, uf: c[2] || null,
        mesorregiao: c[3] || null, cidade: c[4] || null,
        segmento: c[5] || null, familia_produto: c[6] || null,
        volume_mensal: Number(c[7]) || 0,
        intencao: c[8] || 'comercial', fonte: 'csv',
      }
    }).filter(r => r.termo)
    if (!lote.length) return
    for (let i = 0; i < lote.length; i += 200) {
      await supabaseAdmin.from('market_keywords').insert(lote.slice(i, i + 200))
    }
    e.target.value = ''
    carregarKeywords()
  }

  async function importarGKP(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportandoExt(true)

    const texto = await file.text()
    const todasLinhas = texto.split('\n')

    // ── Detecta delimitador (GKP usa "\t", PT-BR às vezes ";", CSV padrão ",") ──
    const amostra = todasLinhas.slice(0, 5).join('')
    const sep = amostra.includes('\t') ? '\t' : amostra.includes(';') ? ';' : ','

    function parseLinha(linha: string): string[] {
      // Respeita aspas e remove espaços extras
      const result: string[] = []
      let cur = '', inQ = false
      for (const ch of linha) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === sep && !inQ) { result.push(cur.trim()); cur = '' }
        else cur += ch
      }
      result.push(cur.trim())
      return result
    }

    // ── Detecta formato estendido (nossa CSV com header "termo,volume_mensal,…") ──
    const primeiraCols = parseLinha(todasLinhas[0]).map(h => h.toLowerCase())
    const isExtended = primeiraCols.includes('termo') && primeiraCols.includes('volume_mensal')

    // ── Localiza linha de cabeçalho real do GKP (ignora metadados — busca até linha 20) ──
    let headerIdx = -1
    if (!isExtended) {
      for (let i = 0; i < Math.min(todasLinhas.length, 20); i++) {
        const l = todasLinhas[i].toLowerCase()
        if (l.includes('keyword') || l.includes('palavra-chave')) {
          headerIdx = i
          break
        }
      }
    }

    const isGKP = !isExtended && headerIdx >= 0
    const dataStart = isExtended ? 1 : isGKP ? headerIdx + 1 : 1
    const headerCols = isGKP ? parseLinha(todasLinhas[headerIdx]).map(h => h.toLowerCase()) : []

    // Índices das colunas no GKP (flexível para EN e PT-BR)
    // Header real: Keyword | Currency | Avg. monthly searches | Mudança em três meses | Mudança YoY | Competition | Competition (indexed value) | ...
    const iKeyword  = headerCols.findIndex(h => h === 'keyword' || h.includes('palavra-chave'))
    const iVol      = headerCols.findIndex(h => h.includes('monthly') || h.includes('mensais') || h.includes('médias'))
    const iVar3m    = headerCols.findIndex(h => h.includes('três meses') || h.includes('three month') || h.includes('3 month'))
    const iYoy      = headerCols.findIndex(h => h.includes('yoy') || (h.includes('mudança') && h.includes('ano')))
    const iComp     = headerCols.findIndex(h => h === 'competition' || h === 'competição')
    const iTrend    = headerCols.findIndex(h => h.includes('indexed') || h.includes('índice'))

    function mapComp(v: string): 'baixa' | 'media' | 'alta' | null {
      const l = v.toLowerCase().trim()
      if (l === 'alto' || l === 'alta' || l.includes('high')) return 'alta'
      if (l === 'baixo' || l === 'baixa' || l.includes('low')) return 'baixa'
      if (l === 'médio' || l === 'média' || l.includes('med')) return 'media'
      return null
    }

    const lote = todasLinhas
      .slice(dataStart)
      .filter(l => l.trim())
      .map(linha => {
        const c = parseLinha(linha)
        if (!c[0] || c[0].toLowerCase().includes('keyword') || c[0].toLowerCase().includes('palavra') || c[0].toLowerCase() === 'termo') return null

        if (isExtended) {
          // Formato estendido com header — usa índices do header
          const idx = (name: string) => primeiraCols.indexOf(name)
          return {
            termo: c[idx('termo')] || '',
            volume_mensal: Number(c[idx('volume_mensal')]) || 0,
            variacao_3m:   c[idx('var_3m')]  ? Number(c[idx('var_3m')])  : null,
            variacao_yoy:  c[idx('var_yoy')] ? Number(c[idx('var_yoy')]) : null,
            competicao: (['baixa','media','alta'].includes(c[idx('competicao')] ?? '') ? c[idx('competicao')] : null) as 'baixa'|'media'|'alta'|null,
            trend_score: c[idx('trend_score')] ? Number(c[idx('trend_score')]) : null,
            uf: c[idx('uf')] || null,
            mesorregiao: c[idx('mesorregiao')] || null,
            cluster: c[idx('cluster')] || null,
            segmento: c[idx('segmento')] || null,
            fonte: 'csv', camada: 'externa', intencao: 'comercial', ativo: true,
          }
        }

        if (isGKP) {
          const ki  = iKeyword >= 0 ? iKeyword : 0
          const vi  = iVol     >= 0 ? iVol     : 2
          const v3i = iVar3m   >= 0 ? iVar3m   : 3
          const yi  = iYoy     >= 0 ? iYoy     : 4
          const ci  = iComp    >= 0 ? iComp    : 5
          const ti  = iTrend   >= 0 ? iTrend   : -1
          const vol   = Number((c[vi]  ?? '').replace(/[^\d]/g, '')) || 0
          const var3m = c[v3i] ? parseInt((c[v3i] ?? '').replace(/[^\d-]/g, '')) || null : null
          const yoy   = c[yi]  ? parseInt((c[yi]  ?? '').replace(/[^\d-]/g, '')) || null : null
          const trend = ti >= 0 && c[ti] ? Number((c[ti] ?? '').replace(/[^\d.]/g, '')) || null : null
          return {
            termo: c[ki] || '', volume_mensal: vol,
            variacao_3m: var3m, variacao_yoy: yoy,
            competicao: mapComp(c[ci] ?? ''),
            trend_score: trend !== null ? Math.round(trend) : null,
            uf: ufImport || null,
            fonte: 'google_ads', camada: 'externa', intencao: 'comercial', ativo: true,
          }
        }

        // Formato estendido: termo, volume, var_3m, var_yoy, competicao, trend_score, uf, mesorregiao, cluster, segmento
        return {
          termo: c[0], volume_mensal: Number(c[1]) || 0,
          variacao_3m:  c[2] ? Number(c[2]) : null,
          variacao_yoy: c[3] ? Number(c[3]) : null,
          competicao: (['baixa','media','alta'].includes(c[4] ?? '') ? c[4] : null) as 'baixa'|'media'|'alta'|null,
          trend_score: c[5] ? Number(c[5]) : null,
          uf: c[6] || null, mesorregiao: c[7] || null,
          cluster: c[8] || null, segmento: c[9] || null,
          fonte: 'csv', camada: 'externa', intencao: 'comercial', ativo: true,
        }
      })
      .filter((r): r is NonNullable<typeof r> => !!r?.termo)

    for (let i = 0; i < lote.length; i += 200) {
      await supabaseAdmin.from('market_keywords').insert(lote.slice(i, i + 200))
    }
    e.target.value = ''
    setImportandoExt(false)
    carregarKeywords()
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function QuadrantMatrix() {
    const groups: Record<CrossUF['quadrant'], CrossUF[]> = {
      oportunidade: crossing.filter(r => r.quadrant === 'oportunidade'),
      validado: crossing.filter(r => r.quadrant === 'validado'),
      relacionamento: crossing.filter(r => r.quadrant === 'relacionamento'),
      baixa: crossing.filter(r => r.quadrant === 'baixa'),
    }
    return (
      <div>
        <div className={s.quadrantGrid}>
          <div className={`${s.quadrant} ${s['q-alta-oportunidade']}`}>
            <div className={s.quadrantLabel}>🟢 Alta busca · Baixa venda — Mercado a atacar</div>
            <div className={s.quadrantItems}>
              {groups.oportunidade.map(r => (
                <span key={r.uf} className={s.quadrantTag}>{r.uf} <span className={s.quadrantScore}>{r.score}</span></span>
              ))}
              {!groups.oportunidade.length && <span className={s.quadrantScore}>—</span>}
            </div>
          </div>
          <div className={`${s.quadrant} ${s['q-validado']}`}>
            <div className={s.quadrantLabel}>🔵 Alta busca · Alta venda — Mercado validado</div>
            <div className={s.quadrantItems}>
              {groups.validado.map(r => (
                <span key={r.uf} className={s.quadrantTag}>{r.uf} <span className={s.quadrantScore}>{r.score}</span></span>
              ))}
              {!groups.validado.length && <span className={s.quadrantScore}>—</span>}
            </div>
          </div>
          <div className={`${s.quadrant} ${s['q-relacionamento']}`}>
            <div className={s.quadrantLabel}>🟡 Baixa busca · Alta venda — Relacionamento</div>
            <div className={s.quadrantItems}>
              {groups.relacionamento.map(r => (
                <span key={r.uf} className={s.quadrantTag}>{r.uf} <span className={s.quadrantScore}>{r.score}</span></span>
              ))}
              {!groups.relacionamento.length && <span className={s.quadrantScore}>—</span>}
            </div>
          </div>
          <div className={`${s.quadrant} ${s['q-baixa']}`}>
            <div className={s.quadrantLabel}>⚪ Baixa busca · Baixa venda — Baixa prioridade</div>
            <div className={s.quadrantItems}>
              {groups.baixa.map(r => (
                <span key={r.uf} className={s.quadrantTag}>{r.uf}</span>
              ))}
              {!groups.baixa.length && <span className={s.quadrantScore}>—</span>}
            </div>
          </div>
        </div>
        <div className={s.quadrantAxes}>
          <span>← presença comercial baixa</span>
          <span>presença comercial alta →</span>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1>📊 Estudo de Mercado</h1>
        <p>Cruzamento entre histórico interno da Pousinox e demanda de busca regional para identificar mercados validados, oportunidades e prioridades comerciais.</p>
      </div>

      {/* Filtros */}
      <div className={s.filtros}>
        <div className={s.filtroGrupo}>
          <label>Período</label>
          <select value={meses} onChange={e => setMeses(e.target.value)}>
            {MESES_OPCOES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div className={s.filtroGrupo}>
          <label>UF</label>
          <SearchableSelect
            value={filtroUF}
            onChange={setFiltroUF}
            options={ufsDisponiveis.map(uf => ({ value: uf, label: uf }))}
            placeholder="Todas"
            searchPlaceholder="Buscar UF…"
            minWidth={110}
          />
        </div>
        <div className={s.filtroGrupo}>
          <label>Segmento</label>
          <SearchableSelect
            value={filtroSegmento}
            onChange={setFiltroSegmento}
            options={segmentosDisponiveis.map(sg => ({ value: sg, label: sg }))}
            placeholder="Todos"
            searchPlaceholder="Buscar segmento…"
            minWidth={180}
          />
        </div>
        <button className={s.btnFiltrar} onClick={carregar}>Aplicar</button>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        {([
          ['visao', '📊 Visão Geral'],
          ['busca', '🔍 Busca Regional'],
          ['externas', '🌐 Oportunidades Externas'],
          ['cruzamento', '⚡ Cruzamento'],
          ['recomendacoes', '💡 Recomendações'],
        ] as [TabId, string][]).map(([id, label]) => (
          <button key={id} className={`${s.tab} ${tab === id ? s.tabAtiva : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className={s.loading}>Carregando dados…</div>}

      {/* ── Tab: Visão Geral ── */}
      {tab === 'visao' && !loading && (
        <>
          <div className={s.resumoCard}>
            <span className={s.resumoIcone}>💬</span>
            <p className={s.resumoTexto}>{gerarResumo(crossing)}</p>
          </div>

          <div className={s.kpiGrid}>
            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>Faturamento</span>
              <span className={s.kpiValor}>{fmtBRL(kpis.faturamento)}</span>
              <span className={s.kpiSub}>período selecionado</span>
            </div>
            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>Clientes únicos</span>
              <span className={s.kpiValor}>{fmtNum(kpis.clientesUnicos)}</span>
              <span className={s.kpiSub}>com compra no período</span>
            </div>
            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>Ticket médio</span>
              <span className={s.kpiValor}>{fmtBRL(kpis.ticket)}</span>
              <span className={s.kpiSub}>por cliente</span>
            </div>
            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>UFs atendidas</span>
              <span className={s.kpiValor}>{kpis.ufsAtendidas}</span>
              <span className={s.kpiSub}>com histórico de venda</span>
            </div>
            <div className={`${s.kpiCard} ${s.destaque}`}>
              <span className={s.kpiLabel}>Volume de busca</span>
              <span className={s.kpiValor}>{fmtNum(kpis.volBusca)}</span>
              <span className={s.kpiSub}>/mês (keywords cadastradas)</span>
            </div>
            <div className={`${s.kpiCard} ${s.destaque}`}>
              <span className={s.kpiLabel}>Oportunidades</span>
              <span className={s.kpiValor}>{crossing.filter(r => r.quadrant === 'oportunidade').length}</span>
              <span className={s.kpiSub}>
                {crossing.filter(r => r.quadrant === 'oportunidade').length === 1
                  ? '1 oportunidade identificada — alta busca, baixa presença'
                  : 'UFs com alta busca / baixa presença comercial'}
              </span>
            </div>
          </div>

          <div className={s.section}>
            <div className={s.sectionTitle}>Demanda × Presença por UF <span>normalizado 0–100 · quanto maior o score, maior o gap entre busca e presença comercial</span></div>
            {crossing.length === 0
              ? <div className={s.empty}>Sem histórico suficiente para esta combinação de filtros. Ajuste UF, segmento ou período para ampliar a leitura.</div>
              : <QuadrantMatrix />}
          </div>

          <div className={s.chartRow}>
            <div className={s.chartCard}>
              <div className={s.chartCardTitle}>Vendas por UF (top 10)</div>
              {vendasPorUF.length === 0
                ? <div className={s.empty} style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sem dados para este recorte.<br/>Ajuste os filtros ou importe histórico de NFs.</div>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={vendasPorUF.slice(0, 10)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtBRL(v).replace('R$', '')} />
                      { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Bar dataKey="total" fill="#1a3a5c" name="Faturamento" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>}
            </div>
            <div className={s.chartCard}>
              <div className={s.chartCardTitle}>Vendas por Segmento (top 8)</div>
              {vendasPorSegmento.length === 0
                ? <div className={s.empty} style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cruzamento entre clientes e prospects não encontrou segmento.<br/>Verifique se os CNPJs estão na base de prospecção.</div>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={vendasPorSegmento} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtBRL(v).replace('R$', '')} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} />
                      { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Bar dataKey="total" fill="#2d6a9f" name="Faturamento" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>}
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Busca Regional ── */}
      {tab === 'busca' && (
        <>
          <div className={s.toolbar}>
            <button className={s.btnPrimario} onClick={() => abrirForm()}>+ Adicionar keyword</button>
            <button className={s.btnSecundario} onClick={() => fileRef.current?.click()}>📥 Importar CSV</button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importarCSV} />
            <input
              className={s.searchInput}
              placeholder="Buscar termo ou cluster…"
              value={busca} onChange={e => setBusca(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>
              {kwFiltradas.length} keywords · {fmtNum(kwFiltradas.reduce((a, k) => a + k.volume_mensal, 0))} buscas/mês
            </span>
          </div>

          {showForm && (
            <div className={s.formCard}>
              {(['termo', 'cluster', 'uf', 'mesorregiao', 'cidade', 'segmento', 'familia_produto', 'volume_mensal'] as const).map(key => (
                <div key={key} className={s.formField}>
                  <label>{key.replace('_', ' ')}</label>
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={key === 'volume_mensal' ? '0' : ''} />
                </div>
              ))}
              <div className={s.formField}>
                <label>Intenção</label>
                <select value={form.intencao} onChange={e => setForm(f => ({ ...f, intencao: e.target.value }))}>
                  {Object.entries(INTENCAO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className={s.formActions}>
                <button className={s.btnPrimario} onClick={salvarKeyword} disabled={salvando}>
                  {salvando ? 'Salvando…' : editId ? 'Atualizar' : 'Salvar'}
                </button>
                <button className={s.btnSecundario} onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Termo</th>
                  <th>Cluster</th>
                  <th>UF</th>
                  <th>Mesorregião</th>
                  <th>Segmento</th>
                  <th>Família</th>
                  <th>Volume/mês</th>
                  <th>Intenção</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loadingKw && (
                  <tr><td colSpan={9} className={s.loading}>Carregando…</td></tr>
                )}
                {!loadingKw && kwFiltradas.length === 0 && (
                  <tr><td colSpan={9} className={s.empty}>Nenhuma keyword cadastrada para este recorte. Importe termos para liberar o cruzamento entre demanda e vendas.</td></tr>
                )}
                {kwFiltradas.map(k => (
                  <tr key={k.id}>
                    <td><strong>{k.termo}</strong></td>
                    <td>{k.cluster ?? '—'}</td>
                    <td>{k.uf ?? '—'}</td>
                    <td>{k.mesorregiao ?? '—'}</td>
                    <td>{k.segmento ?? '—'}</td>
                    <td>{k.familia_produto ?? '—'}</td>
                    <td>
                      <div className={s.volumeBar}>
                        {fmtNum(k.volume_mensal)}
                        <div className={s.volumeBarTrack}>
                          <div className={s.volumeBarFill} style={{ width: `${Math.round((k.volume_mensal / maxVolKw) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${s.badgeIntencao} ${s[`int-${k.intencao}`]}`}>
                        {INTENCAO_LABEL[k.intencao]}
                      </span>
                    </td>
                    <td>
                      <div className={s.tdAcoes}>
                        <button className={s.btnSecundario} style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          onClick={() => abrirForm(k)}>✏️</button>
                        <button className={s.btnDanger} onClick={() => excluirKeyword(k.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#aaa' }}>
            Formato CSV: termo, cluster, uf, mesorregiao, cidade, segmento, familia_produto, volume_mensal, intencao
          </div>
        </>
      )}

      {/* ── Tab: Oportunidades Externas ── */}
      {tab === 'externas' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
            background: '#f5f7fa', border: '1px solid #e0e4ea', borderRadius: 8, padding: '10px 16px' }}>

            {/* UF do import */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UF do import</label>
              <SearchableSelect
                value={ufImport}
                onChange={setUfImport}
                options={['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => ({ value: uf, label: uf }))}
                placeholder="Nacional (todas)"
                searchPlaceholder="Buscar UF…"
                minWidth={140}
              />
            </div>

            <button className={s.btnPrimario} onClick={() => fileRefExt.current?.click()} disabled={importandoExt}
              style={{ marginTop: 18 }}>
              {importandoExt ? 'Importando…' : '📥 Importar Google KP / CSV'}
            </button>
            <input ref={fileRefExt} type="file" accept=".csv" style={{ display: 'none' }} onChange={importarGKP} />

            <div style={{ width: 1, height: 32, background: '#d0d7de', margin: '0 4px', alignSelf: 'flex-end', marginBottom: 2 }} />

            {/* Filtro UF visualização */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UF</label>
              <SearchableSelect
                value={filtroUFExt}
                onChange={setFiltroUFExt}
                options={ufsDisponiveis.map(uf => ({ value: uf, label: uf }))}
                placeholder="Todas"
                searchPlaceholder="Buscar UF…"
                minWidth={100}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Buscar</label>
              <input className={s.searchInput} placeholder="Termo ou cluster…"
                value={buscaExt} onChange={e => setBuscaExt(e.target.value)} style={{ minWidth: 200 }} />
            </div>
            <span style={{ fontSize: '0.78rem', color: '#888', marginLeft: 'auto', alignSelf: 'flex-end', paddingBottom: 2 }}>
              {kwExternas.length} termos · {fmtNum(kwExternas.reduce((a, k) => a + k.volume_mensal, 0))} buscas/mês
            </span>
          </div>

          {kwExternas.length === 0 ? (
            <div className={s.empty} style={{ padding: 40 }}>
              <strong>Nenhum dado externo cadastrado.</strong><br /><br />
              Importe um CSV do Google Keyword Planner ou no formato estendido:<br />
              <code style={{ fontSize: '0.75rem', color: '#555' }}>
                termo, volume_mensal, var_3m%, var_yoy%, competicao, trend_score(0-100), uf, mesorregiao, cluster, segmento
              </code>
              <br /><br />
              Dados do Google Trends também são aceitos no formato nativo de exportação.
            </div>
          ) : (
            <>
              {/* Score externo por UF */}
              <div className={s.section}>
                <div className={s.sectionTitle}>Score de oportunidade externa por UF
                  <span>volume × tendência × gap de presença</span>
                </div>
                <div className={s.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        {([
                          { col: 'uf', label: 'UF' },
                          { col: 'termos', label: 'Termos' },
                          { col: 'volume', label: 'Volume externo /mês' },
                          { col: 'trend', label: 'Trend máx.' },
                          { col: 'vendas', label: 'Vendas internas' },
                          { col: 'score', label: 'Score externo' },
                          { col: 'leitura', label: 'Leitura' },
                        ] as { col: string; label: string }[]).map(({ col, label }) => (
                          <th key={col}
                            style={{ cursor: col !== 'leitura' ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                            onClick={() => col !== 'leitura' && setSortScore(s => s.col === col ? { col, asc: !s.asc } : { col, asc: false })}>
                            {label}{col !== 'leitura' && (
                              <span style={{ color: sortScore.col === col ? '#1a3a5c' : '#ccc', fontSize: '0.65rem', marginLeft: 4 }}>
                                {sortScore.col === col ? (sortScore.asc ? '▲' : '▼') : '⇅'}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...scoreExternoUF].sort((a, b) => {
                        const va = (a as Record<string,unknown>)[sortScore.col] ?? 0
                        const vb = (b as Record<string,unknown>)[sortScore.col] ?? 0
                        const cmp = typeof va === 'number' && typeof vb === 'number'
                          ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
                        return sortScore.asc ? cmp : -cmp
                      }).map(r => (
                        <tr key={r.uf}>
                          <td><strong>{r.uf}</strong></td>
                          <td>{r.termos}</td>
                          <td>{fmtNum(r.volume)}</td>
                          <td>
                            {r.trend > 0
                              ? <div className={s.volumeBar}>{r.trend}<div className={s.volumeBarTrack}><div className={s.volumeBarFill} style={{ width: `${r.trend}%` }} /></div></div>
                              : '—'}
                          </td>
                          <td>{r.vendas > 0 ? fmtBRL(r.vendas) : <span style={{ color: '#aaa' }}>sem histórico</span>}</td>
                          <td>
                            <div className={s.scoreBar}>
                              <span className={s.scoreNum}>{r.score}</span>
                              <div className={s.scoreTrack}>
                                <div className={`${s.scoreFill} ${r.score > 60 ? s['score-alto'] : r.score > 30 ? s['score-medio'] : s['score-baixo']}`}
                                  style={{ width: `${r.score}%` }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#555' }}>
                            {r.vendas === 0
                              ? '🟢 Demanda externa sem presença comercial'
                              : r.score > 60
                                ? '🟡 Alta demanda, presença parcial'
                                : '🔵 Mercado com cobertura comercial'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela de termos */}
              <div className={s.section}>
                <div className={s.sectionTitle}>Termos externos <span>{kwExternas.length} importados</span></div>
                <div className={s.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        {([
                          { col: 'termo', label: 'Termo' },
                          { col: 'cluster', label: 'Cluster' },
                          { col: 'uf', label: 'UF' },
                          { col: 'segmento', label: 'Segmento' },
                          { col: 'volume_mensal', label: 'Volume /mês' },
                          { col: 'variacao_3m', label: 'Var. 3m' },
                          { col: 'variacao_yoy', label: 'Var. YoY' },
                          { col: 'competicao', label: 'Competição' },
                          { col: 'trend_score', label: 'Trend' },
                          { col: 'fonte', label: 'Fonte' },
                        ] as { col: string; label: string }[]).map(({ col, label }) => (
                          <th key={col} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                            onClick={() => setSortExt(s => s.col === col ? { col, asc: !s.asc } : { col, asc: false })}>
                            {label}{' '}
                            <span style={{ color: sortExt.col === col ? '#1a3a5c' : '#ccc', fontSize: '0.65rem' }}>
                              {sortExt.col === col ? (sortExt.asc ? '▲' : '▼') : '⇅'}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...kwExternas].sort((a, b) => {
                        const v = (x: Keyword) => {
                          const raw = x[sortExt.col as keyof Keyword]
                          return raw == null ? (sortExt.asc ? Infinity : -Infinity) : raw
                        }
                        const va = v(a), vb = v(b)
                        const cmp = typeof va === 'number' && typeof vb === 'number'
                          ? va - vb
                          : String(va).localeCompare(String(vb), 'pt-BR')
                        return sortExt.asc ? cmp : -cmp
                      }).map(k => (
                        <tr key={k.id}>
                          <td><strong>{k.termo}</strong></td>
                          <td>{k.cluster ?? '—'}</td>
                          <td>{k.uf ?? '—'}</td>
                          <td>{k.segmento ?? '—'}</td>
                          <td>
                            <div className={s.volumeBar}>
                              {fmtNum(k.volume_mensal)}
                              <div className={s.volumeBarTrack}>
                                <div className={s.volumeBarFill} style={{ width: `${Math.round((k.volume_mensal / maxVolExt) * 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ color: (k.variacao_3m ?? 0) > 0 ? '#27ae60' : (k.variacao_3m ?? 0) < 0 ? '#c0392b' : '#888' }}>
                            {k.variacao_3m != null ? `${k.variacao_3m > 0 ? '+' : ''}${k.variacao_3m}%` : '—'}
                          </td>
                          <td style={{ color: (k.variacao_yoy ?? 0) > 0 ? '#27ae60' : (k.variacao_yoy ?? 0) < 0 ? '#c0392b' : '#888' }}>
                            {k.variacao_yoy != null ? `${k.variacao_yoy > 0 ? '+' : ''}${k.variacao_yoy}%` : '—'}
                          </td>
                          <td>
                            {k.competicao
                              ? <span className={s.badgeIntencao} style={{ background: k.competicao === 'alta' ? '#fde8e8' : k.competicao === 'media' ? '#fff8e0' : '#e8f8f0', color: k.competicao === 'alta' ? '#c0392b' : k.competicao === 'media' ? '#8a6000' : '#1a7a4a' }}>
                                  {k.competicao}
                                </span>
                              : '—'}
                          </td>
                          <td>
                            {k.trend_score != null
                              ? <div className={s.volumeBar}>{k.trend_score}<div className={s.volumeBarTrack}><div className={s.volumeBarFill} style={{ width: `${k.trend_score}%`, background: k.trend_score > 70 ? '#27ae60' : k.trend_score > 40 ? '#f39c12' : '#bbb' }} /></div></div>
                              : '—'}
                          </td>
                          <td style={{ fontSize: '0.72rem', color: '#888' }}>{k.fonte}</td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Cruzamento ── */}
      {tab === 'cruzamento' && (
        <>
          <div className={s.section}>
            <div className={s.sectionTitle}>Busca Regional × Vendas Pousinox por UF <span>(normalizado 0–100)</span></div>
            {crossing.length === 0 ? (
              <div className={s.empty}>Importe keywords com UF preenchida para ativar o cruzamento entre demanda de busca e histórico de vendas.</div>
            ) : (
              <>
                <div className={s.chartCard} style={{ marginBottom: 24 }}>
                  <div className={s.chartCardTitle}>Demanda de busca vs presença comercial</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartCross} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Legend />
                      <Bar dataKey="Busca (norm.)" fill="#27ae60" radius={[4,4,0,0]} />
                      <Bar dataKey="Vendas (norm.)" fill="#1a3a5c" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.section}>
                  <div className={s.sectionTitle}>Ranking de oportunidades por UF</div>
                  <div className={s.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>UF</th>
                          <th>Busca /mês</th>
                          <th>Vendas históricas</th>
                          <th>Score oportunidade</th>
                          <th>Quadrante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossing.map(r => (
                          <tr key={r.uf}>
                            <td><strong>{r.uf}</strong></td>
                            <td>{fmtNum(r.busca_volume)}</td>
                            <td>{fmtBRL(r.vendas_total)}</td>
                            <td>
                              <div className={s.scoreBar}>
                                <span className={s.scoreNum}>{r.score}</span>
                                <div className={s.scoreTrack}>
                                  <div className={`${s.scoreFill} ${r.score > 60 ? s['score-alto'] : r.score > 30 ? s['score-medio'] : s['score-baixo']}`}
                                    style={{ width: `${r.score}%` }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              {{
                                oportunidade: '🟢 Oportunidade',
                                validado: '🔵 Validado',
                                relacionamento: '🟡 Relacionamento',
                                baixa: '⚪ Baixa prioridade',
                              }[r.quadrant]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Recomendações ── */}
      {tab === 'recomendacoes' && (
        <>
          <div className={s.section}>
            <div className={s.sectionTitle}>Recomendações acionáveis <span>{recomendacoes.length} insights gerados</span></div>
            {recomendacoes.length === 0 ? (
              <div className={s.empty}>
                Importe keywords com UF e segmento preenchidos para gerar recomendações automáticas de prospecção, conteúdo e priorização comercial.
              </div>
            ) : (
              <div className={s.recomList}>
                {recomendacoes.map((r, i) => (
                  <div key={i} className={`${s.recomCard} ${s[`recom-${r.tipo}`]}`}>
                    <span className={s.recomTipo}>{
                      r.tipo === 'oportunidade' ? '🟢 Oportunidade'
                      : r.tipo === 'validado' ? '🔵 Mercado validado'
                      : r.tipo === 'atencao' ? '🟡 Atenção'
                      : '⚪ Baixa prioridade'
                    }</span>
                    <span className={s.recomTexto}>{r.titulo}</span>
                    <span className={s.recomSub}>{r.sub}</span>
                    <div className={s.recomChips}>
                      {r.chips.map((c, j) => <span key={j} className={s.chip}>{c}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
