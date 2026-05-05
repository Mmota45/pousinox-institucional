import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Bell, Check, AlertTriangle, Info, Zap } from 'lucide-react'
import styles from './CockpitWidgets.module.css'

interface Alerta {
  id: number
  tipo: string
  severidade: string
  mensagem: string
  dados: any
  lido: boolean
  criado_em: string
}

const SEV_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  critica: { icon: <Zap size={12} />, bg: '#fee2e2', color: '#991b1b' },
  alta:    { icon: <AlertTriangle size={12} />, bg: '#fef9c3', color: '#854d0e' },
  media:   { icon: <Info size={12} />, bg: '#eff6ff', color: '#1d4ed8' },
  baixa:   { icon: <Info size={12} />, bg: '#f1f5f9', color: '#64748b' },
}

export default function WidgetAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('alertas')
      .select('*')
      .eq('lido', false)
      .order('criado_em', { ascending: false })
      .limit(10)
    setAlertas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function marcarLido(id: number) {
    await supabaseAdmin.from('alertas').update({ lido: true }).eq('id', id)
    setAlertas(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className={styles.widgetLoading}>Carregando alertas...</div>

  const fmtData = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Bell size={14} color="#f59e0b" />
        <h3 className={styles.widgetSectionTitle}>Alertas ({alertas.length})</h3>
      </div>

      {alertas.length === 0 ? (
        <div className={styles.vazio}>Sem alertas pendentes</div>
      ) : (
        <div className={styles.listCompact}>
          {alertas.map(a => {
            const sev = SEV_CONFIG[a.severidade] || SEV_CONFIG.media
            return (
              <div key={a.id} className={styles.listItem} style={{ borderLeftColor: sev.color }}>
                <span style={{ color: sev.color }}>{sev.icon}</span>
                <div className={styles.listInfo}>
                  <span className={styles.listNome}>{a.mensagem}</span>
                  <span className={styles.listMeta}>{a.tipo} · {fmtData(a.criado_em)}</span>
                </div>
                <button
                  onClick={() => marcarLido(a.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Marcar como lido"
                >
                  <Check size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
