import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts'
import { FilterBar, ChartCard, EMPTY_FILTERS, dateInRange, resolveCompareRange } from '../components/DashboardFilters'
import type { DashboardFilters, FilterContext } from '../components/DashboardFilters'
import s from './AdminDashboardBI.module.css'

/* ── helpers ── */
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v)
const COLORS = ['#3b82f6', '#0d9488', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#06b6d4']
const COLOR_OUTROS = '#cbd5e1' // cinza neutro para "Outros"
const MESES_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}
const fmtMes = (m: string) => { const [a, mm] = m.split('-'); return `${MESES_LABEL[mm] || mm}/${a.slice(2)}` }

/* ── Normalização de segmentos ── */
const SEGMENTO_ALIAS: Record<string, string> = {
  // Supermercados
  'Comércio varejista de mercado': 'Supermercados',
  'Comércio varejista de mercadorias em geral': 'Supermercados',
  'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados': 'Supermercados',
  // Atacado → Supermercados
  'Atacado': 'Supermercados',
  'Comércio atacadista de mercado': 'Supermercados',
  'Comércio atacadista de mercadorias em geral': 'Supermercados',
  'Comércio atacadista': 'Supermercados',
  // Restaurantes
  'Restaurantes e similares': 'Restaurantes',
  'Restaurantes e outros': 'Restaurantes',
  'Lanchonetes, casas de chá, de sucos e similares': 'Restaurantes',
  // Padarias
  'Panificação': 'Padarias e Confeitarias',
  'Padaria': 'Padarias e Confeitarias',
  'Padarias': 'Padarias e Confeitarias',
  'Confeitaria': 'Padarias e Confeitarias',
  'Confeitarias': 'Padarias e Confeitarias',
  // Hotelaria
  'Hotéis': 'Hotelaria',
  'Hotéis e similares': 'Hotelaria',
  'Alojamento': 'Hotelaria',
  // Saúde
  'Hospitalar': 'Saúde',
  'Hospital': 'Saúde',
  'Hospitais': 'Saúde',
  'Laboratórios': 'Saúde',
  'Laboratório': 'Saúde',
  'Fabricação de medicamentos alopáticos para uso humano': 'Saúde',
  'Fabricação de medicamentos': 'Saúde',
  'Atividades de atendimento em pronto-socorro e unidades hospitalares': 'Saúde',
  'Atividades de atendimento hospitalar': 'Saúde',
  // Indústria
  'Fabricação de máquinas e equipamentos': 'Indústria',
  // Varejo Especializado
  'Comércio varejista especializado de eletrodomésticos': 'Varejo Especializado',
  'Comércio varejista especializado': 'Varejo Especializado',
}
const normSeg = (s: string | null) => {
  const v = s?.trim() || 'Não informado'
  if (SEGMENTO_ALIAS[v]) return SEGMENTO_ALIAS[v]
  // Match por prefixo para variações truncadas do CNAE
  for (const [key, val] of Object.entries(SEGMENTO_ALIAS)) {
    if (v.startsWith(key) || key.startsWith(v)) return val
  }
  return v
}

/* ── Compare context labels ── */
const COMPARE_LABELS: Record<string, string> = {
  periodo_anterior: 'Comparando com período anterior',
  ano_anterior: 'Comparando com mesmo período do ano anterior',
  personalizado: 'Comparando com período personalizado',
}

/* ── Custom Tooltip ── */
interface TipPayload { name: string; value: number; color: string; dataKey: string }
interface TipProps { active?: boolean; payload?: TipPayload[]; label?: string; isCurrency?: boolean }

