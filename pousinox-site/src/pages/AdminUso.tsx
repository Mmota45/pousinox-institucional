import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabaseAdmin, supabase } from '../lib/supabase'
import { getModelInfo } from '../lib/modelInfo'
import s from './AdminUso.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'

/* ═══════════════════════════════════════════════════════════
   Tipos e constantes
   ═══════════════════════════════════════════════════════════ */
interface UsageRow {
  dia: string
  function_name: string
  model: string
  requests: number
  input_tokens: number
  output_tokens: number
  custo_usd: number
}

const USD_BRL = 5.70

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

/* Mapeamento conhecido — fallback usa inferência por padrão do nome */
const KNOWN_PROVIDERS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Claude',
  'claude-sonnet-4-6-20250514': 'Claude',
  'gemini-2.5-flash': 'Gemini',
  'gemini-embedding-001': 'Gemini',
  'llama-3.3-70b-versatile': 'Groq',
  'llama-3.1-8b-instant': 'Groq',
  'mixtral-8x7b-32768': 'Groq',
  'gemma2-9b-it': 'Groq',
  'llama-3.2-90b-vision-preview': 'Groq',
  'deepseek-r1-distill-llama-70b': 'Groq',
  'mistral-saba-24b': 'Groq',
  'qwen-qwq-32b': 'Groq',
  'llama-3.3-70b': 'Cerebras',
  'qwen-3-235b-a22b-instruct-2507': 'Cerebras',
  'mistral-small-latest': 'Mistral',
  'command-a-03-2025': 'Cohere',
  'command-r7b-12-2024': 'Cohere',
}

/* Inferência automática de provider pelo padrão do model ID */
function inferProvider(model: string): string {
  if (model.startsWith('@cf/')) return 'Cloudflare'
  if (model.endsWith(':free') || model.includes('openrouter')) return 'OpenRouter'
  if (model.startsWith('mistralai/') || model.startsWith('google/') || model.startsWith('microsoft/') || model.startsWith('meta-llama/') || model.startsWith('Qwen/')) {
    // IDs com / podem ser HuggingFace ou Together — Together usa sufixo Turbo/Instruct-Turbo
    if (model.includes('-Turbo') || model.includes('405B') || model.includes('deepseek-ai/')) return 'Together'
    return 'HuggingFace'
  }
  if (model.startsWith('deepseek-ai/')) return 'Together'
  if (model.startsWith('qwen/') || model.startsWith('deepseek/') || model.startsWith('nvidia/')) return 'OpenRouter'
  return 'Outro'
}

const PROVIDER_COLORS: Record<string, string> = {
  Claude: '#2563eb',
  Gemini: '#f59e0b',
  Groq: '#ef4444',
  Cerebras: '#8b5cf6',
  Mistral: '#ea580c',
  Cohere: '#6366f1',
  HuggingFace: '#ff6f00',
  Together: '#10b981',
  Cloudflare: '#f48120',
  OpenRouter: '#a855f7',
  Outro: '#9ca3af',
}

function getProvider(model: string) {
  return KNOWN_PROVIDERS[model] || inferProvider(model)
}

interface LimitItem { label: string; desc?: string; limit?: number; cost?: string; usedKey?: string }
interface LimitDef { name: string; tier: string; cost?: string; category: string; items: LimitItem[] }

/* Info estática dos providers IA — limites, tier, ícone */
const PROVIDER_META: Record<string, { icon: string; tier: string; cost?: string; dailyLimit?: number; desc?: string }> = {
  Claude:      { icon: '🤖', tier: 'por uso', desc: 'API paga por token' },
  Gemini:      { icon: '💎', tier: 'grátis', dailyLimit: 1500 },
  Groq:        { icon: '⚡', tier: 'grátis', dailyLimit: 14400, desc: '30 req/min' },
  Cerebras:    { icon: '🧠', tier: 'grátis', desc: '30 req/min' },
  Mistral:     { icon: '🌀', tier: 'grátis' },
  Cohere:      { icon: '🧠', tier: 'grátis', desc: '1K calls/mês (trial), 20 req/min' },
  HuggingFace: { icon: '🤗', tier: 'grátis', desc: 'US$ 0,10/mês free — modelos <10B' },
  Together:    { icon: '🤝', tier: 'crédito', cost: 'US$ 25 grátis', desc: 'Créditos iniciais, 200+ modelos' },
  Cloudflare:  { icon: '☁️', tier: 'grátis', desc: '10K neurons/dia' },
  OpenRouter:  { icon: '🔀', tier: 'grátis', desc: '29+ modelos free, 50 req/dia sem crédito' },
}

