import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import { Link } from 'react-router-dom'
import styles from './AdminDashboard.module.css'
import MetaSemanal from '../components/MetaSemanal/MetaSemanal'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'

interface DashData {
  // Outlet
  totalProdutos: number
  valorEstoque: number
  vendasMes: number
  ticketMedio: number
  interessesMes: number
  estoquesBaixo: { titulo: string; quantidade: number }[]
  topProdutos: { titulo: string; total: number; valor: number }[]
  // Financeiro
  receitasMes: number
  despesasMes: number
  saldoMes: number
  vencidos: number
  // Comercial
  dealsAbertos: number
  valorPipeline: number
  orcamentosEnviados: number
  orcamentosValor: number
  // Produção
  opsAndamento: number
  opsPlanejadas: number
  opsConcluidas: number
  // Qualidade
  ncsAbertas: number
  // Manutenção
  omsAbertas: number
  omsAlta: number
  // Estoque industrial
  itensAbaixoMinimo: number
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

    const [
      produtos, vendas, vendasMes, interesses,
      finLanc, finVencidos,
      deals, orcs,
      ops,
      ncs,
      oms,
      estItens,
    ] = await Promise.all([
      // Outlet
      supabaseAdmin.from('produtos').select('titulo, preco, quantidade, disponivel'),
      supabaseAdmin.from('vendas').select('produto_titulo, valor_recebido'),
      supabaseAdmin.from('vendas').select('valor_recebido').gte('data_venda', inicioMes),
      supabaseAdmin.from('interesses').select('id').gte('created_at', inicioMes),
      // Financeiro
      supabaseAdmin.from('fin_lancamentos').select('*').gte('data_vencimento', inicioMes),
      supabaseAdmin.from('fin_lancamentos').select('*').eq('status', 'pendente').lt('data_vencimento', new Date().toISOString()),
      // Pipeline
      supabaseAdmin.from('pipeline_deals').select('*').neq('estagio', 'ganho').neq('estagio', 'perdido'),
      // Orçamentos
      supabaseAdmin.from('orcamentos').select('*').eq('status', 'enviado'),
      // Produção
      supabaseAdmin.from('ordens_producao').select('*'),
      // Qualidade
      supabaseAdmin.from('nao_conformidades').select('*').in('status', ['aberta', 'em_analise']),
      // Manutenção
      supabaseAdmin.from('ordens_manutencao').select('*').in('status', ['aberta', 'em_execucao']),
      // Estoque industrial
      supabaseAdmin.from('estoque_itens').select('*').eq('ativo', true),
    ])

    const prods = produtos.data ?? []
    const todasVendas = vendas.data ?? []
    const vendasDoMes = vendasMes.data ?? []

    // Outlet
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

