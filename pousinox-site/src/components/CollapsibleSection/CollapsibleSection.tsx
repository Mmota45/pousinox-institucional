import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import styles from './CollapsibleSection.module.css'

interface Props {
  title: ReactNode
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
      <button className={`${styles.header} ${open ? styles.headerOpen : ''}`} onClick={() => setOpen(!open)}>
        <span className={styles.title}>{title}</span>
        {badge && <span className={styles.badge} style={badgeColor ? { background: badgeColor, color: '#fff' } : undefined}>{badge}</span>}
        {count !== undefined && <span className={styles.count}>{count} itens</span>}
        <span className={styles.chevron}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}
