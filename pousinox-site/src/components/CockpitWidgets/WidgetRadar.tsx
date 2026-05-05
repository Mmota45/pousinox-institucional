import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit } from '../../contexts/CockpitContext'
import { Flame, MapPin, TrendingUp, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface TopProspect {
  id: number
  razao_social: string
  nome_fantasia: string
  cidade: string
  uf: string
  segmento: string
  score_total: number
}

export default function WidgetRadar() {
  const { empresa, setEmpresa } = useCockpit()
  const [top, setTop] = useState<TopProspect[]>([])
  const [loading, setLoading] = useState(true)
  const [ufStats, setUfStats] = useState<{ uf: string; count: number }[]>([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      // Top 10 prospects por score
      const { data: prospects } = await supabaseAdmin
        .from('prospeccao')
        .select('id, razao_social, nome_fantasia, cidade, uf, segmento, score_total')
        .not('score_total', 'is', null)
        .order('score_total', { ascending: false })
        .limit(10)
      setTop(prospects ?? [])

      // Distribuição por UF (top 8)
      const { data: ufs } = await supabaseAdmin
        .rpc('fn_top_prospects', { n: 100, filtro_uf: null })
        .then(() => supabaseAdmin
          .from('prospeccao')
          .select('uf')
          .not('uf', 'is', null)
          .limit(5000)
        )
      if (ufs) {
        const map: Record<string, number> = {}
        ufs.forEach(r => { map[r.uf] = (map[r.uf] || 0) + 1 })
        setUfStats(Object.entries(map).map(([uf, count]) => ({ uf, count })).sort((a, b) => b.count - a.count).slice(0, 8))
      }
      setLoading(false)
    })()
  }, [empresa?.cnpj])

  if (loading) return <div className={styles.widgetLoading}>Carregando radar...</div>

  const maxUf = ufStats[0]?.count || 1

  return (
    <div className={styles.widget}>
      {/* Top prospects */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Flame size={14} color="#ef4444" />
          <h3 className={styles.widgetSectionTitle}>Top Prospects</h3>
          <Link to="/admin/central-vendas" className={styles.widgetLink}><ExternalLink size={12} /> Central</Link>
        </div>
        <div className={styles.listCompact}>
          {top.map((p, i) => (
            <button
              key={p.id}
              className={styles.listItem}
              onClick={() => setEmpresa({ cnpj: '', nome: p.nome_fantasia || p.razao_social, tipo: 'prospect', id: p.id })}
            >
              <span className={styles.listPos}>{i + 1}</span>
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{p.nome_fantasia || p.razao_social}</span>
                <span className={styles.listMeta}>{p.cidade}/{p.uf} · {p.segmento}</span>
              </div>
              <span className={styles.scoreBadge} style={{
                background: p.score_total >= 7 ? '#dcfce7' : p.score_total >= 4 ? '#fef9c3' : '#f1f5f9',
                color: p.score_total >= 7 ? '#166534' : p.score_total >= 4 ? '#854d0e' : '#64748b',
              }}>
                {p.score_total?.toFixed(1)}
              </span>
            </button>
          ))}
          {top.length === 0 && <div className={styles.vazio}>Sem prospects com score</div>}
        </div>
      </div>

      {/* UF distribution */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <MapPin size={14} color="#2563eb" />
          <h3 className={styles.widgetSectionTitle}>Distribuição por UF</h3>
        </div>
        <div className={styles.barList}>
          {ufStats.map(s => (
            <div key={s.uf} className={styles.barItem}>
              <span className={styles.barLabel}>{s.uf}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(s.count / maxUf) * 100}%` }} />
              </div>
              <span className={styles.barValue}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
