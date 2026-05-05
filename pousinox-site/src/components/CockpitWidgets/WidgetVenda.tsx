import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { ShoppingCart, ExternalLink, TrendingUp, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CockpitWidgets.module.css'

interface Venda {
  id: string
  produto_titulo: string
  valor_recebido: number
  data_venda: string
  forma_pagamento: string
}

export default function WidgetVenda() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [totalMes, setTotalMes] = useState(0)
  const [countMes, setCountMes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [recentes, mes] = await Promise.allSettled([
        supabaseAdmin.from('vendas').select('id, produto_titulo, valor_recebido, data_venda, forma_pagamento')
          .order('data_venda', { ascending: false }).limit(10),
        supabaseAdmin.from('vendas').select('valor_recebido').gte('data_venda', inicioMes),
      ])

      setVendas(recentes.status === 'fulfilled' ? (recentes.value.data ?? []) : [])

      if (mes.status === 'fulfilled') {
        const arr = mes.value.data ?? []
        setCountMes(arr.length)
        setTotalMes(arr.reduce((s, v) => s + Number(v.valor_recebido || 0), 0))
      }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className={styles.widgetLoading}>Carregando vendas...</div>

  const fmt = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fmtData = (d: string) => {
    const [y, m, dd] = d.split('T')[0].split('-')
    return `${dd}/${m}`
  }

  return (
    <div className={styles.widget}>
      <div className={styles.widgetSectionHeader}>
        <ShoppingCart size={14} color="#16a34a" />
        <h3 className={styles.widgetSectionTitle}>Vendas</h3>
        <Link to="/admin/vendas" className={styles.widgetLink}><ExternalLink size={12} /> Abrir</Link>
      </div>

      {/* KPIs */}
      <div className={styles.miniKpis}>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Vendas no mês</span>
          <strong className={styles.miniKpiValor} style={{ color: '#16a34a' }}>{countMes}</strong>
        </div>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Faturamento</span>
          <strong className={styles.miniKpiValor} style={{ color: '#16a34a' }}>{fmt(totalMes)}</strong>
        </div>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Ticket médio</span>
          <strong className={styles.miniKpiValor}>{countMes > 0 ? fmt(totalMes / countMes) : '—'}</strong>
        </div>
      </div>

      {/* Lista recente */}
      <div className={styles.widgetSection}>
        <div className={styles.widgetSectionHeader}>
          <Receipt size={14} color="#64748b" />
          <h3 className={styles.widgetSectionTitle}>Recentes</h3>
        </div>
        <div className={styles.listCompact}>
          {vendas.map(v => (
            <div key={v.id} className={styles.listItem}>
              <TrendingUp size={12} color="#16a34a" />
              <div className={styles.listInfo}>
                <span className={styles.listNome}>{v.produto_titulo || `Venda #${v.id}`}</span>
                <span className={styles.listMeta}>{v.forma_pagamento} · {fmtData(v.data_venda)}</span>
              </div>
              <span className={styles.listValor}>{fmt(Number(v.valor_recebido || 0))}</span>
            </div>
          ))}
          {vendas.length === 0 && <div className={styles.vazio}>Sem vendas registradas</div>}
        </div>
      </div>
    </div>
  )
}
