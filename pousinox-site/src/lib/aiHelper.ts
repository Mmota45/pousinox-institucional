// Helper centralizado para chamadas IA nos módulos do ERP
import { supabaseAdmin } from './supabase'

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
export async function aiChat({ prompt, system, model = 'gemini' }: AiChatOpts): Promise<AiChatResult> {
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
