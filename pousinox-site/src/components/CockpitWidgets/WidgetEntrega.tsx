import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Truck, Hammer, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface OP {
  id: number
  numero: string
  titulo: string
  status: string
}

interface Projeto {
  id: number
  titulo: string
  status: string
  cliente: string
}

export default function WidgetEntrega() {
  const [ops, setOps] = useState<OP[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [opsRes, projRes] = await Promise.allSettled([
        supabaseAdmin.from('ordens_producao').select('id, numero, titulo, status')
          .in('status', ['em_producao', 'liberada', 'planejada'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabaseAdmin.from('projetos').select('id, titulo, status, cliente')
          .in('status', ['em_andamento', 'aprovado'])
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      setOps(opsRes.status === 'fulfilled' ? (opsRes.value.data ?? []) : [])
      setProjetos(projRes.status === 'fulfilled' ? (projRes.value.data ?? []) : [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className={styles.widgetLoading}>Carregando operação...</div>

  const statusIcon = (s: string) => {
    if (s === 'em_producao' || s === 'em_andamento') return <Hammer size={12} color="#f59e0b" />
    if (s === 'liberada' || s === 'aprovado') return <CheckCircle2 size={12} color="#2563eb" />
    return <AlertTriangle size={12} color="#94a3b8" />
  }

  const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

  return (
    <div className={styles.widget}>
      {/* Projetos */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Truck size={14} color="#ea580c" />
          <h3 className={styles.widgetSectionTitle}>Projetos ativos</h3>
          <Link to="/admin/projetos" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
        </div>
        <div className={styles.listCompact}>
          {projetos.map(p => (
            <div key={p.id} className={styles.listItem}>
              {statusIcon(p.status)}
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{p.titulo}</span>
                <span className={styles.listMeta}>{p.cliente} · {statusLabel(p.status)}</span>
              </div>
            </div>
          ))}
          {projetos.length === 0 && <div className={styles.vazio}>Sem projetos ativos</div>}
        </div>
      </div>

      {/* OPs */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Hammer size={14} color="#f59e0b" />
          <h3 className={styles.widgetSectionTitle}>Ordens de Produção</h3>
          <Link to="/admin/producao" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
        </div>
        <div className={styles.listCompact}>
          {ops.map(o => (
            <div key={o.id} className={styles.listItem}>
              {statusIcon(o.status)}
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{o.numero} — {o.titulo}</span>
                <span className={styles.listMeta}>{statusLabel(o.status)}</span>
              </div>
            </div>
          ))}
          {ops.length === 0 && <div className={styles.vazio}>Sem OPs ativas</div>}
        </div>
      </div>
    </div>
  )
}
