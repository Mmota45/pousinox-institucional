import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminDashboard.module.css'
import MetaSemanal from '../components/MetaSemanal/MetaSemanal'

interface DashData {
  totalProdutos: number
  valorEstoque: number
  vendasMes: number
  ticketMedio: number
  interessesMes: number
  estoquesBaixo: { titulo: string; quantidade: number }[]
  topProdutos: { titulo: string; total: number; valor: number }[]
}

interface TabelaSize {
  tablename: string
  tamanho_total: string
  bytes: number
}

interface DbInfo {
  tamanho_banco: string
  tabelas: TabelaSize[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)

  useEffect(() => { fetchData(); fetchDbInfo() }, [])

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

    setData({ totalProdutos, valorEstoque, vendasMes: totalMes, ticketMedio, interessesMes: (interesses.data ?? []).length, estoquesBaixo: estoqueBaixo, topProdutos })
    setLoading(false)
  }

  async function fetchDbInfo() {
    const [bancoRes, tabelasRes] = await Promise.all([
      supabaseAdmin.rpc('get_db_size'),
      supabaseAdmin.rpc('get_top_tables_size'),
    ])
    if (bancoRes.data && tabelasRes.data) {
      setDbInfo({
        tamanho_banco: bancoRes.data,
        tabelas: tabelasRes.data,
      })
    }
  }

  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (loading) return <div className={styles.loading}>Carregando dashboard...</div>
  if (!data) return null

  return (
    <div className={styles.wrap}>
      <MetaSemanal />
      <h3 className={styles.secTitle}>Outlet & Estoque</h3>
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
        {data.estoquesBaixo?.length > 0 && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>⚠️ Estoque baixo</h3>
            {data.estoquesBaixo.map((p) => (
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

      {/* ── Banco de dados ── */}
      {dbInfo && (
        <>
          <h3 className={styles.secTitle}>Banco de dados</h3>
          <div className={styles.dbWrap}>
            <div className={styles.dbTotal}>
              <span className={styles.dbTotalLabel}>Tamanho total do banco</span>
              <strong className={styles.dbTotalVal}>{dbInfo.tamanho_banco}</strong>
            </div>
            <div className={styles.dbTabelas}>
              {dbInfo.tabelas.map((t) => {
                const pct = Math.min(100, Math.round((t.bytes / dbInfo.tabelas[0].bytes) * 100))
                return (
                  <div key={t.tablename} className={styles.dbItem}>
                    <span className={styles.dbNome}>{t.tablename}</span>
                    <div className={styles.dbBarra}>
                      <div
                        className={styles.dbBarraFill}
                        style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#3b82f6' }}
                      />
                    </div>
                    <span className={styles.dbSize}>{t.tamanho_total}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
