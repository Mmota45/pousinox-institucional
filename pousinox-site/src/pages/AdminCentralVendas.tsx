import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import { aiChat, aiParallel, type MultiResult } from '../lib/aiHelper'
import AiActionButton from '../components/assistente/AiActionButton'
import HistoricoModal from '../components/HistoricoModal/HistoricoModal'
import ModalIframe from '../components/ModalIframe/ModalIframe'
import { SearchableSelect } from '../components/SearchableSelect/SearchableSelect'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import styles from './AdminCentralVendas.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProspectScore {
  prospect_id: number
  score_total: number
  score_demanda: number
  score_segmento: number
  score_porte: number
  score_distancia: number
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  uf: string
  cidade: string
  segmento: string | null
  porte: string | null
  telefone1: string | null
  telefone2: string | null
  email: string | null
  status_contato: string | null
  ultimo_contato: string | null
  whatsapp: string | null
  whatsapp_validado: boolean
}

interface Followup {
  id: number
  prospect_id: number
  deal_id: number | null
  tipo: string
  data_prevista: string
  data_realizada: string | null
  status: string
  observacao: string | null
  created_by: string | null
  created_at: string
  prospeccao: { id: number; razao_social: string; nome_fantasia: string | null; cnpj: string; uf: string; cidade: string; telefone1: string | null; email: string | null; segmento: string | null }
  pipeline_deals: { id: number; titulo: string; estagio: string; valor_estimado: number } | null
}

interface Material {
  id: number; titulo: string; tipo: string; url: string; descricao: string | null; ativo: boolean; envios: number
}

interface DashData {
  contactados: number; materiaisEnviados: number
  followupsAtrasados: number; followupsHoje: number
  dealsAbertos: number; dealsGanhos: number; receitaPipeline: number
}

type Aba = 'radar' | 'hotlist' | 'followups' | 'whatsapp' | 'materiais' | 'dashboard' | 'emails'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().slice(0, 10)
const fmtBRL = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const diasAte = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

const STATUS_OPTS = [
  { value: '',                  label: '— Sem status',        bg: '#f1f5f9', color: '#64748b' },
  { value: 'Interessado',       label: '🟢 Interessado',       bg: '#dcfce7', color: '#15803d' },
  { value: 'Aguardando',        label: '🟡 Aguardando',        bg: '#fef9c3', color: '#92400e' },
  { value: 'Retornar',          label: '🔵 Retornar',          bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'Orçamento enviado', label: '📄 Orçamento enviado', bg: '#fce7f3', color: '#9d174d' },
  { value: 'Venda fechada',     label: '🏆 Venda fechada',     bg: '#ede9fe', color: '#6d28d9' },
  { value: 'Sem interesse',     label: '⚪ Sem interesse',     bg: '#f1f5f9', color: '#94a3b8' },
]

// Scoring frontend (quando busca direto sem RPC)
function scoreSegmento(seg: string | null): number {
  if (!seg) return 4
  const s = seg.toLowerCase()
  if (s.includes('constru')) return 9
  if (s.includes('revest')) return 8
  if (s.includes('arquit') || s.includes('engenh')) return 7
  return 4
}
function scorePorte(porte: string | null): number {
  if (!porte) return 2
  const p = porte.toLowerCase()
  if (p.includes('grande')) return 10
  if (p.includes('médio') || p.includes('medio')) return 7
  if (p.includes('pequeno') || p === 'epp') return 5
  if (p.includes('micro') || p === 'me') return 3
  return 2
}
function scoreFrontend(p: any): number {
  return (5 * 0.35 + scoreSegmento(p.segmento) * 0.25 + scorePorte(p.porte) * 0.20 + 8 * 0.20)
}

const ABAS: { key: Aba; label: string; icon: string }[] = [
  { key: 'hotlist', label: 'Hot List', icon: '🔥' },
  { key: 'followups', label: 'Follow-ups', icon: '📅' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { key: 'materiais', label: 'Materiais', icon: '📎' },
  { key: 'emails', label: 'E-mails', icon: '📧' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'radar', label: 'Radar', icon: '📡' },
]

// ── Multi-IA Drawer ──────────────────────────────────────────────────────────

const MULTI_TARGETS = [
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'groq', model: 'gemma2-9b-it' },
  { provider: 'groq', model: 'mixtral-8x7b-32768' },
]

