// Edge Function: assistente-chat
// Proxy multi-modelo para o Assistente IA.
// Suporta tool_use (ações automáticas) no Claude.
//
// POST /functions/v1/assistente-chat
// Body: { messages, system, model?, tool_results? }

import { logUsage } from '../_shared/logUsage.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const GEMINI_KEY    = Deno.env.get('GEMINI_KEY') ?? Deno.env.get('GEMINI_API_KEY') ?? ''
const GROQ_KEY      = Deno.env.get('GROQ_API_KEY') ?? ''
const CEREBRAS_KEY  = Deno.env.get('CEREBRAS_API_KEY') ?? ''
const MISTRAL_KEY   = Deno.env.get('MISTRAL_API_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`

type Provider = 'anthropic' | 'gemini' | 'openai_compat'

interface ModelCfg {
  id: string
  provider: Provider
  maxTokens: number
  baseUrl?: string
  keyEnv?: string
  maxInput?: number
}

const MODELS: Record<string, ModelCfg> = {
  haiku:    { id: 'claude-haiku-4-5-20251001',  provider: 'anthropic',     maxTokens: 4096 },
  sonnet:   { id: 'claude-sonnet-4-6-20250514', provider: 'anthropic',     maxTokens: 4096 },
  gemini:   { id: 'gemini-2.5-flash',           provider: 'gemini',        maxTokens: 4096 },
  groq:     { id: 'llama-3.3-70b-versatile',    provider: 'openai_compat', maxTokens: 4096, baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY' },
  cerebras: { id: 'qwen-3-235b-a22b-instruct-2507', provider: 'openai_compat', maxTokens: 8192, baseUrl: 'https://api.cerebras.ai/v1', keyEnv: 'CEREBRAS_API_KEY', maxInput: 8192 },
  mistral:  { id: 'mistral-small-latest',       provider: 'openai_compat', maxTokens: 8192, baseUrl: 'https://api.mistral.ai/v1',      keyEnv: 'MISTRAL_API_KEY' },
}

// ── Tool definitions para ações no ERP ──────────────────────────────────────
const TOOLS = [
  {
    name: 'criar_orcamento',
    description: 'Cria um novo orçamento para um cliente. Retorna o ID do orçamento criado.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_nome: { type: 'string', description: 'Nome ou razão social do cliente' },
        cliente_cnpj: { type: 'string', description: 'CNPJ do cliente (opcional)' },
        itens: {
          type: 'array',
          description: 'Lista de itens do orçamento',
          items: {
            type: 'object',
            properties: {
              descricao: { type: 'string' },
              quantidade: { type: 'number' },
              valor_unitario: { type: 'number' },
            },
            required: ['descricao', 'quantidade'],
          },
        },
        observacoes: { type: 'string', description: 'Observações gerais' },
      },
      required: ['cliente_nome'],
    },
  },
  {
    name: 'mover_deal',
    description: 'Move um deal no pipeline comercial para outro estágio.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'number', description: 'ID do deal' },
        novo_estagio: { type: 'string', enum: ['entrada', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] },
        motivo: { type: 'string', description: 'Motivo da movimentação (opcional)' },
      },
      required: ['deal_id', 'novo_estagio'],
    },
  },
  {
    name: 'criar_ordem_producao',
    description: 'Cria uma nova ordem de produção (OP).',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição da OP' },
        projeto_id: { type: 'number', description: 'ID do projeto vinculado (opcional)' },
        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] },
        observacoes: { type: 'string' },
      },
      required: ['descricao'],
    },
  },
  {
    name: 'registrar_lancamento',
    description: 'Registra um lançamento financeiro (receita ou despesa).',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['receita', 'despesa'] },
        descricao: { type: 'string' },
        valor: { type: 'number', description: 'Valor em reais' },
        data_vencimento: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        categoria_id: { type: 'number', description: 'ID da categoria financeira (opcional)' },
      },
      required: ['tipo', 'descricao', 'valor'],
    },
  },
  {
    name: 'consultar_dados',
    description: 'Consulta dados de uma tabela do ERP. Use quando precisar de dados que não foram fornecidos no contexto.',
    input_schema: {
      type: 'object',
      properties: {
        tabela: { type: 'string', description: 'Nome da tabela: clientes, pipeline_deals, orcamentos, ordens_producao, estoque_itens, fin_lancamentos, prospeccao, market_keywords' },
        filtros: { type: 'string', description: 'Descrição dos filtros desejados em linguagem natural' },
        limite: { type: 'number', description: 'Máximo de registros (default 20)' },
      },
      required: ['tabela'],
    },
  },
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Anthropic (Claude) com tool_use ─────────────────────────────────────────
async function callAnthropic(
  modelId: string,
  messages: unknown[],
  system: string,
  maxTokens: number,
) {
  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxTokens,
    system,
    messages,
    tools: TOOLS,
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API ${res.status}: ${err}`)
  }

  const data = await res.json()

  // Extrair texto e tool_use blocks
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  const toolBlocks = data.content?.filter((b: { type: string }) => b.type === 'tool_use') ?? []

  return {
    content: textBlock?.text ?? '',
    tool_calls: toolBlocks.length > 0 ? toolBlocks.map((t: { id: string; name: string; input: unknown }) => ({
      id: t.id,
      name: t.name,
      input: t.input,
    })) : undefined,
    stop_reason: data.stop_reason,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  }
}

// ── Google Gemini ───────────────────────────────────────────────────────────
async function callGemini(
  modelId: string,
  messages: { role: string; content: string }[],
  system: string,
) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[GEMINI] erro:', res.status, err.slice(0, 300))
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text && data.candidates?.[0]?.finishReason === 'SAFETY') {
    console.warn('[GEMINI] resposta bloqueada por safety filter')
    throw new Error('Gemini safety filter blocked response')
  }
  const um = data.usageMetadata
  return {
    content: text,
    usage: {
      input_tokens: um?.promptTokenCount ?? 0,
      output_tokens: um?.candidatesTokenCount ?? 0,
    },
  }
}

// ── OpenAI-compatible (Groq, Cerebras, Mistral) ────────────────────────────
async function callOpenAICompat(
  cfg: ModelCfg,
  messages: { role: string; content: string }[],
  system: string,
) {
  const apiKey = cfg.keyEnv ? (Deno.env.get(cfg.keyEnv) ?? '') : ''
  if (!apiKey) throw new Error(`${cfg.keyEnv} não configurada`)

  const body = {
    model: cfg.id,
    max_tokens: cfg.maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${cfg.id} API ${res.status}: ${err}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  return {
    content: choice?.message?.content ?? '',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

// ── RAG: busca semântica em knowledge_chunks ────────────────────────────────
interface RAGSource { file: string; excerpt: string; similarity: number; chunks: number }

interface RAGResult {
  context: string
  sources: RAGSource[]
}

async function searchRAG(query: string, sourceFiles?: string[]): Promise<RAGResult | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null
  try {
    let chunks: { content: string; source_file: string; similarity: number }[]

    if (sourceFiles?.length) {
      // Fontes específicas: buscar TODOS os chunks via POST (evita encoding issues em query string)
      const directRes = await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_chunks?chunk_index=gte.0&select=content,source_file&order=chunk_index.asc&limit=30`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ source_file: sourceFiles.length === 1 ? sourceFiles[0] : undefined }),
        },
      )
      // Fallback: usar GET com eq para fonte única
      let directChunks: { content: string; source_file: string }[] = []
      if (sourceFiles.length === 1) {
        const eqRes = await fetch(
          `${SUPABASE_URL}/rest/v1/knowledge_chunks?source_file=eq.${encodeURIComponent(sourceFiles[0])}&chunk_index=gte.0&select=content,source_file&order=chunk_index.asc&limit=30`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
        )
        if (eqRes.ok) directChunks = await eqRes.json()
        console.log(`[RAG] busca direta eq: ${eqRes.status}, ${directChunks.length} chunks`)
      } else {
        // Múltiplas fontes: buscar cada uma
        for (const sf of sourceFiles) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/knowledge_chunks?source_file=eq.${encodeURIComponent(sf)}&chunk_index=gte.0&select=content,source_file&order=chunk_index.asc&limit=10`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
          )
          if (r.ok) directChunks.push(...(await r.json()))
        }
        console.log(`[RAG] busca direta multi: ${directChunks.length} chunks de ${sourceFiles.length} fontes`)
      }
      chunks = directChunks.map(c => ({ ...c, similarity: 1.0 }))
    } else {
      // Busca semântica normal (todas as fontes)
      if (!GEMINI_KEY) return null
      const embRes = await fetch(`${EMBED_URL}?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text: query }] }, outputDimensionality: 768 }),
      })
      if (!embRes.ok) return null
      const embData = await embRes.json()
      const embedding = embData.embedding?.values as number[]
      if (!embedding?.length) return null

      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ query_embedding: '[' + embedding.join(',') + ']', match_threshold: 0.3, match_count: 10 }),
      })
      if (!rpcRes.ok) return null
      chunks = await rpcRes.json()
    }

    if (!chunks?.length) { console.log('[RAG] nenhum chunk encontrado'); return null }
    console.log(`[RAG] ${chunks.length} chunks encontrados, sim: ${chunks.map(c => c.similarity.toFixed(2)).join(', ')}`)

    // Agrupar por arquivo — contexto e fontes usam nome do documento, não índices numéricos
    const fileMap = new Map<string, { contents: string[]; excerpt: string; similarity: number }>()
    for (const c of chunks) {
      const cleanContent = c.content.replace(/^\[CONTEXTO DO DOCUMENTO:.*?\]\n?/, '')
      const existing = fileMap.get(c.source_file)
      if (existing) {
        existing.contents.push(cleanContent)
        if (cleanContent.length > existing.excerpt.length) existing.excerpt = cleanContent.slice(0, 400)
      } else {
        fileMap.set(c.source_file, { contents: [cleanContent], excerpt: cleanContent.slice(0, 400), similarity: c.similarity })
      }
    }

    // Contexto agrupado por documento (não por chunk individual)
    const context = '\n\n--- DOCUMENTOS RELEVANTES (base de conhecimento) ---\n' +
      Array.from(fileMap.entries()).map(([file, info]) =>
        `📄 Documento: "${file}"\n${info.contents.join('\n\n')}`
      ).join('\n\n---\n\n') +
      '\n--- FIM DOCUMENTOS ---'

    const sources: RAGSource[] = Array.from(fileMap.entries()).map(([file, info]) => ({
      file,
      excerpt: info.excerpt,
      similarity: info.similarity,
      chunks: info.contents.length,
    }))

    return { context, sources }
  } catch (err) {
    console.warn('[RAG] erro:', err)
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, system, model: modelKey, rag, source_files } = await req.json()
    console.log('[INIT] model:', modelKey, 'rag:', rag, 'msgs:', messages?.length)

    if (!messages?.length) return jsonRes({ error: 'messages é obrigatório' }, 400)

    // Roteamento automático: analisa a pergunta e escolhe o melhor modelo
    let resolvedKey = modelKey
    if (modelKey === 'auto') {
      const lastMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')?.content?.toLowerCase() ?? ''
      if (/dados|tabela|cliente|faturamento|financ|estoque|valor|%|percent|ranking|top\s?\d|quanto|nf|nota fiscal|produção|venda|compra|dre|saldo|receita|despesa/.test(lastMsg)) {
        resolvedKey = 'mistral'
      } else {
        resolvedKey = 'gemini'
      }
      console.log('[AUTO] roteado para:', resolvedKey)
    }
    let cfg = MODELS[resolvedKey] ?? MODELS.gemini
    let sysPrompt = system || 'Você é um assistente empresarial. Responda em português brasileiro.'
    sysPrompt += '\n\nIMPORTANTE: Ao final de toda resposta, inclua 2-4 perguntas de follow-up usando blockquote (>). DEVEM ser perguntas terminando com "?", curtas, sem emojis. Quando estiver respondendo com base em documentos (RAG), as perguntas DEVEM ser respondíveis pelos documentos fornecidos — NÃO sugira perguntas cujas respostas não estejam nos documentos. Exemplo:\n> Qual o faturamento deste mês?\n> Quais produtos mais vendem?'

    // RAG: buscar documentos relevantes e injetar no system prompt
    let ragUsed = false
    let ragSources: RAGSource[] = []
    if (rag) {
      console.log('[RAG] rag=true, buscando...')
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
      const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''
      console.log('[RAG] query:', query?.slice(0, 100))
      if (query) {
        const ragResult = await searchRAG(query, source_files)
        console.log('[RAG] contexto encontrado:', ragResult ? ragResult.context.length + ' chars' : 'nenhum')
        if (ragResult) {
          sysPrompt += `

REGRA RAG OBRIGATÓRIA — ANTI-ALUCINAÇÃO:
1. Sua resposta DEVE ser baseada EXCLUSIVAMENTE nos documentos fornecidos abaixo.
2. SEMPRE cite os documentos consultados pelo nome entre aspas.
3. Se os documentos NÃO contêm informação suficiente para responder, diga EXATAMENTE: "Os documentos consultados não contêm essa informação." e PARE. NÃO invente, NÃO complete com conhecimento geral, NÃO suponha.
4. NÃO associe o conteúdo dos documentos a nenhuma empresa ou contexto externo — descreva o que os documentos dizem, nada mais.
5. Se o documento parece incompleto ou contém apenas metadados, informe: "O conteúdo indexado deste documento parece incompleto ou contém apenas metadados."`
          let lastUserContent = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')?.content ?? ''
          lastUserContent = lastUserContent.replace(/\n*\[NOTA:.*$/s, '').trim()
          const ragMessage = ragResult.context + '\n\nCom base nos documentos acima, responda a seguinte pergunta:\n\n' + lastUserContent
          ragUsed = true
          ragSources = ragResult.sources
          console.log('[RAG] pergunta limpa:', lastUserContent.slice(0, 100))
          console.log('[RAG] msg total:', ragMessage.length, 'chars')
          // Substituir messages por nova array com apenas a mensagem RAG
          while (messages.length > 0) messages.pop()
          messages.push({ role: 'user', content: ragMessage })
        } else {
          // RAG ligado mas nenhum documento relevante encontrado
          sysPrompt += '\n\nNenhum documento relevante foi encontrado na base de conhecimento para esta pergunta. Responda apenas com informações que você tem certeza. Se não souber, diga "Não encontrei informações sobre isso na base de conhecimento." NÃO invente dados, números, listas de produtos ou informações específicas sobre a empresa.'
        }
      }
    } else {
      console.log('[RAG] rag=false, pulando')
    }

    if (cfg.provider === 'anthropic' && !ANTHROPIC_KEY) return jsonRes({ error: 'ANTHROPIC_API_KEY não configurada' }, 500)
    if (cfg.provider === 'gemini' && !GEMINI_KEY) return jsonRes({ error: 'GEMINI_KEY não configurada' }, 500)
    if (cfg.provider === 'openai_compat' && cfg.keyEnv && !Deno.env.get(cfg.keyEnv)) return jsonRes({ error: `${cfg.keyEnv} não configurada` }, 500)

    let result: { content: string; usage: { input_tokens: number; output_tokens: number }; tool_calls?: { id: string; name: string; input: unknown }[]; stop_reason?: string }

    // Truncar mensagens para modelos com limite de input
    if (cfg.maxInput) {
      const maxChars = cfg.maxInput * 3 // ~3 chars por token
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i] as { role: string; content: string }
        if (typeof m.content === 'string' && m.content.length > maxChars) {
          m.content = m.content.slice(0, maxChars) + '\n\n[... contexto truncado por limite do modelo]'
          console.log(`[TRUNCATE] msg ${i} truncada para ${maxChars} chars`)
        }
      }
    }

    console.log('[CALL] provider:', cfg.provider, 'msgs:', messages.length, 'sysPrompt (100):', sysPrompt.slice(0, 100))

    const callModel = async (c: ModelCfg) => {
      if (c.provider === 'gemini') {
        const r = await callGemini(c.id, messages as { role: string; content: string }[], sysPrompt)
        return { ...r, tool_calls: undefined } as typeof result
      } else if (c.provider === 'openai_compat') {
        const r = await callOpenAICompat(c, messages as { role: string; content: string }[], sysPrompt)
        return { ...r, tool_calls: undefined } as typeof result
      } else {
        return await callAnthropic(c.id, messages, sysPrompt, c.maxTokens)
      }
    }

    try {
      result = await callModel(cfg)
    } catch (err: unknown) {
      const errMsg = String(err)
      console.error('[ERROR] modelo principal falhou:', cfg.id, errMsg.slice(0, 200))
      // Fallback para qualquer erro (rate limit, safety filter, timeout, etc.)
      const fallbacks = ['gemini', 'groq', 'mistral'].filter(k => k !== resolvedKey)
      console.log('[FALLBACK] tentando:', fallbacks)
      let ok = false
      for (const fb of fallbacks) {
        const fbCfg = MODELS[fb]
        if (!fbCfg || (fbCfg.keyEnv && !Deno.env.get(fbCfg.keyEnv))) continue
        try {
          result = await callModel(fbCfg)
          cfg = fbCfg
          ok = true
          console.log('[FALLBACK] sucesso com', fb)
          break
        } catch (fbErr) { console.warn('[FALLBACK]', fb, 'falhou:', String(fbErr).slice(0, 100)); continue }
      }
      if (!ok) {
        return jsonRes({ content: 'Todos os modelos falharam. Tente novamente em alguns instantes.', model: 'erro', usage: { input_tokens: 0, output_tokens: 0 } })
      }
    }

    logUsage('assistente-chat', cfg.id, result.usage.input_tokens, result.usage.output_tokens)

    return jsonRes({
      content: result.content,
      usage: result.usage,
      model: cfg.id,
      tool_calls: result.tool_calls,
      stop_reason: result.stop_reason,
      rag_used: ragUsed,
      rag_sources: ragSources.length > 0 ? ragSources : undefined,
    })

  } catch (err) {
    console.error('assistente-chat error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
