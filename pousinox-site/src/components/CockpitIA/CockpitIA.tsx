import { useState, useRef, useEffect, useCallback } from 'react'
import { useCockpit, type Etapa } from '../../contexts/CockpitContext'
import { useOverview } from '../../hooks/useOverview'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabaseAdmin } from '../../lib/supabase'
import { Bot, X, Send, ArrowLeft, Sparkles, ThumbsUp, ThumbsDown, Database } from 'lucide-react'
import styles from './CockpitIA.module.css'

/* ── Providers ─────────────────────────────────────────────────────────── */

const PROVIDERS: { id: string; label: string; modelos: { id: string; label: string }[] }[] = [
  { id: 'auto', label: 'Auto', modelos: [] },
  { id: 'groq', label: 'Groq', modelos: [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  ]},
  { id: 'gemini', label: 'Gemini', modelos: [
    { id: 'gemini-2.5-flash', label: '2.5 Flash' },
  ]},
  { id: 'cohere', label: 'Cohere', modelos: [
    { id: 'command-a-03-2025', label: 'Command A' },
  ]},
  { id: 'openrouter', label: 'OpenRouter', modelos: [
    { id: 'qwen/qwen3-coder-480b:free', label: 'Qwen3 Coder' },
    { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1' },
    { id: 'google/gemini-2.5-flash-exp:free', label: 'Gemini Flash' },
  ]},
]

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const EDGE_URL = `${SUPABASE_URL}/functions/v1/ai-hub`
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

/* ── Auto-routing ──────────────────────────────────────────────────────── */

function autoRoute(texto: string): { provider: string; modelo: string } {
  const t = texto.toLowerCase()
  if (/\b(código|sql|api|html|css|react|python|script)\b/.test(t))
    return { provider: 'openrouter', modelo: 'qwen/qwen3-coder-480b:free' }
  if (/\b(analis[ea]|estratégia|relatório|dados|mercado|comparar)\b/.test(t))
    return { provider: 'gemini', modelo: 'gemini-2.5-flash' }
  if (/\b(pitch|vend[ae]|comercial|marketing|proposta|email|campanha)\b/.test(t))
    return { provider: 'cohere', modelo: 'command-a-03-2025' }
  return { provider: 'groq', modelo: 'meta-llama/llama-4-scout-17b-16e-instruct' }
}

/* ── Contextual suggestions ────────────────────────────────────────────── */

interface Suggestion {
  text: string
  prompt: string
  tag: string
}

function getSuggestions(etapa: Etapa, overview: ReturnType<typeof useOverview>): Suggestion[] {
  const s: Suggestion[] = []

  switch (etapa) {
    case 'radar':
      s.push({ text: 'Quais regiões têm mais demanda para prospecção?', prompt: 'Analise as regiões com maior potencial de prospecção para fixadores de porcelanato em aço inox, considerando construção civil e revestimentos.', tag: 'Análise' })
      s.push({ text: 'Gerar pitch comercial por segmento', prompt: 'Crie um pitch comercial curto para prospecção no segmento de construção civil, focando em fixadores de porcelanato em aço inox Pousinox.', tag: 'Comercial' })
      break
    case 'lead':
      if (overview.status.marketing === 'ok' && overview.marketing.leadsMes > 0)
        s.push({ text: `${overview.marketing.leadsMes} leads no mês — como priorizar?`, prompt: `Temos ${overview.marketing.leadsMes} leads captados neste mês. Sugira critérios para priorizar o atendimento e qualificação desses leads para uma fábrica de produtos em aço inox.`, tag: 'Estratégia' })
      s.push({ text: 'Sugerir campanha para gerar mais leads', prompt: 'Sugira uma campanha de marketing digital para gerar leads qualificados para fixadores de porcelanato em aço inox.', tag: 'Marketing' })
      break
    case 'contato':
      if (overview.status.comercial === 'ok' && overview.comercial.followupsAtrasados > 0)
        s.push({ text: `${overview.comercial.followupsAtrasados} follow-ups atrasados — priorizar`, prompt: `Temos ${overview.comercial.followupsAtrasados} follow-ups atrasados. Sugira uma estratégia de priorização e scripts de abordagem para retomar esses contatos.`, tag: 'Urgente' })
      s.push({ text: 'Gerar template WhatsApp para recontato', prompt: 'Crie um template de mensagem WhatsApp profissional para recontato com prospect que não respondeu há 7 dias. Produto: fixadores de porcelanato em aço inox.', tag: 'Template' })
      break
    case 'deal':
      if (overview.status.comercial === 'ok') {
        s.push({ text: `Pipeline: ${overview.comercial.deals} deals ativos — análise`, prompt: `Analise nosso pipeline comercial com ${overview.comercial.deals} deals ativos e R$ ${overview.comercial.receitaPipeline.toFixed(0)} em receita potencial. Sugira ações para acelerar o ciclo de vendas.`, tag: 'Pipeline' })
      }
      s.push({ text: 'Dicas para negociação B2B industrial', prompt: 'Dê 5 dicas práticas de negociação B2B para venda de fixadores industriais em aço inox para construtoras e incorporadoras.', tag: 'Vendas' })
      break
    case 'proposta':
      s.push({ text: 'Revisar argumentos para proposta comercial', prompt: 'Liste os principais argumentos de venda para incluir em uma proposta comercial de fixadores de porcelanato em aço inox Pousinox, validados pelo SENAI/LAMAT.', tag: 'Proposta' })
      s.push({ text: 'Como aumentar taxa de conversão de orçamentos', prompt: 'Sugira estratégias para aumentar a taxa de conversão de orçamentos em vendas para produtos industriais B2B.', tag: 'Estratégia' })
      break
    case 'venda':
      if (overview.status.financeiro === 'ok')
        s.push({ text: `Receita mês: R$ ${overview.financeiro.receitaMes.toFixed(0)} — projeção`, prompt: `Nossa receita no mês atual é R$ ${overview.financeiro.receitaMes.toFixed(2)}. Analise e projete o fechamento do mês considerando o pipeline ativo.`, tag: 'Financeiro' })
      s.push({ text: 'Estratégia de upsell para clientes ativos', prompt: 'Sugira uma estratégia de upsell e cross-sell para clientes que já compraram fixadores de porcelanato Pousinox.', tag: 'Vendas' })
      break
    case 'entrega':
      if (overview.status.operacao === 'ok' && overview.operacao.ncsAbertas > 0)
        s.push({ text: `${overview.operacao.ncsAbertas} NCs abertas — plano de ação`, prompt: `Temos ${overview.operacao.ncsAbertas} não-conformidades abertas na produção. Sugira um plano de ação 5W2H para tratamento prioritário.`, tag: 'Qualidade' })
      s.push({ text: 'Otimizar fluxo de produção', prompt: 'Sugira melhorias no fluxo de produção de fixadores em aço inox (corte laser → conformação → acabamento → inspeção → expedição).', tag: 'Operação' })
      break
    case 'posvenda':
      s.push({ text: 'Campanha de reativação para clientes inativos', prompt: 'Crie uma campanha de reativação por email e WhatsApp para clientes que não compram há mais de 90 dias. Produto: fixadores de porcelanato em aço inox.', tag: 'Retenção' })
      s.push({ text: 'Análise de satisfação e NPS', prompt: 'Sugira um modelo de pesquisa NPS para clientes B2B industriais de fixadores em aço inox, com 5 perguntas estratégicas.', tag: 'NPS' })
      break
  }

  // Always add generic ones
  s.push({ text: 'Consultar dados: "quanto faturamos em SP?"', prompt: '', tag: 'NL Query' })
  s.push({ text: 'Perguntar algo sobre a Pousinox', prompt: '', tag: 'Livre' })

  return s
}

/* ── Message type ──────────────────────────────────────────────────────── */

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

/* ── Panel content (shared between mobile sheet and desktop) ───────────── */

function PanelContent({ onClose }: { onClose?: () => void }) {
  const { etapa, empresa } = useCockpit()
  const overview = useOverview(empresa?.cnpj)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('auto')
  const [modelo, setModelo] = useState('')
  const msgsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load saved model preference per etapa
  useEffect(() => {
    const saved = localStorage.getItem(`cockpit_ia_model_${etapa}`)
    if (saved) {
      try {
        const { provider: p, modelo: m } = JSON.parse(saved)
        setProvider(p)
        setModelo(m)
      } catch { /* ignore */ }
    }
  }, [etapa])

  // Save model preference
  const saveModelPref = useCallback((p: string, m: string) => {
    if (p !== 'auto') {
      localStorage.setItem(`cockpit_ia_model_${etapa}`, JSON.stringify({ provider: p, modelo: m }))
    } else {
      localStorage.removeItem(`cockpit_ia_model_${etapa}`)
    }
  }, [etapa])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  const suggestions = getSuggestions(etapa, overview)
  const inChat = msgs.length > 0

  function handleProviderChange(val: string) {
    setProvider(val)
    const prov = PROVIDERS.find(p => p.id === val)
    const m = prov?.modelos[0]?.id ?? ''
    setModelo(m)
    saveModelPref(val, m)
  }

  function handleModelChange(val: string) {
    setModelo(val)
    saveModelPref(provider, val)
  }

  async function enviar(text?: string) {
    const txt = (text ?? input).trim()
    if (!txt || loading) return
    setInput('')

    const novaMsgs: Msg[] = [...msgs, { role: 'user', content: txt }]
    setMsgs(novaMsgs)
    setLoading(true)

    let usarProvider = provider
    let usarModelo = modelo
    if (provider === 'auto') {
      const r = autoRoute(txt)
      usarProvider = r.provider
      usarModelo = r.modelo
    }

    // System context
    const systemMsg = `Você é o assistente IA do Cockpit Pousinox. Contexto atual: etapa "${etapa}"${empresa ? `, empresa selecionada: ${empresa.nome} (${empresa.cnpj})` : ' (visão global)'}. Responda de forma concisa e acionável. A Pousinox fabrica produtos sob medida em aço inox, incluindo fixadores de porcelanato validados pelo SENAI/LAMAT.`

    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          action: 'chat',
          provider: usarProvider,
          model: usarModelo,
          messages: [
            { role: 'system', content: systemMsg },
            ...novaMsgs.map(m => ({ role: m.role, content: m.content })),
          ],
          search_source: 'none',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgs([...novaMsgs, { role: 'assistant', content: data.response }])
      } else {
        setMsgs([...novaMsgs, { role: 'assistant', content: `Erro: ${data.error || 'falha na requisição'}` }])
      }
    } catch (err: any) {
      setMsgs([...novaMsgs, { role: 'assistant', content: `Erro de conexão: ${err.message}` }])
    }
    setLoading(false)
  }

  function handleSuggestionClick(s: Suggestion) {
    if (s.prompt) {
      enviar(s.prompt)
    } else {
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const [feedbackSent, setFeedbackSent] = useState<Record<number, string>>({})

  async function sendFeedback(msgIndex: number, rating: 'up' | 'down') {
    if (feedbackSent[msgIndex]) return
    setFeedbackSent(prev => ({ ...prev, [msgIndex]: rating }))
    const promptMsg = msgs[msgIndex - 1]?.content || ''
    await supabaseAdmin.from('ia_feedback').insert({
      etapa,
      modelo: provider === 'auto' ? 'auto' : `${provider}/${modelo}`,
      prompt_resumo: promptMsg.slice(0, 200),
      rating,
    })
  }

  function resetChat() {
    setMsgs([])
    setInput('')
    setFeedbackSent({})
  }

  const currentProvider = PROVIDERS.find(p => p.id === provider)

  return (
    <>
      <div className={styles.panelHeader}>
        <Sparkles size={16} color="#7c3aed" />
        <h3 className={styles.panelTitle}>IA Cockpit</h3>
        {inChat && (
          <button className={styles.backBtn} onClick={resetChat}>
            <ArrowLeft size={12} /> Sugestões
          </button>
        )}
        {onClose && (
          <button className={styles.panelClose} onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Model selector */}
      <div className={styles.modelRow}>
        <span className={styles.modelLabel}>Modelo:</span>
        <select className={styles.modelSelect} value={provider} onChange={e => handleProviderChange(e.target.value)}>
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {currentProvider && currentProvider.modelos.length > 0 && (
          <select className={styles.modelSelect} value={modelo} onChange={e => handleModelChange(e.target.value)}>
            {currentProvider.modelos.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Suggestions or chat */}
      {!inChat ? (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <button key={i} className={styles.suggestCard} onClick={() => handleSuggestionClick(s)}>
              <Sparkles size={14} color="#7c3aed" className={styles.suggestIcon} />
              <span className={styles.suggestText}>{s.text}</span>
              <span className={styles.suggestTag}>{s.tag}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.messages} ref={msgsRef}>
          {msgs.map((m, i) => (
            <div key={i}>
              <div className={m.role === 'user' ? styles.msgUser : styles.msgAssistant}>
                {m.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                ) : m.content.length > 120 ? m.content.slice(0, 120) + '...' : m.content}
              </div>
              {m.role === 'assistant' && (
                <div className={styles.feedbackRow}>
                  <button
                    className={`${styles.feedbackBtn} ${feedbackSent[i] === 'up' ? styles.feedbackActive : ''}`}
                    onClick={() => sendFeedback(i, 'up')}
                    disabled={!!feedbackSent[i]}
                  >
                    <ThumbsUp size={11} />
                  </button>
                  <button
                    className={`${styles.feedbackBtn} ${feedbackSent[i] === 'down' ? styles.feedbackActive : ''}`}
                    onClick={() => sendFeedback(i, 'down')}
                    disabled={!!feedbackSent[i]}
                  >
                    <ThumbsDown size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className={styles.typing}>
              <span className={styles.typingDots}>Pensando</span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.inputField}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo..."
          rows={1}
        />
        <button className={styles.sendBtn} onClick={() => enviar()} disabled={!input.trim() || loading}>
          <Send size={16} />
        </button>
      </div>
    </>
  )
}

/* ── Main component ────────────────────────────────────────────────────── */

export default function CockpitIA() {
  const [open, setOpen] = useState(false)

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false)
      if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <>
      {/* Desktop: inline panel */}
      <aside className={styles.desktopPanel}>
        <PanelContent />
      </aside>

      {/* Mobile: FAB + bottom sheet */}
      <button className={`${styles.fab} ${!open ? styles.fabPulse : ''}`} onClick={() => setOpen(true)}>
        <Bot size={24} />
      </button>

      <div className={`${styles.overlay} ${open ? styles.overlayVisible : ''}`} onClick={() => setOpen(false)} />

      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}>
        <div className={styles.dragHandle} />
        <PanelContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