function DrawerMultiIA({ prospect }: { prospect: ProspectScore }) {
  const [results, setResults] = useState<MultiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  async function gerar() {
    setLoading(true)
    setResults([])
    const seg = (prospect.segmento || '').toLowerCase()
    const isConstru = /constru|engenh|arquit|revest|imobil/i.test(seg)
    const descEmpresa = isConstru
      ? 'A Pousinox fabrica equipamentos em aço inox sob medida E o fixador de segurança para porcelanato (insert metálico que impede desprendimento de placas — NÃO substitui argamassa).'
      : 'A Pousinox fabrica equipamentos e mobiliário em aço inox sob medida desde 2001: bancadas, fogões industriais, coifas, corrimãos, lava-botas, mesas de trabalho, tanques, cubas, mobiliário para cozinhas industriais e soluções personalizadas.'
    const prompt = `Prospect: ${prospect.nome_fantasia || prospect.razao_social}\nCNPJ: ${prospect.cnpj || 'N/I'}\nSegmento: ${prospect.segmento || 'N/I'}\nPorte: ${prospect.porte || 'N/I'}\nCidade/UF: ${prospect.cidade || ''}/${prospect.uf || ''}\nScore: ${Number(prospect.score_total).toFixed(1)}\nStatus: ${prospect.status_contato || 'Novo'}\n\n${descEmpresa}\n\nCrie uma mensagem de abordagem comercial personalizada via WhatsApp. Foque nos produtos RELEVANTES para "${prospect.segmento || 'geral'}". Inclua: gancho, proposta de valor e call-to-action. Máx 3 parágrafos.`
    const system = 'Vendedor consultivo B2B da Pousinox. Mensagens naturais e profissionais. Português brasileiro. NÃO mencione fixador de porcelanato se o segmento não for construção/engenharia/arquitetura.'
    const res = await aiParallel(prompt, MULTI_TARGETS, system)
    setResults(res)
    setLoading(false)
  }

  function copiar(txt: string, idx: number) {
    navigator.clipboard.writeText(txt)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <button
        onClick={gerar}
        disabled={loading}
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700, width: '100%', opacity: loading ? 0.7 : 1, fontSize: '0.85rem', letterSpacing: '-0.01em', boxShadow: '0 2px 8px rgba(99,102,241,0.25)', transition: 'box-shadow 0.15s, transform 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.25)'; e.currentTarget.style.transform = 'none' }}
      >
        {loading ? '⏳ Gerando 3 variações...' : '🧠 Gerar 3 variações IA'}
      </button>
      {results.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r, i) => (
            <div key={i} style={{ background: r.error ? '#fef2f2' : '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 11, color: '#6366f1' }}>
                  {r.model} {r.tempo ? `(${(r.tempo / 1000).toFixed(1)}s)` : ''}
                </span>
                {!r.error && (
                  <button onClick={() => copiar(r.response, i)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                    {copied === i ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {r.error ? `❌ ${r.error}` : r.response}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminCentralVendas() {
  const { ocultarValores } = useAdmin()
  const navigate = useNavigate()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)

  const [aba, setAba] = useState<Aba>('hotlist')
  const tabLoaded = useRef<Partial<Record<Aba, boolean>>>({})
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const showMsg = useCallback((tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3500)
  }, [])

  // ── Hot List ──
  const [hotlist, setHotlist] = useState<ProspectScore[]>([])
  const [loadingHot, setLoadingHot] = useState(false)
  const [filtroUFs, setFiltroUFs] = useState<string[]>([])
  const [filtroSegmentos, setFiltroSegmentos] = useState<string[]>([])
  const [filtroDemanda, setFiltroDemanda] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroSoWa, setFiltroSoWa] = useState(false)
  const [showUFDrop, setShowUFDrop] = useState(false)
  const [showSegDrop, setShowSegDrop] = useState(false)
  const [showMesoDrop, setShowMesoDrop] = useState(false)
  const [mesorregioes, setMesorregioes] = useState<string[]>([])
  const [filtroMeso, setFiltroMeso] = useState<string[]>([])
  const [cidadesMeso, setCidadesMeso] = useState<string[]>([]) // cidades das mesorregiões selecionadas
  const [filtroCidades, setFiltroCidades] = useState<string[]>([])
  const [showCidadeDrop, setShowCidadeDrop] = useState(false)
  const [buscaCidade, setBuscaCidade] = useState('')
  const [buscaSegmento, setBuscaSegmento] = useState('')
  const [buscaMeso, setBuscaMeso] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  // ── Follow-ups ──
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loadingFup, setLoadingFup] = useState(false)

  // ── Materiais ──
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loadingMat, setLoadingMat] = useState(false)
  const [formMat, setFormMat] = useState({ titulo: '', tipo: 'apresentacao', url: '', descricao: '' })
  const [showFormMat, setShowFormMat] = useState(false)

  // ── Template WhatsApp ──
  const TEMPLATE_KEY = 'pousinox_wpp_template'
  const PRODUTOS_KEY = 'pousinox_wpp_produtos'
  const templateDefault = `Boa tarde, {nome}.

Meu nome é Marcos, da Pousinox\u00AE. Fabricamos equipamentos em aço inox padrão e sob medida{origem}.

Trabalhamos com: {produtos}.

Caso estejam precisando de algum projeto específico sob medida ou equipamento, ficamos à disposição. Seria um prazer conversar com o responsável pela área de compras.

Marcos Mota
Pousinox\u00AE \u2014 A Arte em Inox
pousinox.com.br`
  const produtosDefault: Record<string, string> = {
    generico: 'bancadas, mesas, coifas, fogões industriais, lava-botas, corrimãos e projetos sob medida',
    'açougue/frigorífico': 'bancadas, mesas de corte, ganchos, lava-botas e estruturas para câmaras frias',
    'restaurante/bar': 'bancadas, fogões industriais, coifas, mesas de preparo e mobiliário para cozinhas profissionais',
    'padaria/confeitaria': 'bancadas, estantes, mesas de trabalho e estruturas para fornos',
    'hospital/clínica': 'bancadas, pias cirúrgicas, mobiliário técnico e equipamentos para ambientes controlados',
    'hotel/pousada': 'bancadas, buffets, mesas e mobiliário para cozinhas industriais',
    'construção/engenharia': 'fixador de segurança para porcelanato, corrimãos, guarda-corpos e peças sob medida',
    'supermercado/varejo': 'bancadas, balcões, mesas de manipulação e estruturas para áreas de preparo',
  }
  const [wppTemplate, setWppTemplate] = useState(() => {
    try { return localStorage.getItem(TEMPLATE_KEY) || templateDefault } catch { return templateDefault }
  })
  const [wppProdutos, setWppProdutos] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem(PRODUTOS_KEY); return s ? JSON.parse(s) : produtosDefault } catch { return produtosDefault }
  })
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [editSegmento, setEditSegmento] = useState('generico')

  // ── Radar / GSC ──
  const [gscData, setGscData] = useState<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number; topQueries: any[]; totalQueries: number } | null>(null)
  const [loadingGsc, setLoadingGsc] = useState(false)
  const [gscFetching, setGscFetching] = useState(false)
  const [gscDias, setGscDias] = useState(28)
  const [gscSort, setGscSort] = useState<{ col: string; asc: boolean }>({ col: 'impressions', asc: false })
  const [gscSecoes, setGscSecoes] = useState<Record<string, boolean>>({ kpis: true, queries: true, audit: true, cruzamento: true, dicas: false, futuras: false })
  const [marketKws, setMarketKws] = useState<{ termo: string; uf: string; volume_mensal: number; camada: string; intencao: string | null }[]>([])

  // ── Drawer prospect ──
  const [drawerPs, setDrawerPs] = useState<ProspectScore | null>(null)
  const [orcamentoModal, setOrcamentoModal] = useState(false)
  const [validandoWa, setValidandoWa] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [waProg, setWaProg] = useState({ done: 0, total: 0, validos: 0 })
  const [waPendentes, setWaPendentes] = useState<ProspectScore[]>([])
  const [waStats, setWaStats] = useState({ total: 0, validados: 0, pendentes: 0 })
  const [waLoadingTab, setWaLoadingTab] = useState(false)
  const [cronConfig, setCronConfig] = useState<{ uf: string[]; mesorregiao: string[]; cidade: string[]; segmento: string[] }>({ uf: [], mesorregiao: [], cidade: [], segmento: [] })
  const [cronMesos, setCronMesos] = useState<string[]>([])
  const [cronSegmentos, setCronSegmentos] = useState<string[]>([])
  const [cronCidades, setCronCidades] = useState<string[]>([])
  const [cronSaving, setCronSaving] = useState(false)
  const [cronSegStats, setCronSegStats] = useState<{ segmento: string; total: number; validados: number; pendentes: number }[]>([])
  const [cronSegLoading, setCronSegLoading] = useState(false)
  const [waAutoStats, setWaAutoStats] = useState<{ hoje: number; semana: number; total: number; respondidos: number; ultimos: any[] }>({ hoje: 0, semana: 0, total: 0, respondidos: 0, ultimos: [] })
  const [drawerNfs, setDrawerNfs] = useState<any[]>([])
  const [drawerNfsLoading, setDrawerNfsLoading] = useState(false)
  const [drawerNfExpandida, setDrawerNfExpandida] = useState<number | null>(null)
  const [drawerNfItens, setDrawerNfItens] = useState<Record<number, any[]>>({})
  const [drawerStatusOpen, setDrawerStatusOpen] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState<{ id: number; nome: string } | null>(null)
  const [drawerSecoes, setDrawerSecoes] = useState<Record<string, boolean>>({ contato: false, scores: false, nfs: false, portfolio: false, regulatorio: false, estoque: false, orcamentos: false, producao: false, deals: false, ia: false, atividades: false })
  const [drawerPortfolio, setDrawerPortfolio] = useState<any[]>([])
  const [drawerPortfolioLoading, setDrawerPortfolioLoading] = useState(false)
  const [drawerNormas, setDrawerNormas] = useState<any[]>([])
  const [drawerEquipamentos, setDrawerEquipamentos] = useState<any[]>([])
  const [msgRegulatoria, setMsgRegulatoria] = useState('')
  const [portfolioAddOpen, setPortfolioAddOpen] = useState(false)
  const [portfolioAddNome, setPortfolioAddNome] = useState('')
  const [portfolioAddDesc, setPortfolioAddDesc] = useState('')
  const [todosPortfolioProdutos, setTodosPortfolioProdutos] = useState<any[]>([])
  const [portfolioAddExistente, setPortfolioAddExistente] = useState<number | null>(null)
  // ── Novas integrações drawer ──
  const [drawerEstoque, setDrawerEstoque] = useState<any[]>([])
  const [drawerOrcamentos, setDrawerOrcamentos] = useState<any[]>([])
  const [drawerProducao, setDrawerProducao] = useState<any[]>([])
  const [drawerDeals, setDrawerDeals] = useState<any[]>([])
  const [drawerAtividades, setDrawerAtividades] = useState<any[]>([])
  const [emailsLog, setEmailsLog] = useState<any[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailExpandido, setEmailExpandido] = useState<number | null>(null)
  const [drawerNfResumo, setDrawerNfResumo] = useState<{ total: number; qtd: number; ultima: string | null; media: number } | null>(null)
  const [fichaExpandida, setFichaExpandida] = useState<number | null>(null)
  const [drawerConcorrentes, setDrawerConcorrentes] = useState<any[]>([])
  // ── IA Agentes ──
  const [iaAnalise, setIaAnalise] = useState('')
  const [iaResumo, setIaResumo] = useState('')
  const [iaObjecao, setIaObjecao] = useState('')
  const [iaObjecaoInput, setIaObjecaoInput] = useState('')
  const [iaLoadingTipo, setIaLoadingTipo] = useState<string | null>(null)
  const [iaConsultor, setIaConsultor] = useState('')
  const [iaConsultorInput, setIaConsultorInput] = useState('')
  const [iaComparativo, setIaComparativo] = useState('')
  const [iaProposta, setIaProposta] = useState('')
  const statusRef = useRef<HTMLDivElement>(null)

  // ── Dashboard ──
  const [dash, setDash] = useState<DashData | null>(null)
  const [loadingDash, setLoadingDash] = useState(false)

  // ── Funnel data ──
  const [funnelData, setFunnelData] = useState<{ total: number; contactados: number; deals: number; propostas: number; ganhos: number }>({ total: 0, contactados: 0, deals: 0, propostas: 0, ganhos: 0 })

  // ── Loads ───────────────────────────────────────────────────────────────────

  const carregarHotList = useCallback(async () => {
    setLoadingHot(true)
    const N_RPC = 100 // RPC com scoring é pesado — limitar
    const N_DIRETO = 500 // busca direta é leve

    // Se mesorregião selecionada, buscar direto com filtro por cidades
    // Carregar demanda por UF (market_keywords)
    const { data: mkData } = await supabaseAdmin
      .from('market_keywords')
      .select('uf,volume_mensal')
      .eq('ativo', true)
    const demandaPorUf: Record<string, number> = {}
    let maxDemanda = 1
    for (const mk of (mkData ?? [])) {
      demandaPorUf[mk.uf] = (demandaPorUf[mk.uf] || 0) + (mk.volume_mensal || 0)
    }
    maxDemanda = Math.max(1, ...Object.values(demandaPorUf))
    const calcDemanda = (uf: string) => Math.min(10, Math.round(((demandaPorUf[uf] || 0) / maxDemanda) * 10 * 100) / 100)

    if (cidadesMeso.length > 0) {
      const cidadesUpper = cidadesMeso.map(c => c.toUpperCase())
      let q = supabaseAdmin
        .from('prospeccao')
        .select('id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,porte,telefone1,telefone2,email,status_contato,ultimo_contato,whatsapp,whatsapp_validado')
        .in('cidade', cidadesUpper)
        .order('porte', { ascending: false })
        .limit(N_DIRETO)
      // Filtro de segmento aplicado no frontend (hotlistFiltrada)
      const { data, error } = await q
      // Mapear para ProspectScore com scores simplificados
      const mapped = (data ?? []).map((p: any) => ({
        prospect_id: p.id,
        razao_social: p.razao_social,
        nome_fantasia: p.nome_fantasia,
        cnpj: p.cnpj,
        uf: p.uf,
        cidade: p.cidade,
        segmento: p.segmento,
        porte: p.porte,
        telefone1: p.telefone1,
        telefone2: p.telefone2,
        email: p.email,
        status_contato: p.status_contato,
        ultimo_contato: p.ultimo_contato,
        whatsapp: p.whatsapp,
        whatsapp_validado: p.whatsapp_validado ?? false,
        score_demanda: calcDemanda(p.uf),
        score_segmento: scoreSegmento(p.segmento),
        score_porte: scorePorte(p.porte),
        score_distancia: 8,
        score_total: 0,
      })).map((p: any) => ({ ...p, score_total: p.score_demanda * 0.35 + p.score_segmento * 0.25 + p.score_porte * 0.20 + p.score_distancia * 0.20 })) as ProspectScore[]
      mapped.sort((a, b) => Number(b.score_total) - Number(a.score_total))
      setHotlist(mapped)
    } else {
      // Tentar RPC fn_top_prospects — se falhar, buscar direto
      const uf = filtroUFs.length === 1 ? filtroUFs[0] : null
      const { data, error } = await supabaseAdmin.rpc('fn_top_prospects', { n: N_RPC, filtro_uf: uf })
      if (error) {
        // Fallback: buscar direto da tabela
        let query = supabaseAdmin
          .from('prospeccao')
          .select('id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,porte,telefone1,telefone2,email,status_contato,ultimo_contato,whatsapp,whatsapp_validado')
          .order('porte', { ascending: false })
          .limit(N_DIRETO)
        if (filtroUFs.length === 1) query = query.eq('uf', filtroUFs[0])
        else if (filtroUFs.length > 1) query = query.in('uf', filtroUFs)
        // Filtro de segmento aplicado no frontend (hotlistFiltrada)
        const { data: fallback } = await query
        const mapped = (fallback ?? []).map((p: any) => ({
          prospect_id: p.id, razao_social: p.razao_social, nome_fantasia: p.nome_fantasia,
          cnpj: p.cnpj, uf: p.uf, cidade: p.cidade, segmento: p.segmento, porte: p.porte,
          telefone1: p.telefone1, telefone2: p.telefone2, email: p.email,
          status_contato: p.status_contato, ultimo_contato: p.ultimo_contato,
          whatsapp: p.whatsapp, whatsapp_validado: p.whatsapp_validado ?? false,
          score_demanda: calcDemanda(p.uf),
          score_segmento: scoreSegmento(p.segmento), score_porte: scorePorte(p.porte),
          score_distancia: 5, score_total: 0,
        })).map((p: any) => ({ ...p, score_total: p.score_demanda * 0.35 + p.score_segmento * 0.25 + p.score_porte * 0.20 + p.score_distancia * 0.20 })) as ProspectScore[]
        mapped.sort((a, b) => Number(b.score_total) - Number(a.score_total))
        setHotlist(mapped)
        showMsg('erro', 'Função de scoring não encontrada — usando busca direta. Rode a migration para habilitar scoring.')
      } else {
        setHotlist((data ?? []) as ProspectScore[])
      }
    }
    setLoadingHot(false)
  }, [filtroUFs, cidadesMeso])

  const carregarFollowups = useCallback(async () => {
    setLoadingFup(true)
    const { data } = await supabaseAdmin
      .from('followups')
      .select('*, prospeccao(id,razao_social,nome_fantasia,cnpj,uf,cidade,telefone1,email,segmento), pipeline_deals(id,titulo,estagio,valor_estimado)')
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true })
      .limit(100)
    setFollowups((data ?? []) as Followup[])
    setLoadingFup(false)
  }, [])

  const carregarMateriais = useCallback(async () => {
    setLoadingMat(true)
    const { data } = await supabaseAdmin
      .from('materiais_comerciais')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
    setMateriais((data ?? []) as Material[])
    setLoadingMat(false)
  }, [])

  const carregarEmails = useCallback(async () => {
    setEmailsLoading(true)
    const { data } = await supabaseAdmin
      .from('activity_log')
      .select('id, tipo, canal, detalhes, created_at, prospect_id, prospeccao(razao_social, nome_fantasia, email, segmento, uf, cidade)')
      .eq('tipo', 'email')
      .order('created_at', { ascending: false })
      .limit(50)
    setEmailsLog(data ?? [])
    setEmailsLoading(false)
  }, [])

  const carregarDashboard = useCallback(async () => {
    setLoadingDash(true)
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString()

    const [atRes, fupRes, dealsRes, totalRes] = await Promise.all([
      supabaseAdmin.from('activity_log').select('id,tipo', { count: 'exact' }).gte('created_at', semanaAtras),
      supabaseAdmin.from('followups').select('id,status,data_prevista').eq('status', 'pendente'),
      supabaseAdmin.from('pipeline_deals').select('id,estagio,valor_estimado'),
      supabaseAdmin.from('prospeccao').select('id', { count: 'exact', head: true }),
    ])

    const atividades = atRes.data ?? []
    const fups = fupRes.data ?? []
    const deals = dealsRes.data ?? []

    setDash({
      contactados: atividades.filter(a => a.tipo === 'contacted').length,
      materiaisEnviados: atividades.filter(a => a.tipo === 'material_sent').length,
      followupsAtrasados: fups.filter(f => f.data_prevista < hoje).length,
      followupsHoje: fups.filter(f => f.data_prevista === hoje).length,
      dealsAbertos: deals.filter(d => !['ganho', 'perdido'].includes(d.estagio)).length,
      dealsGanhos: deals.filter(d => d.estagio === 'ganho').length,
      receitaPipeline: deals.filter(d => d.estagio === 'ganho').reduce((s, d) => s + (d.valor_estimado ?? 0), 0),
    })

    // Funnel
    const contactadosTotal = await supabaseAdmin.from('prospeccao').select('id', { count: 'exact' }).not('ultimo_contato', 'is', null)
    setFunnelData({
      total: totalRes.count ?? 0,
      contactados: contactadosTotal.count ?? 0,
      deals: deals.filter(d => !['ganho', 'perdido'].includes(d.estagio)).length,
      propostas: deals.filter(d => ['proposta', 'negociacao'].includes(d.estagio)).length,
      ganhos: deals.filter(d => d.estagio === 'ganho').length,
    })

    setLoadingDash(false)
  }, [])

  const carregarGsc = useCallback(async () => {
    setLoadingGsc(true)
    const [gscRes, mkRes] = await Promise.all([
      supabaseAdmin.functions.invoke('central-vendas-gsc', { body: { acao: 'summary' } }),
      supabaseAdmin.from('market_keywords').select('termo,uf,volume_mensal,camada,intencao').eq('ativo', true).limit(500),
    ])
    if (!gscRes.error && gscRes.data?.ok) setGscData(gscRes.data.data)
    setMarketKws((mkRes.data ?? []) as any)
    setLoadingGsc(false)
  }, [])

  async function atualizarGsc() {
    setGscFetching(true)
    const { data, error } = await supabaseAdmin.functions.invoke('central-vendas-gsc', { body: { acao: 'fetch', dias: gscDias } })
    if (error) { showMsg('erro', 'Erro ao buscar GSC'); setGscFetching(false); return }
    showMsg('ok', `GSC atualizado: ${data.total} queries de ${data.sites} sites (${gscDias} dias)`)
    await carregarGsc()
    setGscFetching(false)
  }

  function toggleSecao(key: string) {
    setGscSecoes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function sortGsc(col: string) {
    setGscSort(prev => ({ col, asc: prev.col === col ? !prev.asc : false }))
  }

  const carregarCronSegStats = useCallback(async () => {
    setCronSegLoading(true)
    try {
      let query = supabaseAdmin.from('prospeccao').select('segmento, whatsapp_validado').not('telefone1', 'is', null)
      if (cronConfig.uf.length) query = query.in('uf', cronConfig.uf)
      if (cronConfig.mesorregiao.length) query = query.in('mesorregiao', cronConfig.mesorregiao)
      if (cronConfig.cidade.length) query = query.in('cidade', cronConfig.cidade)
      const { data } = await query.limit(50000)
      if (data) {
        const map = new Map<string, { total: number; validados: number; pendentes: number }>()
        for (const r of data) {
          const seg = r.segmento || 'Sem segmento'
          const e = map.get(seg) || { total: 0, validados: 0, pendentes: 0 }
          e.total++
          if (r.whatsapp_validado) e.validados++
          else e.pendentes++
          map.set(seg, e)
        }
        setCronSegStats([...map.entries()].map(([segmento, v]) => ({ segmento, ...v })).sort((a, b) => b.total - a.total))
      }
    } catch { /* ignore */ }
    setCronSegLoading(false)
  }, [cronConfig])

  const carregarWaTab = useCallback(async () => {
    setWaLoadingTab(true)
    // Buscar contagens + config do cron
    const [{ count: totalCount }, { count: validCount }, { data: cfgData }] = await Promise.all([
      supabaseAdmin.from('prospeccao').select('*', { count: 'exact', head: true }).not('telefone1', 'is', null),
      supabaseAdmin.from('prospeccao').select('*', { count: 'exact', head: true }).eq('whatsapp_validado', true),
      supabaseAdmin.from('feature_flags').select('config').eq('flag', 'prospectar_whatsapp_config').single(),
    ])
    const t = totalCount ?? 0
    const v = validCount ?? 0
    setWaStats({ total: t, validados: v, pendentes: t - v })
    if (cfgData?.config) {
      const c = typeof cfgData.config === 'string' ? JSON.parse(cfgData.config) : cfgData.config
      const toArr = (v: any) => Array.isArray(v) ? v : (v ? [v] : [])
      setCronConfig({ uf: toArr(c.uf), mesorregiao: toArr(c.mesorregiao), cidade: toArr(c.cidade), segmento: toArr(c.segmento) })
      const ufs = toArr(c.uf)
      const mesos = toArr(c.mesorregiao)
      if (ufs.length > 0) {
        const allMesos: string[] = []
        for (const u of ufs) {
          const { data: mData } = await supabaseAdmin.rpc('fn_distinct_mesorregiao', { p_uf: u })
          allMesos.push(...(mData ?? []).map((r: any) => r.mesorregiao).filter(Boolean))
        }
        setCronMesos([...new Set(allMesos)].sort())
        if (mesos.length > 0) {
          const allCidades: string[] = []
          for (const u of ufs) {
            for (const m of mesos) {
              const { data: cData } = await supabaseAdmin.rpc('fn_distinct_cidade', { p_uf: u, p_meso: m })
              allCidades.push(...(cData ?? []).map((r: any) => r.cidade).filter(Boolean))
            }
          }
          setCronCidades([...new Set(allCidades)].sort())
        }
      }
    }
    // Carregar segmentos distintos
    const { data: segData } = await supabaseAdmin.from('prospeccao').select('segmento').not('segmento', 'is', null).limit(10000)
    const segsUnicos = [...new Set((segData ?? []).map((r: any) => r.segmento).filter(Boolean))].sort()
    setCronSegmentos(segsUnicos)
    // Carregar stats por segmento para os filtros atuais
    carregarCronSegStats()
    // Stats de prospecção automática
    const hojeISO = new Date().toISOString().slice(0, 10)
    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
    const semanaISO = inicioSemana.toISOString().slice(0, 10)
    const [{ count: hojeCount }, { count: semanaCount }, { count: totalAuto }, { count: respondidos }, { data: ultimos }] = await Promise.all([
      supabaseAdmin.from('activity_log').select('*', { count: 'exact', head: true }).eq('tipo', 'whatsapp_auto').gte('created_at', hojeISO),
      supabaseAdmin.from('activity_log').select('*', { count: 'exact', head: true }).eq('tipo', 'whatsapp_auto').gte('created_at', semanaISO),
      supabaseAdmin.from('activity_log').select('*', { count: 'exact', head: true }).eq('tipo', 'whatsapp_auto'),
      supabaseAdmin.from('prospeccao').select('*', { count: 'exact', head: true }).eq('whatsapp_validado', true).not('status_contato', 'is', null).neq('status_contato', 'Aguardando'),
      supabaseAdmin.from('activity_log').select('prospect_id, created_at, detalhes, prospeccao(nome_fantasia, razao_social, segmento, uf)').eq('tipo', 'whatsapp_auto').order('created_at', { ascending: false }).limit(10),
    ])
    setWaAutoStats({
      hoje: hojeCount ?? 0,
      semana: semanaCount ?? 0,
      total: totalAuto ?? 0,
      respondidos: respondidos ?? 0,
      ultimos: ultimos ?? [],
    })

    // Buscar pendentes com telefone, limit 200
    const { data } = await supabaseAdmin
      .from('prospeccao')
      .select('id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,porte,telefone1,telefone2,email,status_contato,whatsapp,whatsapp_validado')
      .not('telefone1', 'is', null)
      .or('whatsapp_validado.is.null,whatsapp_validado.eq.false')
      .order('id', { ascending: false })
      .limit(200)
    setWaPendentes((data ?? []).map(d => ({ ...d, prospect_id: d.id, score_total: 0, score_demanda: 0, score_segmento: 0, score_porte: 0, score_distancia: 0 })) as any)
    setWaLoadingTab(false)
  }, [])

  useEffect(() => {
    if (aba === 'hotlist' && hotlist.length > 0) return // já tem dados, não recarregar
    if (aba === 'followups') { if (tabLoaded.current.followups) return; tabLoaded.current.followups = true; carregarFollowups() }
    if (aba === 'whatsapp') { if (tabLoaded.current.whatsapp) return; tabLoaded.current.whatsapp = true; carregarWaTab() }
    if (aba === 'materiais') { if (tabLoaded.current.materiais) return; tabLoaded.current.materiais = true; carregarMateriais() }
    if (aba === 'dashboard') { if (tabLoaded.current.dashboard) return; tabLoaded.current.dashboard = true; carregarDashboard() }
    if (aba === 'radar') { if (tabLoaded.current.radar) return; tabLoaded.current.radar = true; carregarGsc() }
    if (aba === 'emails') { if (tabLoaded.current.emails) return; tabLoaded.current.emails = true; carregarEmails() }
  }, [aba, carregarHotList, carregarFollowups, carregarMateriais, carregarDashboard, carregarGsc, carregarWaTab])

  // Carregar mesorregiões quando UF muda (sem recarregar hot list)
  useEffect(() => {
    setFiltroMeso([])
    setCidadesMeso([])
    setPagina(0)
    if (filtroUFs.length > 0) {
      supabaseAdmin.rpc('get_mesorregioes_ufs', { p_ufs: filtroUFs })
        .then(({ data }) => setMesorregioes((data ?? []).map((r: any) => r.mesorregiao).filter(Boolean)))
    } else {
      setMesorregioes([])
    }
  }, [filtroUFs])

  // Carregar cidades quando mesorregião muda (sem recarregar hot list)
  useEffect(() => {
    if (filtroMeso.length > 0 && filtroUFs.length > 0) {
      supabaseAdmin.rpc('get_cidades_meso', { p_ufs: filtroUFs, p_meso: filtroMeso })
        .then(({ data }) => setCidadesMeso((data ?? []).map((r: any) => r.cidade).filter(Boolean)))
    } else {
      setCidadesMeso([])
    }
    setFiltroCidades([])
    setPagina(0)
  }, [filtroMeso, filtroUFs])

  // Resetar página ao mudar filtros locais
  useEffect(() => { setPagina(0) }, [filtroSegmentos, filtroDemanda, filtroBusca, filtroSoWa, filtroCidades])

  // ── Ações ───────────────────────────────────────────────────────────────────

  async function marcarContactado(ps: ProspectScore) {
    const agora = new Date().toISOString()
    const followupDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

    await Promise.all([
      supabaseAdmin.from('activity_log').insert({
        prospect_id: ps.prospect_id, tipo: 'contacted', canal: 'whatsapp',
        detalhes: { score: ps.score_total }, created_by: 'admin',
      }),
      supabaseAdmin.from('followups').insert({
        prospect_id: ps.prospect_id, tipo: '3d', data_prevista: followupDate,
        status: 'pendente', created_by: 'admin',
      }),
      supabaseAdmin.from('prospeccao').update({
        ultimo_contato: agora, proximo_followup: followupDate,
      }).eq('id', ps.prospect_id),
    ])

    showMsg('ok', `Contactado! Follow-up agendado para ${fmtData(followupDate)}`)
    carregarHotList()
  }

  function limparNome(raw: string): string {
    // Remove CNPJ prefix (ex: "49.408.111 BRAZ FRANCISCO" → "BRAZ FRANCISCO")
    return raw.replace(/^[\d.\-\/]+\s*/, '').replace(/\s+/g, ' ').trim()
  }

  function calcularUrgencia(normas: any[]): 'critico' | 'alto' | 'tecnico' | 'diferencial' {
    if (normas.length === 0) return 'diferencial'
    const pens = normas.map(n => (n.penalidade || '').toLowerCase()).join(' ')
    if (/interdição|cancelamento|fecha|cassação|suspensão/.test(pens)) return 'critico'
    if (/multa|apreensão|recolhimento/.test(pens)) return 'alto'
    if (/certificação|acreditação|exportação/.test(pens)) return 'tecnico'
    return 'diferencial'
  }

  async function gerarMsgRegulatorioIA(prospect: ProspectScore, normas: any[], equipamentos: any[], portfolio: any[]): Promise<string> {
    const nomeClean = limparNome(prospect.nome_fantasia || prospect.razao_social || '')
    const nomeFmt = nomeClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const seg = prospect.segmento || 'seu segmento'

    // Montar contexto de produtos com material correto
    const produtosCtx = portfolio.map((sp: any) => {
      const p = sp.portfolio_produtos
      if (!p) return null
      const material = p.material || (p.norma_aplicavel?.includes('316') ? 'Aço Inox AISI 316' : p.norma_aplicavel?.includes('304') ? 'Aço Inox AISI 304' : 'Aço Inox AISI 430')
      const normaRef = p.norma_aplicavel || ''
      return `- ${p.nome}: ${material}${normaRef ? ` (${normaRef})` : ''}${p.descricao ? ` — ${p.descricao}` : ''}`
    }).filter(Boolean).join('\n')

    // Normas com links
    const normasCtx = normas.map((n: any) => {
      const link = `https://pousinox.com.br/segmentos/${seg.toLowerCase().replace(/\s+/g, '-')}`
      return `- ${n.norma} (${n.orgao}): ${n.titulo}${n.penalidade ? ` | Penalidade: ${n.penalidade}` : ''}\n  Link: ${link}`
    }).join('\n')

    // Equipamentos
    const equipCtx = equipamentos.map((e: any) => {
      return `- ${e.equipamento}${e.obrigatorio ? ' ✅ OBRIGATÓRIO' : ' ⭐ Recomendado'}`
    }).join('\n')

    const prompt = `Você é um especialista comercial da Pousinox, fabricante de produtos em aço inox desde 2001 em Pouso Alegre/MG.

Gere uma mensagem de WhatsApp profissional para o prospect "${nomeFmt}" do segmento "${seg}".

PRODUTOS POUSINOX PARA ESTE SEGMENTO:
${produtosCtx || 'Produtos sob medida em aço inox'}

NORMAS REGULATÓRIAS APLICÁVEIS:
${normasCtx || 'Normas gerais de segurança'}

EQUIPAMENTOS POR NORMA:
${equipCtx || 'Equipamentos em aço inox'}

REGRAS OBRIGATÓRIAS:
1. Liste TODOS os produtos disponíveis para o segmento, sem destacar um sobre outro
2. Na frente de cada produto, coloque a norma aplicável entre parênteses
3. Use o material CORRETO de cada produto (304, 430 ou 316) — NÃO assuma que todos são 304. O 430 é ideal para muitos casos
4. Marque ✅ Obrigatório ou ⭐ Recomendado conforme a norma
5. Inclua link do site após as normas: https://pousinox.com.br/segmentos/${seg.toLowerCase().replace(/\s+/g, '-')}
6. Tom: profissional mas acessível, sem ser invasivo
7. Formato WhatsApp: use *negrito*, _itálico_, emojis moderados
8. Máximo 400 palavras
9. NÃO invente dados, normas, certificações ou produtos que não estejam na lista acima
10. NÃO mencione catálogo (não temos ainda) — convide para orçamento sem compromisso ou visita técnica
11. Finalize com convite para orçamento sem compromisso ou visita técnica`

    try {
      const res = await aiChat([{ role: 'user', content: prompt }])
      return typeof res === 'string' ? res : (res as any).text || ''
    } catch {
      // Fallback template simples
      const obrig = equipamentos.filter((e: any) => e.obrigatorio).slice(0, 3)
      const listaEquip = obrig.length > 0 ? obrig.map((e: any) => e.equipamento.toLowerCase()).join(', ') : 'equipamentos em aço inox'
      return `Olá ${nomeFmt}! Tudo bem?\n\nA *Pousinox* fabrica ${listaEquip} sob medida para ${seg.toLowerCase()}, em conformidade com as normas regulatórias.\n\nAtendemos desde 2001, com fábrica própria em Pouso Alegre/MG.\n\nPosso fazer um orçamento sem compromisso? 😊`
    }
  }

  function gerarMsgWpp(nome: string, segmento?: string, cidade?: string): string {
    const seg = (segmento || '').toLowerCase()
    const nomeClean = limparNome(nome)
    const nomeFmt = nomeClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const cidadeLocal = (cidade || '').toLowerCase().includes('pouso alegre')
    const origem = cidadeLocal ? '' : ', em Pouso Alegre/MG'

    // Selecionar produtos por segmento
    let produtos = wppProdutos['generico'] || produtosDefault['generico']
    if (/açougue|frigoríf|carne/i.test(seg))
      produtos = wppProdutos['açougue/frigorífico'] || produtosDefault['açougue/frigorífico']
    else if (/restaurante|gastrono|gourmet|alimenta|bar\b|lanchonete/i.test(seg))
      produtos = wppProdutos['restaurante/bar'] || produtosDefault['restaurante/bar']
    else if (/padaria|panifica|confeitaria/i.test(seg))
      produtos = wppProdutos['padaria/confeitaria'] || produtosDefault['padaria/confeitaria']
    else if (/hospital|clínica|saúde|laborat|farmác/i.test(seg))
      produtos = wppProdutos['hospital/clínica'] || produtosDefault['hospital/clínica']
    else if (/hotel|hotelaria|pousada/i.test(seg))
      produtos = wppProdutos['hotel/pousada'] || produtosDefault['hotel/pousada']
    else if (/constru|engenh|arquit|revest|imobil/i.test(seg))
      produtos = wppProdutos['construção/engenharia'] || produtosDefault['construção/engenharia']
    else if (/supermercado|mercado|varejo/i.test(seg))
      produtos = wppProdutos['supermercado/varejo'] || produtosDefault['supermercado/varejo']

    return wppTemplate
      .replace(/\{nome\}/g, nomeFmt || '')
      .replace(/\{produtos\}/g, produtos)
      .replace(/\{origem\}/g, origem)
  }

  function abrirWhatsApp(tel: string | null, nome: string, segmento?: string | null, cidade?: string | null) {
    if (!tel) { showMsg('erro', 'Sem telefone cadastrado'); return }
    const num = tel.replace(/\D/g, '')
    const numFull = num.length <= 11 ? `55${num}` : num
    const msg = encodeURIComponent(gerarMsgWpp(nome, segmento ?? undefined, cidade ?? undefined))
    window.open(`https://wa.me/${numFull}?text=${msg}`, '_blank')
  }

  function enviarMaterial(tel: string | null, material: Material, prospectId?: number) {
    if (!tel) { showMsg('erro', 'Sem telefone cadastrado'); return }
    const num = tel.replace(/\D/g, '')
    const numFull = num.length <= 11 ? `55${num}` : num
    const msg = encodeURIComponent(`Olá! Segue ${material.titulo} da Pousinox: ${material.url}`)
    window.open(`https://wa.me/${numFull}?text=${msg}`, '_blank')

    // Registrar envio
    supabaseAdmin.from('activity_log').insert({
      prospect_id: prospectId ?? null, tipo: 'material_sent', canal: 'whatsapp',
      detalhes: { material_id: material.id, titulo: material.titulo },
      created_by: 'admin',
    })
    supabaseAdmin.from('materiais_comerciais').update({ envios: material.envios + 1 }).eq('id', material.id)
  }

  async function atualizarStatus(ps: ProspectScore, novoStatus: string) {
    await supabaseAdmin.from('prospeccao').update({ status_contato: novoStatus || null }).eq('id', ps.prospect_id)
    // Atualizar local
    setHotlist(prev => prev.map(h => h.prospect_id === ps.prospect_id ? { ...h, status_contato: novoStatus || null } : h))
    if (drawerPs?.prospect_id === ps.prospect_id) setDrawerPs({ ...ps, status_contato: novoStatus || null })
    setDrawerStatusOpen(false)
    showMsg('ok', `Status → ${novoStatus || 'Sem status'}`)
  }

  function toggleDrawerSecao(k: string) {
    setDrawerSecoes(prev => ({ ...prev, [k]: !prev[k] }))
  }

  async function abrirDrawer(ps: ProspectScore) {
    setDrawerPs(ps)
    setDrawerNfExpandida(null)
    setDrawerNfItens({})
    setFichaExpandida(null)

    const cnpjLimpo = ps.cnpj?.replace(/\D/g, '')

    // Loading states
    setDrawerNfsLoading(true)
    setDrawerPortfolioLoading(true)

    // Todas as queries em paralelo
    const [nfsRes, portfolioRes, normasRes, equipRes, concRes, dealsRes, orcRes, estRes, opRes, ativRes] = await Promise.all([
      // 1. NFs
      cnpjLimpo
        ? supabaseAdmin.from('nf_cabecalho').select('id,destinatario,emissao,total,cnpj').or(`cnpj.eq.${cnpjLimpo}`).order('emissao', { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      // 2. Portfólio
      ps.segmento
        ? supabaseAdmin.from('segmento_portfolio').select('id, relevancia, destaque, portfolio_produtos(id, nome, descricao, categoria, material, dimensoes, peso_kg, norma_aplicavel, laudo_url, laudo_descricao, ficha_tecnica, vantagens, aplicacoes)').eq('segmento', ps.segmento).order('relevancia', { ascending: false })
        : Promise.resolve({ data: [] }),
      // 3. Normas
      ps.segmento
        ? supabaseAdmin.from('portfolio_normas').select('id, norma, orgao, titulo, status, penalidade, observacao, segmentos').contains('segmentos', [ps.segmento])
        : Promise.resolve({ data: [] }),
      // 4. Equipamentos
      ps.segmento
        ? supabaseAdmin.from('segmento_equipamentos').select('*').eq('segmento', ps.segmento).order('obrigatorio', { ascending: false })
        : Promise.resolve({ data: [] }),
      // 5. Concorrentes
      supabaseAdmin.from('portfolio_concorrentes').select('*'),
      // 6. Deals
      supabaseAdmin.from('pipeline_deals').select('id, titulo, estagio, valor_estimado, created_at, updated_at').eq('prospect_id', ps.prospect_id).order('created_at', { ascending: false }),
      // 7. Orçamentos
      cnpjLimpo
        ? supabaseAdmin.from('orcamentos').select('id, numero, status, valor_total, created_at').or(`cliente_cnpj.eq.${cnpjLimpo},cliente_cnpj.eq.${ps.cnpj}`).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
      // 8. Estoque
      ps.segmento
        ? supabaseAdmin.from('estoque_itens').select('id, codigo, nome, saldo_atual, unidade, estoque_minimo').gt('saldo_atual', 0).eq('ativo', true).order('saldo_atual', { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      // 9. Produção
      supabaseAdmin.from('ordens_producao').select('id, numero, status, data_prevista, projetos(titulo)').in('status', ['planejada', 'liberada', 'em_producao']).order('data_prevista', { ascending: true }).limit(10),
      // 10. Atividades (histórico de contatos)
      supabaseAdmin.from('activity_log').select('id, tipo, canal, detalhes, created_at').eq('prospect_id', ps.prospect_id).order('created_at', { ascending: false }).limit(20),
    ])

    // Setar todos os estados de uma vez
    const nfs = nfsRes.data ?? []
    const portfolioData = portfolioRes.data ?? []
    const normas = normasRes.data ?? []
    const equip = equipRes.data ?? []

    setDrawerNfs(nfs)
    setDrawerNfsLoading(false)
    setDrawerPortfolio(portfolioData)
    setDrawerPortfolioLoading(false)
    setDrawerNormas(normas)
    setDrawerEquipamentos(equip)
    setDrawerConcorrentes(concRes.data ?? [])
    setDrawerDeals(dealsRes.data ?? [])
    setDrawerOrcamentos(orcRes.data ?? [])
    setDrawerEstoque(estRes.data ?? [])
    setDrawerProducao(opRes.data ?? [])
    setDrawerAtividades(ativRes.data ?? [])

    // Mensagem regulatória via IA (async, não bloqueia)
    if (ps.segmento) {
      setMsgRegulatoria('⏳ Gerando mensagem...')
      gerarMsgRegulatorioIA(ps, normas, equip, portfolioData).then(msg => setMsgRegulatoria(msg))
    } else {
      setMsgRegulatoria('')
    }

    // Resumo NFs
    if (drawerNfs && drawerNfs.length > 0) {
      // será calculado após setDrawerNfs
    }

    setPortfolioAddOpen(false)
    setIaAnalise('')
    setIaResumo('')
    setIaObjecao('')
    setIaConsultor('')
    setIaConsultorInput('')
    setIaComparativo('')
    setIaProposta('')
  }

  // Calcular resumo NFs quando mudam
  useEffect(() => {
    if (drawerNfs.length > 0) {
      const total = drawerNfs.reduce((s: number, n: any) => s + (n.total || 0), 0)
      const ultima = drawerNfs[0]?.emissao || null
      setDrawerNfResumo({ total, qtd: drawerNfs.length, ultima, media: total / drawerNfs.length })
    } else {
      setDrawerNfResumo(null)
    }
  }, [drawerNfs])

  // ── Agentes IA ──
  async function iaAnalisarProspect() {
    if (!drawerPs) return
    setIaLoadingTipo('analise')
    const ctx = `Prospect: ${drawerPs.nome_fantasia || drawerPs.razao_social}
CNPJ: ${drawerPs.cnpj || 'N/I'} | Segmento: ${drawerPs.segmento || 'N/I'} | Porte: ${drawerPs.porte || 'N/I'}
Cidade/UF: ${drawerPs.cidade}/${drawerPs.uf} | Score: ${Number(drawerPs.score_total).toFixed(1)}
Status: ${drawerPs.status_contato || 'Novo'} | Último contato: ${drawerPs.ultimo_contato || 'nunca'}
Deals: ${drawerDeals.length} | Orçamentos: ${drawerOrcamentos.length} | NFs: ${drawerNfs.length}
Total comprado: ${drawerNfResumo ? fmtBRL(drawerNfResumo.total) : 'R$ 0'}
Normas aplicáveis: ${drawerNormas.map((n: any) => n.norma).join(', ') || 'nenhuma'}
Equipamentos obrigatórios: ${drawerEquipamentos.filter((e: any) => e.obrigatorio).map((e: any) => e.equipamento).join(', ') || 'nenhum'}
Produtos em estoque: ${drawerEstoque.slice(0, 5).map((e: any) => `${e.nome} (${e.saldo_atual} ${e.unidade})`).join(', ') || 'nenhum'}`
    const system = 'Analista comercial B2B da Pousinox (aço inox). Analise o prospect e sugira a melhor estratégia de abordagem. Seja direto e prático. Máx 200 palavras. Português brasileiro.'
    try {
      const res = await aiChat(`Analise este prospect e sugira estratégia de abordagem:\n\n${ctx}`, system)
      setIaAnalise(res.content || 'Sem resultado')
    } catch { setIaAnalise('Erro ao gerar análise') }
    setIaLoadingTipo(null)
  }

  async function iaGerarResumoExecutivo() {
    if (!drawerPs) return
    setIaLoadingTipo('resumo')
    const produtos = drawerPortfolio.slice(0, 10).map((sp: any) => sp.portfolio_produtos?.nome).filter(Boolean).join(', ')
    const ctx = `Empresa: ${drawerPs.nome_fantasia || drawerPs.razao_social}
Segmento: ${drawerPs.segmento || 'N/I'} | Porte: ${drawerPs.porte || 'N/I'} | ${drawerPs.cidade}/${drawerPs.uf}
Histórico: ${drawerNfResumo ? `${drawerNfResumo.qtd} NFs, total ${fmtBRL(drawerNfResumo.total)}, última em ${fmtData(drawerNfResumo.ultima || '')}` : 'Sem histórico de compras'}
Deals: ${drawerDeals.map((d: any) => `${d.titulo} (${d.estagio})`).join(', ') || 'nenhum'}
Portfólio recomendado: ${produtos || 'não mapeado'}
Normas: ${drawerNormas.map((n: any) => `${n.norma} — ${n.penalidade || 'sem penalidade'}`).join('; ') || 'nenhuma'}
Equipamentos obrigatórios: ${drawerEquipamentos.filter((e: any) => e.obrigatorio).length} | Recomendados: ${drawerEquipamentos.filter((e: any) => !e.obrigatorio).length}
Produção ativa: ${drawerProducao.length} OPs`
    const system = 'Gere um briefing executivo comercial para reunião de vendas da Pousinox (aço inox). Estrutura: 1) Perfil da empresa, 2) Oportunidade, 3) Produtos prioritários, 4) Argumentos regulatórios, 5) Próximos passos. Máx 250 palavras. Português brasileiro.'
    try {
      const res = await aiChat(`Gere briefing executivo para este prospect:\n\n${ctx}`, system)
      setIaResumo(res.content || 'Sem resultado')
    } catch { setIaResumo('Erro ao gerar resumo') }
    setIaLoadingTipo(null)
  }

  async function iaResponderObjecao() {
    if (!drawerPs || !iaObjecaoInput.trim()) return
    setIaLoadingTipo('objecao')
    const ctx = `Prospect: ${drawerPs.nome_fantasia || drawerPs.razao_social} | Segmento: ${drawerPs.segmento || 'N/I'}
Normas aplicáveis: ${drawerNormas.map((n: any) => `${n.norma}: ${n.penalidade || ''}`).join('; ') || 'nenhuma'}
Portfólio: ${drawerPortfolio.slice(0, 5).map((sp: any) => sp.portfolio_produtos?.nome).filter(Boolean).join(', ')}`
    const system = 'Consultor de vendas B2B da Pousinox (fabricante de equipamentos em aço inox). Responda objeções comerciais com argumentos técnicos, regulatórios e de custo-benefício. Seja persuasivo mas honesto. Nunca invente dados ou certificações. Máx 150 palavras. Português brasileiro.'
    try {
      const res = await aiChat(`O prospect disse: "${iaObjecaoInput}"\n\nContexto:\n${ctx}\n\nComo responder esta objeção?`, system)
      setIaObjecao(res.content || 'Sem resultado')
    } catch { setIaObjecao('Erro ao gerar resposta') }
    setIaLoadingTipo(null)
  }

  async function iaConsultorTecnico() {
    if (!drawerPs || !iaConsultorInput.trim()) return
    setIaLoadingTipo('consultor')
    const produtos = drawerPortfolio.slice(0, 8).map((sp: any) => {
      const p = sp.portfolio_produtos
      return p ? `${p.nome} (${p.material || 'inox'})${p.laudo_url ? ' — com laudo técnico' : ''}` : ''
    }).filter(Boolean).join(', ')
    const normasCtx = drawerNormas.map((n: any) => `${n.norma}: ${n.titulo}. Penalidade: ${n.penalidade || 'N/A'}`).join('\n')
    const concCtx = drawerConcorrentes.map((c: any) => `${c.concorrente} (${c.produto_concorrente}): ${c.desvantagem_concorrente}`).join('\n')
    const ctx = `Empresa compradora: ${drawerPs.nome_fantasia || drawerPs.razao_social} | Segmento: ${drawerPs.segmento || 'N/I'}
Produtos Pousinox relevantes: ${produtos || 'diversos equipamentos em aço inox'}
Normas regulatórias:\n${normasCtx || 'Nenhuma específica'}
Concorrentes:\n${concCtx || 'N/I'}`
    const system = `Você é um consultor técnico da Pousinox que explica conceitos de engenharia e materiais para LEIGOS (síndicos, compradores, gestores que NÃO são engenheiros).

REGRAS:
- Use linguagem simples, sem jargão técnico
- Quando usar termo técnico, explique entre parênteses
- Use analogias do dia a dia
- Seja transparente: se algo tem limitação, diga
- NUNCA invente dados, certificações ou números
- Se mencionar laudos, deixe claro que são verificáveis
- Tom: educativo, paciente, confiável
- Máx 200 palavras
- Português brasileiro`
    try {
      const res = await aiChat(`Dúvida do cliente: "${iaConsultorInput}"\n\nContexto:\n${ctx}`, system)
      setIaConsultor(res.content || 'Sem resultado')
    } catch { setIaConsultor('Erro ao gerar resposta') }
    setIaLoadingTipo(null)
  }

  async function iaGerarComparativo() {
    if (!drawerPs) return
    setIaLoadingTipo('comparativo')
    const concCtx = drawerConcorrentes.length > 0
      ? drawerConcorrentes.map((c: any) => `Concorrente: ${c.concorrente}\nProduto: ${c.produto_concorrente}\nMaterial: ${c.material}\nMétodo: ${c.metodo}\nDesvantagem: ${c.desvantagem_concorrente}\nVantagem Pousinox: ${c.vantagem_pousinox}`).join('\n\n')
      : 'Sem dados específicos de concorrentes cadastrados'
    const produtos = drawerPortfolio.slice(0, 5).map((sp: any) => {
      const p = sp.portfolio_produtos
      return p ? `${p.nome}: ${p.material || 'inox 304'}, ${p.vantagens || ''}` : ''
    }).filter(Boolean).join('\n')
    const system = `Consultor técnico-comercial da Pousinox. Gere um comparativo técnico honesto entre Pousinox e concorrentes.

REGRAS:
- Tabela comparativa: Pousinox vs Concorrente (critérios: material, método, estética, durabilidade, laudos, preço)
- Seja honesto: se o concorrente tem vantagem em algo, reconheça
- Destaque diferenciais reais (insert interno, laudos SENAI/LAMAT, inox 304)
- Linguagem acessível para leigos
- NUNCA invente dados
- Máx 250 palavras
- Português brasileiro`
    try {
      const res = await aiChat(`Gere comparativo técnico para o segmento "${drawerPs.segmento || 'geral'}":\n\nDados concorrentes:\n${concCtx}\n\nProdutos Pousinox:\n${produtos}`, system)
      setIaComparativo(res.content || 'Sem resultado')
    } catch { setIaComparativo('Erro ao gerar comparativo') }
    setIaLoadingTipo(null)
  }

  async function iaGerarProposta() {
    if (!drawerPs) return
    setIaLoadingTipo('proposta')
    const produtos = drawerPortfolio.map((sp: any) => {
      const p = sp.portfolio_produtos
      if (!p) return ''
      let line = `- ${p.nome}`
      if (p.material) line += ` (${p.material})`
      if (p.dimensoes) line += ` — ${p.dimensoes}`
      if (p.laudo_url) line += ' ✅ Com laudo técnico'
      return line
    }).filter(Boolean).join('\n')
    const normasCtx = drawerNormas.map((n: any) => `- ${n.norma} (${n.orgao}): ${n.titulo}`).join('\n')
    const equipCtx = drawerEquipamentos.filter((e: any) => e.obrigatorio).map((e: any) => `- ${e.equipamento} (${e.material})`).join('\n')
    const ctx = `DADOS DO PROSPECT:
Nome: ${drawerPs.nome_fantasia || drawerPs.razao_social}
CNPJ: ${drawerPs.cnpj || 'N/I'}
Segmento: ${drawerPs.segmento || 'N/I'}
Cidade/UF: ${drawerPs.cidade}/${drawerPs.uf}
Contato: ${drawerPs.whatsapp || drawerPs.telefone1 || drawerPs.email || 'N/I'}
Histórico: ${drawerNfResumo ? `${drawerNfResumo.qtd} compras, total ${fmtBRL(drawerNfResumo.total)}` : 'Primeiro contato'}

PRODUTOS RECOMENDADOS:
${produtos || 'Equipamentos em aço inox sob medida'}

NORMAS REGULATÓRIAS APLICÁVEIS:
${normasCtx || 'Nenhuma específica'}

EQUIPAMENTOS OBRIGATÓRIOS EM INOX:
${equipCtx || 'Conforme segmento'}`
    const system = `Gere uma proposta comercial profissional da Pousinox para este prospect. Estrutura:

1. CABEÇALHO — "Pousinox — A Arte em Inox" + data + destinatário
2. APRESENTAÇÃO — breve (fabricante desde 2001, Pouso Alegre/MG)
3. PRODUTOS RECOMENDADOS — lista com material e especificações
4. ARGUMENTAÇÃO REGULATÓRIA — normas que exigem inox no segmento
5. DIFERENCIAIS — laudos técnicos SENAI/LAMAT, fabricação própria, personalização
6. CONDIÇÕES — "Valores sob consulta conforme especificação"
7. CONTATO — (35) 3423-8994 / contato@pousinox.com.br

Tom: profissional, consultivo. Português brasileiro. Máx 400 palavras.
NUNCA invente preços, prazos ou certificações que não foram fornecidos.`
    try {
      const res = await aiChat(`Gere proposta comercial:\n\n${ctx}`, system)
      setIaProposta(res.content || 'Sem resultado')
    } catch { setIaProposta('Erro ao gerar proposta') }
    setIaLoadingTipo(null)
  }

  async function removerPortfolioItem(mapId: number) {
    await supabaseAdmin.from('segmento_portfolio').delete().eq('id', mapId)
    setDrawerPortfolio(prev => prev.filter(p => p.id !== mapId))
    showMsg('ok', 'Produto removido do portfólio')
  }

  async function adicionarPortfolioProduto(segmento: string) {
    if (portfolioAddExistente) {
      // Vincular produto existente ao segmento
      const { error } = await supabaseAdmin.from('segmento_portfolio').insert({
        segmento, produto_id: portfolioAddExistente, relevancia: 5
      })
      if (error) { showMsg('erro', error.message.includes('unique') ? 'Já vinculado' : error.message); return }
    } else if (portfolioAddNome.trim()) {
      // Criar produto novo e vincular
      const { data: prod, error: pErr } = await supabaseAdmin
        .from('portfolio_produtos')
        .insert({ nome: portfolioAddNome.trim(), descricao: portfolioAddDesc.trim() || null, categoria: 'fabricacao' })
        .select('id')
        .single()
      if (pErr || !prod) { showMsg('erro', 'Erro ao criar produto'); return }
      await supabaseAdmin.from('segmento_portfolio').insert({
        segmento, produto_id: prod.id, relevancia: 5
      })
    } else { return }
    // Recarregar
    const { data } = await supabaseAdmin
      .from('segmento_portfolio')
      .select('id, relevancia, destaque, portfolio_produtos(id, nome, descricao, categoria)')
      .eq('segmento', segmento)
      .order('relevancia', { ascending: false })
    setDrawerPortfolio(data ?? [])
    setPortfolioAddNome('')
    setPortfolioAddDesc('')
    setPortfolioAddExistente(null)
    setPortfolioAddOpen(false)
    showMsg('ok', 'Produto adicionado ao portfólio')
  }

  async function abrirPortfolioAdd() {
    setPortfolioAddOpen(true)
    if (todosPortfolioProdutos.length === 0) {
      const { data } = await supabaseAdmin.from('portfolio_produtos').select('id, nome').eq('ativo', true).order('nome')
      setTodosPortfolioProdutos(data ?? [])
    }
  }

  async function expandirNf(nfId: number) {
    if (drawerNfExpandida === nfId) { setDrawerNfExpandida(null); return }
    setDrawerNfExpandida(nfId)
    if (!drawerNfItens[nfId]) {
      const { data } = await supabaseAdmin
        .from('nf_itens')
        .select('descricao,quantidade,valor_unitario')
        .eq('nf_cabecalho_id', nfId)
      setDrawerNfItens(prev => ({ ...prev, [nfId]: data ?? [] }))
    }
  }

  async function criarDealDoDrawer(ps: ProspectScore) {
    const { error } = await supabaseAdmin.from('pipeline_deals').insert({
      titulo: ps.nome_fantasia || ps.razao_social,
      prospect_id: ps.prospect_id,
      estagio: 'entrada',
      valor_estimado: 0,
    })
    if (error) { showMsg('erro', 'Erro ao criar deal'); return }
    showMsg('ok', 'Deal criado no Pipeline! Veja em /admin/pipeline')
  }

  async function marcarFollowupFeito(fup: Followup) {
    const proximoDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    await Promise.all([
      supabaseAdmin.from('followups').update({
        status: 'realizado', data_realizada: new Date().toISOString(),
      }).eq('id', fup.id),
      supabaseAdmin.from('activity_log').insert({
        prospect_id: fup.prospect_id, deal_id: fup.deal_id,
        tipo: 'follow_up', canal: 'whatsapp', created_by: 'admin',
      }),
      supabaseAdmin.from('followups').insert({
        prospect_id: fup.prospect_id, deal_id: fup.deal_id,
        tipo: '7d', data_prevista: proximoDate, status: 'pendente', created_by: 'admin',
      }),
      supabaseAdmin.from('prospeccao').update({
        ultimo_contato: new Date().toISOString(), proximo_followup: proximoDate,
      }).eq('id', fup.prospect_id),
    ])

    showMsg('ok', `Follow-up realizado! Próximo em ${fmtData(proximoDate)}`)
    carregarFollowups()
  }

  async function adiarFollowup(fup: Followup, dias: number) {
    const novaData = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
    await supabaseAdmin.from('followups').update({ data_prevista: novaData }).eq('id', fup.id)
    showMsg('ok', `Adiado para ${fmtData(novaData)}`)
    carregarFollowups()
  }

  async function salvarMaterial(e: React.FormEvent) {
    e.preventDefault()
    await supabaseAdmin.from('materiais_comerciais').insert({
      titulo: formMat.titulo, tipo: formMat.tipo, url: formMat.url,
      descricao: formMat.descricao || null,
    })
    setFormMat({ titulo: '', tipo: 'apresentacao', url: '', descricao: '' })
    setShowFormMat(false)
    showMsg('ok', 'Material cadastrado')
    carregarMateriais()
  }

  async function computarScores() {
    await carregarHotList()
    showMsg('ok', 'Hot list atualizada!')
  }

  // ── Filtros Hot List ──
  // Helpers de classificação GSC
  const ctrCor = (v: number) => v >= 0.10 ? '#059669' : v >= 0.05 ? '#16a34a' : v >= 0.03 ? '#65a30d' : v >= 0.01 ? '#d97706' : '#dc2626'
  const ctrLabel = (v: number) => v >= 0.10 ? '⭐ Excelente!' : v >= 0.05 ? 'Ótimo' : v >= 0.03 ? 'Bom' : v >= 0.01 ? 'Regular — melhorar títulos' : 'Ruim — revisar títulos e descrições'
  const posCor = (v: number) => v <= 3 ? '#059669' : v <= 5 ? '#16a34a' : v <= 10 ? '#65a30d' : v <= 20 ? '#d97706' : '#dc2626'
  const posLabel = (v: number) => v <= 3 ? '⭐ Topo — excelente!' : v <= 5 ? 'Ótimo — top 5' : v <= 10 ? 'Bom — 1ª página' : v <= 20 ? 'Regular — 2ª página' : 'Ruim — quase invisível'

  const UFS_DISPONIVEIS = ['MG','SP','RJ','ES','PR','SC','RS','GO','DF','BA','MT','MS','CE','PE','PA','AM','MA','RN','PB','PI','SE','AL','RO','AC','AP','TO','RR']
  // Segmentos extraídos dos dados reais carregados
  const segmentosReais = useMemo(() => {
    if (hotlist.length === 0) return []
    const raw = hotlist.map(h => (h.segmento ?? '').trim()).filter(Boolean)
    const limpos = raw.filter(s => !/[\uFFFD]/.test(s))
    const uniq = [...new Set(limpos.map(s => s.replace(/\s+/g, ' ')))]
    return uniq.sort()
  }, [hotlist])

  const hotlistFiltrada = hotlist.filter(h => {
    if (filtroSoWa && !h.whatsapp) return false
    if (filtroSegmentos.length > 0 && !filtroSegmentos.some(fs => (h.segmento ?? '').toLowerCase().includes(fs.toLowerCase()))) return false
    if (filtroCidades.length > 0 && !filtroCidades.some(c => c.toUpperCase() === (h.cidade ?? '').toUpperCase())) return false
    else if (filtroCidades.length === 0 && cidadesMeso.length > 0 && !cidadesMeso.some(c => c.toUpperCase() === (h.cidade ?? '').toUpperCase())) return false
    const dem = Number(h.score_demanda)
    if (filtroDemanda === 'alta' && dem < 7) return false
    if (filtroDemanda === 'media' && (dem < 3 || dem >= 7)) return false
    if (filtroDemanda === 'baixa' && dem >= 3) return false
    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase()
      const nome = (h.nome_fantasia || h.razao_social || '').toLowerCase()
      const cnpj = (h.cnpj || '').replace(/\D/g, '')
      const cidade = (h.cidade || '').toLowerCase()
      if (!nome.includes(busca) && !cnpj.includes(busca) && !cidade.includes(busca)) return false
    }
    return true
  })

  // ── Follow-ups separados ──
  const fupAtrasados = followups.filter(f => f.data_prevista < hoje)
  const fupHoje = followups.filter(f => f.data_prevista === hoje)
  const fupProximos = followups.filter(f => f.data_prevista > hoje)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

      {!drawerPs && <>
      {/* Abas */}
      <div className={styles.tabs}>
        {ABAS.map(a => (
          <button key={a.key} className={`${styles.tab} ${aba === a.key ? styles.tabAtivo : ''}`}
            onClick={() => setAba(a.key)}>
            <span className={styles.tabIcon}>{a.icon}</span> {a.label}
            {a.key === 'followups' && fupAtrasados.length > 0 && (
              <span className={styles.badgeAlerta}>{fupAtrasados.length}</span>
            )}
            {a.key === 'whatsapp' && waStats.pendentes > 0 && (
              <span className={styles.badgeAlerta}>{waStats.pendentes > 999 ? `${Math.round(waStats.pendentes / 1000)}K` : waStats.pendentes}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOT LIST */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'hotlist' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Prospectar Hoje</h2>
            <button className={styles.btnPrimary} onClick={computarScores} disabled={loadingHot}>
              {loadingHot ? 'Calculando...' : 'Atualizar Scores'}
            </button>
            <button className={styles.btnSecondary} disabled={validandoWa} onClick={async () => {
              const semWaTodos = hotlistFiltrada.filter(h => !h.whatsapp && h.telefone1)
              const celulares = semWaTodos.filter(h => { const n = (h.telefone1 ?? '').replace(/\D/g, ''); return n.length >= 10 && (n.length === 11 || (n.length === 10 && n[2] === '9') || (n.length >= 12 && n[4] === '9')) })
              const fila = celulares.length > 0 ? celulares : semWaTodos
              if (!fila.length) { showMsg('erro', 'Todos já têm WhatsApp ou sem telefone'); return }
              setValidandoWa(true)
              const BATCH = 50
              let totalValidos = 0
              setWaProg({ done: 0, total: fila.length, validos: 0 })
              for (let i = 0; i < fila.length; i += BATCH) {
                const lote = fila.slice(i, i + BATCH)
                try {
                  const { data, error } = await supabaseAdmin.functions.invoke('validar-whatsapp', {
                    body: { action: 'batch', phones: lote.map(h => ({ id: h.prospect_id, phone: h.telefone1 })) }
                  })
                  if (!error && data?.results) {
                    const validSet = new Set(data.results.filter((r: any) => r.exists).map((r: any) => r.id))
                    totalValidos += validSet.size
                    if (validSet.size > 0) {
                      setHotlist(prev => prev.map(h => validSet.has(h.prospect_id)
                        ? { ...h, whatsapp: h.telefone1, whatsapp_validado: true } : h))
                    }
                  }
                } catch {}
                setWaProg({ done: Math.min(i + BATCH, fila.length), total: fila.length, validos: totalValidos })
              }
              showMsg('ok', `✅ ${totalValidos} de ${fila.length} têm WhatsApp`)
              setValidandoWa(false)
            }}>
              {validandoWa ? `⏳ ${waProg.done}/${waProg.total} (${waProg.validos} ✓)` : '📱 Validar WhatsApp'}
            </button>
          </div>

          <div className={styles.filtros}>
            {/* UF */}
            <div className={styles.multiSelect}>
              <button className={styles.multiBtn} onClick={() => setShowUFDrop(!showUFDrop)}>
                {filtroUFs.length === 0 ? 'Todos os estados' : filtroUFs.join(', ')}
                <span className={styles.arrow}>▾</span>
              </button>
              {showUFDrop && (
                <>
                  <div className={styles.backdrop} onClick={() => setShowUFDrop(false)} />
                  <div className={styles.multiDrop}>
                    {filtroUFs.length > 0 && (
                      <button className={styles.multiOptClear} onClick={() => { setFiltroUFs([]); setShowUFDrop(false) }}>✕ Limpar</button>
                    )}
                    {UFS_DISPONIVEIS.map(uf => (
                      <label key={uf} className={styles.multiOpt}>
                        <input type="checkbox" checked={filtroUFs.includes(uf)}
                          onChange={() => setFiltroUFs(prev => prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf])} />
                        {uf}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Mesorregião — aparece só quando tem UF selecionada */}
            {mesorregioes.length > 0 && (
              <div className={styles.multiSelect}>
                <button className={styles.multiBtn} onClick={() => setShowMesoDrop(!showMesoDrop)}>
                  {filtroMeso.length === 0 ? 'Todas mesorregiões' : filtroMeso.length > 2 ? `${filtroMeso.length} mesorregiões` : filtroMeso.join(', ')}
                  <span className={styles.arrow}>▾</span>
                </button>
                {showMesoDrop && (
                  <>
                    <div className={styles.backdrop} onClick={() => { setShowMesoDrop(false); setBuscaMeso('') }} />
                    <div className={styles.multiDrop}>
                      <input className={styles.multiSearch} placeholder="Buscar mesorregiao..." value={buscaMeso} onChange={e => setBuscaMeso(e.target.value)} autoFocus />
                      {filtroMeso.length > 0 && (
                        <button className={styles.multiOptClear} onClick={() => { setFiltroMeso([]); setShowMesoDrop(false); setBuscaMeso('') }}>✕ Limpar</button>
                      )}
                      {mesorregioes.filter(m => !buscaMeso || m.toLowerCase().includes(buscaMeso.toLowerCase())).map(m => (
                        <label key={m} className={styles.multiOpt}>
                          <input type="checkbox" checked={filtroMeso.includes(m)}
                            onChange={() => setFiltroMeso(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} />
                          {m}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Cidade — aparece quando tem mesorregião com cidades */}
            {cidadesMeso.length > 0 && (
              <div className={styles.multiSelect}>
                <button className={styles.multiBtn} onClick={() => setShowCidadeDrop(!showCidadeDrop)}>
                  {filtroCidades.length === 0 ? 'Todas cidades' : filtroCidades.length > 2 ? `${filtroCidades.length} cidades` : filtroCidades.join(', ')}
                  <span className={styles.arrow}>▾</span>
                </button>
                {showCidadeDrop && (
                  <>
                    <div className={styles.backdrop} onClick={() => { setShowCidadeDrop(false); setBuscaCidade('') }} />
                    <div className={styles.multiDrop} style={{ maxHeight: 320 }}>
                      <input className={styles.multiSearch} placeholder="Buscar cidade..." value={buscaCidade} onChange={e => setBuscaCidade(e.target.value)} autoFocus />
                      {filtroCidades.length > 0 && (
                        <button className={styles.multiOptClear} onClick={() => { setFiltroCidades([]); setShowCidadeDrop(false); setBuscaCidade('') }}>✕ Limpar</button>
                      )}
                      {[...cidadesMeso].sort().filter(c => !buscaCidade || c.toLowerCase().includes(buscaCidade.toLowerCase())).map(c => (
                        <label key={c} className={styles.multiOpt}>
                          <input type="checkbox" checked={filtroCidades.includes(c)}
                            onChange={() => setFiltroCidades(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                          {c}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Segmento */}
            <div className={styles.multiSelect}>
              <button className={styles.multiBtn} onClick={() => setShowSegDrop(!showSegDrop)}>
                {filtroSegmentos.length === 0 ? 'Todos segmentos' : filtroSegmentos.length > 2 ? `${filtroSegmentos.length} segmentos` : filtroSegmentos.join(', ')}
                <span className={styles.arrow}>▾</span>
              </button>
              {showSegDrop && (
                <>
                  <div className={styles.backdrop} onClick={() => { setShowSegDrop(false); setBuscaSegmento('') }} />
                  <div className={styles.multiDrop}>
                    <input className={styles.multiSearch} placeholder="Buscar segmento..." value={buscaSegmento} onChange={e => setBuscaSegmento(e.target.value)} autoFocus />
                    {filtroSegmentos.length > 0 && (
                      <button className={styles.multiOptClear} onClick={() => { setFiltroSegmentos([]); setShowSegDrop(false); setBuscaSegmento('') }}>✕ Limpar</button>
                    )}
                    {segmentosReais.length === 0 ? (
                      <AdminLoading />
                    ) : segmentosReais.filter(s => !buscaSegmento || s.toLowerCase().includes(buscaSegmento.toLowerCase())).map(s => (
                      <label key={s} className={styles.multiOpt}>
                        <input type="checkbox" checked={filtroSegmentos.includes(s)}
                          onChange={() => setFiltroSegmentos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                        {s}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Demanda */}
            <select className={styles.input} value={filtroDemanda} onChange={e => setFiltroDemanda(e.target.value)}>
              <option value="">Demanda: Todas</option>
              <option value="alta">🟢 Alta (≥ 7)</option>
              <option value="media">🟡 Média (3–7)</option>
              <option value="baixa">🔴 Baixa (&lt; 3)</option>
            </select>
            <label className={styles.toggleWa}>
              <input type="checkbox" checked={filtroSoWa} onChange={e => setFiltroSoWa(e.target.checked)} />
              📱 Só com WhatsApp
            </label>
          </div>
          {/* Busca + Paginação */}
          <div className={styles.filtros}>
            <input className={styles.input} placeholder="Buscar empresa, CNPJ ou cidade..."
              value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
              style={{ flex: 1, minWidth: 200 }} />
            <span className={styles.countLabel}>
              {hotlistFiltrada.length} prospects
              {hotlistFiltrada.length !== hotlist.length && ` (de ${hotlist.length})`}
            </span>
          </div>
          {/* Paginação */}
          {hotlistFiltrada.length > POR_PAGINA && (
            <div className={styles.paginacao}>
              <button className={styles.btnSecondary} disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>← Anterior</button>
              <span className={styles.paginaInfo}>
                Página {pagina + 1} de {Math.ceil(hotlistFiltrada.length / POR_PAGINA)}
              </span>
              <button className={styles.btnSecondary} disabled={(pagina + 1) * POR_PAGINA >= hotlistFiltrada.length} onClick={() => setPagina(p => p + 1)}>Próxima →</button>
            </div>
          )}

          {loadingHot ? (
            <AdminLoading />
          ) : hotlistFiltrada.length === 0 ? (
            <p className={styles.vazio}>
              {hotlist.length === 0
                ? 'Clique em "Atualizar Scores" para gerar a hot list.'
                : `Nenhum prospect com os filtros selecionados (${hotlist.length} carregados, ${hotlistFiltrada.length} após filtro). Tente ajustar UF, segmento ou demanda.`}
            </p>
          ) : (
            <div className={styles.cardGrid}>
              {hotlistFiltrada.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((ps, idx) => {
                const nome = ps.nome_fantasia || ps.razao_social
                const rankGlobal = pagina * POR_PAGINA + idx + 1
                return (
                  <div key={ps.prospect_id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.rank}>#{rankGlobal}</span>
                      <span className={styles.scoreTotal}>{Number(ps.score_total)?.toFixed(1)}</span>
                    </div>
                    <h3 className={styles.cardNome} title={ps.razao_social}>{nome}</h3>
                    <div className={styles.cardMeta}>
                      {ps.status_contato && (() => {
                        const st = STATUS_OPTS.find(o => o.value === ps.status_contato)
                        return st ? <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span> : null
                      })()}
                      <span>{ps.cidade}/{ps.uf}</span>
                      {ps.segmento && <span className={styles.badge}>{ps.segmento}</span>}
                      {ps.porte && <span className={styles.badgePorte}>{ps.porte}</span>}
                    </div>
                    <div className={styles.scores}>
                      <div className={styles.scoreBar}>
                        <span>Demanda</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_demanda) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Segmento</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_segmento) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Porte</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_porte) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Proximidade</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_distancia) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                    </div>
                    {ps.whatsapp
                      ? <div className={styles.cardTel}>📱 {ps.whatsapp} {ps.whatsapp_validado && '✅'}</div>
                      : ps.telefone1 && <div className={styles.cardTel}>📞 {ps.telefone1}</div>
                    }
                    {ps.ultimo_contato && <div className={styles.cardUltimo}>Último contato: {fmtData(ps.ultimo_contato)}</div>}
                    <div className={styles.cardActions}>
                      <button className={styles.btnDetalhe} onClick={() => abrirDrawer(ps)} title="Ver detalhe">🔍</button>
                      <button className={styles.btnContactar} onClick={() => marcarContactado(ps)}>Contactei</button>
                      <button className={styles.btnWpp} onClick={() => abrirWhatsApp(ps.whatsapp || ps.telefone1, nome, ps.segmento || '', ps.cidade)}>{ps.whatsapp ? '📱 WhatsApp' : '📞 WhatsApp'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* WHATSAPP — Validação */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'whatsapp' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Validação WhatsApp</h2>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.whatsapp = false; carregarWaTab() }} title="Atualizar">🔄 Atualizar</button>
            <button className={styles.btnPrimary} disabled={validandoWa || waPendentes.length === 0} onClick={async () => {
              const celulares = waPendentes.filter(h => { const n = (h.telefone1 ?? '').replace(/\D/g, ''); return n.length >= 10 && (n.length === 11 || (n.length === 10 && n[2] === '9') || (n.length >= 12 && n[4] === '9')) })
              const fila = celulares.length > 0 ? celulares : waPendentes
              if (!fila.length) { showMsg('erro', 'Nenhum pendente'); return }
              setValidandoWa(true)
              const BATCH = 50
              let totalValidos = 0
              setWaProg({ done: 0, total: fila.length, validos: 0 })
              for (let i = 0; i < fila.length; i += BATCH) {
                const lote = fila.slice(i, i + BATCH)
                try {
                  const { data, error } = await supabaseAdmin.functions.invoke('validar-whatsapp', {
                    body: { action: 'batch', phones: lote.map(h => ({ id: h.prospect_id, phone: h.telefone1 })) }
                  })
                  if (!error && data?.results) {
                    const validSet = new Set(data.results.filter((r: any) => r.exists).map((r: any) => r.id))
                    totalValidos += validSet.size
                    if (validSet.size > 0) {
                      setWaPendentes(prev => prev.filter(p => !validSet.has(p.prospect_id)))
                    }
                  }
                } catch {}
                setWaProg({ done: Math.min(i + BATCH, fila.length), total: fila.length, validos: totalValidos })
              }
              setWaStats(prev => ({ ...prev, validados: prev.validados + totalValidos, pendentes: prev.pendentes - totalValidos }))
              showMsg('ok', `✅ ${totalValidos} de ${fila.length} têm WhatsApp`)
              setValidandoWa(false)
            }}>
              {validandoWa ? `⏳ ${waProg.done}/${waProg.total} (${waProg.validos} ✓)` : '📱 Validar Pendentes'}
            </button>
          </div>

          {/* Barra de progresso geral */}
          {waStats.total > 0 && (
            <div className={styles.waProgressWrap}>
              <div className={styles.waProgressCards}>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#16a34a' }}>{waStats.validados.toLocaleString('pt-BR')}</span>
                  <span className={styles.waCardLabel}>Validados</span>
                </div>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#dc2626' }}>{waStats.pendentes.toLocaleString('pt-BR')}</span>
                  <span className={styles.waCardLabel}>Pendentes</span>
                </div>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#1a3a5c' }}>{waStats.total.toLocaleString('pt-BR')}</span>
                  <span className={styles.waCardLabel}>Total c/ telefone</span>
                </div>
              </div>
              <div className={styles.waBarTrack}>
                <div className={styles.waBarFill} style={{ width: `${Math.max(((waStats.validados / waStats.total) * 100), 0.5)}%` }} />
              </div>
              <p className={styles.waBarLabel}>{((waStats.validados / waStats.total) * 100).toFixed(2)}% validados</p>
            </div>
          )}

          {/* Painel de acompanhamento */}
          <details className={styles.waSegmento} open>
            <summary className={styles.waSegmentoHeader}>
              <span>📊 Prospecção Automática</span>
              <span className={styles.waSegmentoBadge}>{waAutoStats.hoje} hoje</span>
            </summary>
            <div style={{ padding: '16px 20px' }}>
              <div className={styles.waProgressCards}>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#1a3a5c' }}>{waAutoStats.hoje}</span>
                  <span className={styles.waCardLabel}>Hoje</span>
                </div>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#2563eb' }}>{waAutoStats.semana}</span>
                  <span className={styles.waCardLabel}>Esta semana</span>
                </div>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#16a34a' }}>{waAutoStats.total}</span>
                  <span className={styles.waCardLabel}>Total enviados</span>
                </div>
                <div className={styles.waCard}>
                  <span className={styles.waCardNum} style={{ color: '#f59e0b' }}>{waAutoStats.respondidos}</span>
                  <span className={styles.waCardLabel}>Responderam</span>
                </div>
              </div>
              {waAutoStats.total > 0 && (
                <div className={styles.waBarTrack} style={{ marginTop: 12 }}>
                  <div className={styles.waBarFill} style={{ width: `${Math.round((waAutoStats.respondidos / waAutoStats.total) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                </div>
              )}
              {waAutoStats.total > 0 && (
                <p className={styles.waBarLabel}>{Math.round((waAutoStats.respondidos / waAutoStats.total) * 100)}% taxa de resposta</p>
              )}
              {waAutoStats.ultimos.length > 0 && (
                <details className={styles.waSegmento} style={{ marginTop: 16 }}>
                  <summary className={styles.waSegmentoHeader}>
                    <span>Últimos envios</span>
                    <span className={styles.waSegmentoBadge}>{waAutoStats.ultimos.length}</span>
                  </summary>
                  <div className={styles.tabelaWrap}>
                    <table className={styles.tabela}>
                      <thead><tr><th>Empresa</th><th>Segmento</th><th>UF</th><th>Quando</th></tr></thead>
                      <tbody>
                        {waAutoStats.ultimos.map((u: any, i: number) => {
                          const p = u.prospeccao
                          const dt = new Date(u.created_at)
                          const quando = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          return (
                            <tr key={i}>
                              <td>{p?.nome_fantasia || p?.razao_social || '—'}</td>
                              <td>{p?.segmento || u.detalhes?.segmento || '—'}</td>
                              <td>{p?.uf || '—'}</td>
                              <td>{quando}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </details>

          {/* Config do cron de prospecção */}
          <details className={styles.waSegmento}>
            <summary className={styles.waSegmentoHeader}>
              <span>⚙️ Prospecção Automática (cron)</span>
              <span className={styles.waSegmentoBadge}>
                {cronConfig.uf.length || cronConfig.mesorregiao.length || cronConfig.cidade.length || cronConfig.segmento.length
                  ? [cronConfig.uf.join(','), cronConfig.mesorregiao.join(','), cronConfig.cidade.join(','), cronConfig.segmento.join(',')].filter(Boolean).join(' · ')
                  : 'Todos'}
              </span>
            </summary>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                Roda seg-sex 8h-18h, 20 mensagens a cada 30min. Filtre por região para focar a prospecção.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>UF</span>
                  <SearchableSelect
                    multiple
                    value={cronConfig.uf}
                    onChange={async (ufs) => {
                      setCronConfig(p => ({ ...p, uf: ufs, mesorregiao: [], cidade: [] }))
                      setCronCidades([])
                      if (ufs.length > 0) {
                        const allMesos: string[] = []
                        for (const u of ufs) {
                          const { data } = await supabaseAdmin.rpc('fn_distinct_mesorregiao', { p_uf: u })
                          allMesos.push(...(data ?? []).map((r: any) => r.mesorregiao).filter(Boolean))
                        }
                        setCronMesos([...new Set(allMesos)].sort())
                      } else { setCronMesos([]) }
                    }}
                    options={['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(u => ({ value: u, label: u }))}
                    placeholder="Todos"
                    searchPlaceholder="Buscar UF..."
                    minWidth={100}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mesorregião</span>
                  <SearchableSelect
                    multiple
                    value={cronConfig.mesorregiao}
                    onChange={async (mesos) => {
                      setCronConfig(p => ({ ...p, mesorregiao: mesos, cidade: [] }))
                      if (mesos.length > 0 && cronConfig.uf.length > 0) {
                        const allCidades: string[] = []
                        for (const u of cronConfig.uf) {
                          for (const m of mesos) {
                            const { data } = await supabaseAdmin.rpc('fn_distinct_cidade', { p_uf: u, p_meso: m })
                            allCidades.push(...(data ?? []).map((r: any) => r.cidade).filter(Boolean))
                          }
                        }
                        setCronCidades([...new Set(allCidades)].sort())
                      } else { setCronCidades([]) }
                    }}
                    options={cronMesos.map(m => ({ value: m, label: m }))}
                    placeholder="Todas"
                    searchPlaceholder="Buscar mesorregião..."
                    minWidth={220}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Cidade</span>
                  <SearchableSelect
                    multiple
                    value={cronConfig.cidade}
                    onChange={(v) => setCronConfig(p => ({ ...p, cidade: v }))}
                    options={cronCidades.map(c => ({ value: c, label: c }))}
                    placeholder="Todas"
                    searchPlaceholder="Buscar cidade..."
                    minWidth={180}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Segmento</span>
                  <SearchableSelect
                    multiple
                    value={cronConfig.segmento}
                    onChange={(v) => setCronConfig(p => ({ ...p, segmento: v }))}
                    options={cronSegmentos.map(s => ({ value: s, label: s }))}
                    placeholder="Todos"
                    searchPlaceholder="Buscar segmento..."
                    minWidth={200}
                  />
                </div>
                <button className={styles.btnPrimary} disabled={cronSaving} onClick={async () => {
                  setCronSaving(true)
                  const valor = { uf: cronConfig.uf.length ? cronConfig.uf : null, mesorregiao: cronConfig.mesorregiao.length ? cronConfig.mesorregiao : null, cidade: cronConfig.cidade.length ? cronConfig.cidade : null, segmento: cronConfig.segmento.length ? cronConfig.segmento : null }
                  await supabaseAdmin.from('feature_flags').upsert({
                    flag: 'prospectar_whatsapp_config',
                    config: valor,
                    descricao: 'Config cron prospecção WhatsApp automática',
                    habilitado: true,
                  }, { onConflict: 'flag' })
                  setCronSaving(false)
                  showMsg('ok', '✅ Config salva — próximo cron usará esses filtros')
                }} style={{ height: 34 }}>
                  {cronSaving ? '⏳' : '💾 Salvar'}
                </button>
              </div>
              {/* Gráfico por segmento */}
              {cronSegLoading ? <AdminLoading /> : cronSegStats.length > 0 && (() => {
                const max = Math.max(...cronSegStats.map(s => s.total))
                const totalGeral = cronSegStats.reduce((a, b) => a + b.total, 0)
                const validadosGeral = cronSegStats.reduce((a, b) => a + b.validados, 0)
                const pctGeral = totalGeral > 0 ? ((validadosGeral / totalGeral) * 100).toFixed(1) : '0'
                return (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a3a5c' }}>
                        Prospects por segmento {cronConfig.cidade.length ? `em ${cronConfig.cidade.join(', ')}` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem' }}>
                        <span style={{ color: '#1a3a5c', fontWeight: 600 }}>{totalGeral.toLocaleString('pt-BR')} total</span>
                        <span style={{ color: '#0ea5e9', fontWeight: 600 }}>{validadosGeral.toLocaleString('pt-BR')} WA ({pctGeral}%)</span>
                        <button className={styles.btnSecondary} onClick={carregarCronSegStats} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>🔄</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {cronSegStats.slice(0, 20).map(s => {
                        const pct = s.total > 0 ? ((s.validados / s.total) * 100).toFixed(1) : '0'
                        return (
                          <div key={s.segmento} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.75rem', color: '#334155', width: 200, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.segmento}>
                              {s.segmento}
                            </span>
                            <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ width: `${(s.total / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #e2e8f0, #cbd5e1)', borderRadius: 6, position: 'absolute' }} />
                              <div style={{ width: `${(s.validados / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #0ea5e9)', borderRadius: 6, position: 'absolute' }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700, width: 42, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                            <span style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0 }}>{s.total.toLocaleString('pt-BR')}</span>
                            <span style={{ fontSize: '0.72rem', color: '#0ea5e9', fontWeight: 600, width: 55, textAlign: 'right', flexShrink: 0 }}>{s.validados} WA</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.72rem', color: '#64748b' }}>
                      <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(90deg, #0284c7, #0ea5e9)', marginRight: 5, verticalAlign: 'middle' }} />WhatsApp validado</span>
                      <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(90deg, #e2e8f0, #cbd5e1)', marginRight: 5, verticalAlign: 'middle' }} />Total com telefone</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </details>

          {waLoadingTab ? <AdminLoading /> : (() => {
            const porSegmento = new Map<string, ProspectScore[]>()
            waPendentes.forEach(p => {
              const seg = p.segmento || 'Sem segmento'
              if (!porSegmento.has(seg)) porSegmento.set(seg, [])
              porSegmento.get(seg)!.push(p)
            })
            const segmentos = Array.from(porSegmento.entries()).sort((a, b) => b[1].length - a[1].length)
            return segmentos.length === 0
              ? <p style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Todos validados!</p>
              : segmentos.map(([seg, lista]) => (
                <details key={seg} className={styles.waSegmento}>
                  <summary className={styles.waSegmentoHeader}>
                    <span>{seg}</span>
                    <span className={styles.waSegmentoBadge}>{lista.length}</span>
                  </summary>
                  <div className={styles.tabelaWrap}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th>UF</th>
                          <th>Telefone</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(p => (
                          <tr key={p.prospect_id}>
                            <td>{p.nome_fantasia || p.razao_social}</td>
                            <td>{p.uf}</td>
                            <td>{p.telefone1}</td>
                            <td>
                              <button className={styles.btnSm} onClick={async () => {
                                try {
                                  const { data, error } = await supabaseAdmin.functions.invoke('validar-whatsapp', {
                                    body: { action: 'check', phone: p.telefone1, prospect_id: p.prospect_id }
                                  })
                                  if (error) throw error
                                  if (data?.exists) {
                                    showMsg('ok', `✅ ${p.nome_fantasia || p.razao_social} tem WhatsApp`)
                                    setWaPendentes(prev => prev.filter(x => x.prospect_id !== p.prospect_id))
                                    setWaStats(prev => ({ ...prev, validados: prev.validados + 1, pendentes: prev.pendentes - 1 }))
                                  } else {
                                    showMsg('erro', `❌ ${p.telefone1} não tem WhatsApp`)
                                  }
                                } catch (e: any) { showMsg('erro', e.message) }
                              }}>✓ Validar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOLLOW-UPS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'followups' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Follow-ups</h2>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.followups = false; carregarFollowups() }} disabled={loadingFup}>Atualizar</button>
          </div>

          {loadingFup ? (
            <AdminLoading />
          ) : followups.length === 0 ? (
            <p className={styles.vazio}>Nenhum follow-up pendente. Comece contactando prospects na Hot List!</p>
          ) : (
            <div className={styles.kanban}>
              {/* Atrasados */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#dc2626' }}>
                  Atrasados ({fupAtrasados.length})
                </h3>
                {fupAtrasados.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social, f.prospeccao?.segmento, f.prospeccao?.cidade)}
                    corBorda="#fca5a5"
                  />
                ))}
              </div>
              {/* Hoje */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#d97706' }}>
                  Hoje ({fupHoje.length})
                </h3>
                {fupHoje.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social, f.prospeccao?.segmento, f.prospeccao?.cidade)}
                    corBorda="#fde68a"
                  />
                ))}
              </div>
              {/* Próximos */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#16a34a' }}>
                  Próximos 7d ({fupProximos.length})
                </h3>
                {fupProximos.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social, f.prospeccao?.segmento, f.prospeccao?.cidade)}
                    corBorda="#bbf7d0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MATERIAIS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'materiais' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Materiais de Venda</h2>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.materiais = false; carregarMateriais() }} title="Atualizar">🔄 Atualizar</button>
            <button className={styles.btnPrimary} onClick={() => setShowFormMat(!showFormMat)}>
              {showFormMat ? 'Cancelar' : '+ Novo Material'}
            </button>
          </div>

          {showFormMat && (
            <form className={styles.formMat} onSubmit={salvarMaterial}>
              <div className={styles.filtros}>
                <input className={styles.input} placeholder="Título *" required
                  value={formMat.titulo} onChange={e => setFormMat(f => ({ ...f, titulo: e.target.value }))} />
                <select className={styles.input} value={formMat.tipo}
                  onChange={e => setFormMat(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="apresentacao">Apresentação</option>
                  <option value="ficha_tecnica">Ficha Técnica</option>
                  <option value="laudo">Laudo</option>
                  <option value="cartao">Cartão Digital</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <input className={styles.input} placeholder="URL do material *" required
                value={formMat.url} onChange={e => setFormMat(f => ({ ...f, url: e.target.value }))} />
              <input className={styles.input} placeholder="Descrição (opcional)"
                value={formMat.descricao} onChange={e => setFormMat(f => ({ ...f, descricao: e.target.value }))} />
              <button type="submit" className={styles.btnPrimary}>Salvar</button>
            </form>
          )}

          {/* ── Template WhatsApp ── */}
          <div className={styles.templateSection}>
            <div className={styles.templateHeader} onClick={() => setShowTemplateEditor(!showTemplateEditor)}>
              <h3>{showTemplateEditor ? '▾' : '▸'} Template Mensagem WhatsApp</h3>
              <span className={styles.countLabel}>Editável</span>
            </div>
            {showTemplateEditor && (
              <div className={styles.templateBody}>
                <p className={styles.templateHint}>
                  Variáveis disponíveis: <code>{'{nome}'}</code> (nome do prospect), <code>{'{produtos}'}</code> (lista por segmento), <code>{'{origem}'}</code> (", em Pouso Alegre/MG" — omitido se prospect local)
                </p>
                <textarea
                  className={styles.templateTextarea}
                  rows={10}
                  value={wppTemplate}
                  onChange={e => setWppTemplate(e.target.value)}
                />
                <div className={styles.templateActions}>
                  <button className={styles.btnPrimary} onClick={() => {
                    localStorage.setItem(TEMPLATE_KEY, wppTemplate)
                    showMsg('ok', 'Template salvo')
                  }}>Salvar template</button>
                  <button className={styles.btnSecondary} onClick={() => {
                    setWppTemplate(templateDefault)
                    localStorage.removeItem(TEMPLATE_KEY)
                    showMsg('ok', 'Template restaurado ao padrão')
                  }}>Restaurar padrão</button>
                </div>

                <h4 style={{ marginTop: 16 }}>Produtos por segmento</h4>
                <div className={styles.filtros}>
                  <select className={styles.input} value={editSegmento} onChange={e => setEditSegmento(e.target.value)}>
                    {Object.keys(wppProdutos).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <textarea
                  className={styles.templateTextarea}
                  rows={3}
                  value={wppProdutos[editSegmento] || ''}
                  onChange={e => setWppProdutos(p => ({ ...p, [editSegmento]: e.target.value }))}
                />
                <div className={styles.templateActions}>
                  <button className={styles.btnPrimary} onClick={() => {
                    localStorage.setItem(PRODUTOS_KEY, JSON.stringify(wppProdutos))
                    showMsg('ok', 'Produtos por segmento salvos')
                  }}>Salvar produtos</button>
                  <button className={styles.btnSecondary} onClick={() => {
                    setWppProdutos(produtosDefault)
                    localStorage.removeItem(PRODUTOS_KEY)
                    showMsg('ok', 'Produtos restaurados ao padrão')
                  }}>Restaurar padrão</button>
                </div>
              </div>
            )}
          </div>

          {loadingMat ? (
            <AdminLoading />
          ) : materiais.length === 0 ? (
            <p className={styles.vazio}>Nenhum material cadastrado. Adicione apresentações, fichas técnicas e laudos.</p>
          ) : (
            <div className={styles.matGrid}>
              {materiais.map(m => (
                <div key={m.id} className={styles.matCard}>
                  <div className={styles.matTop}>
                    <span className={styles.matTipo}>
                      {m.tipo === 'apresentacao' ? '📊' : m.tipo === 'ficha_tecnica' ? '📋' : m.tipo === 'laudo' ? '🔬' : m.tipo === 'cartao' ? '💳' : '📎'}
                    </span>
                    <span className={styles.matEnvios}>{m.envios} envios</span>
                  </div>
                  <h3>{m.titulo}</h3>
                  {m.descricao && <p className={styles.matDesc}>{m.descricao}</p>}
                  <div className={styles.matActions}>
                    <a href={m.url} target="_blank" rel="noreferrer" className={styles.btnSecondary}>Abrir</a>
                    <button className={styles.btnWpp}
                      onClick={() => {
                        const tel = prompt('Telefone do prospect (DDD+número):')
                        if (tel) enviarMaterial(tel, m)
                      }}>
                      Enviar WPP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* E-MAILS */}
      {aba === 'emails' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a3a5c' }}>📧 E-mails Enviados</h3>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.emails = false; carregarEmails() }} title="Atualizar">🔄 Atualizar</button>
          </div>
          {emailsLoading ? (
            <div className={styles.loadingBox}>Carregando...</div>
          ) : emailsLog.length === 0 ? (
            <div className={styles.emptyState}>Nenhum e-mail enviado ainda. Use o botão "📧 Enviar E-mail" no detalhe do prospect.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {emailsLog.map((e: any) => {
                const p = e.prospeccao
                const nome = p?.nome_fantasia || p?.razao_social || '—'
                let parsed: { assunto?: string; corpo?: string; destinatario?: string } | null = null
                try { parsed = typeof e.detalhes === 'string' && e.detalhes.startsWith('{') ? JSON.parse(e.detalhes) : null } catch { /* old format */ }
                const assunto = parsed?.assunto || e.detalhes || '—'
                const isExpanded = emailExpandido === e.id
                return (
                  <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = '#93c5fd')}
                    onMouseLeave={ev => (ev.currentTarget.style.borderColor = '#e5e7eb')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                      onClick={() => setEmailExpandido(isExpanded ? null : e.id)}
                    >
                      <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{isExpanded ? '▼' : '▶'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1a3a5c', fontSize: '0.9rem', marginBottom: 2 }}>{nome}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{p?.email || parsed?.destinatario || '—'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: 2 }}>{typeof assunto === 'string' ? assunto.replace('E-mail enviado: ', '') : '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {p?.segmento && <div style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, marginBottom: 4, display: 'inline-block' }}>{p.segmento}</div>}
                        {p?.uf && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.cidade}/{p.uf}</div>}
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{fmtData(e.created_at)}</div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', background: '#fafbfc' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <button className={styles.btnSmall} style={{ background: '#2563eb', color: '#fff', border: 'none' }}
                            onClick={() => { const ps = hotlist.find(h => h.prospect_id === e.prospect_id); if (ps) abrirDrawer(ps); else showMsg('erro', 'Prospect não está na Hot List atual') }}>
                            Ver Prospect
                          </button>
                        </div>
                        {parsed?.corpo ? (
                          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}
                            dangerouslySetInnerHTML={{ __html: parsed.corpo }}
                          />
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>Conteúdo não disponível (e-mail enviado antes da atualização)</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DASHBOARD */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dashboard' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Dashboard Comercial</h2>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.dashboard = false; carregarDashboard() }} title="Atualizar">🔄 Atualizar</button>
            <span className={styles.countLabel}>Últimos 7 dias</span>
          </div>

          {loadingDash ? (
            <AdminLoading />
          ) : dash ? (
            <>
              <div className={styles.kpiGrid}>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Prospects contactados</span>
                  <strong className={styles.kpiVal}>{dash.contactados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Materiais enviados</span>
                  <strong className={styles.kpiVal}>{dash.materiaisEnviados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Follow-ups atrasados</span>
                  <strong className={styles.kpiVal} style={{ color: dash.followupsAtrasados > 0 ? '#dc2626' : undefined }}>{dash.followupsAtrasados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Follow-ups hoje</span>
                  <strong className={styles.kpiVal} style={{ color: dash.followupsHoje > 0 ? '#d97706' : undefined }}>{dash.followupsHoje}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Deals abertos</span>
                  <strong className={styles.kpiVal}>{dash.dealsAbertos}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Deals ganhos</span>
                  <strong className={styles.kpiVal} style={{ color: '#16a34a' }}>{dash.dealsGanhos}</strong>
                </div>
              </div>

              {/* Funil */}
              <div className={styles.funnel}>
                <h3>Funil Comercial</h3>
                <div className={styles.funnelBars}>
                  {[
                    { label: 'Prospects (scored)', val: funnelData.total, color: '#6366f1' },
                    { label: 'Contactados', val: funnelData.contactados, color: '#0ea5e9' },
                    { label: 'Deals abertos', val: funnelData.deals, color: '#f59e0b' },
                    { label: 'Propostas', val: funnelData.propostas, color: '#f97316' },
                    { label: 'Ganhos', val: funnelData.ganhos, color: '#16a34a' },
                  ].map((step, i) => {
                    const maxVal = Math.max(funnelData.total, 1)
                    const pct = Math.max((step.val / maxVal) * 100, 4)
                    return (
                      <div key={i} className={styles.funnelStep}>
                        <span className={styles.funnelLabel}>{step.label}</span>
                        <div className={styles.funnelBar}>
                          <div style={{ width: `${pct}%`, background: step.color }} className={styles.funnelFill}>
                            <span>{step.val}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={styles.kpi} style={{ marginTop: 16 }}>
                <span className={styles.kpiLabel}>Receita pipeline (ganhos)</span>
                <strong className={styles.kpiVal} style={{ color: '#16a34a', fontSize: '1.8rem' }}>{fmt(dash.receitaPipeline)}</strong>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* RADAR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'radar' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Radar de Demanda — Google Search Console</h2>
            <button className={styles.btnSecondary} onClick={() => { tabLoaded.current.radar = false; carregarGsc() }} title="Atualizar">🔄 Atualizar</button>
            <div className={styles.filtros}>
              <select className={styles.input} value={gscDias} onChange={e => setGscDias(Number(e.target.value))}>
                <option value={7}>Últimos 7 dias</option>
                <option value={14}>Últimos 14 dias</option>
                <option value={28}>Últimos 28 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={180}>Últimos 6 meses</option>
              </select>
              <button className={styles.btnPrimary} onClick={atualizarGsc} disabled={gscFetching}>
                {gscFetching ? 'Buscando...' : '🔄 Atualizar'}
              </button>
            </div>
          </div>

          {loadingGsc ? (
            <p className={styles.vazio}>Carregando dados do GSC...</p>
          ) : !gscData || gscData.totalQueries === 0 ? (
            <div className={styles.radarPlaceholder}>
              <p>Nenhum dado no cache. Clique em "Atualizar" para buscar do Google Search Console.</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 8 }}>
                O GSC mostra o que as pessoas pesquisam no Google e como seu site aparece nos resultados.
              </p>
            </div>
          ) : (
            <>
              {/* ── Guia de Leitura (colapsável) ── */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleSecao('dicas')}>
                  <span>{gscSecoes.dicas ? '▼' : '▶'}</span>
                  <span>📖 Como interpretar esses dados?</span>
                </button>
                {gscSecoes.dicas && (
                  <div className={styles.dicasGrid}>
                    <div className={styles.dicaCard}>
                      <h4>Impressões</h4>
                      <p>Quantas vezes seu site <strong>apareceu</strong> nos resultados do Google. Quanto maior, mais pessoas estão vendo a Pousinox nas buscas.</p>
                      <span className={styles.dicaBom}>Bom: crescendo mês a mês</span>
                    </div>
                    <div className={styles.dicaCard}>
                      <h4>Cliques</h4>
                      <p>Quantas pessoas <strong>clicaram</strong> no seu site. É o tráfego real que o Google envia para você.</p>
                      <span className={styles.dicaBom}>Bom: quanto mais, melhor</span>
                    </div>
                    <div className={styles.dicaCard}>
                      <h4>CTR (Taxa de Cliques)</h4>
                      <p>Porcentagem de quem viu e clicou. Se 100 viram e 5 clicaram = 5% CTR.</p>
                      <span className={styles.dicaBom}>Bom: acima de 3%</span>
                      <span className={styles.dicaRuim}>Atenção: abaixo de 1% — título/descrição fracos</span>
                    </div>
                    <div className={styles.dicaCard}>
                      <h4>Posição Média</h4>
                      <p>Em que lugar seu site aparece nos resultados. Posição 1 = primeiro resultado.</p>
                      <span className={styles.dicaBom}>Bom: 1 a 10 (primeira página)</span>
                      <span className={styles.dicaRuim}>Atenção: acima de 20 — quase invisível</span>
                    </div>
                    <div className={styles.dicaCard}>
                      <h4>O que fazer com isso?</h4>
                      <p><strong>Impressões altas + cliques baixos</strong> = as pessoas veem mas não clicam → melhorar títulos e descrições do site.</p>
                      <p><strong>Posição 10–20</strong> = quase na 1ª página → criar conteúdo sobre essa palavra-chave pode subir o ranking.</p>
                      <p><strong>Query com muitas impressões</strong> = demanda real → pode virar campanha, conteúdo ou segmentação de prospecção.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── KPIs (colapsável) ── */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleSecao('kpis')}>
                  <span>{gscSecoes.kpis ? '▼' : '▶'}</span>
                  <span>📊 Resumo Geral</span>
                </button>
                {gscSecoes.kpis && (
                  <div className={styles.kpiGrid}>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>Queries</span>
                      <span className={styles.kpiVal}>{gscData.totalQueries}</span>
                      <span className={styles.kpiDica}>Termos diferentes que encontraram você</span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>Cliques</span>
                      <span className={styles.kpiVal}>{gscData.totalClicks.toLocaleString('pt-BR')}</span>
                      <span className={styles.kpiDica}>Visitantes vindos do Google</span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>Impressões</span>
                      <span className={styles.kpiVal}>{gscData.totalImpressions.toLocaleString('pt-BR')}</span>
                      <span className={styles.kpiDica}>Vezes que apareceu no Google</span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>CTR Médio</span>
                      <span className={styles.kpiVal} style={{ color: ctrCor(gscData.avgCtr) }}>
                        {(gscData.avgCtr * 100).toFixed(1)}%
                      </span>
                      <span className={styles.kpiDica}>{ctrLabel(gscData.avgCtr)}</span>
                      <span className={styles.kpiMeta}>Meta: &gt; 10%</span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>Posição Média</span>
                      <span className={styles.kpiVal} style={{ color: posCor(gscData.avgPosition) }}>
                        {gscData.avgPosition}
                      </span>
                      <span className={styles.kpiDica}>{posLabel(gscData.avgPosition)}</span>
                      <span className={styles.kpiMeta}>Meta: 1 a 3 (topo)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Top Queries (colapsável + ordenável) ── */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleSecao('queries')}>
                  <span>{gscSecoes.queries ? '▼' : '▶'}</span>
                  <span>🔍 Queries — O que as pessoas pesquisam ({gscData.topQueries.length})</span>
                </button>
                {gscSecoes.queries && (
                  <div className={styles.radarTabela}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          {[
                            { col: 'query', label: 'Query' },
                            { col: 'clicks', label: 'Cliques' },
                            { col: 'impressions', label: 'Impressões' },
                            { col: 'ctr', label: 'CTR' },
                            { col: 'position', label: 'Posição' },
                          ].map(h => (
                            <th key={h.col} onClick={() => sortGsc(h.col)} className={styles.thSort}>
                              {h.label} {gscSort.col === h.col ? (gscSort.asc ? '▲' : '▼') : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...gscData.topQueries]
                          .sort((a, b) => {
                            const va = a[gscSort.col], vb = b[gscSort.col]
                            if (typeof va === 'string') return gscSort.asc ? va.localeCompare(vb) : vb.localeCompare(va)
                            return gscSort.asc ? va - vb : vb - va
                          })
                          .map((q: any, i: number) => (
                          <tr key={i}>
                            <td className={styles.queryCell}>{q.query}</td>
                            <td>{q.clicks}</td>
                            <td>{q.impressions.toLocaleString('pt-BR')}</td>
                            <td style={{ color: ctrCor(q.ctr), fontWeight: 600 }}>
                              {(q.ctr * 100).toFixed(1)}%
                            </td>
                            <td style={{ color: posCor(q.position), fontWeight: 600 }}>
                              {q.position.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* ── Auditoria SEO (colapsável) ── */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleSecao('audit')}>
                  <span>{gscSecoes.audit ? '▼' : '▶'}</span>
                  <span>🤖 Auditoria SEO — Gargalos e Oportunidades</span>
                </button>
                {gscSecoes.audit && <AuditoriaSEO queries={gscData.topQueries} marketKws={marketKws} />}
              </div>
            </>
          )}

          {/* ── Futuras integrações (colapsável) ── */}
          <div className={styles.secaoColapsavel}>
            <button className={styles.secaoToggle} onClick={() => toggleSecao('futuras')}>
              <span>{gscSecoes.futuras ? '▼' : '▶'}</span>
              <span>🔮 Próximas integrações</span>
            </button>
            {gscSecoes.futuras && (
              <div className={styles.radarCards}>
                <div className={styles.radarCard}>
                  <h4>Mercado Livre</h4>
                  <p>Perguntas nos anúncios em tempo real — intenção de compra</p>
                  <span className={styles.badgePendente}>Fase futura</span>
                </div>
                <div className={styles.radarCard}>
                  <h4>Google Trends</h4>
                  <p>Tendências de interesse por estado — mercados emergentes</p>
                  <span className={styles.badgePendente}>Fase futura</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>}
      {/* ── Detalhe Prospect (página inteira) ── */}
      {drawerPs && (
        <>
          <div className={styles.prospectPage}>
            <div className={styles.prospectPageHead}>
              <button className={styles.prospectPageVoltar} onClick={() => setDrawerPs(null)}>← Voltar</button>
              <h2>{drawerPs.nome_fantasia || drawerPs.razao_social}</h2>
            </div>
            <div className={styles.prospectPageBody}>
              {/* Info básica + Status + Score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderRadius: 12, border: '1px solid #e4e8ee', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                {/* Status */}
                <div ref={statusRef} style={{ position: 'relative' }}>
                  {(() => {
                    const atual = STATUS_OPTS.find(o => o.value === (drawerPs.status_contato ?? '')) ?? STATUS_OPTS[0]
                    return (
                      <>
                        <button className={styles.statusBadge} style={{ background: atual.bg, color: atual.color, fontSize: '0.82rem', padding: '6px 14px' }}
                          onClick={() => setDrawerStatusOpen(!drawerStatusOpen)}>
                          {atual.label} ▾
                        </button>
                        {drawerStatusOpen && (
                          <>
                            <div className={styles.backdrop} onClick={() => setDrawerStatusOpen(false)} />
                            <div className={styles.statusDrop}>
                              {STATUS_OPTS.map(o => (
                                <button key={o.value} className={styles.statusOpt}
                                  style={{ background: o.value === (drawerPs.status_contato ?? '') ? o.bg : undefined }}
                                  onClick={() => atualizarStatus(drawerPs, o.value)}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
                {drawerPs.segmento && <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>{drawerPs.segmento}</span>}
                {drawerPs.porte && <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>{drawerPs.porte}</span>}
                {/* Score destaque */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #eff6ff, #e0ecff)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '6px 16px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#6b7fa3', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Score</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{Number(drawerPs.score_total).toFixed(1)}</span>
                </div>
              </div>

              <div className={styles.drawerInfo}>
                <div><strong>Razão Social</strong>{drawerPs.razao_social}</div>
                <div><strong>CNPJ</strong>{drawerPs.cnpj}</div>
                <div><strong>Cidade/UF</strong>{drawerPs.cidade}/{drawerPs.uf}</div>
                {drawerPs.email && <div><strong>E-mail</strong>{drawerPs.email}</div>}
                {drawerPs.ultimo_contato && <div><strong>Último contato</strong>{fmtData(drawerPs.ultimo_contato)}</div>}
              </div>

              {/* Row: Contato + Scores */}
              <div className={styles.prospectPageRow}>
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('contato')}>
                  <span>{drawerSecoes.contato ? '▼' : '▶'}</span>
                  <span>📞 Contato & Pesquisa</span>
                </button>
                {drawerSecoes.contato && (
                  <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {drawerPs.telefone1 && (
                      <div className={styles.drawerContatoRow}>
                        <span>{drawerPs.telefone1}</span>
                        <a href={`tel:${drawerPs.telefone1}`} className={styles.btnSmall}>Ligar</a>
                        <button className={styles.btnWppSmall} onClick={() => abrirWhatsApp(drawerPs.telefone1, drawerPs.razao_social, drawerPs.segmento ?? undefined, drawerPs.cidade)}>WPP</button>
                      </div>
                    )}
                    {drawerPs.telefone2 && (
                      <div className={styles.drawerContatoRow}>
                        <span>{drawerPs.telefone2}</span>
                        <a href={`tel:${drawerPs.telefone2}`} className={styles.btnSmall}>Ligar</a>
                      </div>
                    )}
                    {drawerPs.email && (
                      <div className={styles.drawerContatoRow}>
                        <span>{drawerPs.email}</span>
                        <button className={styles.btnSmall} onClick={() => { navigator.clipboard.writeText(drawerPs.email!); showMsg('ok', 'E-mail copiado') }}>Copiar</button>
                        <button className={styles.btnSmall} disabled={enviandoEmail} style={{ background: '#2563eb', color: '#fff', border: 'none' }} onClick={async () => {
                          setEnviandoEmail(true)
                          try {
                            const { data, error } = await supabaseAdmin.functions.invoke('enviar-email', {
                              body: {
                                acao: 'individual',
                                para: drawerPs.email,
                                nome: drawerPs.nome_fantasia || drawerPs.razao_social,
                                segmento: drawerPs.segmento || '',
                                prospect_id: drawerPs.prospect_id,
                              }
                            })
                            if (error) throw error
                            if (data?.ok) showMsg('ok', '✅ E-mail enviado!')
                            else showMsg('erro', data?.erro || 'Erro ao enviar')
                          } catch (e: any) { showMsg('erro', e.message || 'Erro ao enviar e-mail') }
                          setEnviandoEmail(false)
                        }}>{enviandoEmail ? '⏳ Enviando...' : '📧 Enviar E-mail'}</button>
                      </div>
                    )}
                    {/* WhatsApp dedicado */}
                    <div className={styles.drawerWaRow}>
                      <label className={styles.drawerWaLabel}>📱 WhatsApp:</label>
                      <input
                        className={styles.drawerWaInput}
                        placeholder="(00) 00000-0000"
                        value={drawerPs.whatsapp || ''}
                        onChange={e => setDrawerPs({ ...drawerPs, whatsapp: e.target.value })}
                      />
                      <button className={styles.btnWppSmall} onClick={async () => {
                        const wa = drawerPs.whatsapp?.replace(/\D/g, '')
                        if (!wa) { showMsg('erro', 'Preencha o WhatsApp primeiro'); return }
                        await supabaseAdmin.from('prospeccao').update({ whatsapp: drawerPs.whatsapp, whatsapp_validado: false }).eq('id', drawerPs.prospect_id)
                        setHotlist(prev => prev.map(h => h.prospect_id === drawerPs.prospect_id
                          ? { ...h, whatsapp: drawerPs.whatsapp, whatsapp_validado: false } : h))
                        showMsg('ok', 'WhatsApp salvo — valide para confirmar')
                      }}>Salvar</button>
                      {drawerPs.whatsapp && (
                        <>
                          <button className={styles.btnWppSmall} onClick={() => abrirWhatsApp(drawerPs.whatsapp!, drawerPs.razao_social, drawerPs.segmento ?? undefined, drawerPs.cidade)}>Enviar</button>
                          <button className={styles.btnWppSmall} disabled={validandoWa} onClick={async () => {
                            setValidandoWa(true)
                            try {
                              const { data, error } = await supabaseAdmin.functions.invoke('validar-whatsapp', {
                                body: { action: 'check', phone: drawerPs.whatsapp, prospect_id: drawerPs.prospect_id }
                              })
                              if (error) throw error
                              if (data.exists) {
                                setDrawerPs({ ...drawerPs, whatsapp_validado: true })
                                setHotlist(prev => prev.map(h => h.prospect_id === drawerPs.prospect_id
                                  ? { ...h, whatsapp: drawerPs.whatsapp, whatsapp_validado: true } : h))
                                showMsg('ok', '✅ WhatsApp confirmado!')
                              } else {
                                setDrawerPs({ ...drawerPs, whatsapp_validado: false, whatsapp: null })
                                setHotlist(prev => prev.map(h => h.prospect_id === drawerPs.prospect_id
                                  ? { ...h, whatsapp: null, whatsapp_validado: false } : h))
                                showMsg('erro', '❌ Número não tem WhatsApp')
                              }
                            } catch (e: any) { showMsg('erro', e.message || 'Erro ao validar') }
                            setValidandoWa(false)
                          }}>{validandoWa ? '⏳' : '✓ Validar'}</button>
                        </>
                      )}
                    </div>
                    {drawerPs.whatsapp_validado && <span className={styles.waValidado}>✅ WhatsApp validado</span>}

                    {!drawerPs.telefone1 && !drawerPs.email && !drawerPs.whatsapp && <p className={styles.vazio}>Sem contato cadastrado</p>}
                    <div className={styles.drawerLinks}>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`${drawerPs.razao_social} ${drawerPs.cidade} whatsapp celular telefone`)}`} target="_blank" rel="noreferrer" className={styles.btnSecondary}>🔍 Buscar WhatsApp</a>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`${drawerPs.razao_social} ${drawerPs.cidade} instagram`)}`} target="_blank" rel="noreferrer" className={styles.btnSecondary}>📸 Instagram</a>
                      <a href={`https://cnpj.biz/${drawerPs.cnpj?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={styles.btnSecondary}>CNPJ.biz</a>
                    </div>
                  </div>
                )}
              </div>

              {/* Scores (colapsável) */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('scores')}>
                  <span>{drawerSecoes.scores ? '▼' : '▶'}</span>
                  <span>📊 Scores ({Number(drawerPs.score_total).toFixed(1)})</span>
                </button>
                {drawerSecoes.scores && (
                  <div style={{ padding: '12px 20px' }}>
                    <div className={styles.scores}>
                      {[
                        { label: 'Demanda', val: drawerPs.score_demanda },
                        { label: 'Segmento', val: drawerPs.score_segmento },
                        { label: 'Porte', val: drawerPs.score_porte },
                        { label: 'Proximidade', val: drawerPs.score_distancia },
                      ].map(s => (
                        <div key={s.label} className={styles.scoreBar}>
                          <span>{s.label}</span>
                          <div className={styles.bar}><div style={{ width: `${(Number(s.val) / 10) * 100}%` }} className={styles.barFill} /></div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 28 }}>{Number(s.val).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>{/* /Row Contato+Scores */}

              {/* Row: Histórico + Portfólio */}
              <div className={styles.prospectPageRow}>
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('nfs')}>
                  <span>{drawerSecoes.nfs ? '▼' : '▶'}</span>
                  <span>📦 Histórico de Compras {drawerNfs.length > 0 ? `(${drawerNfs.length})` : ''}</span>
                  {drawerNfResumo && drawerNfResumo.total > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                      Total: {fmtBRL(drawerNfResumo.total)}
                    </span>
                  )}
                </button>
                {drawerSecoes.nfs && (
                  <div style={{ padding: '12px 20px' }}>
                {drawerNfResumo && drawerNfResumo.total > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: '0.78rem' }}>
                    <span><strong>{drawerNfResumo.qtd}</strong> NFs</span>
                    <span>Total: <strong>{fmtBRL(drawerNfResumo.total)}</strong></span>
                    <span>Média: <strong>{fmtBRL(drawerNfResumo.media)}</strong></span>
                    {drawerNfResumo.ultima && <span>Última: <strong>{fmtData(drawerNfResumo.ultima)}</strong></span>}
                  </div>
                )}
                {drawerNfsLoading ? (
                  <p className={styles.vazio}>Carregando NFs...</p>
                ) : drawerNfs.length === 0 ? (
                  <p className={styles.vazio}>Nenhuma NF encontrada para este CNPJ</p>
                ) : (
                  <div className={styles.drawerNfs}>
                    {drawerNfs.map(nf => (
                      <div key={nf.id} className={styles.drawerNfItem}>
                        <button className={styles.drawerNfHead} onClick={() => expandirNf(nf.id)}>
                          <span>{drawerNfExpandida === nf.id ? '▼' : '▶'}</span>
                          <span>{nf.destinatario || 'NF'}</span>
                          <span>{fmtData(nf.emissao)}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtBRL(nf.total ?? 0)}</span>
                        </button>
                        {drawerNfExpandida === nf.id && drawerNfItens[nf.id] && (
                          <div className={styles.drawerNfItens}>
                            {drawerNfItens[nf.id].map((it: any, idx: number) => (
                              <div key={idx} className={styles.drawerNfItemRow}>
                                <span>{it.descricao}</span>
                                <span>{it.quantidade} × {fmtBRL(it.valor_unitario ?? 0)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                  </div>
                )}
              </div>

              {/* Portfólio Sugerido */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('portfolio')}>
                  <span>{drawerSecoes.portfolio ? '▼' : '▶'}</span>
                  <span>🏭 Portfólio para {drawerPs.segmento || 'este segmento'} {drawerPortfolio.length > 0 ? `(${drawerPortfolio.length})` : ''}</span>
                </button>
                {drawerSecoes.portfolio && (
                  <div style={{ padding: '12px 20px' }}>
                    {drawerPortfolioLoading ? (
                      <p className={styles.vazio}>Carregando portfólio...</p>
                    ) : !drawerPs.segmento ? (
                      <p className={styles.vazio}>Prospect sem segmento definido</p>
                    ) : drawerPortfolio.length === 0 ? (
                      <p className={styles.vazio}>Nenhum produto mapeado para este segmento</p>
                    ) : (
                      <div className={styles.portfolioLista}>
                        {drawerPortfolio.map((sp: any) => {
                          const prod = sp.portfolio_produtos
                          if (!prod) return null
                          const temFicha = prod.material || prod.dimensoes || prod.norma_aplicavel || prod.laudo_url || prod.ficha_tecnica || prod.vantagens
                          return (
                            <div key={sp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <div className={styles.portfolioItem}>
                                <div className={styles.portfolioInfo} style={{ cursor: temFicha ? 'pointer' : 'default' }}
                                  onClick={() => temFicha && setFichaExpandida(fichaExpandida === prod.id ? null : prod.id)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {temFicha && <span style={{ fontSize: 10, color: '#94a3b8' }}>{fichaExpandida === prod.id ? '▼' : '▶'}</span>}
                                    <strong>{sp.destaque ? '⭐ ' : ''}{prod.nome}</strong>
                                    {prod.laudo_url && <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>📄 Laudo</span>}
                                    {prod.material && <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 4 }}>{prod.material}</span>}
                                  </div>
                                  {prod.descricao && <span className={styles.portfolioDesc}>{prod.descricao}</span>}
                                </div>
                                <button className={styles.portfolioRemover} onClick={() => removerPortfolioItem(sp.id)} title="Remover do portfólio">✕</button>
                              </div>
                              {fichaExpandida === prod.id && (
                                <div style={{ padding: '8px 16px 12px 28px', background: '#f8fafc', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {prod.material && <div><strong>Material:</strong> {prod.material}</div>}
                                  {prod.dimensoes && <div><strong>Dimensões:</strong> {prod.dimensoes}</div>}
                                  {prod.peso_kg && <div><strong>Peso:</strong> {prod.peso_kg} kg</div>}
                                  {prod.norma_aplicavel && <div><strong>Norma:</strong> {prod.norma_aplicavel}</div>}
                                  {prod.aplicacoes && <div><strong>Aplicações:</strong> {prod.aplicacoes}</div>}
                                  {prod.vantagens && <div style={{ color: '#15803d' }}><strong>Vantagens:</strong> {prod.vantagens}</div>}
                                  {prod.ficha_tecnica && <div style={{ marginTop: 4, lineHeight: 1.4, color: '#475569' }}>{prod.ficha_tecnica}</div>}
                                  {prod.laudo_url && (
                                    <a href={prod.laudo_url} target="_blank" rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: '0.76rem', fontWeight: 600, textDecoration: 'none' }}>
                                      📄 {prod.laudo_descricao || 'Ver laudo técnico'}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {drawerPs.segmento && !portfolioAddOpen && (
                      <button className={styles.btnSecondary} style={{ marginTop: 8, width: '100%' }} onClick={abrirPortfolioAdd}>+ Adicionar produto</button>
                    )}
                    {portfolioAddOpen && drawerPs.segmento && (
                      <div className={styles.portfolioAdd}>
                        <select className={styles.portfolioSelect} value={portfolioAddExistente ?? ''} onChange={e => { setPortfolioAddExistente(e.target.value ? Number(e.target.value) : null); if (e.target.value) setPortfolioAddNome('') }}>
                          <option value="">— Produto existente ou novo abaixo —</option>
                          {todosPortfolioProdutos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        {!portfolioAddExistente && (
                          <>
                            <input className={styles.portfolioInput} placeholder="Nome do novo produto" value={portfolioAddNome} onChange={e => setPortfolioAddNome(e.target.value)} />
                            <input className={styles.portfolioInput} placeholder="Descrição (opcional)" value={portfolioAddDesc} onChange={e => setPortfolioAddDesc(e.target.value)} />
                          </>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className={styles.btnPrimary} onClick={() => adicionarPortfolioProduto(drawerPs.segmento!)}>Salvar</button>
                          <button className={styles.btnSecondary} onClick={() => setPortfolioAddOpen(false)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>{/* /Row Histórico+Portfólio */}

              {/* Row: Regulatório + Deals+Estoque + IA */}
              <div className={styles.prospectPageRow}>
              {/* ⚡ Argumento Regulatório */}
              {(drawerNormas.length > 0 || drawerEquipamentos.length > 0) && (
                <div className={styles.secaoColapsavel}>
                  <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('regulatorio')}>
                    <span>{drawerSecoes.regulatorio ? '▼' : '▶'}</span>
                    <span>⚡ Regulatório — {drawerPs.segmento}</span>
                    {drawerNormas.length > 0 && (
                      <span className={`${styles.urgBadge} ${styles[`urg${calcularUrgencia(drawerNormas).charAt(0).toUpperCase() + calcularUrgencia(drawerNormas).slice(1)}`]}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        {calcularUrgencia(drawerNormas) === 'critico' ? '🔴 Crítico' :
                         calcularUrgencia(drawerNormas) === 'alto' ? '🟡 Alto' :
                         calcularUrgencia(drawerNormas) === 'tecnico' ? '🟢 Técnico' : '🔵 Diferencial'}
                      </span>
                    )}
                  </button>
                  {drawerSecoes.regulatorio && (
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Sub-seção: Normas */}
                      {drawerNormas.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>📋 NORMAS ({drawerNormas.length})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {drawerNormas.map((n: any) => (
                              <div key={n.id} className={styles.normaItem}>
                                <div className={styles.normaHead}>
                                  <span className={styles.normaBadge}>{n.orgao}</span>
                                  <strong>{n.norma}</strong>
                                  <span className={styles.normaStatus} data-status={n.status}>{n.status}</span>
                                </div>
                                <p className={styles.normaTitulo}>{n.titulo}</p>
                                {n.penalidade && <p className={styles.normaPenalidade}>⚠️ {n.penalidade}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-seção: Equipamentos */}
                      {drawerEquipamentos.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>🔧 EQUIPAMENTOS EM INOX ({drawerEquipamentos.length})</h4>
                          <div className={styles.equipLista}>
                            {drawerEquipamentos.map((eq: any) => (
                              <div key={eq.id} className={styles.equipItem}>
                                <span>{eq.obrigatorio ? '✅' : '⭐'}</span>
                                <span className={styles.equipNome}>{eq.equipamento}</span>
                                <a href="/blog/acos-inoxidaveis-304-430-316" target="_blank" rel="noopener" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Saiba mais →</a>
                              </div>
                            ))}
                          </div>
                          <p className={styles.equipLegenda}>✅ = Obrigatório &nbsp; ⭐ = Recomendado</p>
                        </div>
                      )}

                      {/* Sub-seção: Mensagem Regulatória */}
                      {msgRegulatoria && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>📱 MENSAGEM REGULATÓRIA</h4>
                          <div className={styles.regMsgBox}>
                            <p className={styles.regMsgText}>{msgRegulatoria}</p>
                            <div className={styles.regMsgActions}>
                              <button onClick={() => { navigator.clipboard.writeText(msgRegulatoria); showMsg('ok', 'Mensagem copiada!') }}>📋 Copiar</button>
                              <button onClick={() => {
                                const tel = drawerPs.whatsapp || drawerPs.telefone1
                                if (!tel) { showMsg('erro', 'Sem telefone'); return }
                                const num = tel.replace(/\D/g, '')
                                const numFull = num.length <= 11 ? `55${num}` : num
                                window.open(`https://wa.me/${numFull}?text=${encodeURIComponent(msgRegulatoria)}`, '_blank')
                              }}>📱 Enviar WhatsApp</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 📊 Deals & Orçamentos */}
              {(drawerDeals.length > 0 || drawerOrcamentos.length > 0) && (
                <div className={styles.secaoColapsavel}>
                  <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('deals')}>
                    <span>{drawerSecoes.deals ? '▼' : '▶'}</span>
                    <span>📊 Deals & Orçamentos ({drawerDeals.length + drawerOrcamentos.length})</span>
                  </button>
                  {drawerSecoes.deals && (
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {drawerDeals.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Pipeline ({drawerDeals.length})</h4>
                          {drawerDeals.map((d: any) => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: d.estagio === 'ganho' ? '#dcfce7' : d.estagio === 'perdido' ? '#fee2e2' : '#dbeafe',
                                color: d.estagio === 'ganho' ? '#15803d' : d.estagio === 'perdido' ? '#991b1b' : '#1e40af'
                              }}>{d.estagio}</span>
                              <span style={{ flex: 1 }}>{d.titulo}</span>
                              {d.valor_estimado > 0 && <strong>{fmtBRL(d.valor_estimado)}</strong>}
                            </div>
                          ))}
                        </div>
                      )}
                      {drawerOrcamentos.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Orçamentos ({drawerOrcamentos.length})</h4>
                          {drawerOrcamentos.map((o: any) => (
                            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>
                                {o.status || 'rascunho'}
                              </span>
                              <span style={{ flex: 1 }}>#{o.numero || o.id}</span>
                              {o.valor_total > 0 && <strong>{fmtBRL(o.valor_total)}</strong>}
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fmtData(o.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 📋 Histórico de Atividades */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('atividades')}>
                  <span>{drawerSecoes.atividades ? '▼' : '▶'}</span>
                  <span>📋 Histórico de Atividades {drawerAtividades.length > 0 ? `(${drawerAtividades.length})` : ''}</span>
                </button>
                {drawerSecoes.atividades && (
                  <div style={{ padding: '12px 20px' }}>
                    {drawerAtividades.length === 0 ? (
                      <p className={styles.vazio}>Nenhuma atividade registrada</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {drawerAtividades.map((a: any) => {
                          const icone = a.tipo === 'email' ? '📧' : a.tipo === 'whatsapp' || a.tipo === 'whatsapp_auto' ? '📱' : a.tipo === 'ligacao' ? '📞' : '📝'
                          const corBg = a.tipo === 'email' ? '#eff6ff' : a.tipo === 'whatsapp' || a.tipo === 'whatsapp_auto' ? '#f0fdf4' : '#f8fafc'
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: corBg, borderRadius: 8, fontSize: '0.82rem' }}>
                              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icone}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>
                                  {a.tipo === 'email' ? 'E-mail enviado' : a.tipo === 'whatsapp' ? 'WhatsApp' : a.tipo === 'whatsapp_auto' ? 'WhatsApp (auto)' : a.tipo === 'ligacao' ? 'Ligação' : a.tipo}
                                  {a.canal && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>via {a.canal}</span>}
                                </div>
                                {a.detalhes && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{a.detalhes}</div>}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtData(a.created_at)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 📦 Estoque Disponível */}
              {drawerEstoque.length > 0 && (
                <div className={styles.secaoColapsavel}>
                  <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('estoque')}>
                    <span>{drawerSecoes.estoque ? '▼' : '▶'}</span>
                    <span>📦 Estoque Disponível ({drawerEstoque.length})</span>
                  </button>
                  {drawerSecoes.estoque && (
                    <div style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {drawerEstoque.map((item: any) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: '0.82rem' }}>
                            <span style={{ flex: 1 }}>{item.nome}</span>
                            <span style={{ fontWeight: 700, color: item.saldo_atual <= (item.estoque_minimo || 0) ? '#dc2626' : '#15803d' }}>
                              {item.saldo_atual} {item.unidade}
                            </span>
                            {item.codigo && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.codigo}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* 🏭 Produção Ativa */}
              {drawerProducao.length > 0 && (
                <div className={styles.secaoColapsavel}>
                  <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('producao')}>
                    <span>{drawerSecoes.producao ? '▼' : '▶'}</span>
                    <span>🏭 Produção Ativa ({drawerProducao.length} OPs)</span>
                  </button>
                  {drawerSecoes.producao && (
                    <div style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {drawerProducao.map((op: any) => (
                          <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: '0.82rem' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: op.status === 'em_producao' ? '#fef3c7' : op.status === 'liberada' ? '#dbeafe' : '#f1f5f9',
                              color: op.status === 'em_producao' ? '#92400e' : op.status === 'liberada' ? '#1e40af' : '#64748b'
                            }}>{op.status?.replace('_', ' ')}</span>
                            <strong style={{ fontSize: '0.78rem' }}>{op.numero}</strong>
                            <span style={{ flex: 1 }}>{op.projetos?.titulo || op.numero}</span>
                            {op.data_prevista && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{fmtData(op.data_prevista)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🤖 Agentes IA */}
              <div className={styles.secaoColapsavel}>
                <button className={styles.secaoToggle} onClick={() => toggleDrawerSecao('ia')}>
                  <span>{drawerSecoes.ia ? '▼' : '▶'}</span>
                  <span>🤖 Inteligência Comercial</span>
                </button>
                {drawerSecoes.ia && (
                  <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Agente 1: Análise */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className={styles.btnPrimary} style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                          disabled={iaLoadingTipo !== null} onClick={iaAnalisarProspect}>
                          {iaLoadingTipo === 'analise' ? '⏳ Analisando...' : '🔍 Analisar Prospect'}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Estratégia de abordagem personalizada</span>
                      </div>
                      {iaAnalise && (
                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {iaAnalise}
                          <button style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.78rem' }}
                            onClick={() => { navigator.clipboard.writeText(iaAnalise); showMsg('ok', 'Copiado!') }}>📋 Copiar</button>
                        </div>
                      )}
                    </div>

                    {/* Agente 2: Resumo Executivo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className={styles.btnPrimary} style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                          disabled={iaLoadingTipo !== null} onClick={iaGerarResumoExecutivo}>
                          {iaLoadingTipo === 'resumo' ? '⏳ Gerando...' : '📋 Briefing Executivo'}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Resumo completo para reunião</span>
                      </div>
                      {iaResumo && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {iaResumo}
                          <button style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontSize: '0.78rem' }}
                            onClick={() => { navigator.clipboard.writeText(iaResumo); showMsg('ok', 'Copiado!') }}>📋 Copiar</button>
                        </div>
                      )}
                    </div>

                    {/* Agente 3: Objeção Handler */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 12, color: '#64748b' }}>💬 Responder Objeção</h4>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ flex: 1, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.82rem' }}
                          placeholder='Ex: "Tá muito caro", "Já tenho fornecedor"...'
                          value={iaObjecaoInput} onChange={e => setIaObjecaoInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && iaResponderObjecao()} />
                        <button className={styles.btnPrimary} style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                          disabled={iaLoadingTipo !== null || !iaObjecaoInput.trim()} onClick={iaResponderObjecao}>
                          {iaLoadingTipo === 'objecao' ? '⏳...' : '💡'}
                        </button>
                      </div>
                      {iaObjecao && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {iaObjecao}
                          <button style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.78rem' }}
                            onClick={() => { navigator.clipboard.writeText(iaObjecao); showMsg('ok', 'Copiado!') }}>📋 Copiar</button>
                        </div>
                      )}
                    </div>

                    {/* Agente 4: Consultor Técnico para Leigos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 12, color: '#64748b' }}>🎓 Consultor Técnico (para leigos)</h4>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Explica conceitos técnicos em linguagem simples para síndicos, compradores e gestores</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ flex: 1, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.82rem' }}
                          placeholder='Ex: "O que é capacidade de carga?", "Por que inox e não galvanizado?"'
                          value={iaConsultorInput} onChange={e => setIaConsultorInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && iaConsultorTecnico()} />
                        <button className={styles.btnPrimary} style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                          disabled={iaLoadingTipo !== null || !iaConsultorInput.trim()} onClick={iaConsultorTecnico}>
                          {iaLoadingTipo === 'consultor' ? '⏳...' : '🎓'}
                        </button>
                      </div>
                      {iaConsultor && (
                        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {iaConsultor}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem' }}
                              onClick={() => { navigator.clipboard.writeText(iaConsultor); showMsg('ok', 'Copiado!') }}>📋 Copiar</button>
                            <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem' }}
                              onClick={() => {
                                const tel = drawerPs.whatsapp || drawerPs.telefone1
                                if (!tel) { showMsg('erro', 'Sem telefone'); return }
                                const num = tel.replace(/\D/g, '')
                                window.open(`https://wa.me/${num.length <= 11 ? '55' + num : num}?text=${encodeURIComponent(iaConsultor)}`, '_blank')
                              }}>📱 Enviar via WhatsApp</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Agente 5: Comparativo Técnico */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className={styles.btnPrimary} style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                          disabled={iaLoadingTipo !== null} onClick={iaGerarComparativo}>
                          {iaLoadingTipo === 'comparativo' ? '⏳ Gerando...' : '⚔️ Comparativo vs Concorrentes'}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Análise honesta Pousinox vs mercado</span>
                      </div>
                      {iaComparativo && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {iaComparativo}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}
                              onClick={() => { navigator.clipboard.writeText(iaComparativo); showMsg('ok', 'Copiado!') }}>📋 Copiar</button>
                            <button style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}
                              onClick={() => {
                                const tel = drawerPs.whatsapp || drawerPs.telefone1
                                if (!tel) { showMsg('erro', 'Sem telefone'); return }
                                const num = tel.replace(/\D/g, '')
                                window.open(`https://wa.me/${num.length <= 11 ? '55' + num : num}?text=${encodeURIComponent(iaComparativo)}`, '_blank')
                              }}>📱 Enviar via WhatsApp</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>{/* /Row Regulatório+Deals+Estoque+Produção+IA */}

              {/* Ações */}
              <div className={styles.drawerAcoes} style={{ flexDirection: 'column', gap: 10 }}>
                {/* CTA protagonista */}
                <button className={styles.btnWpp} style={{ width: '100%', padding: '12px 18px', fontSize: '0.92rem', borderRadius: 10, fontWeight: 700, letterSpacing: '-0.01em' }}
                  onClick={() => abrirWhatsApp(drawerPs.whatsapp || drawerPs.telefone1, drawerPs.razao_social, drawerPs.segmento, drawerPs.cidade)}>
                  📱 Abrir WhatsApp
                </button>
                {/* Ações secundárias — grid uniforme */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, width: '100%' }}>
                  <button className={styles.btnContactar} style={{ fontSize: '0.78rem', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}
                    onClick={() => { marcarContactado(drawerPs); setDrawerPs(null) }}>✅ Contactei</button>
                  <button className={styles.btnSmall} style={{ padding: '8px 10px', textAlign: 'center' }}
                    onClick={() => { criarDealDoDrawer(drawerPs); setDrawerPs(null) }}>➡ Deal</button>
                  <button className={styles.btnSmall} style={{ padding: '8px 10px', textAlign: 'center' }} onClick={() => {
                    sessionStorage.setItem('orcamento_prospect', JSON.stringify({
                      razao_social: drawerPs.razao_social, nome_fantasia: drawerPs.nome_fantasia,
                      cnpj: drawerPs.cnpj, telefone: drawerPs.whatsapp || drawerPs.telefone1,
                      email: drawerPs.email, cidade: drawerPs.cidade, uf: drawerPs.uf,
                      segmento: drawerPs.segmento,
                    }))
                    setOrcamentoModal(true)
                  }}>📄 Orçamento</button>
                  <button className={styles.btnSmall} style={{ padding: '8px 10px', textAlign: 'center' }}
                    onClick={() => setHistoricoAberto({ id: drawerPs.prospect_id, nome: drawerPs.nome_fantasia || drawerPs.razao_social })}>📋 Histórico</button>
                  <button className={styles.btnSmall} style={{ padding: '8px 10px', textAlign: 'center', color: '#7c3aed', borderColor: '#ddd6fe' }}
                    disabled={iaLoadingTipo !== null} onClick={iaGerarProposta}>
                    {iaLoadingTipo === 'proposta' ? '⏳...' : '📝 Proposta IA'}
                  </button>
                </div>
              </div>
              {iaProposta && (
                <div style={{ padding: '12px 20px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {iaProposta}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, borderTop: '1px solid #e9d5ff', paddingTop: 8 }}>
                    <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      onClick={() => { navigator.clipboard.writeText(iaProposta); showMsg('ok', 'Proposta copiada!') }}>📋 Copiar</button>
                    <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      onClick={() => {
                        const tel = drawerPs.whatsapp || drawerPs.telefone1
                        if (!tel) { showMsg('erro', 'Sem telefone'); return }
                        const num = tel.replace(/\D/g, '')
                        window.open(`https://wa.me/${num.length <= 11 ? '55' + num : num}?text=${encodeURIComponent(iaProposta)}`, '_blank')
                      }}>📱 Enviar via WhatsApp</button>
                    <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      onClick={() => {
                        const mailto = drawerPs.email
                        if (!mailto) { showMsg('erro', 'Sem e-mail'); return }
                        window.open(`mailto:${mailto}?subject=${encodeURIComponent('Proposta Comercial — Pousinox')}&body=${encodeURIComponent(iaProposta)}`, '_blank')
                      }}>📧 Enviar por Email</button>
                  </div>
                </div>
              )}

              {/* IA — Sugerir abordagem (3 variações Multi-IA) */}
              <DrawerMultiIA prospect={drawerPs} />
            </div>
          </div>
        </>
      )}

      {/* Modal Histórico de Interações */}
      {historicoAberto && (
        <HistoricoModal
          prospectId={historicoAberto.id}
          prospectNome={historicoAberto.nome}
          onClose={() => setHistoricoAberto(null)}
          onInteracaoSalva={() => carregarHotList()}
        />
      )}

      {/* Modal Orçamento (iframe) */}
      {orcamentoModal && (
        <ModalIframe
          url="/admin/orcamento"
          titulo={`📄 Orçamento — ${drawerPs?.nome_fantasia || drawerPs?.razao_social || ''}`}
          onClose={() => setOrcamentoModal(false)}
        />
      )}
    </div>
  )
}

// ── Componente Follow-up Card ─────────────────────────────────────────────────

function FollowupCard({ fup, onFeito, onAdiar, onWpp, corBorda }: {
  fup: Followup; onFeito: () => void; onAdiar: (dias: number) => void; onWpp: () => void; corBorda: string
}) {
  const dias = diasAte(fup.data_prevista)
  const nome = fup.prospeccao?.nome_fantasia || fup.prospeccao?.razao_social || '—'

  return (
    <div className={styles.fupCard} style={{ borderLeftColor: corBorda }}>
      <div className={styles.fupTop}>
        <strong>{nome}</strong>
        <span className={styles.fupDias}>
          {dias < 0 ? `${Math.abs(dias)}d atrás` : dias === 0 ? 'Hoje' : `em ${dias}d`}
        </span>
      </div>
      {fup.prospeccao?.cidade && (
        <span className={styles.fupMeta}>{fup.prospeccao.cidade}/{fup.prospeccao.uf}</span>
      )}
      {fup.pipeline_deals && (
        <span className={styles.fupDeal}>Deal: {fup.pipeline_deals.titulo}</span>
      )}
      {fup.observacao && <p className={styles.fupObs}>{fup.observacao}</p>}
      <div className={styles.fupActions}>
        <button className={styles.btnFeito} onClick={onFeito}>Feito</button>
        <button className={styles.btnAdiar} onClick={() => onAdiar(3)}>+3d</button>
        <button className={styles.btnAdiar} onClick={() => onAdiar(7)}>+7d</button>
        <button className={styles.btnWppSmall} onClick={onWpp}>WPP</button>
      </div>
    </div>
  )
}

// ── Auditoria SEO ────────────────────────────────────────────────────────────

interface AuditItem {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  tipo: 'oportunidade' | 'ctr_baixo' | 'topo' | 'invisivel'
  acao: string
  prioridade: number
}

function classificarQueries(queries: any[]): AuditItem[] {
  return queries.map(q => {
    const pos = q.position
    const ctr = q.ctr
    const imp = q.impressions

    // Topo consolidado — manter
    if (pos <= 3 && ctr >= 0.05) {
      return { ...q, tipo: 'topo' as const, acao: 'Manter — você já domina essa busca. Monitore para não perder posição.', prioridade: 4 }
    }
    // Oportunidade fácil — posição 4-20, tem impressões
    if (pos > 3 && pos <= 20 && imp >= 5) {
      const acao = pos <= 10
        ? `Posição ${pos.toFixed(0)} — quase no topo. Criar/otimizar conteúdo sobre "${q.query}" pode subir 3-5 posições.`
        : `Posição ${pos.toFixed(0)} — 2ª página. Um blog post ou página dedicada sobre "${q.query}" pode colocar na 1ª página.`
      return { ...q, tipo: 'oportunidade' as const, acao, prioridade: pos <= 10 ? 1 : 2 }
    }
    // CTR baixo — aparece mas não clicam
    if (imp >= 10 && ctr < 0.03 && pos <= 15) {
      return { ...q, tipo: 'ctr_baixo' as const, acao: `${imp} impressões mas só ${(ctr*100).toFixed(1)}% clicam. O título e a descrição da página não estão atraindo. Reescreva o meta title/description com foco em benefício.`, prioridade: 1 }
    }
    // Invisível — posição > 20
    if (pos > 20) {
      return { ...q, tipo: 'invisivel' as const, acao: `Posição ${pos.toFixed(0)} — quase ninguém vê. Criar conteúdo rico (guia, artigo técnico) sobre "${q.query}" é o caminho.`, prioridade: 3 }
    }
    // Default: oportunidade genérica
    return { ...q, tipo: 'oportunidade' as const, acao: 'Analisar e otimizar conteúdo para essa busca.', prioridade: 3 }
  }).sort((a, b) => a.prioridade - b.prioridade)
}

function AuditoriaSEO({ queries, marketKws }: { queries: any[]; marketKws: { termo: string; uf: string; volume_mensal: number; camada: string; intencao: string | null }[] }) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ ctr_baixo: false, oportunidade: false, invisivel: false, topo: false, passos: false, cruzamento: false })
  const toggle = (k: string) => setAbertos(prev => ({ ...prev, [k]: !prev[k] }))

  const items = classificarQueries(queries)
  const oportunidades = items.filter(i => i.tipo === 'oportunidade')
  const ctrBaixo = items.filter(i => i.tipo === 'ctr_baixo')
  const topo = items.filter(i => i.tipo === 'topo')
  const invisiveis = items.filter(i => i.tipo === 'invisivel')

  const tipoConfig: Record<string, { icon: string; label: string; cor: string; desc: string }> = {
    ctr_baixo: { icon: '⚠️', label: 'CTR Baixo — Título/Descrição Fraco', cor: '#dc2626', desc: 'As pessoas veem seu site mas não clicam. O título e a meta description precisam ser mais atrativos.' },
    oportunidade: { icon: '🎯', label: 'Oportunidade — Quase na 1ª Página', cor: '#d97706', desc: 'Queries onde você está perto do topo. Com pouco esforço de conteúdo, pode subir para a 1ª página.' },
    invisivel: { icon: '👻', label: 'Invisível — Precisa de Conteúdo', cor: '#6b7280', desc: 'Posição muito baixa. Precisa de conteúdo dedicado (blog, página, guia) para começar a ranquear.' },
    topo: { icon: '✅', label: 'Topo — Mantendo Bem', cor: '#059669', desc: 'Você domina essas buscas. Continue monitorando para não perder posição.' },
  }

  const grupos = [
    { key: 'ctr_baixo', items: ctrBaixo },
    { key: 'oportunidade', items: oportunidades },
    { key: 'invisivel', items: invisiveis },
    { key: 'topo', items: topo },
  ].filter(g => g.items.length > 0)

  if (items.length === 0) return <p className={styles.vazio}>Sem dados para auditoria. Atualize o GSC primeiro.</p>

  return (
    <div className={styles.auditWrap}>
      <div className={styles.auditResumo}>
        <p className={styles.auditIntro}>
          O agente SEO analisou <strong>{items.length} queries</strong> e encontrou:
        </p>
        <div className={styles.auditBadges}>
          {ctrBaixo.length > 0 && <span className={styles.auditBadge} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>⚠️ {ctrBaixo.length} com CTR baixo</span>}
          {oportunidades.length > 0 && <span className={styles.auditBadge} style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fed7aa' }}>🎯 {oportunidades.length} oportunidades</span>}
          {invisiveis.length > 0 && <span className={styles.auditBadge} style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>👻 {invisiveis.length} invisíveis</span>}
          {topo.length > 0 && <span className={styles.auditBadge} style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>✅ {topo.length} no topo</span>}
        </div>
      </div>

      {grupos.map(g => {
        const cfg = tipoConfig[g.key]
        return (
          <div key={g.key} className={styles.secaoColapsavel}>
            <button className={styles.secaoToggle} onClick={() => toggle(g.key)}>
              <span>{abertos[g.key] ? '▼' : '▶'}</span>
              <span style={{ color: cfg.cor }}>{cfg.icon} {cfg.label} ({g.items.length})</span>
            </button>
            {abertos[g.key] && (
              <div className={styles.auditGrupo} style={{ padding: '12px 20px' }}>
                <p className={styles.auditGrupoDesc}>{cfg.desc}</p>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Pos.</th>
                      <th>Impr.</th>
                      <th>CTR</th>
                      <th>Ação sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((item, i) => (
                      <tr key={i}>
                        <td className={styles.queryCell}>{item.query}</td>
                        <td style={{ fontWeight: 600, color: item.position <= 10 ? '#16a34a' : item.position <= 20 ? '#d97706' : '#dc2626' }}>
                          {item.position.toFixed(1)}
                        </td>
                        <td>{item.impressions.toLocaleString('pt-BR')}</td>
                        <td style={{ fontWeight: 600, color: item.ctr >= 0.05 ? '#16a34a' : item.ctr >= 0.03 ? '#65a30d' : '#dc2626' }}>
                          {(item.ctr * 100).toFixed(1)}%
                        </td>
                        <td className={styles.auditAcao}>{item.acao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <div className={styles.secaoColapsavel}>
        <button className={styles.secaoToggle} onClick={() => toggle('passos')}>
          <span>{abertos.passos ? '▼' : '▶'}</span>
          <span>📋 Próximos passos recomendados</span>
        </button>
        {abertos.passos && (
          <div className={styles.auditDica}>
            <ol>
              <li><strong>Prioridade 1:</strong> Corrigir títulos/descrições das queries com CTR baixo — ganho rápido sem criar conteúdo</li>
              <li><strong>Prioridade 2:</strong> Criar conteúdo para queries posição 4-20 — blog post, página de produto, FAQ</li>
              <li><strong>Prioridade 3:</strong> Monitorar queries no topo — verificar semanalmente se mantém posição</li>
            </ol>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 8 }}>💡 Dica: mude os títulos no componente SEO de cada página (meta title e description). Resultados aparecem em 2-4 semanas.</p>
          </div>
        )}
      </div>

      {/* ── Cruzamento GSC × Estudo de Mercado ── */}
      {marketKws.length > 0 && <CruzamentoGscMercado queries={queries} marketKws={marketKws} />}
    </div>
  )
}

// ── Cruzamento GSC × Estudo de Mercado ───────────────────────────────────────

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function termosContem(a: string, b: string) {
  const na = normalizar(a), nb = normalizar(b)
  return na.includes(nb) || nb.includes(na)
}

function CruzamentoGscMercado({ queries, marketKws }: {
  queries: any[]
  marketKws: { termo: string; uf: string; volume_mensal: number; camada: string; intencao: string | null }[]
}) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ naoMonit: false, semAparicao: false, validadas: false, comoUsar: false })
  const toggle = (k: string) => setAbertos(prev => ({ ...prev, [k]: !prev[k] }))

  const mkTermos = new Set(marketKws.map(k => normalizar(k.termo)))

  // Queries GSC que NÃO estão no Estudo de Mercado → demanda real não monitorada
  const gscSemMk = queries.filter(q => {
    const nq = normalizar(q.query)
    return ![...mkTermos].some(t => termosContem(nq, t))
  }).sort((a, b) => b.impressions - a.impressions)

  // Keywords do Estudo de Mercado sem aparição no GSC → conteúdo que Google não mostra
  const gscTermos = new Set(queries.map((q: any) => normalizar(q.query)))
  const mkSemGsc = marketKws.filter(k => {
    const nk = normalizar(k.termo)
    return ![...gscTermos].some(t => termosContem(t, nk))
  })
  // Agrupar por termo único (pode ter múltiplas UFs)
  const mkSemGscMap = new Map<string, { termo: string; ufs: string[]; volume: number; camada: string }>()
  for (const k of mkSemGsc) {
    const key = normalizar(k.termo)
    const existing = mkSemGscMap.get(key)
    if (existing) {
      if (!existing.ufs.includes(k.uf)) existing.ufs.push(k.uf)
      existing.volume += k.volume_mensal
    } else {
      mkSemGscMap.set(key, { termo: k.termo, ufs: [k.uf], volume: k.volume_mensal, camada: k.camada })
    }
  }
  const mkSemGscList = [...mkSemGscMap.values()].sort((a, b) => b.volume - a.volume)

  // Queries que EXISTEM em ambos → validadas (demanda confirmada)
  const validadas = queries.filter(q => {
    const nq = normalizar(q.query)
    return [...mkTermos].some(t => termosContem(nq, t))
  }).sort((a, b) => b.impressions - a.impressions)

  return (
    <div className={styles.cruzWrap}>
      <h4 className={styles.cruzTitulo}>🔀 Cruzamento: GSC × Estudo de Mercado</h4>
      <p className={styles.cruzDesc}>
        Comparação entre o que as pessoas realmente pesquisam (GSC) e o que você monitora no Estudo de Mercado (keywords).
      </p>

      <div className={styles.cruzBadges}>
        <span className={styles.auditBadge} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          🚨 {gscSemMk.length} queries não monitoradas
        </span>
        <span className={styles.auditBadge} style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fed7aa' }}>
          📭 {mkSemGscList.length} keywords sem aparição
        </span>
        <span className={styles.auditBadge} style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>
          ✅ {validadas.length} validadas em ambos
        </span>
      </div>

      {/* Queries GSC não monitoradas */}
      {gscSemMk.length > 0 && (
        <div className={styles.secaoColapsavel}>
          <button className={styles.secaoToggle} onClick={() => toggle('naoMonit')}>
            <span>{abertos.naoMonit ? '▼' : '▶'}</span>
            <span style={{ color: '#dc2626' }}>🚨 Demanda real não monitorada ({gscSemMk.length})</span>
          </button>
          {abertos.naoMonit && (
            <div className={styles.cruzBloco} style={{ padding: '12px 20px' }}>
              <p className={styles.cruzBlocoDesc}>
                Essas buscas geram impressões/cliques reais no Google, mas você não tem keyword cadastrada no Estudo de Mercado.
                <strong> Ação:</strong> cadastrar no Estudo de Mercado para acompanhar evolução.
              </p>
              <table className={styles.tabela}>
                <thead>
                  <tr><th>Query</th><th>Impressões</th><th>Cliques</th><th>Posição</th><th>Sugestão</th></tr>
                </thead>
                <tbody>
                  {gscSemMk.slice(0, 15).map((q: any, i: number) => (
                    <tr key={i}>
                      <td className={styles.queryCell}>{q.query}</td>
                      <td>{q.impressions.toLocaleString('pt-BR')}</td>
                      <td>{q.clicks}</td>
                      <td style={{ fontWeight: 600, color: q.position <= 10 ? '#16a34a' : '#d97706' }}>{q.position.toFixed(1)}</td>
                      <td className={styles.auditAcao}>
                        Cadastrar em <a href="/admin/estudo-mercado" style={{ color: '#2563eb', textDecoration: 'underline' }}>Estudo de Mercado</a> → monitorar volume e tendência
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gscSemMk.length > 15 && <p className={styles.cruzMais}>+ {gscSemMk.length - 15} queries adicionais</p>}
            </div>
          )}
        </div>
      )}

      {/* Keywords sem aparição no GSC */}
      {mkSemGscList.length > 0 && (
        <div className={styles.secaoColapsavel}>
          <button className={styles.secaoToggle} onClick={() => toggle('semAparicao')}>
            <span>{abertos.semAparicao ? '▼' : '▶'}</span>
            <span style={{ color: '#d97706' }}>📭 Keywords sem aparição no Google ({mkSemGscList.length})</span>
          </button>
          {abertos.semAparicao && (
            <div className={styles.cruzBloco} style={{ padding: '12px 20px' }}>
              <p className={styles.cruzBlocoDesc}>
                Você monitora essas keywords, mas o site Pousinox não aparece para elas no Google.
                <strong> Ação:</strong> criar conteúdo dedicado (página, blog post) para começar a ranquear.
              </p>
              <table className={styles.tabela}>
                <thead>
                  <tr><th>Keyword</th><th>Volume</th><th>UFs</th><th>Camada</th><th>Sugestão</th></tr>
                </thead>
                <tbody>
                  {mkSemGscList.slice(0, 15).map((k, i) => (
                    <tr key={i}>
                      <td className={styles.queryCell}>{k.termo}</td>
                      <td>{k.volume.toLocaleString('pt-BR')}</td>
                      <td>{k.ufs.join(', ')}</td>
                      <td><span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: 3, background: k.camada === 'externa' ? '#eff6ff' : '#f0fdf4', color: k.camada === 'externa' ? '#2563eb' : '#059669' }}>{k.camada}</span></td>
                      <td className={styles.auditAcao}>
                        Criar conteúdo em <a href="/admin/conteudo" style={{ color: '#2563eb', textDecoration: 'underline' }}>Conteúdo</a> sobre "{k.termo}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mkSemGscList.length > 15 && <p className={styles.cruzMais}>+ {mkSemGscList.length - 15} keywords adicionais</p>}
            </div>
          )}
        </div>
      )}

      {/* Validadas em ambos */}
      {validadas.length > 0 && (
        <div className={styles.secaoColapsavel}>
          <button className={styles.secaoToggle} onClick={() => toggle('validadas')}>
            <span>{abertos.validadas ? '▼' : '▶'}</span>
            <span style={{ color: '#059669' }}>✅ Demanda confirmada ({validadas.length})</span>
          </button>
          {abertos.validadas && (
            <div className={styles.cruzBloco} style={{ padding: '12px 20px' }}>
              <p className={styles.cruzBlocoDesc}>
                Essas queries aparecem tanto nas buscas reais quanto no seu monitoramento. São as mais confiáveis para direcionar prospecção e conteúdo.
              </p>
              <table className={styles.tabela}>
                <thead>
                  <tr><th>Query</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Posição</th><th>Ação</th></tr>
                </thead>
                <tbody>
                  {validadas.slice(0, 10).map((q: any, i: number) => (
                    <tr key={i}>
                      <td className={styles.queryCell}>{q.query}</td>
                      <td>{q.impressions.toLocaleString('pt-BR')}</td>
                      <td>{q.clicks}</td>
                      <td style={{ fontWeight: 600, color: q.ctr >= 0.05 ? '#16a34a' : q.ctr >= 0.03 ? '#65a30d' : '#dc2626' }}>
                        {(q.ctr * 100).toFixed(1)}%
                      </td>
                      <td style={{ fontWeight: 600, color: q.position <= 10 ? '#16a34a' : '#d97706' }}>{q.position.toFixed(1)}</td>
                      <td className={styles.auditAcao}>
                        {q.position <= 3 ? 'Manter — use para prospectar UFs com essa demanda' :
                         q.position <= 10 ? 'Otimizar conteúdo para subir ao top 3' :
                         'Criar conteúdo dedicado para entrar na 1ª página'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className={styles.secaoColapsavel}>
        <button className={styles.secaoToggle} onClick={() => toggle('comoUsar')}>
          <span>{abertos.comoUsar ? '▼' : '▶'}</span>
          <span>🔗 Como usar esses dados nos outros módulos</span>
        </button>
        {abertos.comoUsar && (
          <div className={styles.auditDica}>
            <ol>
              <li><strong>Estudo de Mercado:</strong> cadastre as queries não monitoradas como keywords — acompanhe volume e tendência mês a mês</li>
              <li><strong>Hot List:</strong> o scoring de demanda por UF já usa as keywords cadastradas — quanto mais keywords, mais preciso o score</li>
              <li><strong>Conteúdo:</strong> use as keywords sem aparição como pauta — cada blog post ou página nova pode conquistar uma query</li>
              <li><strong>Campanhas:</strong> queries com muitas impressões e posição 10-20 são candidatas a Google Ads enquanto o orgânico sobe</li>
              <li><strong>Prospecção:</strong> queries validadas em ambos indicam UFs com demanda confirmada — priorize esses estados na Hot List</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
