import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Heart, ExternalLink, Star, AlertTriangle, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface ClienteRFM {
  id: number
  razao_social: string
  rfm_segmento: string
  rfm_score: number
  cidade: string
  uf: string
}

const SEGMENTO_COR: Record<string, { bg: string; color: string }> = {
  campeao: { bg: '#dcfce7', color: '#166534' },
  leal: { bg: '#eff6ff', color: '#1d4ed8' },
  potencial: { bg: '#fef9c3', color: '#854d0e' },
  em_risco: { bg: '#fee2e2', color: '#991b1b' },
  perdido: { bg: '#f1f5f9', color: '#64748b' },
  novo: { bg: '#f3e8ff', color: '#7c3aed' },
  promissor: { bg: '#ecfdf5', color: '#059669' },
}

export default function WidgetPosVenda() {
  const [clientes, setClientes] = useState<ClienteRFM[]>([])
  const [segStats, setSegStats] = useState<{ segmento: string; count: number }[]>([])
  const [estoqueAlerta, setEstoqueAlerta] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [rfmRes, estRes] = await Promise.allSettled([
        supabaseAdmin.from('clientes').select('id, razao_social, rfm_segmento, rfm_score, cidade, uf')
          .not('rfm_segmento', 'is', null)
          .order('rfm_score', { ascending: false })
          .limit(50),
        supabaseAdmin.from('estoque_itens').select('id, saldo_atual, estoque_minimo')
          .eq('ativo', true).gt('estoque_minimo', 0),
      ])

      const clientesArr = rfmRes.status === 'fulfilled' ? (rfmRes.value.data ?? []) : []
      setClientes(clientesArr.slice(0, 10))

      // Stats por segmento
      const map: Record<string, number> = {}
      clientesArr.forEach(c => { map[c.rfm_segmento] = (map[c.rfm_segmento] || 0) + 1 })
      setSegStats(Object.entries(map).map(([segmento, count]) => ({ segmento, count })).sort((a, b) => b.count - a.count))

      // Estoque alerta
      if (estRes.status === 'fulfilled') {
        setEstoqueAlerta((estRes.value.data ?? []).filter(e => e.saldo_atual < e.estoque_minimo).length)
      }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className={styles.widgetLoading}>Carregando pós-venda...</div>

  const segLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

  return (
    <div className={styles.widget}>
      {/* Segmentos RFM */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Heart size={14} color="#ec4899" />
          <h3 className={styles.widgetSectionTitle}>Clientes RFM</h3>
          <Link to="/admin/clientes" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
        </div>
        {segStats.length > 0 && (
          <div className={styles.statusPills}>
            {segStats.map(s => {
              const cor = SEGMENTO_COR[s.segmento] || { bg: '#f1f5f9', color: '#64748b' }
              return (
                <span key={s.segmento} className={styles.statusPill} style={{ background: cor.bg, color: cor.color }}>
                  {segLabel(s.segmento)}: {s.count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Top clientes */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Star size={14} color="#f59e0b" />
          <h3 className={styles.widgetSectionTitle}>Top clientes</h3>
        </div>
        <div className={styles.listCompact}>
          {clientes.map(c => {
            const cor = SEGMENTO_COR[c.rfm_segmento] || { bg: '#f1f5f9', color: '#64748b' }
            return (
              <div key={c.id} className={styles.listItem}>
                <span className={styles.statusDot} style={{ background: cor.color }} />
                <div className={styles.listInfo}>
                  <span className={styles.listNome}>{c.razao_social}</span>
                  <span className={styles.listMeta}>{c.cidade}/{c.uf}</span>
                </div>
                <span className={styles.scoreBadge} style={{ background: cor.bg, color: cor.color }}>
                  {segLabel(c.rfm_segmento)}
                </span>
              </div>
            )
          })}
          {clientes.length === 0 && <div className={styles.vazio}>Sem dados RFM</div>}
        </div>
      </div>

      {/* Alerta estoque */}
      {estoqueAlerta > 0 && (
        <div className={styles.widgetSection}>
          <div className={styles.alertaInline}>
            <Package size={14} color="#f59e0b" />
            <span>{estoqueAlerta} itens abaixo do estoque mínimo</span>
            <Link to="/admin/estoque-mp" className={styles.widgetLink}><ExternalLink size={12} /> Ver</Link>
          </div>
        </div>
      )}
    </div>
  )
}
