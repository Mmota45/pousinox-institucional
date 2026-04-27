import s from './ModelSelector.module.css'

export type ModelKey = 'auto' | 'gemini' | 'mistral' | 'cerebras'

interface ModelOption {
  key: ModelKey
  label: string
  icon: string
  cost: string
  best: string
}

const OPTIONS: ModelOption[] = [
  { key: 'auto',     label: 'Auto',     icon: '🤖', cost: 'grátis',  best: 'Escolhe a melhor IA para cada pergunta' },
  { key: 'gemini',   label: 'Gemini',   icon: '💎', cost: 'grátis',  best: 'Textos longos, resumos, conteúdo criativo' },
  { key: 'mistral',  label: 'Mistral',  icon: '🌀', cost: 'grátis',  best: 'Dados, tabelas, cálculos, análises' },
  { key: 'cerebras', label: 'Cerebras', icon: '⚡', cost: 'grátis',  best: 'Qwen 235B — rápido e poderoso' },
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
          title={`${o.label} (${o.cost}) — Melhor para: ${o.best}`}
        >
          {o.icon} {o.label}
          <span className={s.cost}>{o.cost}</span>
          {value === o.key && <span className={s.best}>{o.best}</span>}
        </button>
      ))}
    </div>
  )
}

export function ModelBadge({ model }: { model?: string }) {
  if (!model) return null
  const BADGE_MAP: Record<string, { match: string; label: string; cls: string }> = {
    gemini:   { match: 'gemini',   label: 'Gemini',   cls: s.badgeGemini },
    mistral:  { match: 'mistral',  label: 'Mistral',  cls: s.badgeMistral },
    cerebras: { match: 'qwen',     label: 'Cerebras', cls: s.badgeCerebras },
  }
  const entry = Object.values(BADGE_MAP).find(b => model.includes(b.match))
  if (!entry) return null
  const { label, cls } = entry
  return <span className={`${s.badge} ${cls}`}>{label}</span>
}
