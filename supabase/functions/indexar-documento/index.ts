// Edge Function: indexar-documento
// Recebe arquivo, extrai texto, chunka, gera embeddings Gemini, insere em knowledge_chunks.
//
// POST /functions/v1/indexar-documento
// Body: { file_base64, mime_type, filename, metadata? }

import { logUsage } from '../_shared/logUsage.ts'

const GEMINI_KEY    = Deno.env.get('GEMINI_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Extrair texto de PDF ────────────────────────────────────────────────────
function extractTextFromPdf(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes)
  const parts: string[] = []
  const tjRegex = /\(([^)]*)\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRegex.exec(text)) !== null) parts.push(m[1])
  if (parts.join('').length < 50) {
    const btRegex = /BT\s*([\s\S]*?)\s*ET/g
    while ((m = btRegex.exec(text)) !== null) {
      const innerTj = /\(([^)]*)\)/g
      let im: RegExpExecArray | null
      while ((im = innerTj.exec(m[1])) !== null) parts.push(im[1])
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// ── Chunking ────────────────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk)
    i += chunkSize - overlap
  }
  return chunks
}

// ── Gerar embedding ─────────────────────────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini embedding ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.embedding.values as number[]
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { file_base64, mime_type, filename, metadata } = await req.json()
    if (!file_base64 || !filename) return jsonRes({ error: 'file_base64 e filename são obrigatórios' }, 400)
    if (!GEMINI_KEY) return jsonRes({ error: 'GEMINI_KEY não configurada' }, 500)

    // Decodificar e extrair texto
    const bytes = Uint8Array.from(atob(file_base64), c => c.charCodeAt(0))
    let texto: string

    if (mime_type === 'application/pdf') {
      texto = extractTextFromPdf(bytes)
    } else {
      texto = new TextDecoder().decode(bytes)
    }

    if (!texto || texto.length < 20) {
      return jsonRes({ error: 'Não foi possível extrair texto suficiente do arquivo.' }, 422)
    }

    // Chunking
    const chunks = chunkText(texto)

    // Deletar chunks anteriores do mesmo arquivo (re-indexação)
    await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?source_file=eq.${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=minimal' },
    })

    // Gerar embeddings e inserir
    let totalTokens = 0
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i])
      totalTokens += Math.ceil(chunks[i].length / 4)

      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          source_file: filename,
          chunk_index: i,
          content: chunks[i],
          embedding: '[' + embedding.join(',') + ']',
          metadata: metadata ?? {},
        }),
      })

      // Rate limit: 300ms entre chamadas
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 300))
    }

    logUsage('indexar-documento', EMBED_MODEL, totalTokens, 0, { filename, chunks: chunks.length })

    return jsonRes({
      success: true,
      filename,
      chunks: chunks.length,
      characters: texto.length,
    })

  } catch (err) {
    console.error('indexar-documento error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
