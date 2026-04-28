import { useState, useRef, useEffect } from 'react'
import type { DashboardFilters, Granularity, FilterContext, CompareMode } from './types'
import { buildPresets } from './types'
import FilterChips from './FilterChips'
import FilterDrawer from './FilterDrawer'
import s from './DashboardFilters.module.css'

const GRAN_OPTIONS: { key: Granularity; label: string; icon: string }[] = [
  { key: 'day', label: 'Dia', icon: '📌' },
  { key: 'month', label: 'Mês', icon: '📆' },
  { key: 'year', label: 'Ano', icon: '📅' },
]

const COMPARE_MODES: { key: CompareMode; label: string }[] = [
  { key: 'periodo_anterior', label: 'Período anterior' },
  { key: 'ano_anterior', label: 'Ano anterior' },
  { key: 'personalizado', label: 'Personalizado' },
]

interface Props {
  filters: DashboardFilters
  onChange: (f: DashboardFilters) => void
  context: FilterContext
}

export default function FilterBar({ filters, onChange, context }: Props) {
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const presetsRef = useRef<HTMLDivElement>(null)
  const presets = buildPresets()

  const isComparing = filters.compareMode !== 'off'
  const hasDateRange = !!(filters.dateFrom && filters.dateTo)

  useEffect(() => {
    if (!presetsOpen) return
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) setPresetsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [presetsOpen])

  const setGranularity = (g: Granularity) => {
    onChange({ ...filters, granularity: g, dateFrom: null, dateTo: null, compareMode: 'off', compareFrom: null, compareTo: null })
  }

  const applyPreset = (idx: number) => {
    const patch = presets[idx].apply()
    onChange({ ...filters, ...patch })
    setPresetsOpen(false)
  }

  const handleRemoveChip = (key: keyof DashboardFilters) => {
    if (key === 'dateFrom') {
      onChange({ ...filters, dateFrom: null, dateTo: null, compareMode: 'off', compareFrom: null, compareTo: null })
    } else if (key === 'compareMode') {
      onChange({ ...filters, compareMode: 'off', compareFrom: null, compareTo: null })
    } else {
      onChange({ ...filters, [key]: null })
    }
  }

  const handleClearAll = () => {
    onChange({
      granularity: 'month',
      dateFrom: null, dateTo: null,
      segmento: null, cidade: null, cliente: null, uf: null,
      compareMode: 'off', compareFrom: null, compareTo: null,
    })
  }

  const toggleCompare = () => {
    if (isComparing) {
      onChange({ ...filters, compareMode: 'off', compareFrom: null, compareTo: null })
    } else {
      onChange({ ...filters, compareMode: 'periodo_anterior' })
    }
  }

  const setCompareMode = (m: CompareMode) => {
    if (m === 'personalizado') {
      onChange({ ...filters, compareMode: m, compareFrom: filters.dateFrom, compareTo: filters.dateTo })
    } else {
      onChange({ ...filters, compareMode: m, compareFrom: null, compareTo: null })
    }
  }

  const hasCrossFilters = !!(filters.segmento || filters.cidade || filters.uf)
  const crossCount = [filters.segmento, filters.cidade, filters.uf].filter(Boolean).length

  const dateInput = (value: string | null, onCh: (v: string) => void) => {
    const g = filters.granularity
    if (g === 'day') return <input type="date" className={s.dateInput} value={value || ''} onChange={e => onCh(e.target.value)} />
    if (g === 'month') return <input type="month" className={s.dateInput} value={value || ''} onChange={e => onCh(e.target.value)} />
    return <input type="number" className={`${s.dateInput} ${s.dateInputYear}`} placeholder="Ano" min={2020} max={2030} value={value || ''} onChange={e => onCh(e.target.value)} />
  }

  return (
    <>
      <div className={s.bar}>
        {/* Granularity tabs */}
        <div className={s.granTabs}>
          {GRAN_OPTIONS.map(g => (
            <button
              key={g.key}
              className={`${s.granTab} ${filters.granularity === g.key ? s.granTabActive : ''}`}
              onClick={() => setGranularity(g.key)}
            >
              <span className={s.granIcon}>{g.icon}</span> {g.label}
            </button>
          ))}
        </div>

        <div className={s.barSep} />

        {/* Date inputs */}
        <div className={s.dateInputs}>
          <label className={s.dateLabel}>De</label>
          {dateInput(filters.dateFrom, v => onChange({ ...filters, dateFrom: v || null }))}
          <label className={s.dateLabel}>Até</label>
          {dateInput(filters.dateTo, v => onChange({ ...filters, dateTo: v || null }))}
        </div>

        <div className={s.barSep} />

        {/* Presets */}
        <div className={s.presetsWrap} ref={presetsRef}>
          <button className={s.presetsBtn} onClick={() => setPresetsOpen(!presetsOpen)}>
            ⚡ Atalhos
          </button>
          {presetsOpen && (
            <div className={s.presetsDropdown}>
              {presets.map((p, i) => (
                <button key={i} className={s.presetItem} onClick={() => applyPreset(i)}>
                  <span className={s.presetIcon}>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compare toggle + inline mode selector */}
        <button
          className={`${s.compareBtn} ${isComparing ? s.compareBtnActive : ''}`}
          onClick={toggleCompare}
          disabled={!hasDateRange}
          title={!hasDateRange ? 'Selecione um período primeiro' : isComparing ? 'Desativar comparação' : 'Ativar comparação'}
        >
          📊 Comparar
        </button>

        {isComparing && (
          <div className={s.compareModes}>
            {COMPARE_MODES.map(m => (
              <button
                key={m.key}
                className={`${s.compareModeBtn} ${filters.compareMode === m.key ? s.compareModeBtnActive : ''}`}
                onClick={() => setCompareMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Advanced drawer toggle */}
        <button
          className={`${s.advancedBtn} ${hasCrossFilters ? s.advancedBtnActive : ''}`}
          onClick={() => setDrawerOpen(true)}
        >
          🔧 Filtros{crossCount > 0 && <span className={s.advancedBadge}>{crossCount}</span>}
        </button>
      </div>

      {/* Custom compare dates — only for "personalizado" */}
      {isComparing && filters.compareMode === 'personalizado' && (
        <div className={s.compareBar}>
          <span className={s.compareLabel}>Comparar com:</span>
          <div className={s.dateInputs}>
            <label className={s.dateLabel}>De</label>
            {dateInput(filters.compareFrom, v => onChange({ ...filters, compareFrom: v || null }))}
            <label className={s.dateLabel}>Até</label>
            {dateInput(filters.compareTo, v => onChange({ ...filters, compareTo: v || null }))}
          </div>
          <button className={s.compareClear} onClick={() => onChange({ ...filters, compareMode: 'off', compareFrom: null, compareTo: null })} title="Remover comparação">✕</button>
        </div>
      )}

      {/* Chips */}
      <FilterChips filters={filters} onRemove={handleRemoveChip} onClearAll={handleClearAll} />

      {/* Drawer */}
      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        context={context}
        segmento={filters.segmento}
        cidade={filters.cidade}
        uf={filters.uf}
        onSegmento={v => onChange({ ...filters, segmento: v })}
        onCidade={v => onChange({ ...filters, cidade: v })}
        onUf={v => onChange({ ...filters, uf: v })}
      />
    </>
  )
}
