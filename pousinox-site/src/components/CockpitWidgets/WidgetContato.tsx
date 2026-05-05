import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit } from '../../contexts/CockpitContext'
import { CalendarClock, AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface Followup {
  id: number
  tipo: string
  data_prevista: string
  prospect_id: number
  prospect_nome?: string
  status: string
}

export default function WidgetContato() {
  const { empresa } = useCockpit()
  const [atrasados, setAtrasados] = useState<Followup[]>([])
  const [hoje, setHoje] = useState<Followup[]>([])
  const [proximos, setProximos] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const now = new Date()
      const hojeStr = now.toISOString().slice(0, 10)
      const em7dias = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)

      let query = supabaseAdmin
        .from('followups')
        .select('id, tipo, data_prevista, prospect_id, status')
        .eq('status', 'pendente')
        .order('data_prevista', { ascending: true })
        .limit(30)

      const { data } = await query
      const items = (data ?? []) as Followup[]

      // Enriquecer com nome do prospect (batch)
      const ids = [...new Set(items.map(f => f.prospect_id))]
      if (ids.length > 0) {
        const { data: prospects } = await supabaseAdmin
          .from('prospeccao')
          .select('id, nome_fantasia, razao_social')
          .in('id', ids)
        const map = new Map((prospects ?? []).map(p => [p.id, p.nome_fantasia || p.razao_social]))
        items.forEach(f => { f.prospect_nome = map.get(f.prospect_id) || `#${f.prospect_id}` })
      }

      setAtrasados(items.filter(f => f.data_prevista < hojeStr))
      setHoje(items.filter(f => f.data_prevista === hojeStr))
      setProximos(items.filter(f => f.data_prevista > hojeStr && f.data_prevista <= em7dias))
      setLoading(false)
    })()
  }, [empresa?.cnpj])

  if (loading) return <div className={styles.widgetLoading}>Carregando follow-ups...</div>

  const fmtData = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}`
  }

  const renderList = (items: Followup[], cor: string, icon: React.ReactNode) => (
    <div className={styles.listCompact}>
      {items.map(f => (
        <div key={f.id} className={styles.listItem} style={{ borderLeftColor: cor }}>
          <div className={styles.listItemIcon}>{icon}</div>
          <div className={styles.listInfo}>
            <span className={styles.listNome}>{f.prospect_nome}</span>
            <span className={styles.listMeta}>{f.tipo} · {fmtData(f.data_prevista)}</span>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className={styles.vazio}>Nenhum</div>}
    </div>
  )

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <CalendarClock size={14} color="#f59e0b" />
        <h3 className={styles.widgetSectionTitle}>Follow-ups</h3>
        <Link to="/admin/central-vendas" className={styles.widgetLink}><ExternalLink size={12} /> Central</Link>
      </div>

      {/* Kanban compacto */}
      <div className={styles.kanban3}>
        <div className={styles.kanbanCol}>
          <div className={styles.kanbanHeader} style={{ color: '#dc2626' }}>
            <AlertTriangle size={12} /> Atrasados ({atrasados.length})
          </div>
          {renderList(atrasados, '#fecaca', <AlertTriangle size={12} color="#dc2626" />)}
        </div>
        <div className={styles.kanbanCol}>
          <div className={styles.kanbanHeader} style={{ color: '#f59e0b' }}>
            <Clock size={12} /> Hoje ({hoje.length})
          </div>
          {renderList(hoje, '#fef3c7', <Clock size={12} color="#f59e0b" />)}
        </div>
        <div className={styles.kanbanCol}>
          <div className={styles.kanbanHeader} style={{ color: '#16a34a' }}>
            <CheckCircle2 size={12} /> Próx. 7 dias ({proximos.length})
          </div>
          {renderList(proximos, '#dcfce7', <CheckCircle2 size={12} color="#16a34a" />)}
        </div>
      </div>
    </div>
  )
}
