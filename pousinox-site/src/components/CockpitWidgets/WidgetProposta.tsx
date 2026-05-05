import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit } from '../../contexts/CockpitContext'
import { FileText, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface Orcamento {
  id: number
  numero: string
  cliente_nome: string
  total: number
  status: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
  rascunho: { icon: <Clock size={12} />, bg: '#f1f5f9', color: '#64748b', label: 'Rascunho' },
  enviado: { icon: <FileText size={12} />, bg: '#eff6ff', color: '#1d4ed8', label: 'Enviado' },
  aprovado: { icon: <CheckCircle2 size={12} />, bg: '#dcfce7', color: '#166534', label: 'Aprovado' },
  recusado: { icon: <XCircle size={12} />, bg: '#fee2e2', color: '#991b1b', label: 'Recusado' },
}

export default function WidgetProposta() {
  const { empresa } = useCockpit()
  const [orcs, setOrcs] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabaseAdmin
        .from('orcamentos')
        .select('id, numero, cliente_nome, total, status, created_at')
        .order('created_at', { ascending: false })
        .limit(12)
      setOrcs(data ?? [])
      setLoading(false)
    })()
  }, [empresa?.cnpj])

  if (loading) return <div className={styles.widgetLoading}>Carregando orçamentos...</div>

  const fmt = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fmtData = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`
  }

  // Stats
  const enviados = orcs.filter(o => o.status === 'enviado')
  const aprovados = orcs.filter(o => o.status === 'aprovado')
  const totalEnviado = enviados.reduce((s, o) => s + Number(o.total || 0), 0)

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <FileText size={14} color="#0ea5e9" />
        <h3 className={styles.widgetSectionTitle}>Orçamentos</h3>
        <Link to="/admin/orcamento" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
      </div>

      {/* KPIs inline */}
      <div className={styles.miniKpis}>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Enviados</span>
          <strong className={styles.miniKpiValor} style={{ color: '#1d4ed8' }}>{enviados.length}</strong>
          <span className={styles.miniKpiSub}>{fmt(totalEnviado)}</span>
        </div>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Aprovados</span>
          <strong className={styles.miniKpiValor} style={{ color: '#16a34a' }}>{aprovados.length}</strong>
        </div>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Taxa</span>
          <strong className={styles.miniKpiValor}>
            {enviados.length + aprovados.length > 0
              ? `${Math.round((aprovados.length / (enviados.length + aprovados.length)) * 100)}%`
              : '—'}
          </strong>
        </div>
      </div>

      {/* Lista recente */}
      <div className={styles.listCompact}>
        {orcs.map(o => {
          const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.rascunho
          return (
            <div key={o.id} className={styles.listItem}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{o.cliente_nome || o.numero || `#${o.id}`}</span>
                <span className={styles.listMeta}>{o.numero} · {fmtData(o.created_at)}</span>
              </div>
              <span className={styles.listValor}>{fmt(Number(o.total || 0))}</span>
            </div>
          )
        })}
        {orcs.length === 0 && <div className={styles.vazio}>Sem orçamentos</div>}
      </div>
    </div>
  )
}