/* Friendly name para model IDs longos */
function friendlyModel(model: string): string {
  // Remove prefixos comuns
  const short = model
    .replace(/^@cf\//, '')
    .replace(/^mistralai\//, '')
    .replace(/^google\//, '')
    .replace(/^microsoft\//, '')
    .replace(/^meta-llama\//, '')
    .replace(/^Qwen\//, '')
    .replace(/^deepseek-ai\//, '')
    .replace(/^deepseek\//, '')
    .replace(/^nvidia\//, '')
    .replace(/:free$/, '')
    .replace(/-Instruct(-v\d+\.\d+)?/, '')
    .replace(/-Turbo/, ' Turbo')
    .replace(/-it$/, '')
  return short.length > 35 ? short.slice(0, 32) + '…' : short
}

// Recursos ESTÁTICOS (infra, busca, integrações)
const STATIC_LIMITS: LimitDef[] = [
  // ── Desenvolvimento ──
  { name: '🤖 Claude Max (Assinatura)', tier: 'assinatura', cost: 'R$ 687,50/mês', category: 'Desenvolvimento', items: [
    { label: 'Claude Code (IDE)', desc: 'Ilimitado (fair use)' },
    { label: 'Claude.ai (web)', desc: 'Acesso completo' },
    { label: 'Modelos inclusos', desc: 'Opus 4.6, Sonnet 4.6, Haiku 4.5' },
  ]},
  { name: '🐙 GitHub', tier: 'grátis', category: 'Desenvolvimento', items: [
    { label: 'Repos privados', desc: 'Ilimitado' },
    { label: 'Actions', desc: '2.000 min/mês' },
    { label: 'Storage LFS', desc: '1 GB' },
  ]},

  // ── Hospedagem & Infra ──
  { name: '🗄️ Supabase Pro', tier: 'pago', cost: `R$ ${(25 * USD_BRL).toFixed(0)}/mês`, category: 'Hospedagem', items: [
    { label: 'Edge Functions', limit: 500000, usedKey: 'fn:*' },
    { label: 'DB', desc: '8 GB (Pro)' },
    { label: 'Storage', desc: '100 GB' },
    { label: 'Bandwidth', desc: '250 GB' },
    { label: 'Realtime', desc: '200 conexões' },
    { label: 'Auth', desc: '50K MAU' },
  ]},
  { name: '☁️ Cloudflare Pages', tier: 'grátis', category: 'Hospedagem', items: [
    { label: 'Builds/mês', desc: '500' },
    { label: 'Bandwidth', desc: 'Ilimitado' },
    { label: 'Workers', desc: '100K req/dia' },
  ]},
  { name: '🌐 Registro.br', tier: 'pago', cost: 'R$ 80/ano (2 domínios)', category: 'Hospedagem', items: [
    { label: 'pousinox.com.br', desc: 'Ativo' },
    { label: 'fixadorporcelanato.com.br', desc: 'Ativo' },
  ]},

  // ── Busca & Pesquisa ──
  { name: '🔍 Brave Search', tier: 'grátis', category: 'Busca', items: [
    { label: 'Queries/mês (limite)', limit: 2000, usedKey: 'fn:ai-hub' },
  ]},
  { name: '🔎 Serper (Google)', tier: 'grátis', category: 'Busca', items: [
    { label: 'Queries/mês (limite)', limit: 2500, usedKey: 'fn:ai-hub' },
  ]},

  // ── Integrações ──
  { name: '📱 Z-API (WhatsApp)', tier: 'pago', cost: 'R$ 99,99/mês', category: 'Integrações', items: [
    { label: 'Validações/mês', usedKey: 'fn:validar-whatsapp' },
    { label: 'Notificações/mês', usedKey: 'fn:notificar-pedido' },
    { label: 'Instância', desc: '1 número conectado' },
    { label: 'Mensagens', desc: 'Ilimitadas' },
  ]},
  { name: '⚙️ n8n (VPS)', tier: 'pago', cost: 'R$ 50/mês', category: 'Integrações', items: [
    { label: 'Workflows', desc: 'Ilimitados' },
    { label: 'Webhooks', desc: 'Contato, campanhas, alertas' },
  ]},
  { name: '🎨 Canva API', tier: 'grátis', category: 'Integrações', items: [
    { label: 'Connect API', desc: 'Free tier' },
  ]},
  { name: '📊 Google Analytics', tier: 'grátis', category: 'Integrações', items: [
    { label: 'Req/mês', usedKey: 'fn:ga4-metrics' },
    { label: 'Data API', desc: '10K req/dia' },
  ]},
  { name: '🔑 Google Search Console', tier: 'grátis', category: 'Integrações', items: [
    { label: 'Req/mês', usedKey: 'fn:central-vendas-gsc' },
    { label: 'API', desc: '25K req/dia' },
  ]},
]

function fmtBrl(v: number) { return `R$ ${(v * USD_BRL).toFixed(2).replace('.', ',')}` }
function fmtUsd(v: number) { return `US$ ${v.toFixed(4)}` }
function fmtNum(n: number) { return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n > 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) }

type SortKey = 'function_name' | 'model' | 'requests' | 'input_tokens' | 'output_tokens' | 'custo_usd'

/* ═══════════════════════════════════════════════════════════
   Seção colapsável
   ═══════════════════════════════════════════════════════════ */
function Section({ title, badge, defaultOpen, children }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className={s.section}>
      <div className={s.sectionHeader} onClick={() => setOpen(v => !v)}>
        <span className={s.sectionTitle}>
          {title}
          {badge && <span className={s.sectionBadge}>{badge}</span>}
        </span>
        <span className={`${s.sectionChevron} ${open ? s.sectionChevronOpen : ''}`}>▾</span>
      </div>
      {open && <div className={s.sectionBody}>{children}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════ */
export default function AdminUso() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [prevRows, setPrevRows] = useState<UsageRow[]>([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(1)
  const [sortKey, setSortKey] = useState<SortKey>('custo_usd')
  const [sortAsc, setSortAsc] = useState(false)
  const [groupBy, setGroupBy] = useState<'function' | 'model'>('function')
  // Créditos Claude API
  const [creditoTotal, setCreditoTotal] = useState(() => parseFloat(localStorage.getItem('claude_credito_total') || '0'))
  const [editCredito, setEditCredito] = useState(false)
  const [creditoInput, setCreditoInput] = useState('')
  // Cards colapsáveis
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const toggleCard = (name: string) => setOpenCards(prev => ({ ...prev, [name]: !prev[name] }))
  const [filterFn, setFilterFn] = useState('')
  const [filterModel, setFilterModel] = useState('')
  // Discover — novos modelos disponíveis
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<Record<string, { id: string; name: string; free: boolean; context?: number; new?: boolean; price?: string; likes?: number }[]> | null>(null)
  const [configuredModels, setConfiguredModels] = useState<Record<string, string[]> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - period)
    const prevSince = new Date(since)
    prevSince.setDate(prevSince.getDate() - period)

    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabaseAdmin.from('vw_ai_usage_diario').select('*').gte('dia', since.toISOString().slice(0, 10)).order('dia', { ascending: false }).limit(1000),
      supabaseAdmin.from('vw_ai_usage_diario').select('*').gte('dia', prevSince.toISOString().slice(0, 10)).lt('dia', since.toISOString().slice(0, 10)).order('dia', { ascending: false }).limit(1000),
    ])
    setRows((d1 as UsageRow[]) ?? [])
    setPrevRows((d2 as UsageRow[]) ?? [])
    lp.step()
    setLoading(false)
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <AdminLoading total={lp.total} current={lp.current} label="Carregando dados de uso..." />

  // ── KPIs ──
  const totalUsd = rows.reduce((a, r) => a + Number(r.custo_usd), 0)
  const prevUsd = prevRows.reduce((a, r) => a + Number(r.custo_usd), 0)
  const totalReqs = rows.reduce((a, r) => a + r.requests, 0)
  const prevReqs = prevRows.reduce((a, r) => a + r.requests, 0)
  const totalTokens = rows.reduce((a, r) => a + r.input_tokens + r.output_tokens, 0)
  const today = new Date().toISOString().slice(0, 10)
  const todayUsd = rows.filter(r => r.dia === today).reduce((a, r) => a + Number(r.custo_usd), 0)
  const todayReqs = rows.filter(r => r.dia === today).reduce((a, r) => a + r.requests, 0)

  function pctChange(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }
  const costPct = pctChange(totalUsd, prevUsd)
  const reqPct = pctChange(totalReqs, prevReqs)

  // ── Gráfico empilhado por provider ──
  const dayProviders: Record<string, Record<string, number>> = {}
  const providerSet = new Set<string>()
  rows.forEach(r => {
    const prov = getProvider(r.model)
    providerSet.add(prov)
    if (!dayProviders[r.dia]) dayProviders[r.dia] = {}
    dayProviders[r.dia][prov] = (dayProviders[r.dia][prov] || 0) + Number(r.custo_usd) * USD_BRL
  })
  const providers = Array.from(providerSet).sort()
  const chartData = Object.entries(dayProviders)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([dia, provs]) => ({ dia: dia.slice(5), ...provs }))

  // ── Tabela agrupada ──
  const grouped: Record<string, { requests: number; input_tokens: number; output_tokens: number; custo_usd: number; function_name: string; model: string }> = {}
  rows.forEach(r => {
    if (filterFn && r.function_name !== filterFn) return
    if (filterModel && r.model !== filterModel) return
    const key = groupBy === 'function' ? r.function_name : r.model
    if (!grouped[key]) grouped[key] = { requests: 0, input_tokens: 0, output_tokens: 0, custo_usd: 0, function_name: r.function_name, model: r.model }
    grouped[key].requests += r.requests
    grouped[key].input_tokens += r.input_tokens
    grouped[key].output_tokens += r.output_tokens
    grouped[key].custo_usd += Number(r.custo_usd)
  })
  const tableRows = Object.entries(grouped)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'string' && typeof vb === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va)
    })

  const uniqueFns = [...new Set(rows.map(r => r.function_name))].sort()
  const uniqueModels = [...new Set(rows.map(r => r.model))].sort()

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const thCls = (key: SortKey) => `${sortKey === key ? s.thActive : ''}`

  // ── Limites: uso do mês atual ──
  const monthRows = rows.filter(r => {
    const d = new Date(r.dia)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthReqsByProvider: Record<string, number> = {}
  const monthTokensByProvider: Record<string, number> = {}
  const monthCostByProvider: Record<string, number> = {}
  const monthReqsByModel: Record<string, number> = {}
  const monthReqsByFn: Record<string, number> = {}
  monthRows.forEach(r => {
    const p = getProvider(r.model)
    monthReqsByProvider[p] = (monthReqsByProvider[p] || 0) + r.requests
    monthTokensByProvider[p] = (monthTokensByProvider[p] || 0) + r.input_tokens + r.output_tokens
    monthCostByProvider[p] = (monthCostByProvider[p] || 0) + Number(r.custo_usd)
    monthReqsByModel[r.model] = (monthReqsByModel[r.model] || 0) + r.requests
    monthReqsByFn[r.function_name] = (monthReqsByFn[r.function_name] || 0) + r.requests
  })
  // Total do mês
  const monthTotalReqs = monthRows.reduce((a, r) => a + r.requests, 0)
  const monthTotalTokens = monthRows.reduce((a, r) => a + r.input_tokens + r.output_tokens, 0)
  const monthTotalCost = monthRows.reduce((a, r) => a + Number(r.custo_usd), 0)

  // Requests de hoje por provider (para limites diários)
  const todayRows = rows.filter(r => r.dia === today)
  const dailyReqsByProvider: Record<string, number> = {}
  todayRows.forEach(r => {
    const p = getProvider(r.model)
    dailyReqsByProvider[p] = (dailyReqsByProvider[p] || 0) + r.requests
  })

  return (
    <div className={s.page}>
      <h1 className={s.pageTitle}>📊 Uso e Custos</h1>

      <div className={s.periodRow}>
        {PERIODS.map(p => (
          <button key={p.days} className={`${s.periodBtn} ${period === p.days ? s.periodActive : ''}`} onClick={() => setPeriod(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Seção 1: Resumo ── */}
      <Section title="Resumo" badge={fmtBrl(totalUsd)} defaultOpen>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Custo Total</div>
            <div className={s.kpiVal}>{fmtBrl(totalUsd)}</div>
            <div className={s.kpiSub}>{fmtUsd(totalUsd)}</div>
            <div className={`${s.kpiTrend} ${costPct > 0 ? s.kpiUp : costPct < 0 ? s.kpiDown : s.kpiNeutral}`}>
              {costPct > 0 ? '▲' : costPct < 0 ? '▼' : '—'} {Math.abs(costPct).toFixed(0)}% vs período anterior
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Requests</div>
            <div className={s.kpiVal}>{fmtNum(totalReqs)}</div>
            <div className={`${s.kpiTrend} ${reqPct > 0 ? s.kpiUp : reqPct < 0 ? s.kpiDown : s.kpiNeutral}`}>
              {reqPct > 0 ? '▲' : reqPct < 0 ? '▼' : '—'} {Math.abs(reqPct).toFixed(0)}% vs anterior
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Tokens</div>
            <div className={s.kpiVal}>{fmtNum(totalTokens)}</div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Custo Hoje</div>
            <div className={s.kpiVal}>{fmtBrl(todayUsd)}</div>
            <div className={s.kpiSub}>{todayReqs} requests</div>
          </div>
        </div>
      </Section>

      {/* ── Seção 2: Gráfico ── */}
      <Section title="Custo Diário por Provider" badge={`${chartData.length}d`}>
        <div className={s.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `R$${v}`} />
              <Tooltip formatter={(v: unknown) => [`R$ ${Number(v).toFixed(2)}`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {providers.map(p => (
                <Bar key={p} dataKey={p} stackId="a" fill={PROVIDER_COLORS[p] || '#9ca3af'} radius={p === providers[providers.length - 1] ? [3, 3, 0, 0] : undefined} maxBarSize={20} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ── Seção 3: Detalhamento ── */}
      <Section title="Detalhamento" badge={`${tableRows.length} itens`}>
        <div className={s.tableToolbar}>
          <div className={s.groupToggle}>
            <button className={`${s.groupBtn} ${groupBy === 'function' ? s.groupBtnActive : ''}`} onClick={() => setGroupBy('function')}>Por Função</button>
            <button className={`${s.groupBtn} ${groupBy === 'model' ? s.groupBtnActive : ''}`} onClick={() => setGroupBy('model')}>Por Modelo</button>
          </div>
          <select className={s.filterSelect} value={filterFn} onChange={e => setFilterFn(e.target.value)}>
            <option value="">Todas as funções</option>
            {uniqueFns.map(fn => <option key={fn} value={fn}>{fn}</option>)}
          </select>
          <select className={s.filterSelect} value={filterModel} onChange={e => setFilterModel(e.target.value)}>
            <option value="">Todos os modelos</option>
            {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={thCls(groupBy === 'function' ? 'function_name' : 'model')} onClick={() => toggleSort(groupBy === 'function' ? 'function_name' : 'model')}>
                  {groupBy === 'function' ? 'Função' : 'Modelo'} {sortKey === (groupBy === 'function' ? 'function_name' : 'model') ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className={`${s.tableRight} ${thCls('requests')}`} onClick={() => toggleSort('requests')}>Requests {sortKey === 'requests' ? (sortAsc ? '↑' : '↓') : ''}</th>
                <th className={`${s.tableRight} ${thCls('input_tokens')}`} onClick={() => toggleSort('input_tokens')}>Tokens In {sortKey === 'input_tokens' ? (sortAsc ? '↑' : '↓') : ''}</th>
                <th className={`${s.tableRight} ${thCls('output_tokens')}`} onClick={() => toggleSort('output_tokens')}>Tokens Out {sortKey === 'output_tokens' ? (sortAsc ? '↑' : '↓') : ''}</th>
                <th className={`${s.tableRight} ${thCls('custo_usd')}`} onClick={() => toggleSort('custo_usd')}>Custo {sortKey === 'custo_usd' ? (sortAsc ? '↑' : '↓') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => (
                <tr key={r.key}>
                  <td>{r.key}</td>
                  <td className={s.tableRight}>{fmtNum(r.requests)}</td>
                  <td className={s.tableRight}>{fmtNum(r.input_tokens)}</td>
                  <td className={s.tableRight}>{fmtNum(r.output_tokens)}</td>
                  <td className={s.tableRight}>
                    <strong>{fmtBrl(r.custo_usd)}</strong>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fmtUsd(r.custo_usd)}</div>
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>Sem dados</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Seção 4: Recursos e Limites ── */}
      {(() => {
        /* ── Gerar cards dinâmicos de IA a partir dos dados + modelos conhecidos ── */
        const AI_HUB_MODELS: Record<string, string[]> = {
          Groq: ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it','llama-3.2-90b-vision-preview','deepseek-r1-distill-llama-70b','mistral-saba-24b','qwen-qwq-32b'],
          Gemini: ['gemini-2.5-flash'],
          Cerebras: ['llama-3.3-70b','qwen-3-235b-a22b-instruct-2507'],
          Mistral: ['mistral-small-latest'],
          Cohere: ['command-a-03-2025','command-r7b-12-2024'],
          HuggingFace: ['mistralai/Mistral-7B-Instruct-v0.3','google/gemma-2-2b-it','microsoft/Phi-3-mini-4k-instruct','meta-llama/Llama-3.1-8B-Instruct','Qwen/Qwen2.5-72B-Instruct','mistralai/Mixtral-8x7B-Instruct-v0.1'],
          Together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo','mistralai/Mixtral-8x7B-Instruct-v0.1','Qwen/Qwen2.5-72B-Instruct-Turbo','deepseek-ai/DeepSeek-R1-Distill-Llama-70B','meta-llama/Llama-3.1-405B-Instruct-Turbo'],
          Cloudflare: ['@cf/meta/llama-3.1-8b-instruct','@cf/mistral/mistral-7b-instruct-v0.1','@cf/deepseek-ai/deepseek-r1-distill-qwen-32b','@cf/qwen/qwen2.5-coder-32b-instruct'],
          OpenRouter: ['google/gemini-2.5-flash-exp:free','meta-llama/llama-3.3-70b-instruct:free','mistralai/mistral-7b-instruct:free','qwen/qwen3-coder-480b:free','deepseek/deepseek-r1:free','nvidia/llama-3.1-nemotron-70b-instruct:free'],
        }

        // Merge: modelos do Hub + qualquer modelo encontrado nos logs
        const allModelsByProv: Record<string, Set<string>> = {}
        // Primeiro: modelos configurados no Hub
        Object.entries(AI_HUB_MODELS).forEach(([prov, models]) => {
          allModelsByProv[prov] = new Set(models)
        })
        // Depois: modelos encontrados nos logs (inclui novos automaticamente)
        rows.forEach(r => {
          const prov = getProvider(r.model)
          if (!allModelsByProv[prov]) allModelsByProv[prov] = new Set()
          allModelsByProv[prov].add(r.model)
        })

        // Gerar LimitDef para cada provider IA
        const iaLimits: LimitDef[] = []

        // Card especial: Claude API (com créditos)
        const claudeModels = Array.from(allModelsByProv['Claude'] || [])
        iaLimits.push({
          name: '🤖 Claude API (ERP)', tier: 'por uso', category: 'IA',
          items: [
            { label: '__credito__' },
            ...claudeModels.map(m => ({ label: `${friendlyModel(m)} — req/mês`, usedKey: `model:${m}` })),
            { label: 'Tokens consumidos', usedKey: 'tokens:Claude' },
            { label: 'Custo API mês', usedKey: 'cost:Claude' },
            { label: 'Haiku Input', desc: 'R$ 4,56 / 1M tokens' },
            { label: 'Haiku Output', desc: 'R$ 22,80 / 1M tokens' },
            { label: 'Sonnet Input', desc: 'R$ 17,10 / 1M tokens' },
            { label: 'Sonnet Output', desc: 'R$ 85,50 / 1M tokens' },
          ],
        })

        // Cards para outros providers (dinâmicos)
        const iaOrder = ['Gemini','Groq','Cerebras','Mistral','Cohere','HuggingFace','Together','Cloudflare','OpenRouter']
        iaOrder.forEach(prov => {
          const meta = PROVIDER_META[prov] || { icon: '🔌', tier: 'grátis' }
          const models = Array.from(allModelsByProv[prov] || [])
          const items: LimitItem[] = [
            { label: 'Total req/mês', usedKey: `prov:${prov}` },
            { label: 'Total tokens/mês', usedKey: `tokens:${prov}` },
          ]
          if (meta.dailyLimit) {
            items.push({ label: 'Req/dia (limite)', limit: meta.dailyLimit, usedKey: `daily:${prov}` })
          }
          models.forEach(m => {
            items.push({ label: friendlyModel(m), usedKey: `model:${m}` })
          })
          if (meta.desc) {
            items.push({ label: 'Info', desc: meta.desc })
          }
          iaLimits.push({
            name: `${meta.icon} ${prov}`, tier: meta.tier, cost: meta.cost, category: 'IA',
            items,
          })
        })

        // Providers desconhecidos encontrados nos logs
        Object.entries(allModelsByProv).forEach(([prov, models]) => {
          if (prov === 'Claude' || iaOrder.includes(prov) || prov === 'Outro') return
          iaLimits.push({
            name: `🔌 ${prov}`, tier: 'desconhecido', category: 'IA',
            items: [
              { label: 'Total req/mês', usedKey: `prov:${prov}` },
              ...Array.from(models).map(m => ({ label: friendlyModel(m), usedKey: `model:${m}` })),
            ],
          })
        })

        const LIMITS = [...STATIC_LIMITS.filter(l => l.category !== 'IA'), ...iaLimits, ...STATIC_LIMITS.filter(() => false)]
        // Reorganizar: Desenvolvimento, Hospedagem, IA, Busca, Integrações
        const allLimits = [
          ...STATIC_LIMITS.filter(l => l.category === 'Desenvolvimento'),
          ...STATIC_LIMITS.filter(l => l.category === 'Hospedagem'),
          ...iaLimits,
          ...STATIC_LIMITS.filter(l => l.category === 'Busca'),
          ...STATIC_LIMITS.filter(l => l.category === 'Integrações'),
        ]

        const categories = [...new Set(allLimits.map(l => l.category))]
        const totalMensal = allLimits.reduce((acc, l) => {
          if (!l.cost) return acc
          const m = l.cost.match(/([\d.,]+)/)
          if (!m) return acc
          const val = parseFloat(m[1].replace(',', '.'))
          if (l.cost.includes('US$')) return acc + val * USD_BRL
          if (l.cost.includes('/ano')) return acc + val / 12
          return acc + val
        }, 0) + 687.50 // Claude Max
        return (
          <Section title="Recursos do Sistema" badge={`~R$ ${totalMensal.toFixed(0)}/mês`}>
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div className={s.catTitle}>{cat}</div>
                <div className={s.limitsGrid}>
                  {allLimits.filter(l => l.category === cat).map(lim => (
                    <div key={lim.name} className={s.limitCard}>
                      <div className={s.limitHeader} onClick={() => toggleCard(lim.name)} style={{ cursor: 'pointer' }}>
                        <span className={s.limitName}>
                          {lim.name}
                          <span className={`${s.cardChevron} ${openCards[lim.name] ? s.cardChevronOpen : ''}`}>▾</span>
                        </span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {lim.cost && <span className={s.limitCost}>{lim.cost}</span>}
                          <span className={`${s.limitTier} ${lim.tier === 'grátis' ? s.limitFree : lim.tier === 'por uso' ? s.limitUsage : s.limitPaid}`}>{lim.tier}</span>
                        </div>
                      </div>
                      {openCards[lim.name] && <div className={s.limitRows}>
                        {lim.items.map((item, i) => {
                          // Resolver usedKey para valor real
                          const resolveUsed = (key?: string): number | null => {
                            if (!key) return null
                            if (key === 'fn:*') return monthTotalReqs
                            if (key.startsWith('daily:')) return dailyReqsByProvider[key.slice(6)] || 0
                            if (key.startsWith('prov:')) return monthReqsByProvider[key.slice(5)] || 0
                            if (key.startsWith('tokens:')) return monthTokensByProvider[key.slice(7)] || 0
                            if (key.startsWith('cost:')) return monthCostByProvider[key.slice(5)] || 0
                            if (key.startsWith('model:')) return monthReqsByModel[key.slice(6)] || 0
                            if (key.startsWith('fn:')) return monthReqsByFn[key.slice(3)] || 0
                            return null
                          }
                          // Bloco especial: crédito Claude API
                          if (item.label === '__credito__') {
                            const gastoUsd = monthCostByProvider['Claude'] || 0
                            const gastoTotal = rows.reduce((a, r) => getProvider(r.model) === 'Claude' ? a + Number(r.custo_usd) : a, 0)
                            const saldo = creditoTotal - gastoTotal
                            const pctUsed = creditoTotal > 0 ? Math.min((gastoTotal / creditoTotal) * 100, 100) : 0
                            const barCls = pctUsed >= 90 ? s.limitDanger : pctUsed >= 70 ? s.limitWarn : s.limitOk
                            return (
                              <div key={i} className={s.creditBlock}>
                                <div className={s.creditHeader}>
                                  <span className={s.creditTitle}>Saldo de Créditos</span>
                                  <button className={s.creditEditBtn} onClick={() => { setEditCredito(v => !v); setCreditoInput(String(creditoTotal || '')) }}>
                                    {editCredito ? '✕' : '✏️'}
                                  </button>
                                </div>
                                {editCredito && (
                                  <div className={s.creditForm}>
                                    <input
                                      className={s.creditInput}
                                      type="number"
                                      step="0.01"
                                      placeholder="Total comprado (USD)"
                                      value={creditoInput}
                                      onChange={e => setCreditoInput(e.target.value)}
                                    />
                                    <button className={s.creditSaveBtn} onClick={() => {
                                      const v = parseFloat(creditoInput) || 0
                                      setCreditoTotal(v)
                                      localStorage.setItem('claude_credito_total', String(v))
                                      setEditCredito(false)
                                    }}>Salvar</button>
                                  </div>
                                )}
                                {creditoTotal > 0 ? (
                                  <>
                                    <div className={s.limitLabel}>
                                      <span>Comprado</span>
                                      <span className={s.limitUsedVal}>{fmtBrl(creditoTotal)}</span>
                                    </div>
                                    <div className={s.limitLabel}>
                                      <span>Gasto total</span>
                                      <span className={s.limitUsedVal}>{fmtBrl(gastoTotal)}</span>
                                    </div>
                                    <div className={s.limitLabel}>
                                      <span>Saldo restante</span>
                                      <span className={`${s.limitUsedVal} ${saldo <= 0 ? s.kpiUp : s.kpiDown}`}>{fmtBrl(saldo)}</span>
                                    </div>
                                    <div className={s.limitBarBg}>
                                      <div className={`${s.limitBar} ${barCls}`} style={{ width: `${pctUsed}%` }} />
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Clique em ✏️ para informar o total de créditos comprados (em USD)</div>
                                )}
                              </div>
                            )
                          }

                          const used = resolveUsed(item.usedKey)
                          const isCost = item.usedKey?.startsWith('cost:')
                          const isTokens = item.usedKey?.startsWith('tokens:')

                          // Sem usedKey e sem limit → texto estático
                          if (used === null && !item.limit) {
                            return (
                              <div key={i} className={s.limitRow}>
                                <div className={s.limitLabel}><span>{item.label}</span><span>{item.desc}</span></div>
                              </div>
                            )
                          }

                          // Com usedKey mas sem limit → mostra valor usado
                          if (used !== null && !item.limit) {
                            const display = isCost ? fmtBrl(used) : isTokens ? fmtNum(used) : fmtNum(used)
                            const modelId = item.usedKey?.startsWith('model:') ? item.usedKey.slice(6) : null
                            const mi = modelId ? getModelInfo(modelId) : null
                            return (
                              <div key={i} className={s.limitRow}>
                                {mi && <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: 1 }}>{mi.skill} <span style={{ color: '#cbd5e1' }}>{mi.tags.join(' · ')}</span></div>}
                                <div className={s.limitLabel}>
                                  <span>{item.label}</span>
                                  <span className={s.limitUsedVal}>{display}</span>
                                </div>
                              </div>
                            )
                          }

                          // Com limit → barra de progresso
                          const usedVal = used ?? 0
                          const pct = Math.min((usedVal / (item.limit || 1)) * 100, 100)
                          const barCls = pct >= 90 ? s.limitDanger : pct >= 70 ? s.limitWarn : s.limitOk
                          return (
                            <div key={i} className={s.limitRow}>
                              <div className={s.limitLabel}>
                                <span>{item.label}</span>
                                <span>{fmtNum(usedVal)} / {fmtNum(item.limit!)}</span>
                              </div>
                              <div className={s.limitBarBg}>
                                <div className={`${s.limitBar} ${barCls}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )
      })()}

      {/* ── Seção 5: Novidades IA ── */}
      {(() => {
        const doDiscover = async () => {
          setDiscovering(true)
          try {
            const { data, error } = await supabase.functions.invoke('ai-hub', {
              body: { action: 'discover' },
            })
            if (!error && data?.ok) {
              setDiscovered(data.discovered)
              setConfiguredModels(data.configured)
            }
          } catch { /* skip */ }
          setDiscovering(false)
        }

        const providerLabels: Record<string, string> = {
          groq: '⚡ Groq', openrouter: '🔀 OpenRouter', together: '🤝 Together', cohere: '🧠 Cohere', huggingface: '🤗 HuggingFace',
        }

        const totalNew = discovered ? Object.values(discovered).reduce((a, models) => a + models.filter(m => m.new).length, 0) : 0

        const activateModel = async (prov: string, m: { id: string; name: string; free: boolean; context?: number; price?: string }) => {
          await supabase.functions.invoke('ai-hub', {
            body: { action: 'activate', provider: prov, model_id: m.id, display_name: m.name, free: m.free, context_length: m.context, price: m.price },
          })
          // Atualizar lista
          if (discovered) {
            const updated = { ...discovered }
            if (updated[prov]) {
              updated[prov] = updated[prov].map(mod => mod.id === m.id ? { ...mod, new: false } : mod)
            }
            setDiscovered(updated)
          }
          if (configuredModels) {
            const updated = { ...configuredModels }
            if (!updated[prov]) updated[prov] = []
            updated[prov] = [...updated[prov], m.id]
            setConfiguredModels(updated)
          }
        }

        const deactivateModel = async (prov: string, modelId: string) => {
          await supabase.functions.invoke('ai-hub', {
            body: { action: 'deactivate', provider: prov, model_id: modelId },
          })
          if (discovered) {
            const updated = { ...discovered }
            if (updated[prov]) {
              updated[prov] = updated[prov].map(mod => mod.id === modelId ? { ...mod, new: true } : mod)
            }
            setDiscovered(updated)
          }
          if (configuredModels) {
            const updated = { ...configuredModels }
            if (updated[prov]) updated[prov] = updated[prov].filter(id => id !== modelId)
            setConfiguredModels(updated)
          }
        }

        return (
          <Section title="Novidades IA" badge={discovered ? `${totalNew} novos` : undefined}>
            <div style={{ marginBottom: 12 }}>
              <button
                className={s.creditSaveBtn}
                onClick={doDiscover}
                disabled={discovering}
                style={{ opacity: discovering ? 0.6 : 1 }}
              >
                {discovering ? '🔄 Consultando providers...' : '🔍 Verificar novos modelos'}
              </button>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 8 }}>
                Consulta Groq, OpenRouter, Together e Cohere em tempo real
              </span>
            </div>

            {discovered && Object.entries(discovered).map(([prov, models]) => {
              const newModels = models.filter(m => m.new)
              const existingModels = models.filter(m => !m.new)
              const conf = configuredModels?.[prov] || []

              return (
                <div key={prov} style={{ marginBottom: 16 }}>
                  <div
                    className={s.limitHeader}
                    onClick={() => toggleCard(`disc_${prov}`)}
                    style={{ cursor: 'pointer', padding: '10px 0' }}
                  >
                    <span className={s.limitName}>
                      {providerLabels[prov] || prov}
                      {newModels.length > 0 && (
                        <span className={s.sectionBadge} style={{ background: '#dcfce7', color: '#166534' }}>
                          🆕 {newModels.length} novos
                        </span>
                      )}
                      <span className={s.sectionBadge}>{models.length} disponíveis</span>
                      <span className={s.sectionBadge} style={{ background: '#e0f2fe', color: '#0369a1' }}>{conf.length} configurados</span>
                      <span className={`${s.cardChevron} ${openCards[`disc_${prov}`] ? s.cardChevronOpen : ''}`}>▾</span>
                    </span>
                  </div>
                  {openCards[`disc_${prov}`] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8 }}>
                      {newModels.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginTop: 4 }}>
                            Novos (não configurados)
                          </div>
                          {newModels.map(m => (
                            <div key={m.id} className={s.limitRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                              <span style={{ fontSize: '0.75rem', color: '#1e293b', flex: 1 }}>
                                🆕 <strong>{m.name || m.id}</strong>
                                {m.context && <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: 6 }}>{(m.context / 1000).toFixed(0)}K ctx</span>}
                                {getModelInfo(m.id) && <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: 1 }}>{getModelInfo(m.id)!.skill} <span style={{ color: '#cbd5e1' }}>— {getModelInfo(m.id)!.tags.join(' · ')}</span></div>}
                              </span>
                              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {m.price && <span style={{ fontSize: '0.58rem', color: '#92400e' }}>{m.price}</span>}
                                {m.likes && <span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>♥ {m.likes}</span>}
                                <span className={`${s.limitTier} ${m.free ? s.limitFree : s.limitPaid}`} style={{ fontSize: '0.58rem' }}>
                                  {m.free ? 'free' : 'pago'}
                                </span>
                                <button
                                  onClick={() => activateModel(prov, m)}
                                  style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 6, border: '1px solid #22c55e', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Ativar
                                </button>
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                      {existingModels.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: 8 }}>
                            Já configurados
                          </div>
                          {existingModels.map(m => (
                            <div key={m.id} className={s.limitRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', flex: 1 }}>
                                ✅ {m.name || m.id}
                                {m.context && <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: 6 }}>{(m.context / 1000).toFixed(0)}K ctx</span>}
                                {getModelInfo(m.id) && <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: 1 }}>{getModelInfo(m.id)!.skill} — {getModelInfo(m.id)!.tags.join(' · ')}</div>}
                              </span>
                              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {m.price && <span style={{ fontSize: '0.58rem', color: '#92400e' }}>{m.price}</span>}
                                <span className={`${s.limitTier} ${m.free ? s.limitFree : s.limitPaid}`} style={{ fontSize: '0.58rem' }}>
                                  {m.free ? 'free' : 'pago'}
                                </span>
                                <button
                                  onClick={() => deactivateModel(prov, m.id)}
                                  style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 6, border: '1px solid #ef4444', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Desativar
                                </button>
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Section>
        )
      })()}
    </div>
  )
}
