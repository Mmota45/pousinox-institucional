import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabaseAdmin } from '../lib/supabase'
import { getModelSkill, getModelInfo } from '../lib/modelInfo'
import { aiParallel, type MultiTarget, type MultiResult } from '../lib/aiHelper'
import ModelMonitor from '../components/ia/ModelMonitor'
import styles from './AdminIA.module.css'

// ── Providers e modelos ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, { label: string; modelos: { id: string; label: string }[] }> = {
  groq: {
    label: '⚡ Groq',
    modelos: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B' },
      { id: 'qwen-qwq-32b', label: 'Qwen QwQ 32B' },
      { id: 'mistral-saba-24b', label: 'Mistral Saba 24B' },
    ],
  },
  gemini: {
    label: '💎 Gemini',
    modelos: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ],
  },
  cohere: {
    label: '🧠 Cohere',
    modelos: [
      { id: 'command-a-03-2025', label: 'Command A' },
      { id: 'command-r7b-12-2024', label: 'Command R7B' },
    ],
  },
  huggingface: {
    label: '🤗 HuggingFace',
    modelos: [
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B' },
      { id: 'microsoft/Phi-3-mini-4k-instruct', label: 'Phi-3 Mini' },
    ],
  },
  together: {
    label: '🤝 Together',
    modelos: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B Turbo' },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', label: 'DeepSeek R1 70B' },
      { id: 'meta-llama/Llama-3.1-405B-Instruct-Turbo', label: 'Llama 405B Turbo' },
    ],
  },
  cloudflare: {
    label: '☁️ Cloudflare',
    modelos: [
      { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
      { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 32B' },
      { id: '@cf/qwen/qwen2.5-coder-32b-instruct', label: 'Qwen Coder 32B' },
    ],
  },
  openrouter: {
    label: '🔀 OpenRouter',
    modelos: [
      { id: 'qwen/qwen3-coder-480b:free', label: 'Qwen3 Coder 480B' },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1' },
      { id: 'google/gemini-2.5-flash-exp:free', label: 'Gemini 2.5 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', label: 'Nemotron 70B' },
      { id: 'mistralai/devstral-small:free', label: 'Devstral Small' },
    ],
  },
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  provider?: string
  model?: string
  tempo?: number
  erro?: boolean
  webSearch?: boolean
  dbSearch?: boolean
}

const SEARCH_SOURCES = [
  { id: 'auto', label: '🔍 Auto' },
  { id: 'brave', label: '🦁 Brave' },
  { id: 'serper', label: '🔎 Google' },
  { id: 'none', label: '❌ Sem busca' },
] as const

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const EDGE_URL = `${SUPABASE_URL}/functions/v1/ai-hub`

// ── Roteador inteligente ─────────────────────────────────────────────────────

// Transforma URLs soltas em links markdown antes de renderizar
function autoLinkify(text: string): string {
  // Processa linha por linha para evitar mexer em links markdown existentes
  return text.split('\n').map(line => {
    // Pula linhas que já têm links markdown
    if (line.includes('](')) return line
    // Detecta URLs e domínios
    return line.replace(
      /(https?:\/\/[^\s)<>]+|www\.[^\s)<>]+|[\w][\w.-]*\.(?:com\.br|gov\.br|org\.br|com|net|org|io)(?:\/[^\s)<>]*)?)/gi,
      function(m) {
        var clean = m.replace(/[.,;:!?)]+$/, '')
        var href = clean.match(/^https?:\/\//) ? clean : 'https://' + clean
        return '[' + clean + '](' + href + ')'
      }
    )
  }).join('\n')
}

