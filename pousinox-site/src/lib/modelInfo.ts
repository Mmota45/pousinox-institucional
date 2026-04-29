/**
 * Mapa central de informações sobre modelos de IA.
 * Usado em AdminUso, Hub IA e Assistente para exibir especialidades.
 * Chave = model ID (ou padrão parcial). Atualizar ao adicionar modelos novos.
 */

export interface ModelMeta {
  /** Ícone + habilidade principal */
  skill: string
  /** Tags curtas */
  tags: string[]
  /** Data de lançamento aproximada (para ordenação) */
  released?: string
}

const MODEL_INFO: Record<string, ModelMeta> = {
  // ── Claude ──
  'claude-haiku-4-5-20251001':    { skill: '⚡ Ultra-rápido, custo baixo', tags: ['rápido','barato','classificação'], released: '2025-10' },
  'claude-sonnet-4-6-20250514':   { skill: '🧠 Raciocínio avançado', tags: ['raciocínio','código','análise'], released: '2025-05' },

  // ── Gemini ──
  'gemini-2.5-flash':             { skill: '📄 Contexto 1M tokens, multimodal', tags: ['contexto longo','visão','rápido'], released: '2025-03' },
  'gemini-embedding-001':         { skill: '🔢 Embeddings semânticos', tags: ['embeddings','busca'], released: '2024-12' },

  // ── Groq (inferência ultra-rápida) ──
  'llama-3.3-70b-versatile':      { skill: '🎯 Propósito geral, muito rápido', tags: ['versátil','rápido','multilingual'], released: '2024-12' },
  'llama-3.1-8b-instant':         { skill: '⚡ Ultra-leve, latência mínima', tags: ['leve','chat','classificação'], released: '2024-07' },
  'mixtral-8x7b-32768':           { skill: '🌍 Multilingual, contexto 32K', tags: ['multilingual','código','32K ctx'], released: '2024-01' },
  'gemma2-9b-it':                 { skill: '📝 Texto conciso e preciso', tags: ['compacto','instrução','eficiente'], released: '2024-06' },
  'llama-3.2-90b-vision-preview': { skill: '👁️ Visão + texto, multimodal', tags: ['imagens','visão','análise visual'], released: '2024-09' },
  'deepseek-r1-distill-llama-70b':{ skill: '🧮 Raciocínio matemático/lógico', tags: ['matemática','lógica','chain-of-thought'], released: '2025-01' },
  'mistral-saba-24b':             { skill: '🌐 Foco Oriente Médio/Sul Asiático', tags: ['multilingual','regional','eficiente'], released: '2025-02' },
  'qwen-qwq-32b':                 { skill: '🧮 Raciocínio profundo, debate interno', tags: ['raciocínio','matemática','reflexão'], released: '2025-03' },

  // ── Cerebras (chip dedicado) ──
  'llama-3.3-70b':                { skill: '🚀 Inferência mais rápida do mundo', tags: ['velocidade recorde','propósito geral'], released: '2024-12' },
  'qwen-3-235b-a22b-instruct-2507': { skill: '🧠 235B params, raciocínio denso', tags: ['enorme','raciocínio','instrução'], released: '2025-07' },

  // ── Mistral ──
  'mistral-small-latest':         { skill: '⚡ Leve e eficiente, bom em francês', tags: ['europeu','leve','código'], released: '2024-09' },

  // ── Cohere ──
  'command-a-03-2025':            { skill: '🔍 RAG e busca empresarial', tags: ['RAG','busca','enterprise'], released: '2025-03' },
  'command-r7b-12-2024':          { skill: '🔍 RAG compacto, baixo custo', tags: ['RAG','leve','retrieval'], released: '2024-12' },

  // ── HuggingFace ──
  'mistralai/Mistral-7B-Instruct-v0.3':    { skill: '⚡ Leve, bom para prototipagem', tags: ['leve','instrução','open-source'], released: '2024-05' },
  'google/gemma-2-2b-it':                  { skill: '🔬 Ultra-compacto 2B, edge deploy', tags: ['tiny','edge','eficiente'], released: '2024-06' },
  'microsoft/Phi-3-mini-4k-instruct':      { skill: '📊 Forte em matemática para o tamanho', tags: ['matemática','compacto','Microsoft'], released: '2024-04' },
  'meta-llama/Llama-3.1-8B-Instruct':      { skill: '🎯 Versátil, base sólida 8B', tags: ['versátil','instrução','Meta'], released: '2024-07' },
  'Qwen/Qwen2.5-72B-Instruct':            { skill: '💻 Forte em código e matemática', tags: ['código','matemática','72B'], released: '2024-09' },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { skill: '🌍 MoE multilingual, eficiente', tags: ['MoE','multilingual','46B'], released: '2024-01' },

  // ── Together ──
  'meta-llama/Llama-3.3-70B-Instruct-Turbo':    { skill: '🎯 Versátil otimizado, Turbo', tags: ['rápido','versátil','Turbo'], released: '2024-12' },
  'Qwen/Qwen2.5-72B-Instruct-Turbo':            { skill: '💻 Código + math, acelerado', tags: ['código','Turbo','72B'], released: '2024-09' },
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B':  { skill: '🧮 Raciocínio step-by-step', tags: ['raciocínio','matemática','CoT'], released: '2025-01' },
  'meta-llama/Llama-3.1-405B-Instruct-Turbo':   { skill: '🏆 Maior Llama, máxima qualidade', tags: ['405B','top-tier','Turbo'], released: '2024-07' },

  // ── Cloudflare ──
  '@cf/meta/llama-3.1-8b-instruct':              { skill: '🌐 Edge global, baixa latência', tags: ['edge','CDN','leve'], released: '2024-07' },
  '@cf/mistral/mistral-7b-instruct-v0.1':        { skill: '🌐 Edge europeu, multilingual', tags: ['edge','europeu','leve'], released: '2023-12' },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b':{ skill: '🧮 Raciocínio no edge', tags: ['raciocínio','edge','32B'], released: '2025-01' },
  '@cf/qwen/qwen2.5-coder-32b-instruct':         { skill: '💻 Código no edge, 32B', tags: ['código','edge','32B'], released: '2024-11' },

  // ── OpenRouter ──
  'google/gemini-2.5-flash-exp:free':             { skill: '📄 Contexto 1M, grátis', tags: ['contexto longo','free','Google'], released: '2025-03' },
  'meta-llama/llama-3.3-70b-instruct:free':       { skill: '🎯 Versátil 70B, grátis', tags: ['versátil','free','70B'], released: '2024-12' },
  'mistralai/mistral-7b-instruct:free':           { skill: '⚡ Leve 7B, grátis', tags: ['leve','free','rápido'], released: '2023-12' },
  'qwen/qwen3-coder-480b:free':                   { skill: '💻 Melhor código free, 480B MoE', tags: ['código','free','480B','MoE'], released: '2025-04' },
  'deepseek/deepseek-r1:free':                     { skill: '🧮 Raciocínio top, grátis', tags: ['raciocínio','free','CoT'], released: '2025-01' },
  'nvidia/llama-3.1-nemotron-70b-instruct:free':  { skill: '🤖 Instrução complexa, NVIDIA', tags: ['instrução','free','NVIDIA'], released: '2024-10' },
}