function AnalyticTooltip({ active, payload, label, isCurrency = true }: TipProps) {
  if (!active || !payload?.length) return null
  const fmtV = (v: number) => isCurrency ? fmt(v) : v.toLocaleString('pt-BR')
  const atual = payload.find(p => !String(p.dataKey).includes('Anterior') && !String(p.dataKey).includes('anterior'))
  const anterior = payload.find(p => String(p.dataKey).includes('Anterior') || String(p.dataKey).includes('anterior'))

  const deltaAbs = atual && anterior ? atual.value - anterior.value : null
  const deltaPct = atual && anterior && anterior.value > 0 ? ((atual.value - anterior.value) / anterior.value) * 100 : null

  return (
    <div className={s.tooltip}>
      <div className={s.tooltipLabel}>{label}</div>
      {atual && (
        <div className={s.tooltipRow}>
          <span className={s.tooltipDot} style={{ background: atual.color || '#3b82f6' }} />
          <span className={s.tooltipName}>Atual</span>
          <span className={s.tooltipValue}>{fmtV(atual.value)}</span>
        </div>
      )}
      {anterior && anterior.value > 0 && (
        <div className={s.tooltipRow}>
          <span className={s.tooltipDot} style={{ background: '#94a3b8' }} />
          <span className={s.tooltipName}>Anterior</span>
          <span className={s.tooltipValue}>{fmtV(anterior.value)}</span>
        </div>
      )}
      {deltaAbs !== null && deltaPct !== null && (
        <div className={s.tooltipDelta}>
          <span className={deltaPct >= 0 ? s.tooltipDeltaUp : s.tooltipDeltaDown}>
            {deltaPct >= 0 ? '▲' : '▼'} {fmtV(Math.abs(deltaAbs))} ({Math.abs(deltaPct).toFixed(1)}%)
          </span>
        </div>
      )}
      {!anterior && payload.length === 1 && !atual && (
        <div className={s.tooltipRow}>
          <span className={s.tooltipDot} style={{ background: payload[0].color }} />
          <span className={s.tooltipName}>{payload[0].name}</span>
          <span className={s.tooltipValue}>{fmtV(payload[0].value)}</span>
        </div>
      )}
    </div>
  )
}

/* ── Inline Legend ── */
function ChartLegend({ comparing }: { comparing: boolean }) {
  if (!comparing) return null
  return (
    <div className={s.chartLegend}>
      <span className={s.legendItem}><span className={s.legendLine} style={{ background: '#3b82f6' }} /> Atual</span>
      <span className={s.legendItem}><span className={s.legendLineDashed} /> Anterior</span>
    </div>
  )
}

/* ── types ── */
interface Cliente { razao_social: string; segmento: string; cidade: string; uf: string; total_gasto: number; cnpj: string }
interface NF { emissao: string; total: number; cnpj: string }

