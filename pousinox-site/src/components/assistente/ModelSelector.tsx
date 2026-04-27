import s from './ModelSelector.module.css'

export type ModelKey = 'haiku' | 'sonnet' | 'gemini' | 'groq' | 'cerebras' | 'mistral'

interface ModelOption {
  key: ModelKey
  label: string
  icon: string
  cost: string
}

const OPTIONS: ModelOption[] = [
  { key: 'haiku',    label: 'Rápido',   icon: '⚡', cost: '$0.80/M' },
  { key: 'sonnet',   label: 'Profundo', icon: '🧠', cost: '$3/M' },
  { key: 'gemini',   label: 'Gemini',   icon: '💎', cost: 'grátis' },
  { key: 'groq',     label: 'Groq',     icon: '🚀', cost: 'grátis' },
  { key: 'cerebras', label: 'Cerebras', icon: '⚙️', cost: 'grátis' },
  { key: 'mistral',  label: 'Mistral',  icon: '🌀', cost: 'grátis' },
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
  const BADGE_MAP: Record<string, { match: string; label: string; cls: string }> = {
    haiku:    { match: 'haiku',    label: 'Haiku',    cls: s.badgeHaiku },
    sonnet:   { match: 'sonnet',   label: 'Sonnet',   cls: s.badgeSonnet },
    gemini:   { match: 'gemini',   label: 'Gemini',   cls: s.badgeGemini },
    groq:     { match: 'llama-3.3-70b-versatile', label: 'Groq', cls: s.badgeGroq },
    cerebras: { match: 'llama-3.3-70b', label: 'Cerebras', cls: s.badgeCerebras },
    mistral:  { match: 'mistral',  label: 'Mistral',  cls: s.badgeMistral },
  }
  // Match longest first to avoid cerebras matching groq's llama
  const entry = Object.values(BADGE_MAP).sort((a, b) => b.match.length - a.match.length).find(b => model.includes(b.match))
  if (!entry) return null
  const { label, cls } = entry
  return <span className={`${s.badge} ${cls}`}>{label}</span>
}
