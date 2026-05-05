import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { Lightbulb, Check, ChevronRight } from 'lucide-react'
import styles from './CockpitWidgets.module.css'

interface Insight {
  id: number
  tipo: string
  mensagem: string
  dados: any
  acionado: boolean
  criado_em: string
}

const TIPO_COR: Record<string, string> = {
  reposicao_proxima: '#f59e0b',
  prospect_quente_sem_deal: '#2563eb',
  deal_proposta_parado: '#dc2626',
  concentracao_receita: '#7c3aed',
  consulta_nl: '#64748b',
}

export default function WidgetInsights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('insights')
      .select('*')
      .eq('acionado', false)
      .neq('tipo', 'consulta_nl')
      .order('criado_em', { ascending: false })
      .limit(8)
    setInsights(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function marcarAcionado(id: number) {
    await supabaseAdmin.from('insights').update({ acionado: true }).eq('id', id)
    setInsights(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className={styles.widgetLoading}>Carregando insights...</div>

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <Lightbulb size={14} color="#f59e0b" />
        <h3 className={styles.widgetSectionTitle}>Insights IA ({insights.length})</h3>
      </div>

      {insights.length === 0 ? (
        <div className={styles.vazio}>Sem insights pendentes</div>
      ) : (
        <div className={styles.listCompact}>
          {insights.map(ins => (
            <button key={ins.id} className={styles.listItem} onClick={() => marcarAcionado(ins.id)} style={{ borderLeftColor: TIPO_COR[ins.tipo] || '#94a3b8' }}>
              <ChevronRight size={12} color={TIPO_COR[ins.tipo] || '#94a3b8'} />
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{ins.mensagem}</span>
                <span className={styles.listMeta}>{ins.tipo.replace(/_/g, ' ')}</span>
              </div>
              <Check size={14} color="#16a34a" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