function escolherProviderModelo(texto: string): { provider: string; modelo: string; motivo: string } {
  const t = texto.toLowerCase()

  // Código, programação, técnico → Qwen3 Coder (melhor free p/ código)
  if (/\b(código|code|programa|function|sql|api|bug|html|css|javascript|typescript|react|python|script|deploy|docker|git)\b/.test(t))
    return { provider: 'openrouter', modelo: 'qwen/qwen3-coder-480b:free', motivo: 'Código → Qwen3 Coder 480B' }

  // Raciocínio complexo, matemática, lógica → DeepSeek R1
  if (/\b(raciocín|lógic[ao]|matemátic|calcul[aeo]|demonstr|prov[ae]r?\b|equação|fórmula|resolver)\b/.test(t))
    return { provider: 'openrouter', modelo: 'deepseek/deepseek-r1:free', motivo: 'Raciocínio → DeepSeek R1' }

  // Análise longa, estratégia, relatório → Gemini 2.5 Flash (1M contexto)
  if (/\b(analis[ea]|estratégia|relatório|report|planeja|mercado|comparar|pesquis[ea]|estud[oa]|dados|dashboard)\b/.test(t))
    return { provider: 'gemini', modelo: 'gemini-2.5-flash', motivo: 'Análise/estratégia → Gemini 2.5 Flash' }

  // Texto comercial, vendas, pitch, marketing → Cohere Command A
  if (/\b(pitch|vend[ae]|comercial|marketing|post|instagram|facebook|cliente|proposta|email|campanha|texto|redação)\b/.test(t))
    return { provider: 'cohere', modelo: 'command-a-03-2025', motivo: 'Comercial/marketing → Cohere Command A' }

  // Tradução, resumo → OpenRouter Gemini grátis
  if (/\b(traduz|translate|resum[oa]|summarize|sintetiz)\b/.test(t))
    return { provider: 'openrouter', modelo: 'google/gemini-2.5-flash-exp:free', motivo: 'Tradução/resumo → Gemini Flash (free)' }

  // Criativo, ideia, brainstorm → Groq Llama 4 Scout (multimodal, rápido)
  if (/\b(cri[ea]|ideia|brainstorm|sugir[ae]|inov[ae]|imagin[ea]|banner|design|inspiração)\b/.test(t))
    return { provider: 'groq', modelo: 'meta-llama/llama-4-scout-17b-16e-instruct', motivo: 'Criativo → Llama 4 Scout' }

  // Perguntas rápidas → Groq Llama 4 Scout (mais rápido)
  if (texto.length < 100)
    return { provider: 'groq', modelo: 'meta-llama/llama-4-scout-17b-16e-instruct', motivo: 'Pergunta rápida → Llama 4 Scout' }

  // Default: Groq Llama 3.3 70B (melhor custo-benefício geral)
  return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Geral → Groq Llama 3.3 70B' }
}

interface Conversa {
  id: number
  titulo: string
  mensagens: Msg[]
  updated_at: string
}

