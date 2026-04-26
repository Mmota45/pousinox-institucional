// Edge Function: assistente-chat
// Proxy multi-modelo para o Assistente IA.
// Suporta tool_use (ações automáticas) no Claude.
//
// POST /functions/v1/assistente-chat
// Body: { messages, system, model?, tool_results? }

import { logUsage } from '../_shared/logUsage.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const GEMINI_KEY    = Deno.env.get('GEMINI_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`

const MODELS: Record<string, { id: string; provider: 'anthropic' | 'gemini'; maxTokens: number }> = {
  haiku:  { id: 'claude-haiku-4-5-20251001',  provider: 'anthropic', maxTokens: 4096 },
  sonnet: { id: 'claude-sonnet-4-6-20250514', provider: 'anthropic', maxTokens: 4096 },
  gemini: { id: 'gemini-2.5-flash',           provider: 'gemini',    maxTokens: 4096 },
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
    throw new Error(`Gemini API ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const um = data.usageMetadata
  return {
    content: text,
    usage: {
      input_tokens: um?.promptTokenCount ?? 0,
      output_tokens: um?.candidatesTokenCount ?? 0,
    },
  }
}

// ── RAG: busca semântica em knowledge_chunks ────────────────────────────────
async function searchRAG(query: string): Promise<string> {
  if (!GEMINI_KEY || !SUPABASE_URL || !SERVICE_KEY) return ''
  try {
    // Gerar embedding da pergunta
    const embRes = await fetch(`${EMBED_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: query }] } }),
    })
    if (!embRes.ok) return ''
    const embData = await embRes.json()
    const embedding = embData.embedding?.values as number[]
    if (!embedding?.length) return ''

    // Buscar chunks similares via RPC
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        query_embedding: '[' + embedding.join(',') + ']',
        match_threshold: 0.65,
        match_count: 5,
      }),
    })
    if (!rpcRes.ok) return ''
    const chunks = await rpcRes.json() as { content: string; source_file: string; similarity: number }[]
    if (!chunks?.length) return ''

    return '\n\n--- DOCUMENTOS RELEVANTES (base de conhecimento) ---\n' +
      chunks.map((c, i) => `[${i + 1}] (${c.source_file}, sim=${c.similarity.toFixed(2)})\n${c.content}`).join('\n\n') +
      '\n--- FIM DOCUMENTOS ---'
  } catch (err) {
    console.warn('[RAG] erro:', err)
    return ''
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, system, model: modelKey, rag } = await req.json()

    if (!messages?.length) return jsonRes({ error: 'messages é obrigatório' }, 400)

    const cfg = MODELS[modelKey] ?? MODELS.haiku
    let sysPrompt = system || 'Você é um assistente empresarial. Responda em português brasileiro.'

    // RAG: buscar documentos relevantes e injetar no system prompt
    if (rag) {
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
      const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''
      if (query) {
        const ragContext = await searchRAG(query)
        if (ragContext) sysPrompt += ragContext
      }
    }

    if (cfg.provider === 'anthropic' && !ANTHROPIC_KEY) return jsonRes({ error: 'ANTHROPIC_API_KEY não configurada' }, 500)
    if (cfg.provider === 'gemini' && !GEMINI_KEY) return jsonRes({ error: 'GEMINI_KEY não configurada' }, 500)

    let result: { content: string; usage: { input_tokens: number; output_tokens: number }; tool_calls?: { id: string; name: string; input: unknown }[]; stop_reason?: string }

    if (cfg.provider === 'gemini') {
      const r = await callGemini(cfg.id, messages as { role: string; content: string }[], sysPrompt)
      result = { ...r, tool_calls: undefined }
    } else {
      result = await callAnthropic(cfg.id, messages, sysPrompt, cfg.maxTokens)
    }

    logUsage('assistente-chat', cfg.id, result.usage.input_tokens, result.usage.output_tokens)

    return jsonRes({
      content: result.content,
      usage: result.usage,
      model: cfg.id,
      tool_calls: result.tool_calls,
      stop_reason: result.stop_reason,
    })

  } catch (err) {
    console.error('assistente-chat error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
