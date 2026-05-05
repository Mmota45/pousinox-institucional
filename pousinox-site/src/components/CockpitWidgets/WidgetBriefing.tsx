import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Sun, Calendar } from 'lucide-react'
import styles from './CockpitWidgets.module.css'

interface Briefing {
  id: number
  data: string
  conteudo: {
    resumo?: string
    kpis?: { label: string; valor: string }[]
    alertas?: string[]
    acoes?: string[]
  }
  enviado_em: string | null
  canal: string | null
}

export default function WidgetBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabaseAdmin
        .from('briefings')
        .select('*')
        .order('data', { ascending: false })
        .limit(1)
        .single()
      setBriefing(data)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className={styles.widgetLoading}>Carregando briefing...</div>

  if (!briefing) return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Sun size={14} color="#f59e0b" />
        <h3 className={styles.widgetSectionTitle}>Briefing do Dia</h3>
      </div>
      <div className={styles.vazio}>Nenhum briefing disponível ainda</div>
    </div>
  )

  const c = briefing.conteudo
  const fmtData = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}/${y}`
  }

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Sun size={14} color="#f59e0b" />
        <h3 className={styles.widgetSectionTitle}>Briefing do Dia</h3>
        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={10} /> {fmtData(briefing.data)}
        </span>
      </div>

      {c.resumo && <p style={{ fontSize: '0.82rem', color: '#1a2332', margin: '0 0 8px', lineHeight: 1.5 }}>{c.resumo}</p>}

      {c.kpis && c.kpis.length > 0 && (
        <div className={styles.miniKpis}>
          {c.kpis.map((k, i) => (
            <div key={i} className={styles.miniKpi}>
              <span className={styles.miniKpiLabel}>{k.label}</span>
              <strong className={styles.miniKpiValor}>{k.valor}</strong>
            </div>
          ))}
        </div>
      )}

      {c.alertas && c.alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {c.alertas.map((a, i) => (
            <div key={i} className={styles.alertaInline}>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {c.acoes && c.acoes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const }}>Ações sugeridas</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: '0.8rem', color: '#1a2332' }}>
            {c.acoes.map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
