import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Cog, ToggleLeft, ToggleRight } from 'lucide-react'
import styles from './CockpitWidgets.module.css'

interface EventRule {
  id: number
  nome: string
  trigger_tipo: string
  ativo: boolean
}

export default function WidgetAutomacoes() {
  const [rules, setRules] = useState<EventRule[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('event_rules')
      .select('id, nome, trigger_tipo, ativo')
      .order('id')
    setRules(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function toggleRule(id: number, ativo: boolean) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ativo: !ativo } : r))
    await supabaseAdmin.from('event_rules').update({ ativo: !ativo }).eq('id', id)
  }

  if (loading) return <div className={styles.widgetLoading}>Carregando automações...</div>

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Cog size={14} color="#64748b" />
        <h3 className={styles.widgetSectionTitle}>Automações</h3>
        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
          {rules.filter(r => r.ativo).length}/{rules.length} ativas
        </span>
      </div>

      {rules.length === 0 ? (
        <div className={styles.vazio}>Sem regras configuradas</div>
      ) : (
        <div className={styles.listCompact}>
          {rules.map(r => (
            <button key={r.id} className={styles.listItem} onClick={() => toggleRule(r.id, r.ativo)}>
              {r.ativo
                ? <ToggleRight size={18} color="#16a34a" />
                : <ToggleLeft size={18} color="#94a3b8" />
              }
              <div className={styles.listInfo}>
                <span className={styles.listNome} style={{ opacity: r.ativo ? 1 : 0.5 }}>{r.nome}</span>
                <span className={styles.listMeta}>{r.trigger_tipo}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
