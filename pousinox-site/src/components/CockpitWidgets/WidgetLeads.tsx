import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit } from '../../contexts/CockpitContext'
import { UserPlus, ExternalLink, Phone, Mail, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface Lead {
  id: number
  nome: string
  whatsapp: string
  email: string
  cidade: string
  uf: string
  produto: string
  status: string
  created_at: string
}

const STATUS_COR: Record<string, { bg: string; color: string }> = {
  novo: { bg: '#eff6ff', color: '#1d4ed8' },
  em_contato: { bg: '#fef9c3', color: '#854d0e' },
  proposta: { bg: '#f3e8ff', color: '#7c3aed' },
  fechado: { bg: '#dcfce7', color: '#166534' },
  perdido: { bg: '#fee2e2', color: '#991b1b' },
}

export default function WidgetLeads() {
  const { empresa } = useCockpit()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<{ status: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [recentes, todos] = await Promise.allSettled([
        supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false }).limit(10),
        supabaseAdmin.from('leads').select('status').gte('created_at', inicioMes),
      ])

      setLeads(recentes.status === 'fulfilled' ? (recentes.value.data ?? []) : [])

      if (todos.status === 'fulfilled') {
        const map: Record<string, number> = {}
        ;(todos.value.data ?? []).forEach(l => { map[l.status] = (map[l.status] || 0) + 1 })
        setStats(Object.entries(map).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count))
      }
      setLoading(false)
    })()
  }, [empresa?.cnpj])

  if (loading) return <div className={styles.widgetLoading}>Carregando leads...</div>

  const fmtData = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`
  }

  const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

  return (
    <div className={styles.widget}>
      {/* Stats do mês */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <UserPlus size={14} color="#f59e0b" />
          <h3 className={styles.widgetSectionTitle}>Leads do mês</h3>
          <Link to="/admin/leads" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
        </div>
        {stats.length > 0 && (
          <div className={styles.statusPills}>
            {stats.map(s => {
              const cor = STATUS_COR[s.status] || { bg: '#f1f5f9', color: '#64748b' }
              return (
                <span key={s.status} className={styles.statusPill} style={{ background: cor.bg, color: cor.color }}>
                  {statusLabel(s.status)}: {s.count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Lista recente */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <h3 className={styles.widgetSectionTitle}>Recentes</h3>
        </div>
        <div className={styles.listCompact}>
          {leads.map(l => {
            const cor = STATUS_COR[l.status] || { bg: '#f1f5f9', color: '#64748b' }
            return (
              <div key={l.id} className={styles.listItem}>
                <span className={styles.statusDot} style={{ background: cor.color }} />
                <div className={styles.listInfo}>
                  <span className={styles.listNome}>{l.nome}</span>
                  <span className={styles.listMeta}>
                    {l.produto && `${l.produto} · `}{l.cidade && l.uf && `${l.cidade}/${l.uf} · `}{fmtData(l.created_at)}
                  </span>
                </div>
                <span className={styles.scoreBadge} style={{ background: cor.bg, color: cor.color }}>
                  {statusLabel(l.status)}
                </span>
              </div>
            )
          })}
          {leads.length === 0 && <div className={styles.vazio}>Sem leads recentes</div>}
        </div>
      </div>
    </div>
  )
}
