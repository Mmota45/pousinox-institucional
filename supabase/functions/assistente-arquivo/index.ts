// Edge Function: assistente-arquivo
// Analisa arquivos enviados pelo chat do assistente.
// Suporta PDF (texto → Claude), CSV (parse → Claude), imagens (Gemini Vision).
//
// POST /functions/v1/assistente-arquivo
// Body: { file_base64, mime_type, filename, prompt? }

import { logUsage } from '../_shared/logUsage.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const GEMINI_KEY    = Deno.env.get('GEMINI_KEY') ?? ''

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

// ── Extrair texto de PDF (heurística simples) ───────────────────────────────
function extractTextFromPdf(bytes: Uint8Array): string {
  // Extrai strings de texto dos streams do PDF usando regex
  const text = new TextDecoder('latin1').decode(bytes)
  const parts: string[] = []

  // Busca text entre parênteses em operadores Tj/TJ
  const tjRegex = /\(([^)]*)\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRegex.exec(text)) !== null) {
    parts.push(m[1])
  }

  // Se não achou muito com Tj, tenta BT..ET blocks
  if (parts.join('').length < 50) {
    const btRegex = /BT\s*([\s\S]*?)\s*ET/g
    while ((m = btRegex.exec(text)) !== null) {
      const block = m[1]
      const innerTj = /\(([^)]*)\)/g
      let im: RegExpExecArray | null
      while ((im = innerTj.exec(block)) !== null) {
        parts.push(im[1])
      }
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim() || '[Não foi possível extrair texto do PDF]'
}

// ── Parse CSV ───────────────────────────────────────────────────────────────
function parseCsv(text: string): string {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length > 200) {
    return `CSV com ${lines.length} linhas. Primeiras 100:\n${lines.slice(0, 100).join('\n')}\n\n... (truncado, total: ${lines.length} linhas)`
  }
  return text
}

// ── Análise de imagem via Gemini Vision ─────────────────────────────────────
async function analyzeImage(base64: string, mimeType: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini Vision ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const um = data.usageMetadata
  return {
    content,
    usage: { input_tokens: um?.promptTokenCount ?? 0, output_tokens: um?.candidatesTokenCount ?? 0 },
  }
}

// ── Análise de texto via Claude ─────────────────────────────────────────────
async function analyzeText(texto: string, prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${prompt}\n\n--- CONTEÚDO DO ARQUIVO ---\n${texto.slice(0, 50000)}\n--- FIM ---`,
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    content: data.content?.[0]?.text ?? '',
    usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 },
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { file_base64, mime_type, filename, prompt: userPrompt } = await req.json()

    if (!file_base64 || !mime_type) return jsonRes({ error: 'file_base64 e mime_type são obrigatórios' }, 400)

    const defaultPrompt = `Analise este arquivo (${filename || 'sem nome'}) e forneça um resumo detalhado em português. Use markdown com tabelas quando apropriado.`
    const prompt = userPrompt || defaultPrompt

    let result: { content: string; usage: { input_tokens: number; output_tokens: number } }
    let model: string

    if (mime_type.startsWith('image/')) {
      // Imagem → Gemini Vision
      if (!GEMINI_KEY) return jsonRes({ error: 'GEMINI_KEY não configurada' }, 500)
      result = await analyzeImage(file_base64, mime_type, prompt)
      model = 'gemini-2.5-flash'
    } else {
      // PDF ou CSV/texto → Claude
      if (!ANTHROPIC_KEY) return jsonRes({ error: 'ANTHROPIC_API_KEY não configurada' }, 500)
      const bytes = Uint8Array.from(atob(file_base64), c => c.charCodeAt(0))
      let texto: string

      if (mime_type === 'application/pdf') {
        texto = extractTextFromPdf(bytes)
      } else {
        // CSV, TXT, XLSX (tenta como texto)
        texto = new TextDecoder().decode(bytes)
        if (mime_type.includes('csv') || filename?.endsWith('.csv')) {
          texto = parseCsv(texto)
        }
      }

      result = await analyzeText(texto, prompt)
      model = 'claude-haiku-4-5-20251001'
    }

    logUsage('assistente-arquivo', model, result.usage.input_tokens, result.usage.output_tokens)

    return jsonRes({ content: result.content, usage: result.usage, model, filename })

  } catch (err) {
    console.error('assistente-arquivo error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
