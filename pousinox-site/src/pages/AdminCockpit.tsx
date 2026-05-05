import { CockpitProvider, useCockpit, ETAPAS, type Etapa } from '../contexts/CockpitContext'
import { useOverview, type SectionStatus } from '../hooks/useOverview'
import { useAdmin } from '../contexts/AdminContext'
import BuscaGlobal from '../components/BuscaGlobal/BuscaGlobal'
import WidgetRadar from '../components/CockpitWidgets/WidgetRadar'
import WidgetContato from '../components/CockpitWidgets/WidgetContato'
import WidgetPipeline from '../components/CockpitWidgets/WidgetPipeline'
import WidgetEntrega from '../components/CockpitWidgets/WidgetEntrega'
import WidgetLeads from '../components/CockpitWidgets/WidgetLeads'
import WidgetProposta from '../components/CockpitWidgets/WidgetProposta'
import WidgetVenda from '../components/CockpitWidgets/WidgetVenda'
import WidgetPosVenda from '../components/CockpitWidgets/WidgetPosVenda'
import WidgetBriefing from '../components/CockpitWidgets/WidgetBriefing'
import WidgetAlertas from '../components/CockpitWidgets/WidgetAlertas'
import WidgetNoticias from '../components/CockpitWidgets/WidgetNoticias'
import WidgetAutomacoes from '../components/CockpitWidgets/WidgetAutomacoes'
import WidgetInsights from '../components/CockpitWidgets/WidgetInsights'
import CockpitIA from '../components/CockpitIA/CockpitIA'
import {
  Radar, UserPlus, MessageSquare, Handshake, FileText,
  ShoppingCart, Truck, Heart, RefreshCw,
  TrendingUp, TrendingDown, AlertTriangle, Package,
  Megaphone, BarChart3,
} from 'lucide-react'
import styles from './AdminCockpit.module.css'

/* ── Etapas config ─────────────────────────────────────────────────────── */

const ETAPA_CONFIG: Record<Etapa, { label: string; icon: React.ReactNode; cor: string; permissoes: string[] }> = {
  radar:    { label: 'Radar',     icon: <Radar size={16} />,         cor: '#8b5cf6', permissoes: ['prospeccao', 'estudo-mercado'] },
  lead:     { label: 'Lead',      icon: <UserPlus size={16} />,      cor: '#f59e0b', permissoes: ['leads', 'prospeccao'] },
  contato:  { label: 'Contato',   icon: <MessageSquare size={16} />, cor: '#25d366', permissoes: ['central-vendas'] },
  deal:     { label: 'Deal',      icon: <Handshake size={16} />,     cor: '#2563eb', permissoes: ['pipeline'] },
  proposta: { label: 'Proposta',  icon: <FileText size={16} />,      cor: '#0ea5e9', permissoes: ['orcamento'] },
  venda:    { label: 'Venda',     icon: <ShoppingCart size={16} />,   cor: '#16a34a', permissoes: ['vendas'] },
  entrega:  { label: 'Entrega',   icon: <Truck size={16} />,         cor: '#ea580c', permissoes: ['projetos', 'producao'] },
  posvenda: { label: 'Pós-venda', icon: <Heart size={16} />,         cor: '#ec4899', permissoes: ['clientes'] },
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */

function Skeleton({ width = '100%', height = 20 }: { width?: string | number; height?: number }) {
  return <div className={styles.skeleton} style={{ width, height }} />
}

function KPISkeleton() {
  return (
    <div className={styles.kpiCard}>
      <Skeleton width="60%" height={12} />
      <Skeleton width="80%" height={28} />
    </div>
  )
}

/* ── KPI Card ──────────────────────────────────────────────────────────── */

function KPICard({ label, valor, cor, sub, status }: {
  label: string; valor: string; cor?: string; sub?: string; status: SectionStatus
}) {
  if (status === 'loading') return <KPISkeleton />
  if (status === 'error') return (
    <div className={styles.kpiCard} data-error>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiIndisponivel}>Indisponível</span>
    </div>
  )
  return (
    <div className={styles.kpiCard}>
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={styles.kpiValor} style={cor ? { color: cor } : undefined}>{valor}</strong>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  )
}

/* ── Cockpit Interior ──────────────────────────────────────────────────── */

