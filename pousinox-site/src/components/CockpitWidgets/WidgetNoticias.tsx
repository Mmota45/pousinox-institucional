import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Newspaper, ExternalLink, Eye } from 'lucide-react'
import styles from './CockpitWidgets.module.css'

interface Noticia {
  id: number
  titulo: string
  resumo: string | null
  url: string | null
  fonte: string | null
  relevancia: number
  lida: boolean
  criado_em: string
}

export default function WidgetNoticias() {
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('noticias_radar')
      .select('*')
      .gte('relevancia', 5)
      .order('criado_em', { ascending: false })
      .limit(8)
    setNoticias(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function marcarLida(id: number) {
    await supabaseAdmin.from('noticias_radar').update({ lida: true }).eq('id', id)
    setNoticias(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  if (loading) return <div className={styles.widgetLoading}>Carregando notícias...</div>

  const relBg = (r: number) => r >= 8 ? '#dcfce7' : r >= 6 ? '#fef9c3' : '#f1f5f9'
  const relColor = (r: number) => r >= 8 ? '#166534' : r >= 6 ? '#854d0e' : '#64748b'

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Newspaper size={14} color="#2563eb" />
        <h3 className={styles.widgetSectionTitle}>Radar de Notícias</h3>
      </div>

      {noticias.length === 0 ? (
        <div className={styles.vazio}>Sem notícias recentes</div>
      ) : (
        <div className={styles.listCompact}>
          {noticias.map(n => (
            <div key={n.id} className={styles.listItem} style={{ opacity: n.lida ? 0.6 : 1 }}>
              <span className={styles.scoreBadge} style={{ background: relBg(n.relevancia), color: relColor(n.relevancia) }}>
                {n.relevancia}
              </span>
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{n.titulo}</span>
                <span className={styles.listMeta}>{n.fonte || 'Fonte desconhecida'}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {n.url && (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', padding: 4, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ExternalLink size={12} />
                  </a>
                )}
                {!n.lida && (
                  <button
                    onClick={() => marcarLida(n.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Marcar como lida"
                  >
                    <Eye size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