    // Financeiro
    const lancMes = finLanc.data ?? []
    const receitasMes = lancMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0)
    const despesasMes = lancMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0)
    const vencidosArr = finVencidos.data ?? []
    const vencidos = vencidosArr.reduce((s, l) => s + Number(l.valor), 0)

    // Pipeline
    const dealsArr = deals.data ?? []
    const valorPipeline = dealsArr.reduce((s, d) => s + Number(d.valor || 0), 0)

    // Orçamentos
    const orcsArr = orcs.data ?? []
    const orcamentosValor = orcsArr.reduce((s, o) => s + Number(o.total || 0), 0)

    // Produção
    const opsArr = ops.data ?? []

    // Estoque industrial
    const estArr = estItens.data ?? []
    const itensAbaixoMinimo = estArr.filter(e => e.estoque_minimo > 0 && e.saldo_atual < e.estoque_minimo).length

    setData({
      totalProdutos, valorEstoque, vendasMes: totalMes, ticketMedio,
      interessesMes: (interesses.data ?? []).length,
      estoquesBaixo: estoqueBaixo, topProdutos,
      receitasMes, despesasMes, saldoMes: receitasMes - despesasMes, vencidos,
      dealsAbertos: dealsArr.length, valorPipeline,
      orcamentosEnviados: orcsArr.length, orcamentosValor,
      opsAndamento: opsArr.filter(o => o.status === 'em_producao').length,
      opsPlanejadas: opsArr.filter(o => o.status === 'planejada' || o.status === 'liberada').length,
      opsConcluidas: opsArr.filter(o => o.status === 'concluida').length,
      ncsAbertas: (ncs.data ?? []).length,
      omsAbertas: (oms.data ?? []).length,
      omsAlta: (oms.data ?? []).filter(o => o.prioridade === 'alta').length,
      itensAbaixoMinimo,
    })
    setLoading(false)
  }

  async function fetchDbInfo() {
    const [bancoRes, tabelasRes] = await Promise.all([
      supabaseAdmin.rpc('get_db_size'),
      supabaseAdmin.rpc('get_top_tables_size'),
    ])
    if (bancoRes.data && tabelasRes.data) {
      setDbInfo({ tamanho_banco: bancoRes.data, tabelas: tabelasRes.data })
    }
  }

  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (loading) return <div className={styles.loading}>Carregando dashboard...</div>
  if (!data) return null

  const gerarResumo = useCallback(async () => {
    if (!data) return 'Sem dados'
    const prompt = `Dados do ERP Pousinox (mês atual):
- Receitas: R$ ${data.receitasMes.toFixed(2)} | Despesas: R$ ${data.despesasMes.toFixed(2)} | Saldo: R$ ${data.saldoMes.toFixed(2)}
- Vencidos: R$ ${data.vencidos.toFixed(2)}
- Deals abertos: ${data.dealsAbertos} (R$ ${data.valorPipeline.toFixed(2)} no pipeline)
- Orçamentos enviados: ${data.orcamentosEnviados} (R$ ${data.orcamentosValor.toFixed(2)})
- OPs em produção: ${data.opsAndamento} | Planejadas: ${data.opsPlanejadas} | Concluídas: ${data.opsConcluidas}
- NCs abertas: ${data.ncsAbertas} | Manutenções abertas: ${data.omsAbertas} (${data.omsAlta} alta prioridade)
- Estoque abaixo mínimo: ${data.itensAbaixoMinimo} itens
- Outlet: ${data.totalProdutos} produtos (R$ ${data.valorEstoque.toFixed(2)} em estoque), vendas mês R$ ${data.vendasMes.toFixed(2)}, ticket médio R$ ${data.ticketMedio.toFixed(2)}
- Interesses do mês: ${data.interessesMes}

Gere um resumo executivo de 5-8 linhas com: situação geral, alertas importantes, e 2-3 ações prioritárias recomendadas.`
    const r = await aiChat({ prompt, system: 'Você é o analista de negócios da Pousinox. Responda direto, sem saudações. Use dados concretos. Português brasileiro.', model: 'groq' })
    return r.error ? `Erro: ${r.error}` : r.content
  }, [data])

  return (
    <div className={styles.wrap}>
      <MetaSemanal />

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 10px' }}>
        <AiActionButton label="Resumo Executivo IA" icon="📊" action={gerarResumo} />
      </div>

      {/* ── Financeiro ── */}
      <h3 className={styles.secTitle}>Financeiro — Mês Atual</h3>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Receitas</span>
          <strong className={styles.cardValue} style={{ color: '#16a34a' }}>{fmt(data.receitasMes)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Despesas</span>
          <strong className={styles.cardValue} style={{ color: '#dc2626' }}>{fmt(data.despesasMes)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Saldo</span>
          <strong className={styles.cardValue} style={{ color: data.saldoMes >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(data.saldoMes)}</strong>
        </div>
        {data.vencidos > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>Vencidos</span>
            <strong className={styles.cardValue} style={{ color: '#f59e0b' }}>{fmt(data.vencidos)}</strong>
            <Link to="/admin/financeiro" className={styles.cardSub} style={{ color: '#2563eb', textDecoration: 'none' }}>Ver detalhes →</Link>
          </div>
        )}
      </div>

      {/* ── Comercial ── */}
      <h3 className={styles.secTitle}>Comercial</h3>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Deals abertos</span>
          <strong className={styles.cardValue}>{data.dealsAbertos}</strong>
          {data.valorPipeline > 0 && <span className={styles.cardSub}>{fmt(data.valorPipeline)} no pipeline</span>}
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Orçamentos enviados</span>
          <strong className={styles.cardValue}>{data.orcamentosEnviados}</strong>
          {data.orcamentosValor > 0 && <span className={styles.cardSub}>{fmt(data.orcamentosValor)} pendentes</span>}
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Interesses do mês</span>
          <strong className={styles.cardValue}>{data.interessesMes}</strong>
        </div>
      </div>

      {/* ── Operação ── */}
      <h3 className={styles.secTitle}>Operação</h3>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>OPs em produção</span>
          <strong className={styles.cardValue}>{data.opsAndamento}</strong>
          {data.opsPlanejadas > 0 && <span className={styles.cardSub}>{data.opsPlanejadas} planejadas</span>}
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>OPs concluídas</span>
          <strong className={styles.cardValue} style={{ color: '#16a34a' }}>{data.opsConcluidas}</strong>
        </div>
        {data.ncsAbertas > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>NCs abertas</span>
            <strong className={styles.cardValue} style={{ color: '#dc2626' }}>{data.ncsAbertas}</strong>
            <Link to="/admin/qualidade" className={styles.cardSub} style={{ color: '#2563eb', textDecoration: 'none' }}>Resolver →</Link>
          </div>
        )}
        {data.omsAbertas > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>Manutenções abertas</span>
            <strong className={styles.cardValue} style={{ color: '#f59e0b' }}>{data.omsAbertas}</strong>
            {data.omsAlta > 0 && <span className={styles.cardSub} style={{ color: '#dc2626' }}>{data.omsAlta} prioridade alta</span>}
          </div>
        )}
        {data.itensAbaixoMinimo > 0 && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>Estoque abaixo mínimo</span>
            <strong className={styles.cardValue} style={{ color: '#f59e0b' }}>{data.itensAbaixoMinimo}</strong>
            <Link to="/admin/estoque-mp" className={styles.cardSub} style={{ color: '#2563eb', textDecoration: 'none' }}>Ver itens →</Link>
          </div>
        )}
      </div>

      {/* ── Outlet ── */}
      <h3 className={styles.secTitle}>Outlet & Vendas</h3>
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
          <span className={styles.cardLabel}>Vendas do mês</span>
          <strong className={styles.cardValue}>{fmt(data.vendasMes)}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Ticket médio</span>
          <strong className={styles.cardValue}>{fmt(data.ticketMedio)}</strong>
        </div>
      </div>

      <div className={styles.grid2}>
        {data.estoquesBaixo?.length > 0 && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>⚠️ Estoque baixo (Outlet)</h3>
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

      {/* ── Atalhos rápidos ── */}
      <h3 className={styles.secTitle}>Acesso rápido</h3>
      <div className={styles.cards}>
        <Link to="/admin/assistente" className={styles.card} style={{ textDecoration: 'none', borderTopColor: '#8b5cf6', cursor: 'pointer' }}>
          <span className={styles.cardLabel}>🤖 Assistente IA</span>
          <strong className={styles.cardValue} style={{ fontSize: '0.85rem', color: '#6d28d9' }}>Pergunte sobre o sistema</strong>
        </Link>
        <Link to="/admin/financeiro" className={styles.card} style={{ textDecoration: 'none', borderTopColor: '#16a34a', cursor: 'pointer' }}>
          <span className={styles.cardLabel}>💰 Financeiro</span>
          <strong className={styles.cardValue} style={{ fontSize: '0.85rem', color: '#15803d' }}>Lançamentos e DRE</strong>
        </Link>
        <Link to="/admin/pipeline" className={styles.card} style={{ textDecoration: 'none', borderTopColor: '#2563eb', cursor: 'pointer' }}>
          <span className={styles.cardLabel}>📊 Pipeline</span>
          <strong className={styles.cardValue} style={{ fontSize: '0.85rem', color: '#1d4ed8' }}>Deals e oportunidades</strong>
        </Link>
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
                      <div className={styles.dbBarraFill} style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#3b82f6' }} />
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
