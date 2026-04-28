export type Granularity = 'day' | 'month' | 'year'
export type CompareMode = 'off' | 'periodo_anterior' | 'ano_anterior' | 'personalizado'

export interface DashboardFilters {
  granularity: Granularity
  dateFrom: string | null   // YYYY-MM-DD | YYYY-MM | YYYY
  dateTo: string | null
  segmento: string | null
  cidade: string | null
  cliente: string | null
  uf: string | null
  compareMode: CompareMode
  compareFrom: string | null
  compareTo: string | null
}

export interface PresetOption {
  label: string
  icon: string
  apply: () => Partial<DashboardFilters>
}

export interface FilterContext {
  segmentos: string[]
  cidades: string[]
  ufs: string[]
}

export const EMPTY_FILTERS: DashboardFilters = {
  granularity: 'month',
  dateFrom: null,
  dateTo: null,
  segmento: null,
  cidade: null,
  cliente: null,
  uf: null,
  compareMode: 'off',
  compareFrom: null,
  compareTo: null,
}

/* helpers */
const pad = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const todayMonth = () => today().substring(0, 7)
const todayYear = () => today().substring(0, 4)
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const monthStart = () => today().substring(0, 8) + '01'
const prevMonthRange = (): [string, string] => {
  const d = new Date(); d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear(); const m = pad(d.getMonth() + 1)
  const last = new Date(y, d.getMonth() + 1, 0).getDate()
  return [`${y}-${m}-01`, `${y}-${m}-${pad(last)}`]
}
const quarterStart = (): string => {
  const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3
  return `${d.getFullYear()}-${pad(q + 1)}-01`
}
const yearStart = () => `${todayYear()}-01-01`
const prevYearRange = (): [string, string] => {
  const y = Number(todayYear()) - 1
  return [`${y}-01-01`, `${y}-12-31`]
}

export function buildPresets(): PresetOption[] {
  return [
    { label: 'Hoje', icon: '📌', apply: () => ({ granularity: 'day' as const, dateFrom: today(), dateTo: today() }) },
    { label: 'Últimos 7 dias', icon: '📅', apply: () => ({ granularity: 'day' as const, dateFrom: daysAgo(6), dateTo: today() }) },
    { label: 'Últimos 30 dias', icon: '📅', apply: () => ({ granularity: 'day' as const, dateFrom: daysAgo(29), dateTo: today() }) },
    { label: 'Este mês', icon: '📆', apply: () => ({ granularity: 'day' as const, dateFrom: monthStart(), dateTo: today() }) },
    { label: 'Mês passado', icon: '◀', apply: () => { const [f, t] = prevMonthRange(); return { granularity: 'day' as const, dateFrom: f, dateTo: t } } },
    { label: 'Este trimestre', icon: '📊', apply: () => ({ granularity: 'month' as const, dateFrom: quarterStart().substring(0, 7), dateTo: todayMonth() }) },
    { label: 'Este ano (YTD)', icon: '📈', apply: () => ({ granularity: 'month' as const, dateFrom: yearStart().substring(0, 7), dateTo: todayMonth() }) },
    { label: 'Ano passado', icon: '⏪', apply: () => { const [f, t] = prevYearRange(); return { granularity: 'month' as const, dateFrom: f.substring(0, 7), dateTo: t.substring(0, 7) } } },
    { label: 'Tudo', icon: '♾️', apply: () => ({ granularity: 'month' as const, dateFrom: null, dateTo: null }) },
  ]
}

/** Resolve the actual compare date range based on mode */
export function resolveCompareRange(f: DashboardFilters): { from: string | null; to: string | null } {
  if (f.compareMode === 'off') return { from: null, to: null }
  if (f.compareMode === 'personalizado') return { from: f.compareFrom, to: f.compareTo }
  if (!f.dateFrom || !f.dateTo) return { from: null, to: null }

  if (f.compareMode === 'ano_anterior') {
    const shift = (d: string) => (parseInt(d.substring(0, 4)) - 1) + d.substring(4)
    return { from: shift(f.dateFrom), to: shift(f.dateTo) }
  }

  // periodo_anterior
  const { granularity: g, dateFrom, dateTo } = f
  if (g === 'year') {
    const from = parseInt(dateFrom); const to = parseInt(dateTo)
    const span = to - from + 1
    return { from: String(from - span), to: String(from - 1) }
  }
  if (g === 'month') {
    const toD = (s: string) => { const [y, m] = s.split('-').map(Number); return new Date(y, m - 1, 1) }
    const a = toD(dateFrom); const b = toD(dateTo)
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
    const nf = new Date(a); nf.setMonth(nf.getMonth() - months)
    const nt = new Date(a); nt.setMonth(nt.getMonth() - 1)
    const fm = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    return { from: fm(nf), to: fm(nt) }
  }
  // day
  const a = new Date(dateFrom + 'T00:00:00'); const b = new Date(dateTo + 'T00:00:00')
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1
  const nf = new Date(a); nf.setDate(nf.getDate() - days)
  const nt = new Date(a); nt.setDate(nt.getDate() - 1)
  const fd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: fd(nf), to: fd(nt) }
}

/** Check if a date string (YYYY-MM-DD) falls within the filter range */
export function dateInRange(date: string, filters: DashboardFilters): boolean {
  if (!date) return false
  if (!filters.dateFrom && !filters.dateTo) return true

  const { granularity, dateFrom, dateTo } = filters

  if (granularity === 'year') {
    const y = date.substring(0, 4)
    if (dateFrom && y < dateFrom) return false
    if (dateTo && y > dateTo) return false
    return true
  }

  if (granularity === 'month') {
    const m = date.substring(0, 7)
    if (dateFrom && m < dateFrom) return false
    if (dateTo && m > dateTo) return false
    return true
  }

  // day
  const d = date.substring(0, 10)
  if (dateFrom && d < dateFrom) return false
  if (dateTo && d > dateTo) return false
  return true
}
