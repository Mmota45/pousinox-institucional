import type { DashboardFilters, Granularity } from './types'
import { resolveCompareRange } from './types'
import s from './DashboardFilters.module.css'

const GRAN_LABEL: Record<Granularity, string> = { day: 'Dia', month: 'Mês', year: 'Ano' }
const MESES: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function fmtDate(d: string, gran: Granularity): string {
  if (gran === 'year') return d
  if (gran === 'month') {
    const [y, m] = d.split('-')
    return `${MESES[m] || m}/${y}`
  }
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

interface Props {
  filters: DashboardFilters
  onRemove: (key: keyof DashboardFilters) => void
  onClearAll: () => void
}

export default function FilterChips({ filters, onRemove, onClearAll }: Props) {
  const chips: { label: string; key: keyof DashboardFilters }[] = []

  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? fmtDate(filters.dateFrom, filters.granularity) : '...'
    const to = filters.dateTo ? fmtDate(filters.dateTo, filters.granularity) : '...'
    const label = from === to ? `${GRAN_LABEL[filters.granularity]}: ${from}` : `${from} → ${to}`
    chips.push({ label, key: 'dateFrom' })
  }
  if (filters.compareMode !== 'off') {
    const cr = resolveCompareRange(filters)
    const from = cr.from ? fmtDate(cr.from, filters.granularity) : '...'
    const to = cr.to ? fmtDate(cr.to, filters.granularity) : '...'
    const modeLabel = filters.compareMode === 'periodo_anterior' ? 'vs anterior' : filters.compareMode === 'ano_anterior' ? 'vs ano anterior' : 'vs custom'
    chips.push({ label: `${modeLabel}: ${from} → ${to}`, key: 'compareMode' })
  }
  if (filters.segmento) chips.push({ label: `Segmento: ${filters.segmento}`, key: 'segmento' })
  if (filters.cidade) chips.push({ label: `Cidade: ${filters.cidade}`, key: 'cidade' })
  if (filters.uf) chips.push({ label: `UF: ${filters.uf}`, key: 'uf' })
  if (filters.cliente) chips.push({ label: `Cliente: ${filters.cliente}`, key: 'cliente' })

  if (chips.length === 0) return null

  return (
    <div className={s.chipsRow}>
      <span className={s.chipsLabel}>Filtros ativos:</span>
      {chips.map(c => (
        <span key={c.key} className={s.chip}>
          {c.label}
          <button className={s.chipX} onClick={() => onRemove(c.key)}>✕</button>
        </span>
      ))}
      {chips.length > 1 && (
        <button className={s.chipClearAll} onClick={onClearAll}>Limpar tudo</button>
      )}
    </div>
  )
}
