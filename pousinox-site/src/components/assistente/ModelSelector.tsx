import s from './ModelSelector.module.css'

export type ModelKey = 'haiku' | 'sonnet' | 'gemini'

interface ModelOption {
  key: ModelKey
  label: string
  icon: string
  cost: string  // custo resumido
}

const OPTIONS: ModelOption[] = [
  { key: 'haiku',  label: 'Rápido',   icon: '⚡', cost: '$0.80/M' },
  { key: 'sonnet', label: 'Profundo', icon: '🧠', cost: '$3/M' },
  { key: 'gemini', label: 'Gemini',   icon: '💎', cost: 'grátis' },
]

interface Props {
  value: ModelKey
  onChange: (v: ModelKey) => void
}

export default function ModelSelector({ value, onChange }: Props) {
  return (
    <div className={s.wrap}>
      {OPTIONS.map(o => (
        <button
          key={o.key}
          className={`${s.pill} ${value === o.key ? s.active : ''}`}
          onClick={() => onChange(o.key)}
          title={`${o.label} — ${o.cost}`}
        >
          {o.icon} {o.label}
          <span className={s.cost}>{o.cost}</span>
        </button>
      ))}
    </div>
  )
}

export function ModelBadge({ model }: { model?: string }) {
  if (!model) return null
  const key = model.includes('haiku') ? 'haiku' : model.includes('sonnet') ? 'sonnet' : model.includes('gemini') ? 'gemini' : null
  if (!key) return null
  const label = key === 'haiku' ? 'Haiku' : key === 'sonnet' ? 'Sonnet' : 'Gemini'
  const cls = key === 'haiku' ? s.badgeHaiku : key === 'sonnet' ? s.badgeSonnet : s.badgeGemini
  return <span className={`${s.badge} ${cls}`}>{label}</span>
}
