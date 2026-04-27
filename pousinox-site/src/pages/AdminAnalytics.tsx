import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './AdminAnalytics.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/ga4-metrics'

type Serie = { label: string; cor: string; key: 'sessoes' | 'usuarios' | 'pageviews' }
const SERIES: Serie[] = [
  { label: 'Sessões', cor: '#1e3a5f', key: 'sessoes' },
  { label: 'Usuários', cor: '#0ea5e9', key: 'usuarios' },
  { label: 'Pageviews', cor: '#8b5cf6', key: 'pageviews' },
]

function fmtDateLabel(raw: string) {
  // "20260423" → "23/04"
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}`
}

function LineChart({ dados, seriesAtivas }: { dados: GA4Data['diario'] & {}; seriesAtivas: Set<string> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (dados.length < 2) return null
  const W = 700, H = 220, PX = 40, PY = 24, PB = 28
  const chartW = W - PX * 2, chartH = H - PY - PB

  const activeSeries = SERIES.filter(s => seriesAtivas.has(s.key))
  const allVals = dados.flatMap(d => activeSeries.map(s => d[s.key]))
  const maxVal = Math.max(...allVals, 1)
  const minVal = Math.min(...allVals, 0)
  const range = maxVal - minVal || 1

  const xStep = chartW / (dados.length - 1)
  const toY = (v: number) => PY + chartH - ((v - minVal) / range) * chartH
  const toX = (i: number) => PX + i * xStep

  const gridLines = 4
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => minVal + (range / gridLines) * i)
  const tickInterval = Math.max(1, Math.floor(dados.length / 7))

  // Area fill
  const areaPath = (key: 'sessoes' | 'usuarios' | 'pageviews') => {
    const pts = dados.map((d, i) => `${toX(i)},${toY(d[key])}`)
    return `M${pts.join(' L')} L${toX(dados.length - 1)},${PY + chartH} L${toX(0)},${PY + chartH} Z`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', cursor: 'crosshair' }}
      onMouseLeave={() => setHoverIdx(null)}>
      {/* Grid */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PX} x2={W - PX} y1={toY(v)} y2={toY(v)} stroke="#e2e8f0" strokeWidth={0.5} />
          <text x={PX - 6} y={toY(v) + 3} textAnchor="end" fill="#94a3b8" fontSize={9} fontFamily="Inter, sans-serif">
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      {/* X labels */}
      {dados.map((d, i) => i % tickInterval === 0 || i === dados.length - 1 ? (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="Inter, sans-serif">
          {fmtDateLabel(d.data)}
        </text>
      ) : null)}
      {/* Area fills */}
      {activeSeries.map(s => (
        <path key={`area-${s.key}`} d={areaPath(s.key)} fill={s.cor} opacity={0.06} />
      ))}
      {/* Lines */}
      {activeSeries.map(s => {
        const points = dados.map((d, i) => `${toX(i)},${toY(d[s.key])}`).join(' ')
        return (
          <g key={s.key}>
            <polyline fill="none" stroke={s.cor} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" points={points} />
            {dados.length <= 45 && dados.map((d, i) => (
              <circle key={i} cx={toX(i)} cy={toY(d[s.key])} r={hoverIdx === i ? 4 : 2} fill={hoverIdx === i ? s.cor : '#fff'} stroke={s.cor} strokeWidth={1.2} style={{ transition: 'r 0.1s' }} />
            ))}
          </g>
        )
      })}
      {/* Hover zones — invisible rects for each data point */}
      {dados.map((_, i) => (
        <rect key={`hz-${i}`} x={toX(i) - xStep / 2} y={PY} width={xStep} height={chartH} fill="transparent"
          onMouseEnter={() => setHoverIdx(i)} />
      ))}
      {/* Vertical hover line */}
      {hoverIdx !== null && (
        <line x1={toX(hoverIdx)} x2={toX(hoverIdx)} y1={PY} y2={PY + chartH} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,3" />
      )}
      {/* Tooltip */}
      {hoverIdx !== null && (() => {
        const d = dados[hoverIdx]
        const tx = toX(hoverIdx)
        const flip = tx > W * 0.7
        const bx = flip ? tx - 120 : tx + 8
        return (
          <g>
            <rect x={bx} y={PY} width={112} height={14 + activeSeries.length * 15} rx={4} fill="#0f172a" opacity={0.92} />
            <text x={bx + 8} y={PY + 12} fill="#94a3b8" fontSize={8.5} fontFamily="Inter, sans-serif">{fmtDateLabel(d.data)}</text>
            {activeSeries.map((s, si) => (
              <g key={s.key}>
                <circle cx={bx + 10} cy={PY + 24 + si * 15} r={3} fill={s.cor} />
                <text x={bx + 18} y={PY + 27 + si * 15} fill="#fff" fontSize={8.5} fontFamily="Inter, sans-serif">
                  {s.label}: {d[s.key].toLocaleString('pt-BR')}
                </text>
              </g>
            ))}
          </g>
        )
      })()}
    </svg>
  )
}

interface GA4Data {
  ultimos30dias: { sessoes: number; usuarios: number; taxaRejeicao: number; duracaoMedia: number }
  ultimos7dias: { sessoes: number; usuarios: number }
  topPaginas: { titulo: string; visualizacoes: number }[]
  canais: { canal: string; sessoes: number }[]
  cidades: { cidade: string; estado: string; usuarios: number }[]
  estados: { estado: string; usuarios: number }[]
  // Métricas extras (opcionais — Edge Function pode ainda não retornar)
  dispositivos?: { tipo: string; sessoes: number }[]
  novosVsRecorrentes?: { tipo: string; usuarios: number }[]
  pageviews?: number
  conversoes?: { evento: string; total: number }[]
  diario?: { data: string; sessoes: number; usuarios: number; pageviews: number }[]
}

interface GSCData {
  queries: { query: string; cliques: number; impressoes: number; ctr: number; posicao: number }[]
  paginas: { pagina: string; cliques: number; impressoes: number; ctr: number; posicao: number }[]
  oportunidades: { query: string; cliques: number; impressoes: number; ctr: number; posicao: number }[]
}

interface RTData {
  ativos: number
  paginas: { pagina: string; usuarios: number }[]
  dispositivos: { tipo: string; usuarios: number }[]
  cidades: { cidade: string; usuarios: number }[]
}

const canalLabel: Record<string, string> = {
  'Organic Search': 'Busca orgânica',
  'Direct': 'Direto',
  'Referral': 'Referência',
  'Organic Social': 'Redes sociais',
  'Paid Search': 'Busca paga',
  'Email': 'E-mail',
  'Unassigned': 'Não classificado',
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function subtractDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISO(d)
}

const PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

const TABS = ['Estratégia', 'SEO', 'Tempo Real']

export default function AdminAnalytics() {
  const today = toISO(new Date())
  const [aba, setAba] = useState<'Estratégia' | 'SEO' | 'Tempo Real'>('Estratégia')

  // ── Histórico ──
  const [startDate, setStartDate] = useState(subtractDays(30))
  const [endDate, setEndDate] = useState(today)
  const [presetAtivo, setPresetAtivo] = useState(30)
  const [ga4, setGa4] = useState<GA4Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [seriesAtivas, setSeriesAtivas] = useState<Set<string>>(new Set(['sessoes', 'usuarios']))

  // ── SEO (GSC) ──
  const [gsc, setGsc] = useState<GSCData | null>(null)
  const [gscLoading, setGscLoading] = useState(false)
  const [gscErro, setGscErro] = useState('')

  // ── Tempo Real ──
  const [rt, setRt] = useState<RTData | null>(null)
  const [rtLoading, setRtLoading] = useState(false)
  const [rtErro, setRtErro] = useState('')
  const [ultimaAtt, setUltimaAtt] = useState('')
  const rtTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [rtHistorico, setRtHistorico] = useState<{ hora: string; ativos: number }[]>([])
  const rtAnterior = useRef<number | null>(null)

  useEffect(() => { fetchGA4(startDate, endDate) }, [])

  useEffect(() => {
    if (aba === 'Tempo Real') {
      fetchRT()
      rtTimer.current = setInterval(fetchRT, 60000)
    } else if (aba === 'SEO' && !gsc) {
      fetchGSC(startDate, endDate)
    }
    if (aba !== 'Tempo Real' && rtTimer.current) clearInterval(rtTimer.current)
    return () => { if (rtTimer.current) clearInterval(rtTimer.current) }
  }, [aba])

  async function fetchGA4(start: string, end: string) {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`${EDGE_URL}?startDate=${start}&endDate=${end}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      if (!json.ultimos30dias) throw new Error('Resposta inválida da API')
      setGa4(json)
    } catch (e) {
      setErro(String(e))
    }
    setLoading(false)
  }

  async function fetchRT() {
    setRtLoading(true)
    setRtErro('')
    try {
      const res = await fetch(`${EDGE_URL}?realtime=1`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      rtAnterior.current = rt?.ativos ?? null
      setRt(json)
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setRtHistorico(prev => [...prev.slice(-29), { hora, ativos: json.ativos }])
      setUltimaAtt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (e) {
      setRtErro(String(e))
    }
    setRtLoading(false)
  }

  async function fetchGSC(start: string, end: string) {
    setGscLoading(true)
    setGscErro('')
    try {
      const res = await fetch(`${EDGE_URL}?gsc=1&startDate=${start}&endDate=${end}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setGsc(json)
    } catch (e) {
      setGscErro(String(e))
    }
    setGscLoading(false)
  }

  function aplicarPreset(days: number) {
    const start = subtractDays(days)
    setStartDate(start)
    setEndDate(today)
    setPresetAtivo(days)
    fetchGA4(start, today)
  }

  function aplicarDatas() {
    setPresetAtivo(0)
    fetchGA4(startDate, endDate)
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`

  const periodoLabel = presetAtivo
    ? `Últimos ${presetAtivo} dias`
    : `${startDate} → ${endDate}`

  function gerarInsights(d: GA4Data) {
    const ins: { tag: string; classe: string; texto: string }[] = []
    const bounce = d.ultimos30dias.taxaRejeicao * 100
    const dur = d.ultimos30dias.duracaoMedia

    // Taxa de rejeição
    if (bounce > 70) ins.push({ tag: 'alerta', classe: styles.tagAlerta, texto: `Taxa de rejeição alta (${bounce.toFixed(0)}%). Revise as landing pages — conteúdo acima da dobra, CTAs claros e velocidade de carregamento.` })
    else if (bounce > 50) ins.push({ tag: 'cro', classe: styles.tagCro, texto: `Taxa de rejeição em ${bounce.toFixed(0)}%. Teste CTAs mais visíveis e seções de prova social para reduzir.` })
    else ins.push({ tag: 'bom', classe: styles.tagBom, texto: `Taxa de rejeição saudável (${bounce.toFixed(0)}%). Usuários estão engajando com o conteúdo.` })

    // Duração média
    if (dur < 30) ins.push({ tag: 'alerta', classe: styles.tagAlerta, texto: `Duração média muito baixa (${fmtDur(dur)}). Conteúdo pode não estar atendendo a intenção de busca. Revise títulos e H1s.` })
    else if (dur > 120) ins.push({ tag: 'bom', classe: styles.tagBom, texto: `Boa duração média (${fmtDur(dur)}). Usuários estão consumindo conteúdo — considere adicionar CTAs intermediários.` })

    // Sessões por usuário (engajamento)
    const sessUser = d.ultimos30dias.usuarios > 0 ? d.ultimos30dias.sessoes / d.ultimos30dias.usuarios : 0
    if (sessUser < 1.1) ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `Baixa recorrência (${sessUser.toFixed(1)} sessão/usuário). Considere blog, e-mail marketing ou remarketing para trazer visitantes de volta.` })

    // Mobile
    if (d.dispositivos) {
      const totalD = d.dispositivos.reduce((s, x) => s + x.sessoes, 0)
      const mob = d.dispositivos.find(x => x.tipo.toLowerCase() === 'mobile')?.sessoes ?? 0
      const pctMob = totalD > 0 ? (mob / totalD) * 100 : 0
      if (pctMob > 60) ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `${pctMob.toFixed(0)}% do tráfego é mobile. Priorize Core Web Vitals mobile, botões touch-friendly e formulários curtos.` })
      else if (pctMob < 30) ins.push({ tag: 'cro', classe: styles.tagCro, texto: `Apenas ${pctMob.toFixed(0)}% mobile — incomum para B2B industrial. Verifique se o site está indexando bem em mobile (Google Search Console).` })
    }

    // Novos vs recorrentes
    if (d.novosVsRecorrentes) {
      const totalNR = d.novosVsRecorrentes.reduce((s, x) => s + x.usuarios, 0)
      const novos = d.novosVsRecorrentes.find(x => x.tipo === 'new')?.usuarios ?? 0
      const pctNovos = totalNR > 0 ? (novos / totalNR) * 100 : 0
      if (pctNovos > 85) ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `${pctNovos.toFixed(0)}% são novos visitantes — SEO está trazendo descoberta, mas poucos voltam. Invista em remarketing e conteúdo recorrente.` })
      else if (pctNovos < 40) ins.push({ tag: 'cro', classe: styles.tagCro, texto: `Muitos recorrentes (${(100-pctNovos).toFixed(0)}%) — bom engajamento, mas amplie alcance com novas palavras-chave e backlinks.` })
    }

    // Canal dominante
    if (d.canais.length > 0) {
      const totalC = d.canais.reduce((s, x) => s + x.sessoes, 0)
      const top = d.canais[0]
      const pctTop = totalC > 0 ? (top.sessoes / totalC) * 100 : 0
      const direct = d.canais.find(c => c.canal === 'Direct')
      const pctDirect = direct && totalC > 0 ? (direct.sessoes / totalC) * 100 : 0
      if (pctTop > 75) ins.push({ tag: 'alerta', classe: styles.tagAlerta, texto: `${pctTop.toFixed(0)}% do tráfego vem de "${canalLabel[top.canal] ?? top.canal}". Dependência alta — diversifique com outros canais.` })
      if (pctDirect > 50) ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `Tráfego direto alto (${pctDirect.toFixed(0)}%). Pode indicar UTMs faltando — marque links de e-mail, WhatsApp e redes sociais com UTM.` })
      const organic = d.canais.find(c => c.canal === 'Organic Search')
      if (organic && totalC > 0) {
        const pctOrg = (organic.sessoes / totalC) * 100
        if (pctOrg < 20) ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `Busca orgânica representa só ${pctOrg.toFixed(0)}%. Invista em conteúdo de blog, FAQ e páginas de segmento para atrair tráfego SEO.` })
      }
    }

    // Páginas
    if (d.topPaginas.length > 0) {
      const home = d.topPaginas.find(p => p.titulo === '/' || p.titulo.toLowerCase().includes('home') || p.titulo === 'Pousinox')
      const totalVis = d.topPaginas.reduce((s, p) => s + p.visualizacoes, 0)
      if (home && totalVis > 0 && (home.visualizacoes / totalVis) > 0.5) {
        ins.push({ tag: 'seo', classe: styles.tagSeo, texto: `Home concentra ${((home.visualizacoes / totalVis) * 100).toFixed(0)}% das visitas. Crie landing pages específicas por produto/segmento para capturar buscas de cauda longa.` })
      }
    }

    // Conversões
    if (d.conversoes && d.conversoes.length === 0) {
      ins.push({ tag: 'cro', classe: styles.tagCro, texto: `Nenhum evento de conversão registrado. Configure eventos no GTM: cliques em WhatsApp, envios de formulário e cliques em telefone.` })
    }

    return ins
  }

  function calcScore(d: GA4Data, g: GSCData | null) {
    let score = 50 // base
    const bounce = d.ultimos30dias.taxaRejeicao * 100
    const dur = d.ultimos30dias.duracaoMedia
    const sessUser = d.ultimos30dias.usuarios > 0 ? d.ultimos30dias.sessoes / d.ultimos30dias.usuarios : 0

    // Bounce (0-20 pts)
    if (bounce < 20) score += 20
    else if (bounce < 40) score += 15
    else if (bounce < 60) score += 8
    else if (bounce > 70) score -= 10

    // Duração (0-15 pts)
    if (dur > 180) score += 15
    else if (dur > 60) score += 10
    else if (dur > 30) score += 5
    else score -= 5

    // Recorrência (0-10 pts)
    if (sessUser > 1.5) score += 10
    else if (sessUser > 1.2) score += 5

    // Mobile ok (0-5 pts)
    if (d.dispositivos) {
      const totalD = d.dispositivos.reduce((s, x) => s + x.sessoes, 0)
      const mob = d.dispositivos.find(x => x.tipo.toLowerCase() === 'mobile')?.sessoes ?? 0
      if (totalD > 0 && (mob / totalD) > 0.3 && (mob / totalD) < 0.8) score += 5
    }

    // SEO presence (0-10 pts)
    if (g && g.queries.length > 0) {
      const avgPos = g.queries.reduce((s, q) => s + q.posicao * q.impressoes, 0) / Math.max(g.queries.reduce((s, q) => s + q.impressoes, 0), 1)
      if (avgPos <= 5) score += 10
      else if (avgPos <= 10) score += 6
      else if (avgPos <= 20) score += 3
    }

    // Conversions (0-5 pts)
    if (d.conversoes && d.conversoes.length > 0) {
      const totalConv = d.conversoes.reduce((s, c) => s + c.total, 0)
      if (totalConv > 10) score += 5
      else if (totalConv > 0) score += 2
    }

    return Math.max(0, Math.min(100, score))
  }

  type DiagItem = { kpi: string; valor: string; status: 'verde' | 'amarelo' | 'vermelho'; explicacao: string }

  function diagnosticar(d: GA4Data, g: GSCData | null): DiagItem[] {
    const diag: DiagItem[] = []
    const bounce = d.ultimos30dias.taxaRejeicao * 100
    const dur = d.ultimos30dias.duracaoMedia

    diag.push({
      kpi: 'Sessões',
      valor: d.ultimos30dias.sessoes.toLocaleString('pt-BR'),
      status: d.ultimos30dias.sessoes > 100 ? 'verde' : d.ultimos30dias.sessoes > 30 ? 'amarelo' : 'vermelho',
      explicacao: d.ultimos30dias.sessoes > 100
        ? 'Volume saudável de visitas para o segmento.'
        : 'Volume baixo — invista em SEO, Google Ads ou redes sociais para atrair mais tráfego.',
    })

    diag.push({
      kpi: 'Taxa de Rejeição',
      valor: `${bounce.toFixed(1)}%`,
      status: bounce < 30 ? 'verde' : bounce < 60 ? 'amarelo' : 'vermelho',
      explicacao: bounce < 30
        ? 'Excelente — visitantes estão interagindo com o conteúdo.'
        : bounce < 60
        ? 'Moderada — teste CTAs mais visíveis e conteúdo acima da dobra.'
        : 'Alta — conteúdo pode não atender a intenção de busca. Revise landing pages.',
    })

    diag.push({
      kpi: 'Duração Média',
      valor: fmtDur(dur),
      status: dur > 120 ? 'verde' : dur > 30 ? 'amarelo' : 'vermelho',
      explicacao: dur > 120
        ? 'Ótimo engajamento. Considere CTAs intermediários para converter.'
        : dur > 30
        ? 'Razoável — conteúdo pode ser mais aprofundado ou visual.'
        : 'Muito baixa — visitantes saem rápido. Revise títulos e primeiro parágrafo.',
    })

    const sessUser = d.ultimos30dias.usuarios > 0 ? d.ultimos30dias.sessoes / d.ultimos30dias.usuarios : 0
    diag.push({
      kpi: 'Recorrência',
      valor: `${sessUser.toFixed(1)}x`,
      status: sessUser > 1.5 ? 'verde' : sessUser > 1.1 ? 'amarelo' : 'vermelho',
      explicacao: sessUser > 1.5
        ? 'Visitantes estão voltando — bom sinal de conteúdo relevante.'
        : 'Poucos retornos. Considere e-mail marketing, remarketing ou blog.',
    })

    if (d.dispositivos) {
      const totalD = d.dispositivos.reduce((s, x) => s + x.sessoes, 0)
      const mob = d.dispositivos.find(x => x.tipo.toLowerCase() === 'mobile')?.sessoes ?? 0
      const pctMob = totalD > 0 ? (mob / totalD) * 100 : 0
      diag.push({
        kpi: 'Mobile',
        valor: `${pctMob.toFixed(0)}%`,
        status: pctMob > 30 && pctMob < 80 ? 'verde' : 'amarelo',
        explicacao: pctMob > 60
          ? `${pctMob.toFixed(0)}% mobile — priorize Core Web Vitals e UX mobile.`
          : pctMob < 30
          ? 'Tráfego mobile baixo — verifique indexação mobile no Search Console.'
          : 'Distribuição equilibrada entre mobile e desktop.',
      })
    }

    if (g && g.queries.length > 0) {
      const avgPos = g.queries.reduce((s, q) => s + q.posicao * q.impressoes, 0) / Math.max(g.queries.reduce((s, q) => s + q.impressoes, 0), 1)
      diag.push({
        kpi: 'Posição Google',
        valor: avgPos.toFixed(1),
        status: avgPos <= 5 ? 'verde' : avgPos <= 15 ? 'amarelo' : 'vermelho',
        explicacao: avgPos <= 5
          ? 'Boa visibilidade no Google — foque em manter e expandir para novos termos.'
          : avgPos <= 15
          ? 'Na margem da 1ª página. Otimize titles e meta descriptions.'
          : 'Posição baixa — crie conteúdo dedicado para os termos mais buscados.',
      })

      const totI = g.queries.reduce((s, q) => s + q.impressoes, 0)
      const totC = g.queries.reduce((s, q) => s + q.cliques, 0)
      const ctr = totI > 0 ? (totC / totI) * 100 : 0
      diag.push({
        kpi: 'CTR Google',
        valor: `${ctr.toFixed(1)}%`,
        status: ctr > 5 ? 'verde' : ctr > 2 ? 'amarelo' : 'vermelho',
        explicacao: ctr > 5
          ? 'CTR saudável — títulos e descriptions estão atraindo cliques.'
          : 'CTR baixo — reescreva title tags e meta descriptions para serem mais atrativos.',
      })
    }

    if (d.conversoes) {
      const totalConv = d.conversoes.reduce((s, c) => s + c.total, 0)
      diag.push({
        kpi: 'Conversões',
        valor: totalConv.toLocaleString('pt-BR'),
        status: totalConv > 10 ? 'verde' : totalConv > 0 ? 'amarelo' : 'vermelho',
        explicacao: totalConv > 10
          ? 'Bom volume de conversões.'
          : totalConv > 0
          ? 'Poucas conversões — revise CTAs e formulário.'
          : 'Nenhuma conversão. Configure eventos no GTM: WhatsApp, formulários, telefone.',
      })
    }

    return diag
  }

  type AcaoItem = { prioridade: number; titulo: string; descricao: string; modulo: string; link: string }

  function gerarAcoes(d: GA4Data, g: GSCData | null): AcaoItem[] {
    const acoes: AcaoItem[] = []
    const bounce = d.ultimos30dias.taxaRejeicao * 100
    const dur = d.ultimos30dias.duracaoMedia

    // Conversões ausentes = prioridade máxima
    if (!d.conversoes || d.conversoes.length === 0) {
      acoes.push({ prioridade: 10, titulo: 'Configurar eventos de conversão', descricao: 'Sem eventos configurados. Adicione tracking de cliques em WhatsApp, envios de formulário e cliques em telefone via GTM.', modulo: 'GTM', link: '' })
    }

    // SEO fraco
    if (g) {
      const orgPct = d.canais.find(c => c.canal === 'Organic Search')
      const totalC = d.canais.reduce((s, x) => s + x.sessoes, 0)
      if (orgPct && totalC > 0 && (orgPct.sessoes / totalC) < 0.25) {
        acoes.push({ prioridade: 9, titulo: 'Aumentar tráfego orgânico', descricao: `Busca orgânica é só ${((orgPct.sessoes / totalC) * 100).toFixed(0)}% do tráfego. Crie artigos de blog e landing pages para termos de busca.`, modulo: 'Conteúdo', link: '/admin/conteudo' })
      }
      if (g.oportunidades.length > 0) {
        acoes.push({ prioridade: 8, titulo: `Otimizar ${g.oportunidades.length} termos posição 5-20`, descricao: `Você já aparece para "${g.oportunidades[0].query}" (pos. ${g.oportunidades[0].posicao.toFixed(0)}). Otimize title/meta ou crie conteúdo dedicado para subir.`, modulo: 'SEO', link: '' })
      }
    }

    // Bounce alto
    if (bounce > 50) {
      acoes.push({ prioridade: 7, titulo: 'Reduzir taxa de rejeição', descricao: 'Revise o conteúdo acima da dobra nas landing pages. Teste CTAs mais claros, prova social e velocidade de carregamento.', modulo: 'CRO', link: '' })
    }

    // Conteúdo
    if (d.topPaginas.length > 0) {
      const totalVis = d.topPaginas.reduce((s, p) => s + p.visualizacoes, 0)
      const homePct = d.topPaginas[0] ? (d.topPaginas[0].visualizacoes / totalVis) * 100 : 0
      if (homePct > 50) {
        acoes.push({ prioridade: 7, titulo: 'Criar landing pages por segmento', descricao: `Home concentra ${homePct.toFixed(0)}% do tráfego. Crie páginas específicas por segmento/produto para capturar buscas de cauda longa.`, modulo: 'Conteúdo', link: '/admin/conteudo' })
      }
    }

    // Duração baixa
    if (dur < 60) {
      acoes.push({ prioridade: 6, titulo: 'Melhorar engajamento do conteúdo', descricao: 'Duração média baixa. Adicione vídeos, tabelas comparativas, cases de sucesso e FAQ nas páginas principais.', modulo: 'Conteúdo', link: '/admin/conteudo' })
    }

    // Recorrência
    const sessUser = d.ultimos30dias.usuarios > 0 ? d.ultimos30dias.sessoes / d.ultimos30dias.usuarios : 0
    if (sessUser < 1.2) {
      acoes.push({ prioridade: 5, titulo: 'Estratégia de retorno', descricao: 'Visitantes não voltam. Considere blog com conteúdo recorrente, e-mail marketing ou remarketing no Google Ads.', modulo: 'Marketing', link: '/admin/campanhas' })
    }

    // Estudo de mercado
    acoes.push({ prioridade: 4, titulo: 'Revisar oportunidades de mercado', descricao: 'Cruze dados do Search Console com o Estudo de Mercado para identificar UFs e segmentos com demanda não atendida.', modulo: 'Estudo de Mercado', link: '/admin/estudo-mercado' })

    return acoes.sort((a, b) => b.prioridade - a.prioridade)
  }

  const gerarAnalise = useCallback(async () => {
    if (!ga4) return 'Sem dados GA4 carregados.'
    const topPages = ga4.topPaginas?.slice(0, 10).map(p => `${p.titulo}: ${p.visualizacoes} views`).join('\n') || 'N/D'
    const canais = ga4.canais?.map(c => `${c.canal}: ${c.sessoes} sessões`).join(', ') || 'N/D'
    const cidades = ga4.cidades?.slice(0, 5).map(c => `${c.cidade}/${c.estado}: ${c.usuarios}`).join(', ') || 'N/D'
    const gscInfo = gsc ? `\nSEO (GSC): ${gsc.queries?.length || 0} queries, top: ${gsc.queries?.slice(0, 5).map(q => `"${q.query}" (${q.cliques} clicks)`).join(', ') || 'N/D'}` : ''
    const d = ga4.ultimos30dias
    const prompt = `Dados do Google Analytics do site pousinox.com.br (${startDate} a ${endDate}):
- Sessões: ${d.sessoes} | Usuários: ${d.usuarios} | Pageviews: ${ga4.pageviews || 'N/D'}
- Taxa rejeição: ${(d.taxaRejeicao * 100).toFixed(1)}%
- Duração média: ${d.duracaoMedia.toFixed(0)}s
- Canais: ${canais}
- Top cidades: ${cidades}
- Top páginas:\n${topPages}${gscInfo}

Gere: 1) Diagnóstico de performance (2-3 linhas) 2) 3 pontos fortes 3) 3 problemas/oportunidades 4) 5 ações concretas priorizadas para melhorar tráfego e conversões`
    const r = await aiChat({ prompt, system: 'Especialista em analytics e SEO para indústria B2B. Site de fabricante de fixadores de porcelanato inox. Responda direto, acionável. Português brasileiro.', model: 'groq' })
    return r.error ? `Erro: ${r.error}` : r.content
  }, [ga4, gsc, startDate, endDate])

  return (
    <div className={styles.wrap}>

      {/* ── Abas ── */}
      <div className={styles.tabBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${aba === t ? styles.tabAtivo : ''}`}
            onClick={() => setAba(t as typeof aba)}
          >
            {t === 'Tempo Real' && <span className={styles.dotVerde} />}
            {t}
          </button>
        ))}
        </div>
        <AiActionButton label="Análise IA" icon="📊" action={gerarAnalise} modelName="Groq" />
      </div>

      {/* ══════════════ ESTRATÉGIA ══════════════ */}
      {aba === 'Estratégia' && (
        <>
          {loading ? (
            <div className={styles.loading}>Carregando dados…</div>
          ) : erro ? (
            <div className={styles.erroBox}>Erro: {erro}</div>
          ) : ga4 ? (
            <>
              {/* Score geral */}
              {(() => {
                const score = calcScore(ga4, gsc)
                const cor = score >= 70 ? '#166534' : score >= 45 ? '#92400e' : '#dc2626'
                const bg = score >= 70 ? '#dcfce7' : score >= 45 ? '#fef3c7' : '#fee2e2'
                const label = score >= 70 ? 'Bom' : score >= 45 ? 'Regular' : 'Precisa atenção'
                return (
                  <div className={styles.scoreBox}>
                    <div className={styles.scoreRing} style={{ borderColor: cor }}>
                      <span className={styles.scoreNum} style={{ color: cor }}>{score}</span>
                      <span className={styles.scoreOf}>/100</span>
                    </div>
                    <div className={styles.scoreInfo}>
                      <span className={styles.scoreLabel} style={{ background: bg, color: cor }}>{label}</span>
                      <span className={styles.scoreDesc}>
                        Score calculado com base em taxa de rejeição, duração, recorrência, mobile, SEO e conversões.
                        {!gsc && <button className={styles.scoreLinkBtn} onClick={() => { setAba('SEO') }}>Carregue a aba SEO para melhorar a precisão</button>}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Gráfico interativo */}
              {ga4.diario && ga4.diario.length >= 2 && (
                <div className={styles.chartBox}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.boxTitle} style={{ margin: 0 }}>Evolução diária</h3>
                    <div className={styles.chartToggles}>
                      {SERIES.map(s => (
                        <button
                          key={s.key}
                          className={`${styles.chartToggle} ${seriesAtivas.has(s.key) ? styles.chartToggleAtivo : ''}`}
                          style={seriesAtivas.has(s.key) ? { borderColor: s.cor, color: s.cor } : undefined}
                          onClick={() => setSeriesAtivas(prev => {
                            const next = new Set(prev)
                            if (next.has(s.key)) { if (next.size > 1) next.delete(s.key) }
                            else next.add(s.key)
                            return next
                          })}
                        >
                          <span className={styles.chartDot} style={{ background: seriesAtivas.has(s.key) ? s.cor : '#cbd5e1' }} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LineChart dados={ga4.diario} seriesAtivas={seriesAtivas} />
                </div>
              )}

              {/* Diagnóstico dos KPIs */}
              <div className={styles.box}>
                <h3 className={styles.boxTitle}>Diagnóstico</h3>
                <div className={styles.diagGrid}>
                  {diagnosticar(ga4, gsc).map((item, i) => (
                    <div key={i} className={styles.diagCard}>
                      <div className={styles.diagHeader}>
                        <span className={`${styles.diagDot} ${styles[`dot_${item.status}`]}`} />
                        <span className={styles.diagKpi}>{item.kpi}</span>
                        <strong className={styles.diagValor}>{item.valor}</strong>
                      </div>
                      <p className={styles.diagExpl}>{item.explicacao}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plano de ação priorizado */}
              <div className={styles.box}>
                <h3 className={styles.boxTitle}>Plano de ação — por prioridade</h3>
                {gerarAcoes(ga4, gsc).map((acao, i) => (
                  <div key={i} className={styles.acaoItem}>
                    <span className={styles.acaoPrioridade}>{i + 1}</span>
                    <div className={styles.acaoBody}>
                      <div className={styles.acaoTopo}>
                        <strong className={styles.acaoTitulo}>{acao.titulo}</strong>
                        <span className={styles.acaoModulo}>{acao.modulo}</span>
                      </div>
                      <p className={styles.acaoDesc}>{acao.descricao}</p>
                      {acao.link && (
                        <a href={acao.link} className={styles.acaoLink}>Ir para {acao.modulo} →</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Insights detalhados */}
              {(() => {
                const insights = gerarInsights(ga4)
                return insights.length > 0 ? (
                  <div className={styles.insightsBox}>
                    <h3 className={styles.insightsTitle}>Insights detalhados</h3>
                    {insights.map((ins, i) => (
                      <div key={i} className={styles.insightItem}>
                        <span className={`${styles.insightTag} ${ins.classe}`}>{ins.tag}</span>
                        <span>{ins.texto}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}

              {/* Dados detalhados */}
              <div className={styles.filtroBar}>
                <div className={styles.presets}>
                  {PRESETS.map(p => (
                    <button key={p.days} className={`${styles.presetBtn} ${presetAtivo === p.days ? styles.presetBtnAtivo : ''}`}
                      onClick={() => aplicarPreset(p.days)}>{p.label}</button>
                  ))}
                </div>
                <div className={styles.dataPicker}>
                  <input type="date" value={startDate} max={endDate} onChange={e => { setStartDate(e.target.value); setPresetAtivo(0) }} className={styles.dateInput} />
                  <span className={styles.dataSep}>até</span>
                  <input type="date" value={endDate} min={startDate} max={today} onChange={e => { setEndDate(e.target.value); setPresetAtivo(0) }} className={styles.dateInput} />
                  <button className={styles.aplicarBtn} onClick={aplicarDatas}>Aplicar</button>
                </div>
              </div>

              <div className={styles.sectionLabel}>{periodoLabel}</div>

              <div className={styles.cards}>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>👥</span>
                  <strong className={styles.cardValue}>{ga4.ultimos30dias.sessoes.toLocaleString('pt-BR')}</strong>
                  <span className={styles.cardLabel}>Sessões</span>
                </div>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>👤</span>
                  <strong className={styles.cardValue}>{ga4.ultimos30dias.usuarios.toLocaleString('pt-BR')}</strong>
                  <span className={styles.cardLabel}>Usuários</span>
                </div>
                {ga4.pageviews != null && (
                  <div className={styles.card}>
                    <span className={styles.cardIcon}>📄</span>
                    <strong className={styles.cardValue}>{ga4.pageviews.toLocaleString('pt-BR')}</strong>
                    <span className={styles.cardLabel}>Pageviews</span>
                  </div>
                )}
                <div className={styles.card}>
                  <span className={styles.cardIcon}>↩️</span>
                  <strong className={styles.cardValue}>{(ga4.ultimos30dias.taxaRejeicao * 100).toFixed(1)}%</strong>
                  <span className={styles.cardLabel}>Rejeição</span>
                </div>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>⏱</span>
                  <strong className={styles.cardValue}>{fmtDur(ga4.ultimos30dias.duracaoMedia)}</strong>
                  <span className={styles.cardLabel}>Duração</span>
                </div>
                {ga4.novosVsRecorrentes && (() => {
                  const totalNR = ga4.novosVsRecorrentes!.reduce((s, x) => s + x.usuarios, 0)
                  const novos = ga4.novosVsRecorrentes!.find(x => x.tipo === 'new')?.usuarios ?? 0
                  const pctNovos = totalNR > 0 ? Math.round((novos / totalNR) * 100) : 0
                  return <div className={styles.card}><span className={styles.cardIcon}>🆕</span><strong className={styles.cardValue}>{pctNovos}%</strong><span className={styles.cardLabel}>Novos</span></div>
                })()}
                {ga4.dispositivos && (() => {
                  const totalDisp = ga4.dispositivos!.reduce((s, x) => s + x.sessoes, 0)
                  const mobile = ga4.dispositivos!.find(x => x.tipo.toLowerCase() === 'mobile')?.sessoes ?? 0
                  const pctMobile = totalDisp > 0 ? Math.round((mobile / totalDisp) * 100) : 0
                  return <div className={styles.card}><span className={styles.cardIcon}>📱</span><strong className={styles.cardValue}>{pctMobile}%</strong><span className={styles.cardLabel}>Mobile</span></div>
                })()}
                {ga4.conversoes?.map((ev, i) => (
                  <div key={i} className={styles.card}><span className={styles.cardIcon}>🎯</span><strong className={styles.cardValue}>{ev.total.toLocaleString('pt-BR')}</strong><span className={styles.cardLabel}>{ev.evento}</span></div>
                ))}
              </div>

              <div className={styles.grid3}>
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Páginas mais visitadas</h3>
                  {ga4.topPaginas.length === 0 ? <p className={styles.vazio}>Aguardando dados…</p> : ga4.topPaginas.map((p, i) => (
                    <div key={i} className={styles.rankItem}><span className={styles.rankPos}>{i + 1}</span><span className={styles.rankLabel}>{p.titulo.replace(' | POUSINOX®', '').replace('Pousinox — ', '')}</span><span className={styles.rankVal}>{p.visualizacoes.toLocaleString('pt-BR')}</span></div>
                  ))}
                </div>
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Origem do tráfego</h3>
                  {(() => { const total = ga4.canais.reduce((s, x) => s + x.sessoes, 0); return ga4.canais.length === 0 ? <p className={styles.vazio}>Aguardando dados…</p> : ga4.canais.map((c, i) => { const pct = total > 0 ? Math.round((c.sessoes / total) * 100) : 0; return (
                    <div key={i} className={styles.barItem}><span className={styles.barLabel}>{canalLabel[c.canal] ?? c.canal}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div><span className={styles.barPct}>{pct}%</span><span className={styles.barNum}>{c.sessoes}</span></div>
                  )}) })()}
                </div>
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Top cidades</h3>
                  {(() => { const total = ga4.cidades.reduce((s, x) => s + x.usuarios, 0); return ga4.cidades.length === 0 ? <p className={styles.vazio}>Aguardando dados…</p> : ga4.cidades.map((c, i) => { const pct = total > 0 ? Math.round((c.usuarios / total) * 100) : 0; return (
                    <div key={i} className={styles.barItem}><span className={styles.barLabel}>{c.cidade} <small style={{ opacity: 0.6 }}>{c.estado}</small></span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div><span className={styles.barPct}>{pct}%</span><span className={styles.barNum}>{c.usuarios}</span></div>
                  )}) })()}
                </div>
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Top estados</h3>
                  {(() => { const total = ga4.estados.reduce((s, x) => s + x.usuarios, 0); return ga4.estados.length === 0 ? <p className={styles.vazio}>Aguardando dados…</p> : ga4.estados.map((e, i) => { const pct = total > 0 ? Math.round((e.usuarios / total) * 100) : 0; return (
                    <div key={i} className={styles.barItem}><span className={styles.barLabel}>{e.estado}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div><span className={styles.barPct}>{pct}%</span><span className={styles.barNum}>{e.usuarios}</span></div>
                  )}) })()}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* ══════════════ SEO ══════════════ */}
      {aba === 'SEO' && (
        <>
          <div className={styles.filtroBar}>
            <div className={styles.presets}>
              {PRESETS.map(p => (
                <button
                  key={p.days}
                  className={`${styles.presetBtn} ${presetAtivo === p.days ? styles.presetBtnAtivo : ''}`}
                  onClick={() => { aplicarPreset(p.days); fetchGSC(subtractDays(p.days), today) }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className={styles.dataPicker}>
              <input type="date" value={startDate} max={endDate} onChange={e => { setStartDate(e.target.value); setPresetAtivo(0) }} className={styles.dateInput} />
              <span className={styles.dataSep}>até</span>
              <input type="date" value={endDate} min={startDate} max={today} onChange={e => { setEndDate(e.target.value); setPresetAtivo(0) }} className={styles.dateInput} />
              <button className={styles.aplicarBtn} onClick={() => { setPresetAtivo(0); fetchGSC(startDate, endDate) }}>Aplicar</button>
            </div>
          </div>

          {gscLoading ? (
            <div className={styles.loading}>Carregando dados do Search Console…</div>
          ) : gscErro ? (
            <div className={styles.erroBox}>
              Erro: {gscErro}
              <button onClick={() => fetchGSC(startDate, endDate)} className={styles.retryBtn}>Tentar novamente</button>
            </div>
          ) : gsc ? (
            <>
              {/* KPIs resumo */}
              <div className={styles.cards}>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>🔍</span>
                  <strong className={styles.cardValue}>{gsc.queries.reduce((s, q) => s + q.impressoes, 0).toLocaleString('pt-BR')}</strong>
                  <span className={styles.cardLabel}>Impressões</span>
                </div>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>👆</span>
                  <strong className={styles.cardValue}>{gsc.queries.reduce((s, q) => s + q.cliques, 0).toLocaleString('pt-BR')}</strong>
                  <span className={styles.cardLabel}>Cliques orgânicos</span>
                </div>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>📊</span>
                  <strong className={styles.cardValue}>
                    {(() => {
                      const totI = gsc.queries.reduce((s, q) => s + q.impressoes, 0)
                      const totC = gsc.queries.reduce((s, q) => s + q.cliques, 0)
                      return totI > 0 ? `${((totC / totI) * 100).toFixed(1)}%` : '—'
                    })()}
                  </strong>
                  <span className={styles.cardLabel}>CTR médio</span>
                </div>
                <div className={styles.card}>
                  <span className={styles.cardIcon}>📍</span>
                  <strong className={styles.cardValue}>
                    {gsc.queries.length > 0
                      ? (gsc.queries.reduce((s, q) => s + q.posicao * q.impressoes, 0) / gsc.queries.reduce((s, q) => s + q.impressoes, 0)).toFixed(1)
                      : '—'}
                  </strong>
                  <span className={styles.cardLabel}>Posição média</span>
                </div>
              </div>

              <div className={styles.grid3}>
                {/* Top queries */}
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Palavras-chave</h3>
                  {gsc.queries.length === 0 ? (
                    <p className={styles.vazio}>Sem dados no período</p>
                  ) : (
                    <table className={styles.seoTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Termo</th>
                          <th>Cliques</th>
                          <th>Impr.</th>
                          <th>CTR</th>
                          <th>Pos.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gsc.queries.map((q, i) => (
                          <tr key={i}>
                            <td className={styles.seoQuery}>{q.query}</td>
                            <td className={styles.seoNum}>{q.cliques}</td>
                            <td className={styles.seoNum}>{q.impressoes}</td>
                            <td className={styles.seoNum}>{(q.ctr * 100).toFixed(1)}%</td>
                            <td className={styles.seoNum}>
                              <span className={q.posicao <= 3 ? styles.posGood : q.posicao <= 10 ? styles.posOk : styles.posBad}>
                                {q.posicao.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Páginas */}
                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Páginas no Google</h3>
                  {gsc.paginas.length === 0 ? (
                    <p className={styles.vazio}>Sem dados no período</p>
                  ) : (
                    <table className={styles.seoTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Página</th>
                          <th>Cliques</th>
                          <th>Impr.</th>
                          <th>CTR</th>
                          <th>Pos.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gsc.paginas.map((p, i) => (
                          <tr key={i}>
                            <td className={styles.seoQuery}>{p.pagina || '/'}</td>
                            <td className={styles.seoNum}>{p.cliques}</td>
                            <td className={styles.seoNum}>{p.impressoes}</td>
                            <td className={styles.seoNum}>{(p.ctr * 100).toFixed(1)}%</td>
                            <td className={styles.seoNum}>
                              <span className={p.posicao <= 3 ? styles.posGood : p.posicao <= 10 ? styles.posOk : styles.posBad}>
                                {p.posicao.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Oportunidades */}
              {gsc.oportunidades.length > 0 && (
                <div className={styles.insightsBox}>
                  <h3 className={styles.insightsTitle}>Oportunidades SEO — posição 5 a 20</h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 12px' }}>
                    Termos onde você já aparece mas pode subir com otimização de conteúdo, título e meta description.
                  </p>
                  <table className={styles.seoTable}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Termo</th>
                        <th>Impr.</th>
                        <th>Pos. atual</th>
                        <th>Ação sugerida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gsc.oportunidades.map((q, i) => (
                        <tr key={i}>
                          <td className={styles.seoQuery}>{q.query}</td>
                          <td className={styles.seoNum}>{q.impressoes}</td>
                          <td className={styles.seoNum}>
                            <span className={styles.posOk}>{q.posicao.toFixed(1)}</span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {q.posicao <= 10
                              ? 'Otimizar title/meta para aumentar CTR'
                              : 'Criar/expandir conteúdo sobre o tema'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {/* ══════════════ TEMPO REAL ══════════════ */}
      {aba === 'Tempo Real' && (
        <>
          <div className={styles.rtHeader}>
            <span className={styles.dotVerde} />
            <span className={styles.rtInfo}>Últimos 30 minutos · atualiza a cada 60s</span>
            <span className={styles.rtAtt}>{ultimaAtt ? `${ultimaAtt}` : ''}</span>
            <button className={styles.aplicarBtn} onClick={fetchRT} disabled={rtLoading}>
              {rtLoading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>

          {rtLoading && !rt ? (
            <div className={styles.loading}>Carregando tempo real…</div>
          ) : rtErro ? (
            <div className={styles.erroBox}>
              Erro: {rtErro}
              <button onClick={fetchRT} className={styles.retryBtn}>Tentar novamente</button>
            </div>
          ) : rt ? (
            <>
              {/* Usuários ativos + tendência */}
              <div className={styles.rtDestaque}>
                <span className={styles.rtDestaqueNum}>
                  {rt.ativos}
                  {rtAnterior.current !== null && rt.ativos !== rtAnterior.current && (
                    <span className={styles.rtTrend} style={{ color: rt.ativos > rtAnterior.current ? '#4ade80' : '#fbbf24' }}>
                      {rt.ativos > rtAnterior.current ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </span>
                <span className={styles.rtDestaqueLabel}>usuários ativos agora</span>

                {/* Sparkline */}
                {rtHistorico.length >= 2 && (
                  <svg viewBox="0 0 200 40" className={styles.sparkline}>
                    {(() => {
                      const maxH = Math.max(...rtHistorico.map(h => h.ativos), 1)
                      const step = 200 / (rtHistorico.length - 1)
                      const pts = rtHistorico.map((h, i) => `${i * step},${40 - (h.ativos / maxH) * 36}`).join(' ')
                      const areaPts = `0,40 ${pts} ${(rtHistorico.length - 1) * step},40`
                      return (
                        <>
                          <polyline fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} strokeLinejoin="round" points={pts} />
                          <polygon fill="rgba(255,255,255,0.1)" points={areaPts} />
                          <circle cx={(rtHistorico.length - 1) * step} cy={40 - (rtHistorico[rtHistorico.length - 1].ativos / maxH) * 36} r={3} fill="#fff" />
                        </>
                      )
                    })()}
                  </svg>
                )}
                {rtHistorico.length >= 2 && (
                  <span className={styles.rtSparkLabel}>
                    Pico: {Math.max(...rtHistorico.map(h => h.ativos))} · Mín: {Math.min(...rtHistorico.map(h => h.ativos))}
                  </span>
                )}
              </div>

              <div className={styles.grid3} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Páginas ativas</h3>
                  {rt.paginas.length === 0 ? (
                    <p className={styles.vazio}>Nenhum usuário ativo</p>
                  ) : rt.paginas.map((p, i) => (
                    <div key={i} className={styles.rankItem}>
                      <span className={styles.rankPos}>{i + 1}</span>
                      <span className={styles.rankLabel}>{p.pagina.replace(' | POUSINOX®', '').replace('Pousinox — ', '')}</span>
                      <span className={styles.rankVal}>{p.usuarios}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Dispositivos</h3>
                  {rt.dispositivos.length === 0 ? (
                    <p className={styles.vazio}>Nenhum usuário ativo</p>
                  ) : (() => {
                    const total = rt.dispositivos.reduce((s, x) => s + x.usuarios, 0)
                    return rt.dispositivos.map((d, i) => {
                      const pct = total > 0 ? Math.round((d.usuarios / total) * 100) : 0
                      return (
                        <div key={i} className={styles.barItem}>
                          <span className={styles.barLabel}>{d.tipo}</span>
                          <div className={styles.barTrack}>
                            <div className={styles.barFill} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={styles.barPct}>{pct}%</span>
                          <span className={styles.barNum}>{d.usuarios}</span>
                        </div>
                      )
                    })
                  })()}
                </div>

                <div className={styles.box}>
                  <h3 className={styles.boxTitle}>Cidades ativas</h3>
                  {rt.cidades.length === 0 ? (
                    <p className={styles.vazio}>Nenhum usuário ativo</p>
                  ) : rt.cidades.map((c, i) => (
                    <div key={i} className={styles.rankItem}>
                      <span className={styles.rankPos}>{i + 1}</span>
                      <span className={styles.rankLabel}>{c.cidade}</span>
                      <span className={styles.rankVal}>{c.usuarios}</span>
                    </div>
                  ))}
                </div>

              </div>
            </>
          ) : null}
        </>
      )}

    </div>
  )
}
