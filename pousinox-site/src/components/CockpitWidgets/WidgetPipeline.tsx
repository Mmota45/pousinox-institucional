import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit } from '../../contexts/CockpitContext'
import { Handshake, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

const ESTAGIOS = ['entrada', 'qualificado', 'proposta', 'negociacao'] as const
const ESTAGIO_LABEL: Record<string, string> = {
  entrada: 'Entrada', qualificado: 'Qualificado', proposta: 'Proposta', negociacao: 'Negociação',
}
const ESTAGIO_COR: Record<string, string> = {
  entrada: '#94a3b8', qualificado: '#2563eb', proposta: '#8b5cf6', negociacao: '#f59e0b',
}

interface Deal {
  id: number
  empresa_nome: string
  estagio: string
  valor: number
}

export default function WidgetPipeline() {
  const { empresa } = useCockpit()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabaseAdmin
        .from('pipeline_deals')
        .select('id, empresa_nome, estagio, valor')
        .neq('estagio', 'ganho')
        .neq('estagio', 'perdido')
        .order('valor', { ascending: false })
        .limit(30)
      setDeals(data ?? [])
      setLoading(false)
    })()
  }, [empresa?.cnpj])

  if (loading) return <div className={styles.widgetLoading}>Carregando pipeline...</div>

  const fmt = (v: number) => 'R$ ' + v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const porEstagio = ESTAGIOS.map(e => ({
    estagio: e,
    deals: deals.filter(d => d.estagio === e),
    total: deals.filter(d => d.estagio === e).reduce((s, d) => s + Number(d.valor || 0), 0),
  }))

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Handshake size={14} color="#2563eb" />
        <h3 className={styles.widgetSectionTitle}>Pipeline</h3>
        <Link to="/admin/pipeline" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
      </div>

      {/* Funnel summary */}
      <div className={styles.funnelBar}>
        {porEstagio.map(e => (
          <div
            key={e.estagio}
            className={styles.funnelSegment}
            style={{
              flex: Math.max(e.deals.length, 1),
              background: ESTAGIO_COR[e.estagio],
            }}
            title={`${ESTAGIO_LABEL[e.estagio]}: ${e.deals.length} deals · ${fmt(e.total)}`}
          >
            <span className={styles.funnelLabel}>{e.deals.length}</span>
          </div>
        ))}
      </div>
      <div className={styles.funnelLegend}>
        {porEstagio.map(e => (
          <span key={e.estagio} className={styles.funnelLegendItem}>
            <span className={styles.funnelDot} style={{ background: ESTAGIO_COR[e.estagio] }} />
            {ESTAGIO_LABEL[e.estagio]} ({fmt(e.total)})
          </span>
        ))}
      </div>

      {/* Top deals */}
      <div className={styles.listCompact}>
        {deals.slice(0, 8).map(d => (
          <div key={d.id} className={styles.listItem}>
            <span className={styles.funnelDot} style={{ background: ESTAGIO_COR[d.estagio] }} />
            <div className={styles.listInfo}>
              <span className={styles.listNome}>{d.empresa_nome || `Deal #${d.id}`}</span>
              <span className={styles.listMeta}>{ESTAGIO_LABEL[d.estagio]}</span>
            </div>
            <span className={styles.listValor}>{fmt(Number(d.valor || 0))}</span>
          </div>
        ))}
        {deals.length === 0 && <div className={styles.vazio}>Sem deals ativos</div>}
      </div>
    </div>
  )
}