/* ── period label ── */
function periodoLabel(f: DashboardFilters): string {
  if (!f.dateFrom && !f.dateTo) return 'todo o histórico'
  const MESES: Record<string, string> = MESES_LABEL
  const fmtD = (d: string) => {
    if (f.granularity === 'year') return d
    if (f.granularity === 'month') { const [y, m] = d.split('-'); return `${MESES[m] || m}/${y}` }
    const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`
  }
  const from = f.dateFrom ? fmtD(f.dateFrom) : '...'
  const to = f.dateTo ? fmtD(f.dateTo) : '...'
  return from === to ? from : `${from} a ${to}`
}

export default function AdminDashboardBI() {
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(2)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nfs, setNfs] = useState<NF[]>([])
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS)
  const [showCompSeries, setShowCompSeries] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      lp.reset()
      const [resCli, resNf] = await Promise.all([
        lp.wrap(supabaseAdmin.from('clientes').select('*').gt('total_gasto', 0).order('total_gasto', { ascending: false })),
        lp.wrap(supabaseAdmin.from('nf_cabecalho').select('emissao, total, cnpj').gt('total', 0)),
      ])
      setClientes((resCli.data || []) as Cliente[])
      setNfs((resNf.data || []) as NF[])
      setLoading(false)
    }
    load()
  }, [])

  const pLabel = periodoLabel(filters)

  // Filter context for drawer selects
  const filterContext: FilterContext = useMemo(() => {
    const segs = new Set<string>(); const cids = new Set<string>(); const ufs = new Set<string>()
    clientes.forEach(c => { if (c.segmento) segs.add(normSeg(c.segmento)); if (c.cidade) cids.add(c.cidade); if (c.uf) ufs.add(c.uf) })
    return { segmentos: Array.from(segs).sort(), cidades: Array.from(cids).sort(), ufs: Array.from(ufs).sort() }
  }, [clientes])

  // ── Filtered data ──
  const clientesFiltrados = useMemo(() => {
    let arr = clientes
    if (filters.segmento) arr = arr.filter(c => normSeg(c.segmento) === filters.segmento)
    if (filters.cidade) arr = arr.filter(c => (c.cidade || 'Não informada') === filters.cidade)
    if (filters.uf) arr = arr.filter(c => c.uf === filters.uf)
    if (filters.cliente) arr = arr.filter(c => c.razao_social?.substring(0, 25) === filters.cliente)
    return arr
  }, [clientes, filters.segmento, filters.cidade, filters.uf, filters.cliente])

  const cnpjSet = useMemo(() => new Set(clientesFiltrados.map(c => c.cnpj)), [clientesFiltrados])
  const hasCrossFilter = !!(filters.segmento || filters.cidade || filters.uf || filters.cliente)

  const nfsFiltradas = useMemo(() => {
    let arr = nfs
    if (filters.dateFrom || filters.dateTo) arr = arr.filter(nf => dateInRange(nf.emissao, filters))
    if (hasCrossFilter) arr = arr.filter(nf => cnpjSet.has(nf.cnpj))
    return arr
  }, [nfs, filters, hasCrossFilter, cnpjSet])

  // ── Comparison data ──
  const compareRange = useMemo(() => resolveCompareRange(filters), [filters])
  const isComparing = filters.compareMode !== 'off' && !!(compareRange.from || compareRange.to)
  const compLabel = isComparing ? COMPARE_LABELS[filters.compareMode] || '' : ''
  const chartSub = (base: string) => isComparing ? `${base} — ${compLabel.toLowerCase()}` : `${base} — ${pLabel}`

  const nfsCompare = useMemo(() => {
    if (!isComparing) return []
    const compFilters = { ...filters, dateFrom: compareRange.from, dateTo: compareRange.to }
    let arr = nfs
    if (compFilters.dateFrom || compFilters.dateTo) arr = arr.filter(nf => dateInRange(nf.emissao, compFilters))
    if (hasCrossFilter) arr = arr.filter(nf => cnpjSet.has(nf.cnpj))
    return arr
  }, [nfs, filters, isComparing, compareRange, hasCrossFilter, cnpjSet])

  // ── KPIs ──
  const delta = (cur: number, prev: number) => prev === 0 ? null : ((cur - prev) / prev) * 100

  const kpis = useMemo(() => {
    const fatNfs = nfsFiltradas.reduce((a, n) => a + (n.total || 0), 0)
    const qtdNfs = nfsFiltradas.length
    const ticketNfs = qtdNfs ? fatNfs / qtdNfs : 0

    const fatNfsComp = nfsCompare.reduce((a, n) => a + (n.total || 0), 0)
    const qtdNfsComp = nfsCompare.length
    const ticketNfsComp = qtdNfsComp ? fatNfsComp / qtdNfsComp : 0

    const fatTotal = clientesFiltrados.reduce((a, c) => a + (c.total_gasto || 0), 0)
    const qtdCli = clientesFiltrados.length

    return [
      { label: 'Faturamento (NFs)', value: fmt(fatNfs), icon: '💰', sub: pLabel, delta: isComparing ? delta(fatNfs, fatNfsComp) : null },
      { label: 'Qtd NFs', value: String(qtdNfs), icon: '📄', sub: hasCrossFilter ? 'filtrado' : pLabel, delta: isComparing ? delta(qtdNfs, qtdNfsComp) : null },
      { label: 'Ticket Médio NF', value: fmt(ticketNfs), icon: '🎯', sub: 'por nota fiscal', delta: isComparing ? delta(ticketNfs, ticketNfsComp) : null },
      { label: 'Clientes Ativos', value: String(qtdCli), icon: '👥', sub: `Total: ${fmt(fatTotal)}`, delta: null },
    ]
  }, [clientesFiltrados, nfsFiltradas, nfsCompare, hasCrossFilter, pLabel, isComparing])

  // ── Chart data ──
  const fatMensal = useMemo(() => {
    const m = new Map<string, number>()
    nfsFiltradas.forEach(nf => { if (!nf.emissao) return; const k = nf.emissao.substring(0, 7); m.set(k, (m.get(k) || 0) + (nf.total || 0)) })
    return Array.from(m.entries()).map(([mes, total]) => ({ mes: fmtMes(mes), mesRaw: mes, total })).sort((a, b) => a.mesRaw.localeCompare(b.mesRaw))
  }, [nfsFiltradas])

  const ticketMensal = useMemo(() => {
    const m = new Map<string, { soma: number; count: number }>()
    nfsFiltradas.forEach(nf => { if (!nf.emissao) return; const k = nf.emissao.substring(0, 7); const e = m.get(k) || { soma: 0, count: 0 }; e.soma += nf.total || 0; e.count++; m.set(k, e) })
    return Array.from(m.entries()).map(([mes, v]) => ({ mes: fmtMes(mes), mesRaw: mes, ticket: v.soma / v.count, nfs: v.count })).sort((a, b) => a.mesRaw.localeCompare(b.mesRaw))
  }, [nfsFiltradas])

  const topClientes = useMemo(() =>
    clientesFiltrados.slice(0, 10).map(c => ({ nome: (c.razao_social || '').substring(0, 25), total: c.total_gasto || 0 }))
  , [clientesFiltrados])

  const segmentoData = useMemo(() => {
    const m = new Map<string, number>()
    clientesFiltrados.forEach(c => { const seg = normSeg(c.segmento); m.set(seg, (m.get(seg) || 0) + (c.total_gasto || 0)) })
    const sorted = Array.from(m.entries()).sort(([, a], [, b]) => b - a)
    const total = sorted.reduce((a, [, v]) => a + v, 0)
    const threshold = total * 0.005 // 0.5%
    let outros = 0
    const outrosDetalhe: { name: string; value: number }[] = []
    const result: { name: string; value: number }[] = []
    for (const [name, value] of sorted) {
      if (value < threshold || result.length >= 8) { outros += value; outrosDetalhe.push({ name, value }) }
      else { result.push({ name: name.substring(0, 25), value }) }
    }
    if (outros > 0) result.push({ name: 'Outros', value: outros })
    return { data: result, outrosDetalhe }
  }, [clientesFiltrados])

  const cidadeData = useMemo(() => {
    const m = new Map<string, number>()
    clientesFiltrados.forEach(c => { const cid = c.cidade || 'Não informada'; m.set(cid, (m.get(cid) || 0) + (c.total_gasto || 0)) })
    return Array.from(m.entries()).map(([cidade, total]) => ({ cidade: cidade.substring(0, 20), total })).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [clientesFiltrados])

  // ── Comparison chart data (merged with main series) ──
  const fatMensalComp = useMemo(() => {
    if (!isComparing) return fatMensal
    const compMap = new Map<string, number>()
    nfsCompare.forEach(nf => { if (!nf.emissao) return; const k = nf.emissao.substring(0, 7); compMap.set(k, (compMap.get(k) || 0) + (nf.total || 0)) })

    // Align comparison by position (not by date)
    const compArr = Array.from(compMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    return fatMensal.map((item, i) => ({
      ...item,
      totalAnterior: compArr[i]?.[1] || 0,
      mesAnterior: compArr[i] ? fmtMes(compArr[i][0]) : '',
    }))
  }, [fatMensal, nfsCompare, isComparing])

  const ticketMensalComp = useMemo(() => {
    if (!isComparing) return ticketMensal
    const compMap = new Map<string, { soma: number; count: number }>()
    nfsCompare.forEach(nf => { if (!nf.emissao) return; const k = nf.emissao.substring(0, 7); const e = compMap.get(k) || { soma: 0, count: 0 }; e.soma += nf.total || 0; e.count++; compMap.set(k, e) })
    const compArr = Array.from(compMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    return ticketMensal.map((item, i) => ({
      ...item,
      ticketAnterior: compArr[i] ? compArr[i][1].soma / compArr[i][1].count : 0,
      nfsAnterior: compArr[i]?.[1].count || 0,
    }))
  }, [ticketMensal, nfsCompare, isComparing])

  // ── CSV builders ──
  const csvFatMensal = useMemo(() => [['Mês', 'Faturamento'], ...fatMensal.map(r => [r.mes, r.total.toFixed(2)])], [fatMensal])
  const csvTopClientes = useMemo(() => [['Cliente', 'Faturamento'], ...topClientes.map(r => [r.nome, r.total.toFixed(2)])], [topClientes])
  const csvSegmentos = useMemo(() => [['Segmento', 'Faturamento'], ...segmentoData.data.map(r => [r.name, r.value.toFixed(2)])], [segmentoData])
  const csvCidades = useMemo(() => [['Cidade', 'Faturamento'], ...cidadeData.map(r => [r.cidade, r.total.toFixed(2)])], [cidadeData])
  const csvTicket = useMemo(() => [['Mês', 'Ticket Médio', 'Qtd NFs'], ...ticketMensal.map(r => [r.mes, r.ticket.toFixed(2), String(r.nfs)])], [ticketMensal])

  // ── Cross-filter handlers ──
  const handleSegmentoClick = useCallback((_: unknown, idx: number) => {
    const seg = segmentoData.data[idx]?.name
    if (seg === 'Outros') return // agrupamento virtual, não filtrável
    setFilters(f => ({ ...f, segmento: f.segmento === seg ? null : seg, cidade: null, cliente: null }))
  }, [segmentoData])

  const handleCidadeClick = useCallback((_: unknown, idx: number) => {
    const cid = cidadeData[idx]?.cidade
    if (!cid) return
    setFilters(f => ({ ...f, cidade: f.cidade === cid ? null : cid, segmento: null, cliente: null }))
  }, [cidadeData])

  const handleClienteClick = useCallback((_: unknown, idx: number) => {
    const nome = topClientes[idx]?.nome
    if (!nome) return
    setFilters(f => ({ ...f, cliente: f.cliente === nome ? null : nome, segmento: null, cidade: null }))
  }, [topClientes])

  if (loading) return <AdminLoading total={lp.total} current={lp.current} label="Carregando dados..." />

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Dashboard BI</h1>
          <p className={s.subtitle}>Inteligência de negócios — visão consolidada</p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} context={filterContext} />

      {/* KPIs */}
      <div className={s.kpiGrid}>
        {kpis.map((k, i) => (
          <div key={i} className={s.kpiCard}>
            <span className={s.kpiIcon}>{k.icon}</span>
            <div>
              <div className={s.kpiLabel}>{k.label}</div>
              <div className={s.kpiValRow}>
                <div className={s.kpiVal}>{k.value}</div>
                {k.delta !== null && k.delta !== undefined && (
                  <span className={`${s.kpiDelta} ${k.delta >= 0 ? s.kpiDeltaUp : s.kpiDeltaDown}`}>
                    {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className={s.kpiSub}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compare banner */}
      {isComparing && (
        <div className={s.compareBanner}>
          <span className={s.compareBannerIcon}>📊</span>
          <span>{compLabel}</span>
          <button
            className={`${s.compareBannerToggle} ${!showCompSeries ? s.compareBannerToggleOff : ''}`}
            onClick={() => setShowCompSeries(v => !v)}
          >
            {showCompSeries ? '👁 Série visível' : '👁‍🗨 Série oculta'}
          </button>
        </div>
      )}

      {/* Row 1 */}
      <div className={s.row2}>
        <ChartCard title="Faturamento Mensal" subtitle={chartSub('Evolução mensal')} csvData={csvFatMensal} csvFilename="faturamento_mensal" noData={fatMensal.length === 0}>
          <ChartLegend comparing={isComparing && showCompSeries} />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={fatMensalComp} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<AnalyticTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradFat)" name="Atual" activeDot={{ r: 5, strokeWidth: 2 }} />
              {isComparing && showCompSeries && <Area type="monotone" dataKey="totalAnterior" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" fill="none" name="Anterior" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Faturamento por Segmento" subtitle="Distribuição acumulada por segmento" active={!!filters.segmento} activeLabel={filters.segmento || undefined} csvData={csvSegmentos} csvFilename="segmentos">
          <div className={s.segRow}>
            <ResponsiveContainer width="55%" height={280}>
              <PieChart>
                <Pie data={segmentoData.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={38}
                  onClick={handleSegmentoClick} cursor="pointer" paddingAngle={1} label={false}>
                  {segmentoData.data.map((entry, i) => (
                    <Cell key={i} fill={entry.name === 'Outros' ? COLOR_OUTROS : COLORS[i % COLORS.length]}
                      opacity={filters.segmento && filters.segmento !== entry.name ? 0.3 : 1}
                      stroke={filters.segmento === entry.name ? '#0f172a' : undefined}
                      strokeWidth={filters.segmento === entry.name ? 2 : 0} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]
                  const name = d.name as string
                  const value = d.value as number
                  return (
                    <div className={s.tooltip}>
                      <div className={s.tooltipLabel}>{name}</div>
                      <div className={s.tooltipRow}>
                        <span className={s.tooltipDot} style={{ background: d.payload?.fill }} />
                        <span className={s.tooltipName}>Faturamento</span>
                        <span className={s.tooltipValue}>{fmt(value)}</span>
                      </div>
                      {name === 'Outros' && segmentoData.outrosDetalhe.length > 0 && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', marginBottom: 3 }}>COMPOSIÇÃO</div>
                          {segmentoData.outrosDetalhe.map((o, i) => (
                            <div key={i} className={s.tooltipRow}>
                              <span className={s.tooltipName}>{o.name}</span>
                              <span className={s.tooltipValue}>{fmt(o.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className={s.segList}>
              {segmentoData.data.map((entry, i) => {
                const total = segmentoData.data.reduce((a, e) => a + e.value, 0)
                const pct = total ? ((entry.value / total) * 100).toFixed(1) : '0'
                const color = entry.name === 'Outros' ? COLOR_OUTROS : COLORS[i % COLORS.length]
                const isActive = filters.segmento === entry.name
                const dimmed = filters.segmento && !isActive
                return (
                  <div key={i} className={`${s.segItem} ${isActive ? s.segItemActive : ''}`}
                    style={{ opacity: dimmed ? 0.4 : 1 }}
                    onClick={() => { if (entry.name !== 'Outros') setFilters(f => ({ ...f, segmento: f.segmento === entry.name ? null : entry.name, cidade: null, cliente: null })) }}
                  >
                    <span className={s.segDot} style={{ background: color }} />
                    <span className={s.segName}>{entry.name}</span>
                    <span className={s.segPct}>{pct}%</span>
                    <span className={s.segVal}>{fmtK(entry.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className={s.row2}>
        <ChartCard title="Top 10 Clientes" subtitle={chartSub('Maiores compradores')} active={!!filters.cliente} activeLabel={filters.cliente || undefined} csvData={csvTopClientes} csvFilename="top_clientes">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topClientes} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<AnalyticTooltip />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Faturamento" onClick={handleClienteClick} cursor="pointer">
                {topClientes.map((entry, i) => (
                  <Cell key={i} fill={filters.cliente === entry.nome ? '#065f46' : '#0d9488'}
                    opacity={filters.cliente && filters.cliente !== entry.nome ? 0.3 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Faturamento por Cidade" subtitle="Top 8 cidades por faturamento" active={!!filters.cidade} activeLabel={filters.cidade || undefined} csvData={csvCidades} csvFilename="cidades">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={cidadeData} margin={{ bottom: 5, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal />
              <XAxis dataKey="cidade" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<AnalyticTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Faturamento" onClick={handleCidadeClick} cursor="pointer">
                {cidadeData.map((entry, i) => (
                  <Cell key={i} fill={filters.cidade === entry.cidade ? '#5b21b6' : '#8b5cf6'}
                    opacity={filters.cidade && filters.cidade !== entry.cidade ? 0.3 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3 */}
      <div className={s.row2}>
        <ChartCard title="Ticket Médio Mensal" subtitle={chartSub('Valor médio por NF')} csvData={csvTicket} csvFilename="ticket_medio" noData={ticketMensal.length === 0}>
          <ChartLegend comparing={isComparing && showCompSeries} />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ticketMensalComp} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<AnalyticTooltip />} />
              <Line type="monotone" dataKey="ticket" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} name="Atual" activeDot={{ r: 5 }} />
              {isComparing && showCompSeries && <Line type="monotone" dataKey="ticketAnterior" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 2 }} name="Anterior" />}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume de NFs por Mês" subtitle={chartSub('Quantidade de notas emitidas')} csvData={csvTicket} csvFilename="volume_nfs" noData={ticketMensal.length === 0}>
          <ChartLegend comparing={isComparing && showCompSeries} />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ticketMensalComp} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<AnalyticTooltip isCurrency={false} />} />
              <Bar dataKey="nfs" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Atual" />
              {isComparing && showCompSeries && <Bar dataKey="nfsAnterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Anterior" />}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
