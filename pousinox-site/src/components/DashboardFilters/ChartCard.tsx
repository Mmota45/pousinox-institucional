import { useState, useRef, useCallback, type ReactNode } from 'react'
import s from './ChartCard.module.css'

interface Props {
  title: string
  subtitle?: string
  active?: boolean
  activeLabel?: string
  children: ReactNode
  /** data for CSV export: [headers, ...rows] */
  csvData?: string[][]
  csvFilename?: string
  noData?: boolean
}

export default function ChartCard({ title, subtitle, active, activeLabel, children, csvData, csvFilename, noData }: Props) {
  const [expanded, setExpanded] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  const exportCSV = useCallback(() => {
    if (!csvData?.length) return
    const csv = csvData.map(row => row.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${csvFilename || 'dados'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }, [csvData, csvFilename])

  const exportPNG = useCallback(() => {
    const el = expanded ? document.querySelector(`.${s.modalChart}`) as HTMLElement : chartRef.current
    if (!el) return
    const svg = el.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const svgStr = new XMLSerializer().serializeToString(clone)
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `${csvFilename || 'grafico'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
  }, [expanded, csvFilename])

  return (
    <>
      <div className={`${s.card} ${active ? s.cardActive : ''}`}>
        <div className={s.cardHeader}>
          <div>
            <h3 className={s.cardTitle}>
              {title}
              {activeLabel && <span className={s.cardFilter}> — {activeLabel}</span>}
            </h3>
            {subtitle && <p className={s.cardSub}>{subtitle}</p>}
          </div>
          <div className={s.cardActions}>
            <button className={s.actionBtn} onClick={() => setExpanded(true)} title="Expandir gráfico">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            {csvData && csvData.length > 1 && (
              <button className={s.actionBtn} onClick={exportCSV} title="Exportar CSV">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            )}
            <button className={s.actionBtn} onClick={exportPNG} title="Exportar imagem">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
          </div>
        </div>
        <div ref={chartRef} className={s.cardBody}>
          {noData ? <div className={s.noData}>Sem dados no período</div> : children}
        </div>
      </div>

      {/* Modal expanded */}
      {expanded && (
        <div className={s.modalBackdrop} onClick={() => setExpanded(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <div>
                <h3 className={s.modalTitle}>{title}</h3>
                {subtitle && <p className={s.modalSub}>{subtitle}</p>}
              </div>
              <div className={s.modalActions}>
                {csvData && csvData.length > 1 && (
                  <button className={s.actionBtn} onClick={exportCSV} title="Exportar CSV">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                )}
                <button className={s.actionBtn} onClick={exportPNG} title="Exportar imagem">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
                <button className={s.modalClose} onClick={() => setExpanded(false)}>✕</button>
              </div>
            </div>
            <div className={`${s.modalChart}`}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
