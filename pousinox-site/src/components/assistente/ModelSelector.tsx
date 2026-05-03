import { type ReactNode } from 'react'
import s from './ModelSelector.module.css'

export type ModelKey = 'auto' | 'gemini' | 'mistral' | 'cerebras' | 'groq' | 'haiku' | 'sonnet'

interface ModelOption {
  key: ModelKey
  label: string
  icon: ReactNode
  cost: string
  best: string
}

const ico = (d: string, color: string): ReactNode => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>

const OPTIONS: ModelOption[] = [
  { key: 'auto',     label: 'Auto',     icon: ico('M12 2a4 4 0 014 4v1a2 2 0 012 2v5a2 2 0 01-2 2h-1v2l-3-2H8a2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z', '#6366f1'), cost: 'grátis',  best: 'Escolhe a melhor IA para cada pergunta' },
  { key: 'gemini',   label: 'Gemini',   icon: ico('M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', '#0ea5e9'), cost: 'grátis',  best: 'Contexto 1M tokens · visão · rápido' },
  { key: 'groq',     label: 'Groq',     icon: ico('M13 2L3 14h9l-1 8 10-12h-9l1-8', '#f59e0b'), cost: 'grátis',  best: 'Llama 70B — versátil · ultra rápido' },
  { key: 'cerebras', label: 'Cerebras', icon: ico('M12 2a10 10 0 100 20 10 10 0 000-20zM12 8a4 4 0 100 8 4 4 0 000-8z', '#8b5cf6'), cost: 'grátis',  best: 'Inferência recorde · propósito geral' },
  { key: 'mistral',  label: 'Mistral',  icon: ico('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 12l4-4 4 4-4 4', '#ef4444'), cost: 'grátis',  best: 'Leve · código · multilingual' },
  { key: 'haiku',    label: 'Haiku',    icon: ico('M17 8C8 10 5.9 16.17 3.82 21.34M12.54 6.64C10.11 3.64 5.27 3.34 2.64 6.34M21 3s-3 5.5-6 6c-3 .5-5-2.5-5-2.5', '#10b981'), cost: 'pago',    best: 'Rápido · barato · classificação' },
  { key: 'sonnet',   label: 'Sonnet',   icon: ico('M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z', '#d946ef'), cost: 'pago',    best: 'Raciocínio avançado · código · análise' },
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
    groq:     { match: 'llama',    label: 'Groq',     cls: s.badgeGroq },
    haiku:    { match: 'haiku',    label: 'Haiku',     cls: s.badgeHaiku },
    sonnet:   { match: 'sonnet',   label: 'Sonnet',    cls: s.badgeSonnet },
  }
  const entry = Object.values(BADGE_MAP).find(b => model.includes(b.match))
  if (!entry) return null
  const { label, cls } = entry
  return <span className={`${s.badge} ${cls}`}>{label}</span>
}
