import { useState, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminIA.module.css'

// ── Providers e modelos ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, { label: string; modelos: { id: string; label: string }[] }> = {
  groq: {
    label: '⚡ Groq',
    modelos: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    ],
  },
  gemini: {
    label: '💎 Gemini',
    modelos: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
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
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B' },
      { id: 'google/gemma-2-2b-it', label: 'Gemma 2 2B' },
      { id: 'microsoft/Phi-3-mini-4k-instruct', label: 'Phi-3 Mini' },
    ],
  },
  together: {
    label: '🤝 Together',
    modelos: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
    ],
  },
  cloudflare: {
    label: '☁️ Cloudflare',
    modelos: [
      { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
      { id: '@cf/mistral/mistral-7b-instruct-v0.1', label: 'Mistral 7B' },
    ],
  },
  openrouter: {
    label: '🔀 OpenRouter',
    modelos: [
      { id: 'google/gemini-2.5-flash-exp:free', label: 'Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B' },
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

function escolherProviderModelo(texto: string): { provider: string; modelo: string; motivo: string } {
  const t = texto.toLowerCase()

  // Código, programação, técnico → Groq Llama 70B (rápido e capaz)
  if (/\b(código|code|programa|function|sql|api|bug|erro|html|css|javascript|typescript|react)\b/.test(t))
    return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Técnico/código → Llama 3.3 70B' }

  // Análise longa, estratégia, relatório → Gemini (contexto grande)
  if (/\b(analis[ea]|estratégia|relatório|report|planeja|mercado|comparar|pesquis[ea]|estud[oa])\b/.test(t))
    return { provider: 'gemini', modelo: 'gemini-2.5-flash', motivo: 'Análise/estratégia → Gemini 2.0 Flash' }

  // Texto comercial, vendas, pitch, marketing → Cohere (bom em texto)
  if (/\b(pitch|vend[ae]|comercial|marketing|post|instagram|facebook|cliente|proposta|email|campanha)\b/.test(t))
    return { provider: 'cohere', modelo: 'command-a-03-2025', motivo: 'Comercial/marketing → Cohere Command A' }

  // Tradução, resumo → OpenRouter Gemini grátis
  if (/\b(traduz|translate|resum[oa]|summarize)\b/.test(t))
    return { provider: 'openrouter', modelo: 'google/gemini-2.5-flash-exp:free', motivo: 'Tradução/resumo → OpenRouter Gemini' }

  // Criativo, ideia, brainstorm → Together Llama 70B
  if (/\b(cri[ea]|ideia|brainstorm|sugir[ae]|inov[ae]|imagin[ea]|banner|design)\b/.test(t))
    return { provider: 'together', modelo: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', motivo: 'Criativo → Together Llama 3.3 70B' }

  // Perguntas rápidas, simples → Groq (mais rápido)
  if (texto.length < 100)
    return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Pergunta rápida → Groq Llama 70B' }

  // Default: Groq 70B (melhor custo-benefício)
  return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Geral → Groq Llama 3.3 70B' }
}

export default function AdminIA() {
  const [provider, setProvider] = useState('auto')
  const [modelo, setModelo] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [anexos, setAnexos] = useState<{ tipo: 'imagem' | 'doc'; nome: string; base64: string; preview?: string }[]>([])
  const [searchSource, setSearchSource] = useState('auto')
  const msgsRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    if (!texto || loading) return
    setInput('')
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
        setMsgs([...novaMsgs, {
          role: 'assistant',
          content: motivo ? `🎯 ${motivo}\n\n${data.response}` : data.response,
          provider: data.provider,
          model: data.model,
          tempo,
          webSearch: data.web_search,
          dbSearch: data.db_search,
        }])
      } else {
        setMsgs([...novaMsgs, {
          role: 'assistant',
          content: `Erro: ${data.error || 'Falha desconhecida'}`,
          provider: usarProvider,
          model: usarModelo,
          tempo,
          erro: true,
        }])
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (const f of Array.from(files)) {
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
      <div className={styles.chatArea}>
        {msgs.length === 0 ? (
          <div className={styles.welcome}>
            <h2 className={styles.welcomeTitle}>O que posso ajudar hoje?</h2>
            <p className={styles.welcomeSub}>7 providers de IA gratuitos com roteamento inteligente</p>
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
                  <div className={`${styles.msgAiContent} ${m.erro ? styles.msgErro : ''}`}>{conteudo}</div>
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
            {loading && <div className={styles.typing}>Pensando…</div>}
          </div>
        )}

        <div className={styles.inputContainer}>
          <div className={styles.inputInner}>
            <input type="file" ref={fileRef} onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.txt,.csv" multiple hidden />
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
              <div className={styles.searchSelect}>
                {SEARCH_SOURCES.map(s => (
                  <button
                    key={s.id}
                    className={`${styles.providerChip} ${searchSource === s.id ? (s.id === 'none' ? styles.providerChipAtivo : styles.providerChipSearch) : ''}`}
                    onClick={() => setSearchSource(s.id)}
                  >{s.label}</button>
                ))}
              </div>
              {msgs.length > 0 && <button className={styles.limpar} onClick={() => setMsgs([])}>Limpar</button>}
            </div>
            {prov && (
              <div className={styles.modelBar}>
                {prov.modelos.map(m => (
                  <button
                    key={m.id}
                    className={`${styles.modelBtn} ${modelo === m.id ? styles.modelBtnAtivo : ''}`}
                    onClick={() => setModelo(m.id)}
                  >{m.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
