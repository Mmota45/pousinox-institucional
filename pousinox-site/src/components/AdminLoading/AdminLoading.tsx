/**
 * AdminLoading — Loading com progresso % para módulos admin
 * Props: total (steps), current (completed), label (opcional)
 */
import styles from './AdminLoading.module.css'

interface Props {
  total: number
  current: number
  label?: string
}

export default function AdminLoading({ total, current, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className={styles.wrap}>
      <div className={styles.ring}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#e5e8ed" strokeWidth="5" />
          <circle
            cx="44" cy="44" r="36" fill="none"
            stroke="#1a3a5c" strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={styles.progress}
          />
        </svg>
        <span className={styles.pct}>{pct}%</span>
      </div>
      {label && <p className={styles.label}>{label}</p>}
    </div>
  )
}
