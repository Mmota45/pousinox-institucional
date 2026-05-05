// Helper centralizado para chamadas IA nos módulos do ERP
import { supabaseAdmin, supabase } from './supabase'

interface AiChatOpts {
  prompt: string
  system: string
  model?: string  // default 'gemini' (grátis)
}

interface AiChatResult {
  content: string
  usage?: { input_tokens: number; output_tokens: number }
  error?: string
}

/** Chamada de texto via assistente-chat */
export async function aiChat(optsOrPrompt: AiChatOpts | string | { role: string; content: string }[], systemArg?: string): Promise<AiChatResult> {
  let prompt: string, system: string, model: string
  if (typeof optsOrPrompt === 'string') {
    prompt = optsOrPrompt; system = systemArg || ''; model = 'gemini'
  } else if (Array.isArray(optsOrPrompt)) {
    prompt = optsOrPrompt.map(m => m.content).join('\n'); system = systemArg || ''; model = 'gemini'
  } else {
    prompt = optsOrPrompt.prompt; system = optsOrPrompt.system; model = optsOrPrompt.model || 'gemini'
  }
  return _aiChat({ prompt, system, model })
}

async function _aiChat({ prompt, system, model = 'gemini' }: AiChatOpts): Promise<AiChatResult> {
  const { data, error } = await supabaseAdmin.functions.invoke('assistente-chat', {
    body: {
      messages: [{ role: 'user', content: prompt }],
      system,
      model,
    },
  })
  if (error) return { content: '', error: String(error) }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (parsed.error) return { content: '', error: parsed.error }
  return { content: parsed.content ?? '', usage: parsed.usage }
}

interface AiVisionOpts {
  imageBase64: string
  mimeType: string
  filename: string
  system?: string
}

/** Chamada de visão (imagem) via assistente-arquivo */
export async function aiVision({ imageBase64, mimeType, filename }: AiVisionOpts): Promise<AiChatResult> {
  const { data, error } = await supabaseAdmin.functions.invoke('assistente-arquivo', {
    body: { file_base64: imageBase64, mime_type: mimeType, filename },
  })
  if (error) return { content: '', error: String(error) }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (parsed.error) return { content: '', error: parsed.error }
  return { content: parsed.content ?? '', usage: parsed.usage }
}

/* ═══════════════════════════════════════════════════════════
   Multi-IA — chamadas via ai-hub (múltiplos providers)
   ═══════════════════════════════════════════════════════════ */

export interface MultiTarget { provider: string; model: string }
export interface MultiResult { provider: string; model: string; response: string; tempo?: number; error?: string }

/** Chamada direta ao ai-hub (qualquer provider) */
export async function aiHubChat(
  prompt: string,
  target: MultiTarget,
  system?: string,
): Promise<MultiResult> {
  const t0 = Date.now()
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ]
  const { data, error } = await supabase.functions.invoke('ai-hub', {
    body: { action: 'chat', provider: target.provider, model: target.model, messages },
  })
  const tempo = Date.now() - t0
  if (error || !data?.ok) return { ...target, response: '', tempo, error: data?.error || error?.message || 'Erro' }
  return { ...target, response: data.response, tempo }
}

/** Paralelo — dispara N chamadas simultâneas, retorna todas */
export async function aiParallel(
  prompt: string,
  targets: MultiTarget[],
  system?: string,
): Promise<MultiResult[]> {
  const results = await Promise.allSettled(
    targets.map(t => aiHubChat(prompt, t, system))
  )
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...targets[i], response: '', error: String((r as PromiseRejectedResult).reason) }
  )
}

/** Pipeline — encadeia: resposta do step N vira contexto do step N+1 */
export async function aiPipeline(
  prompt: string,
  steps: { target: MultiTarget; system: string }[],
): Promise<MultiResult[]> {
  const results: MultiResult[] = []
  let lastResponse = prompt

  for (const step of steps) {
    const result = await aiHubChat(lastResponse, step.target, step.system)
    results.push(result)
    if (result.error) break
    lastResponse = result.response
  }
  return results
}

/** Revisor — modelo A responde, modelo B valida/critica */
export async function aiReviewer(
  prompt: string,
  main: MultiTarget,
  reviewer: MultiTarget,
  system?: string,
): Promise<{ main: MultiResult; review: MultiResult }> {
  const mainResult = await aiHubChat(prompt, main, system)
  if (mainResult.error) return { main: mainResult, review: { ...reviewer, response: '', error: 'Pulado (erro no principal)' } }

  const reviewResult = await aiHubChat(
    mainResult.response,
    reviewer,
    'Você é um revisor crítico. Analise a resposta abaixo e:\n1. Aponte erros factuais ou lógicos\n2. Identifique omissões importantes\n3. Sugira melhorias\n4. Dê uma nota de 0-10 para a qualidade\nSeja direto e objetivo.',
  )
  return { main: mainResult, review: reviewResult }
}

/** Converte File para base64 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data:...;base64, prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
