import { useState, type ReactNode } from 'react'
import styles from './CollapsibleSection.module.css'

interface Props {
  title: string
  defaultOpen?: boolean
  count?: number
  children: ReactNode
  badge?: string
  badgeColor?: string
}

export default function CollapsibleSection({ title, defaultOpen = false, count, children, badge, badgeColor }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button className={`${styles.header} ${open ? styles.headerOpen : ''}`} onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '14px 16px', fontSize: '0.95rem', color: '#0f172a' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>{title}</span>
        {badge && <span className={styles.badge} style={badgeColor ? { background: badgeColor, color: '#fff' } : undefined}>{badge}</span>}
        {count !== undefined && <span className={styles.count}>{count} itens</span>}
        <span style={{ fontSize: '1.2rem', color: '#64748b', width: 24, textAlign: 'center', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}