export default function AdminIA() {
  const [provider, setProvider] = useState('auto')
  const [modelo, setModelo] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [anexos, setAnexos] = useState<{ tipo: 'imagem' | 'doc'; nome: string; base64: string; preview?: string }[]>([])
  const [searchSource, setSearchSource] = useState('none')
  const msgsRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Histórico
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaId, setConversaId] = useState<number | null>(null)
  const [showHistorico, setShowHistorico] = useState(false)
  const [metaAberto, setMetaAberto] = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)

  // Multi-IA
  const [multiMode, setMultiMode] = useState(false)
  const [multiTargets, setMultiTargets] = useState<MultiTarget[]>([
    { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { provider: 'gemini', model: 'gemini-2.5-flash' },
    { provider: 'openrouter', model: 'qwen/qwen3-coder-480b:free' },
  ])
  const [multiResults, setMultiResults] = useState<MultiResult[]>([])
  const [multiLoading, setMultiLoading] = useState(false)

  useEffect(() => { carregarConversas() }, [])

  async function carregarConversas() {
    const { data } = await supabaseAdmin.from('ia_conversas').select('id,titulo,updated_at').order('updated_at', { ascending: false }).limit(50)
    if (data) setConversas(data as Conversa[])
  }

  async function salvarConversa(novasMsgs: Msg[]) {
    if (novasMsgs.length < 2) return
    const titulo = novasMsgs[0].content.slice(0, 80)
    if (conversaId) {
      await supabaseAdmin.from('ia_conversas').update({ mensagens: novasMsgs, titulo }).eq('id', conversaId)
    } else {
      const { data } = await supabaseAdmin.from('ia_conversas').insert({ titulo, mensagens: novasMsgs }).select('id').single()
      if (data) setConversaId(data.id)
    }
    carregarConversas()
  }

  async function abrirConversa(id: number) {
    setLoadingHist(true)
    const { data } = await supabaseAdmin.from('ia_conversas').select('*').eq('id', id).single()
    if (data) {
      setMsgs(data.mensagens as Msg[])
      setConversaId(data.id)
    }
    setShowHistorico(false)
    setLoadingHist(false)
  }

  async function excluirConversa(id: number) {
    await supabaseAdmin.from('ia_conversas').delete().eq('id', id)
    if (conversaId === id) { setMsgs([]); setConversaId(null) }
    carregarConversas()
  }

  function novaConversa() {
    setMsgs([]); setConversaId(null); setShowHistorico(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  function trocarProvider(p: string) {
    setProvider(p)
    if (p !== 'auto') setModelo(PROVIDERS[p].modelos[0].id)
    else setModelo('')
  }

  async function enviar() {
    const texto = input.trim()
    if (!texto || loading || multiLoading) return
    setInput('')

    // ── Multi-IA: dispara paralelo ──
    if (multiMode) {
      setMultiLoading(true)
      setMultiResults(multiTargets.map(t => ({ ...t, response: '' })))
      const results = await aiParallel(texto, multiTargets)
      setMultiResults(results)
      setMultiLoading(false)
      return
    }

    const novaMsgs: Msg[] = [...msgs, { role: 'user', content: texto }]
    setMsgs(novaMsgs)
    setLoading(true)

    // Roteador automático
    let usarProvider = provider
    let usarModelo = modelo
    let motivo = ''
    if (anexos.some(a => a.tipo === 'imagem')) {
      usarProvider = 'gemini'
      usarModelo = 'gemini-2.5-flash'
      motivo = '📎 Imagem detectada → Gemini 2.0 Flash (visão)'
    } else if (provider === 'auto') {
      const escolha = escolherProviderModelo(texto)
      usarProvider = escolha.provider
      usarModelo = escolha.modelo
      motivo = escolha.motivo
    }

    const inicio = Date.now()
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg',
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg`,
        },
        body: JSON.stringify({
          action: 'chat',
          provider: usarProvider,
          model: usarModelo,
          messages: novaMsgs.map(m => ({ role: m.role, content: m.content })),
          search_source: searchSource,
          ...(anexos.length > 0 ? { attachments: anexos.map(a => ({ tipo: a.tipo, nome: a.nome, base64: a.base64 })) } : {}),
        }),
      })
      setAnexos([])
      const data = await res.json()
      const tempo = Date.now() - inicio
      if (data.ok) {
        const updated = [...novaMsgs, {
          role: 'assistant' as const,
          content: motivo ? `🎯 ${motivo}\n\n${data.response}` : data.response,
          provider: data.provider,
          model: data.model,
          tempo,
          webSearch: data.web_search,
          dbSearch: data.db_search,
        }]
        setMsgs(updated)
        salvarConversa(updated)
      } else {
        const updated = [...novaMsgs, {
          role: 'assistant' as const,
          content: `Erro: ${data.error || 'Falha desconhecida'}`,
          provider: usarProvider,
          model: usarModelo,
          tempo,
          erro: true,
        }]
        setMsgs(updated)
      }
    } catch (err) {
      setMsgs([...novaMsgs, {
        role: 'assistant',
        content: `Erro de conexão: ${(err as Error).message}`,
        provider,
        model: modelo,
        tempo: Date.now() - inicio,
        erro: true,
      }])
    }
    setLoading(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const [transcrevendo, setTranscrevendo] = useState(false)

  async function transcreverAudio(base64: string, nome: string): Promise<string | null> {
    try {
      setTranscrevendo(true)
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg',
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg`,
        },
        body: JSON.stringify({ action: 'transcribe', audio_base64: base64, audio_name: nome }),
      })
      const data = await res.json()
      if (data.ok) {
        const duracao = data.duration ? ` (${Math.round(data.duration)}s)` : ''
        return `🎙️ Transcrição de "${nome}"${duracao}:\n\n${data.text}`
      }
      return `Erro ao transcrever: ${data.error}`
    } catch (err) {
      return `Erro de conexão: ${(err as Error).message}`
    } finally {
      setTranscrevendo(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'webm', 'mp4', 'opus']
    for (const f of Array.from(files)) {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const isAudio = f.type.startsWith('audio/') || audioExts.includes(ext)

      if (isAudio) {
        // Transcrever áudio automaticamente
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          const transcricao = await transcreverAudio(base64, f.name)
          if (transcricao) {
            setMsgs(prev => [...prev, { role: 'user', content: transcricao }])
          }
        }
        reader.readAsDataURL(f)
        continue
      }

      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const isImg = f.type.startsWith('image/')
        setAnexos(prev => [...prev, {
          tipo: isImg ? 'imagem' : 'doc',
          nome: f.name,
          base64,
          preview: isImg ? URL.createObjectURL(f) : undefined,
        }])
      }
      reader.readAsDataURL(f)
    }
    e.target.value = ''
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const prov = provider === 'auto' ? null : PROVIDERS[provider]

  return (
    <div className={styles.wrap}>
      {/* Drawer Histórico */}
      {showHistorico && <div className={styles.histOverlay} onClick={() => setShowHistorico(false)} />}
      <div className={`${styles.histDrawer} ${showHistorico ? styles.histDrawerOpen : ''}`}>
        <div className={styles.histHeader}>
          <span className={styles.histTitle}>Conversas</span>
          <button className={styles.histNovaBtn} onClick={novaConversa}>+ Nova</button>
        </div>
        <div className={styles.histList}>
          {conversas.map(c => (
            <div key={c.id} className={`${styles.histItem} ${conversaId === c.id ? styles.histItemAtivo : ''}`}>
              <button className={styles.histItemBtn} onClick={() => abrirConversa(c.id)}>
                <span className={styles.histItemTitulo}>{c.titulo}</span>
                <span className={styles.histItemData}>{new Date(c.updated_at).toLocaleDateString('pt-BR')}</span>
              </button>
              <button className={styles.histItemExcluir} onClick={() => excluirConversa(c.id)} title="Excluir">✕</button>
            </div>
          ))}
          {conversas.length === 0 && <p className={styles.histVazio}>Nenhuma conversa salva</p>}
        </div>
      </div>

      <div className={styles.chatArea}>
        {/* ── Painel Monitor de Modelos ── */}
        {showMonitor && (
          <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
            <ModelMonitor onClose={() => setShowMonitor(false)} />
          </div>
        )}

        {/* ── Painel Multi-IA ── */}
        {multiMode && (multiResults.length > 0 || multiLoading) && (
          <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
            {multiLoading && <div className={styles.typing}>🧠 Comparando {multiTargets.length} modelos…</div>}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(multiTargets.length, 3)}, 1fr)`, gap: 12 }}>
              {multiResults.map((r, i) => {
                const info = getModelInfo(r.model)
                return (
                  <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                          {PROVIDERS[r.provider]?.label || r.provider}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{info.skill}</div>
                      </div>
                      {r.tempo && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>{(r.tempo / 1000).toFixed(1)}s</span>}
                    </div>
                    <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#334155', flex: 1, overflowY: 'auto', maxHeight: 400 }}>
                      {r.error ? (
                        <div style={{ color: '#ef4444' }}>Erro: {r.error}</div>
                      ) : r.response ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{autoLinkify(r.response)}</ReactMarkdown>
                      ) : (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aguardando…</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {multiMode && multiResults.length === 0 && !multiLoading ? (
          <div className={styles.welcome}>
            <h2 className={styles.welcomeTitle}>🧠 Modo Multi-IA</h2>
            <p className={styles.welcomeSub}>Faça uma pergunta e compare respostas de {multiTargets.length} modelos lado a lado</p>
          </div>
        ) : msgs.length === 0 ? (
          <div className={styles.welcome}>
            <h2 className={styles.welcomeTitle}>O que posso ajudar hoje?</h2>
            <p className={styles.welcomeSub}>10 providers de IA gratuitos com roteamento inteligente</p>
            <div className={styles.sugestoes}>
              <button className={styles.sugestaoBtn} onClick={() => { setInput('Crie um pitch de vendas para construtoras sobre fixador de porcelanato inox'); }}>
                <span className={styles.sugestaoBtnIcon}>💼</span>
                Pitch de vendas para construtoras
              </button>
              <button className={styles.sugestaoBtn} onClick={() => { setInput('Quais estados do Brasil têm mais potencial para venda de fixador de porcelanato?'); }}>
                <span className={styles.sugestaoBtnIcon}>📊</span>
                Análise de mercado por estado
              </button>
              <button className={styles.sugestaoBtn} onClick={() => { setInput('Escreva um post para Instagram sobre as vantagens do fixador inox vs argamassa'); }}>
                <span className={styles.sugestaoBtnIcon}>📱</span>
                Post para Instagram
              </button>
              <button className={styles.sugestaoBtn} onClick={() => { setInput('Me dê 5 ideias criativas para divulgar fixador de porcelanato'); }}>
                <span className={styles.sugestaoBtnIcon}>💡</span>
                Ideias criativas de divulgação
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.messages} ref={msgsRef}>
            {msgs.map((m, i) => {
              const isRoteado = m.role === 'assistant' && m.content.startsWith('🎯 ')
              const partes = isRoteado ? m.content.split('\n\n') : null
              const roteamento = partes ? partes[0] : null
              const conteudo = partes ? partes.slice(1).join('\n\n') : m.content
              return m.role === 'user' ? (
                <div key={i} className={styles.msgUser}>
                  <div className={styles.msgUserBubble}>{conteudo}</div>
                </div>
              ) : (
                <div key={i} className={styles.msgAi}>
                  {roteamento && <div className={styles.msgRoteamento}>{roteamento}</div>}
                  {m.dbSearch && <div className={styles.msgDbSearch}>🗄️ Dados do sistema</div>}
                  {m.webSearch && <div className={styles.msgWebSearch}>🔍 Busca web ativa</div>}
                  <div className={`${styles.msgAiContent} ${m.erro ? styles.msgErro : ''}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{autoLinkify(conteudo)}</ReactMarkdown>
                  </div>
                  {m.tempo && (
                    <div className={styles.msgMeta}>
                      <span className={styles.msgMetaTag}>{m.provider}</span>
                      <span className={styles.msgMetaTag}>{m.model}</span>
                      <span className={styles.msgMetaTag}>{(m.tempo / 1000).toFixed(1)}s</span>
                      {m.dbSearch && <span className={styles.msgMetaTag}>🗄️ db</span>}
                      {m.webSearch && <span className={styles.msgMetaTag}>🔍 web</span>}
                    </div>
                  )}
                </div>
              )
            })}
            {transcrevendo && <div className={styles.typing}>🎙️ Transcrevendo áudio…</div>}
            {loading && <div className={styles.typing}>Pensando…</div>}
          </div>
        )}

        <div className={styles.inputContainer}>
          <div className={styles.inputInner}>
            <input type="file" ref={fileRef} onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.txt,.csv,audio/*,.mp3,.ogg,.wav,.m4a,.webm,.opus" multiple hidden />
            {anexos.length > 0 && (
              <div className={styles.anexoPreview}>
                {anexos.map((a, i) => a.tipo === 'imagem' ? (
                  <div key={i} className={styles.anexoThumb}>
                    <img src={a.preview} alt={a.nome} />
                    <button className={styles.anexoRemover} onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ) : (
                  <div key={i} className={styles.anexoThumbDoc}>
                    📄 {a.nome}
                    <button className={styles.anexoRemover} onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.inputBox}>
              <button className={styles.btnAnexo} onClick={() => fileRef.current?.click()} title="Anexar imagem ou documento">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pergunte qualquer coisa..."
                rows={1}
              />
              <button className={styles.btnEnviar} onClick={enviar} disabled={loading || (!input.trim() && anexos.length === 0)}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
            <div className={styles.inputMeta}>
              <div className={styles.inputMetaRow}>
                {/* Resumo colapsado */}
                <button className={styles.metaToggle} onClick={() => setMetaAberto(v => !v)}>
                  <span>{provider === 'auto' ? '🎯 Auto' : PROVIDERS[provider]?.label || provider}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>{SEARCH_SOURCES.find(s => s.id === searchSource)?.label || searchSource}</span>
                  <span className={`${styles.metaChevron} ${metaAberto ? styles.metaChevronAberto : ''}`}>▾</span>
                </button>
                <button
                  className={styles.limpar}
                  onClick={() => { setMultiMode(v => !v); setMultiResults([]) }}
                  style={multiMode ? { background: '#ede9fe', color: '#7c3aed', borderColor: '#c4b5fd' } : {}}
                >🧠 Multi-IA</button>
                <button className={styles.limpar} onClick={() => setShowHistorico(v => !v)}>📂 Histórico{conversas.length > 0 ? ` (${conversas.length})` : ''}</button>
                <button
                  className={styles.limpar}
                  onClick={() => setShowMonitor(v => !v)}
                  style={showMonitor ? { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' } : {}}
                >🔬 Monitor</button>
                {msgs.length > 0 && !multiMode && <button className={styles.limpar} onClick={novaConversa}>+ Nova</button>}
              </div>
              {metaAberto && (
                <div className={styles.metaExpandido}>
                  <div className={styles.metaGrupo}>
                    <span className={styles.inputMetaLabel}>IA</span>
                    <div className={styles.providerSelect}>
                      <button
                        className={`${styles.providerChip} ${provider === 'auto' ? styles.providerChipAuto : ''}`}
                        onClick={() => trocarProvider('auto')}
                      >🎯 Auto</button>
                      {Object.entries(PROVIDERS).map(([key, p]) => (
                        <button
                          key={key}
                          className={`${styles.providerChip} ${provider === key ? styles.providerChipAtivo : ''}`}
                          onClick={() => trocarProvider(key)}
                        >{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.metaGrupo}>
                    <span className={styles.inputMetaLabel}>Busca</span>
                    <div className={styles.searchSelect}>
                      {SEARCH_SOURCES.map(s => (
                        <button
                          key={s.id}
                          className={`${styles.providerChip} ${searchSource === s.id ? (s.id === 'none' ? styles.providerChipAtivo : styles.providerChipSearch) : ''}`}
                          onClick={() => setSearchSource(s.id)}
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>
                  {prov && !multiMode && (
                    <div className={styles.metaGrupo}>
                      <span className={styles.inputMetaLabel}>Modelo</span>
                      <div className={styles.modelBar}>
                        {prov.modelos.map(m => (
                          <button
                            key={m.id}
                            className={`${styles.modelBtn} ${modelo === m.id ? styles.modelBtnAtivo : ''}`}
                            onClick={() => setModelo(m.id)}
                            title={getModelSkill(m.id)}
                          >
                            {m.label}
                            {modelo === m.id && getModelSkill(m.id) && (
                              <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.8, fontWeight: 400, marginTop: 1 }}>{getModelSkill(m.id)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {multiMode && (
                    <div className={styles.metaGrupo}>
                      <span className={styles.inputMetaLabel}>Modelos para comparar</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {multiTargets.map((mt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', minWidth: 14 }}>{idx + 1}.</span>
                            <select
                              value={mt.provider}
                              onChange={e => {
                                const p = e.target.value
                                const m = PROVIDERS[p]?.modelos[0]?.id || ''
                                setMultiTargets(prev => prev.map((t, i) => i === idx ? { provider: p, model: m } : t))
                              }}
                              style={{ fontSize: '0.72rem', padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
                            >
                              {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select
                              value={mt.model}
                              onChange={e => setMultiTargets(prev => prev.map((t, i) => i === idx ? { ...t, model: e.target.value } : t))}
                              style={{ fontSize: '0.72rem', padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0', flex: 1, minWidth: 120 }}
                            >
                              {(PROVIDERS[mt.provider]?.modelos || []).map(m => <option key={m.id} value={m.id}>{m.label} — {getModelInfo(m.id).skill}</option>)}
                            </select>
                            {multiTargets.length > 2 && (
                              <button onClick={() => setMultiTargets(prev => prev.filter((_, i) => i !== idx))} style={{ fontSize: '0.65rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            )}
                          </div>
                        ))}
                        {multiTargets.length < 5 && (
                          <button
                            onClick={() => setMultiTargets(prev => [...prev, { provider: 'groq', model: 'llama-3.3-70b-versatile' }])}
                            style={{ fontSize: '0.65rem', color: '#7c3aed', background: 'none', border: '1px dashed #c4b5fd', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
                          >+ Adicionar modelo</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
