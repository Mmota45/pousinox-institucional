import { useEffect, useRef } from 'react'
import type { FilterContext } from './types'
import s from './DashboardFilters.module.css'

interface Props {
  open: boolean
  onClose: () => void
  context: FilterContext
  segmento: string | null
  cidade: string | null
  uf: string | null
  onSegmento: (v: string | null) => void
  onCidade: (v: string | null) => void
  onUf: (v: string | null) => void
}

export default function FilterDrawer({ open, onClose, context, segmento, cidade, uf, onSegmento, onCidade, onUf }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {open && <div className={s.drawerBackdrop} />}
      <div ref={ref} className={`${s.drawer} ${open ? s.drawerOpen : ''}`}>
        <div className={s.drawerHeader}>
          <h3 className={s.drawerTitle}>Filtros Avançados</h3>
          <button className={s.drawerClose} onClick={onClose}>✕</button>
        </div>

        <div className={s.drawerBody}>
          {/* UF */}
          <div className={s.drawerField}>
            <label className={s.drawerLabel}>Estado (UF)</label>
            <select
              className={s.drawerSelect}
              value={uf || ''}
              onChange={e => onUf(e.target.value || null)}
            >
              <option value="">Todos</option>
              {context.ufs.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Segmento */}
          <div className={s.drawerField}>
            <label className={s.drawerLabel}>Segmento</label>
            <select
              className={s.drawerSelect}
              value={segmento || ''}
              onChange={e => onSegmento(e.target.value || null)}
            >
              <option value="">Todos</option>
              {context.segmentos.map(sg => <option key={sg} value={sg}>{sg}</option>)}
            </select>
          </div>

          {/* Cidade */}
          <div className={s.drawerField}>
            <label className={s.drawerLabel}>Cidade</label>
            <select
              className={s.drawerSelect}
              value={cidade || ''}
              onChange={e => onCidade(e.target.value || null)}
            >
              <option value="">Todas</option>
              {context.cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className={s.drawerFooter}>
          <button className={s.drawerClearBtn} onClick={() => { onSegmento(null); onCidade(null); onUf(null) }}>
            Limpar filtros
          </button>
          <button className={s.drawerApplyBtn} onClick={onClose}>Aplicar</button>
        </div>
      </div>
    </>
  )
}