function CockpitContent() {
  const { etapa, setEtapa, empresa } = useCockpit()
  const overview = useOverview(empresa?.cnpj)
  const { ocultarValores } = useAdmin()

  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Todas as etapas visíveis (permissão já controlada pela rota no AdminLayout)
  const etapasVisiveis = ETAPAS

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.titulo}>Cockpit</h1>
          <button className={styles.btnRefresh} onClick={overview.refetch} title="Atualizar dados">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className={styles.headerBusca}>
          <BuscaGlobal />
        </div>
      </div>

      {/* ── Layout principal ── */}
      <div className={styles.layout}>
        {/* ── Nav de fluxo ── */}
        <nav className={styles.fluxoNav}>
          {etapasVisiveis.map(e => {
            const cfg = ETAPA_CONFIG[e]
            return (
              <button
                key={e}
                className={`${styles.fluxoBtn} ${etapa === e ? styles.fluxoBtnAtivo : ''}`}
                onClick={() => setEtapa(e)}
                style={etapa === e ? { borderColor: cfg.cor, color: cfg.cor } : undefined}
              >
                {cfg.icon}
                <span className={styles.fluxoLabel}>{cfg.label}</span>
              </button>
            )
          })}
        </nav>

        {/* ── Área principal ── */}
        <main className={styles.main}>
          {/* KPIs globais (sempre visíveis) */}
          <div className={styles.kpis}>
            <KPICard label="Pipeline" valor={fmt(overview.comercial.receitaPipeline)} cor="#2563eb" sub={`${overview.comercial.deals} deals`} status={overview.status.comercial} />
            <KPICard label="Receitas mês" valor={fmt(overview.financeiro.receitaMes)} cor="#16a34a" status={overview.status.financeiro} />
            <KPICard label="Despesas mês" valor={fmt(overview.financeiro.despesaMes)} cor="#dc2626" status={overview.status.financeiro} />
            <KPICard label="Saldo" valor={fmt(overview.financeiro.saldo)} cor={overview.financeiro.saldo >= 0 ? '#16a34a' : '#dc2626'} status={overview.status.financeiro} />
          </div>

          {/* Alertas rápidos */}
          <div className={styles.alertas}>
            {overview.status.comercial === 'ok' && overview.comercial.followupsAtrasados > 0 && (
              <div className={styles.alerta} data-tipo="warning">
                <AlertTriangle size={14} color="#f59e0b" />
                <span>{overview.comercial.followupsAtrasados} follow-ups atrasados</span>
              </div>
            )}
            {overview.status.financeiro === 'ok' && overview.financeiro.vencidos > 0 && (
              <div className={styles.alerta} data-tipo="danger">
                <TrendingDown size={14} color="#dc2626" />
                <span>{fmt(overview.financeiro.vencidos)} em vencidos</span>
              </div>
            )}
            {overview.status.estoque === 'ok' && overview.estoque.alertasMinimo > 0 && (
              <div className={styles.alerta} data-tipo="warning">
                <Package size={14} color="#f59e0b" />
                <span>{overview.estoque.alertasMinimo} itens abaixo do mínimo</span>
              </div>
            )}
            {overview.status.operacao === 'ok' && overview.operacao.ncsAbertas > 0 && (
              <div className={styles.alerta} data-tipo="danger">
                <AlertTriangle size={14} color="#dc2626" />
                <span>{overview.operacao.ncsAbertas} NCs abertas</span>
              </div>
            )}
          </div>

          {/* Painel inteligente: briefing + alertas + notícias + automações */}
          <div className={styles.painelInteligente}>
            <WidgetBriefing />
            <WidgetAlertas />
            <WidgetNoticias />
            <WidgetInsights />
            <WidgetAutomacoes />
          </div>

          {/* Conteúdo da etapa ativa */}
          <div className={styles.etapaContent}>
            <div className={styles.etapaHeader}>
              <span className={styles.etapaIcon} style={{ color: ETAPA_CONFIG[etapa].cor }}>
                {ETAPA_CONFIG[etapa].icon}
              </span>
              <h2 className={styles.etapaTitulo}>{ETAPA_CONFIG[etapa].label}</h2>
            </div>

            <EtapaWidgets etapa={etapa} overview={overview} fmt={fmt} />
          </div>
        </main>

        {/* ── Painel IA ── */}
        <CockpitIA />
      </div>
    </div>
  )
}

/* ── Widgets por etapa ─────────────────────────────────────────────────── */

function EtapaWidgets({ etapa, overview, fmt }: {
  etapa: Etapa
  overview: ReturnType<typeof useOverview>
  fmt: (v: number) => string
}) {
  switch (etapa) {
    case 'radar':
      return <WidgetRadar />

    case 'lead':
      return <WidgetLeads />

    case 'contato':
      return <WidgetContato />

    case 'deal':
      return <WidgetPipeline />

    case 'proposta':
      return <WidgetProposta />

    case 'venda':
      return <WidgetVenda />

    case 'entrega':
      return <WidgetEntrega />

    case 'posvenda':
      return (
        <div className={styles.widgetGrid}>
          <KPICard label="Estoque industrial" valor={fmt(overview.estoque.valorTotal)} status={overview.status.estoque} />
          <KPICard label="Itens abaixo mínimo" valor={String(overview.estoque.alertasMinimo)} cor={overview.estoque.alertasMinimo > 0 ? '#f59e0b' : '#16a34a'} status={overview.status.estoque} />
          <div className={styles.widgetPlaceholder}>
            <Heart size={24} color="#94a3b8" />
            <span>RFM + Recorrência — em breve</span>
          </div>
        </div>
      )

    default:
      return null
  }
}

/* ── Export com Provider ───────────────────────────────────────────────── */

export default function AdminCockpit() {
  return (
    <CockpitProvider>
      <CockpitContent />
    </CockpitProvider>
  )
}
