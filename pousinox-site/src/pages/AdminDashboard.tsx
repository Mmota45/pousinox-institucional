import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminDashboard.module.css'

interface DashData {
  totalProdutos: number
  valorEstoque: number
  vendasMes: number
  ticketMedio: number
  estoquesBaixo: { titulo: string; quantidade: number }[]
  topProdutos: { titulo: string; total: number; valor: number }[]
  interessesMes: number
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

    const [produtos, vendas, vendasMes, interesses] = await Promise.all([
      supabaseAdmin.from('produtos').select('titulo, preco, quantidade, disponivel'),
      supabaseAdmin.from('vendas').select('produto_titulo, valor_recebido'),
      supabaseAdmin.from('vendas').select('valor_recebido').gte('data_venda', inicioMes),
      supabaseAdmin.from('interesses').select('id').gte('created_at', inicioMes),
    ])

    const prods = produtos.data ?? []
    const todasVendas = vendas.data ?? []
    const vendasDoMes = vendasMes.data ?? []

    const totalProdutos = prods.filter(p => p.disponivel).length
    const valorEstoque = prods.filter(p => p.disponivel).reduce((s, p) => s + (p.preco * p.quantidade), 0)
    const totalMes = vendasDoMes.reduce((s, v) => s + Number(v.valor_recebido), 0)
    const ticketMedio = vendasDoMes.length > 0 ? totalMes / vendasDoMes.length : 0
    const estoqueBaixo = prods.filter(p => p.disponivel && p.quantidade <= 1).map(p => ({ titulo: p.titulo, quantidade: p.quantidade }))

    const vendasPorProduto: Record<string, { total: number; valor: number }> = {}
    todasVendas.forEach(v => {
      if (!vendasPorProduto[v.produto_titulo]) vendasPorProduto[v.produto_titulo] = { total: 0, valor: 0 }
      vendasPorProduto[v.produto_titulo].total++
      vendasPorProduto[v.produto_titulo].valor += Number(v.valor_recebido)
    })
    const topProdutos = Object.entries(vendasPorProduto)
      .map(([titulo, d]) => ({ titulo, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    setData({
      totalProdutos,
      valorEstoque,
      vendasMes: totalMes,
      ticketMedio,
      estoquesBaixo: estoqueBaixo,
      topProdutos,
      interessesMes: (interesses.data ?? []).length,
    })
    setLoading(false)
  }

  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (loading) return <div className={styles.loading}>Carregando dashboard...</div>
  if (!data) return null

  const d = data

  return (
    <div className={styles.wrap}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Produtos disponíveis</span>
          <strong className={styles.cardValue}>{data.totalProdutos}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Valor em estoque</span>
          <strong className={styles.cardValue}>{fmt(data.valorEstoque)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Vendas este mês</span>
          <strong className={styles.cardValue}>{fmt(data.vendasMes)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Ticket médio</span>
          <strong className={styles.cardValue}>{fmt(data.ticketMedio)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Interesses este mês</span>
          <strong className={styles.cardValue}>{data.interessesMes}</strong>
        </div>
      </div>

      <div className={styles.grid2}>
        {d.estoquesBaixo?.length > 0 && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>⚠️ Estoque baixo</h3>
            {d.estoquesBaixo.map((p) => (
              <div key={p.titulo} className={styles.alertaItem}>
                <span>{p.titulo}</span>
                <span className={styles.alertaQtd}>{p.quantidade === 0 ? 'Esgotado' : 'Última unidade'}</span>
              </div>
            ))}
          </div>
        )}

        {data.topProdutos.length > 0 && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>Top produtos vendidos</h3>
            {data.topProdutos.map((p, i) => (
              <div key={p.titulo} className={styles.topItem}>
                <span className={styles.topPos}>{i + 1}</span>
                <span className={styles.topTitulo}>{p.titulo}</span>
                <span className={styles.topInfo}>{p.total}x · {fmt(p.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