/** Inferência automática de skill por padrões no nome do modelo */
function inferFromName(id: string): ModelMeta {
  const l = id.toLowerCase()
  // Código
  if (l.includes('coder') || l.includes('codestral') || l.includes('starcoder') || l.includes('deepcoder'))
    return { skill: '💻 Especialista em código', tags: ['código','programação'] }
  // Visão / multimodal
  if (l.includes('vision') || l.includes('vl') || l.includes('pixtral') || l.includes('llava'))
    return { skill: '👁️ Visão e imagens', tags: ['multimodal','imagens','visão'] }
  // Raciocínio
  if (l.includes('deepseek-r1') || l.includes('qwq') || l.includes('reasoning') || l.includes('think'))
    return { skill: '🧮 Raciocínio e matemática', tags: ['raciocínio','matemática','CoT'] }
  // Embedding
  if (l.includes('embed') || l.includes('bge') || l.includes('e5-'))
    return { skill: '🔢 Embeddings semânticos', tags: ['embeddings','busca'] }
  // Rerank
  if (l.includes('rerank'))
    return { skill: '🔍 Reranking de resultados', tags: ['rerank','busca'] }
  // Imagem / difusão
  if (l.includes('flux') || l.includes('stable-diffusion') || l.includes('sdxl') || l.includes('dall'))
    return { skill: '🎨 Geração de imagens', tags: ['imagem','difusão'] }
  // Áudio
  if (l.includes('whisper') || l.includes('tts') || l.includes('audio'))
    return { skill: '🎙️ Áudio / transcrição', tags: ['áudio','voz'] }
  // Modelos grandes (>100B)
  if (l.includes('405b') || l.includes('480b') || l.includes('671b'))
    return { skill: '🏆 Modelo gigante, máxima qualidade', tags: ['enorme','top-tier'] }
  // Llama
  if (l.includes('llama'))
    return { skill: '🎯 Propósito geral (Meta Llama)', tags: ['versátil','Meta','open-source'] }
  // Mistral / Mixtral
  if (l.includes('mixtral'))
    return { skill: '🌍 MoE multilingual', tags: ['MoE','multilingual','eficiente'] }
  if (l.includes('mistral'))
    return { skill: '⚡ Leve e eficiente (Mistral)', tags: ['europeu','leve','rápido'] }
  // Qwen
  if (l.includes('qwen'))
    return { skill: '💻 Forte em código e math (Qwen)', tags: ['código','matemática','Alibaba'] }
  // Gemma
  if (l.includes('gemma'))
    return { skill: '📝 Compacto e preciso (Google)', tags: ['compacto','Google','eficiente'] }
  // Gemini
  if (l.includes('gemini'))
    return { skill: '📄 Contexto longo, multimodal (Google)', tags: ['contexto longo','Google','visão'] }
  // Claude
  if (l.includes('claude'))
    return { skill: '🧠 Raciocínio avançado (Anthropic)', tags: ['raciocínio','análise','Anthropic'] }
  // GPT
  if (l.includes('gpt') || l.includes('openai'))
    return { skill: '🧠 Propósito geral (OpenAI)', tags: ['versátil','OpenAI'] }
  // Phi
  if (l.includes('phi'))
    return { skill: '📊 Compacto, forte em math (Microsoft)', tags: ['compacto','matemática','Microsoft'] }
  // Command (Cohere)
  if (l.includes('command'))
    return { skill: '🔍 RAG e busca (Cohere)', tags: ['RAG','busca','enterprise'] }
  // DBRX / Databricks
  if (l.includes('dbrx'))
    return { skill: '📊 Dados e analytics (Databricks)', tags: ['dados','enterprise'] }
  // Nemotron / NVIDIA
  if (l.includes('nemotron') || l.includes('nvidia'))
    return { skill: '🤖 Instrução complexa (NVIDIA)', tags: ['instrução','NVIDIA'] }
  // Yi
  if (l.includes('yi-'))
    return { skill: '🌏 Bilíngue chinês-inglês', tags: ['bilíngue','chinês'] }
  // InternLM
  if (l.includes('internlm'))
    return { skill: '🌏 Multilingual asiático', tags: ['multilingual','chinês'] }
  // Fallback genérico
  return { skill: '🤖 Modelo de linguagem', tags: ['chat','texto'] }
}

/**
 * Busca info do modelo. Tenta match exato, depois parcial, depois infere do nome.
 */
export function getModelInfo(modelId: string): ModelMeta {
  if (MODEL_INFO[modelId]) return MODEL_INFO[modelId]
  // Match parcial — útil para IDs com variações de versão
  const lower = modelId.toLowerCase()
  for (const [key, val] of Object.entries(MODEL_INFO)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val
  }
  // Inferência automática pelo nome
  return inferFromName(modelId)
}

/**
 * Retorna skill curto
 */
export function getModelSkill(modelId: string): string {
  return getModelInfo(modelId).skill
}

/**
 * Retorna tags como array
 */
export function getModelTags(modelId: string): string[] {
  return getModelInfo(modelId).tags
}

export default MODEL_INFO
