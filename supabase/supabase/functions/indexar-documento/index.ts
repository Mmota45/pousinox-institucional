// Edge Function: indexar-documento v2
// Recebe arquivo, extrai texto, gera contexto IA, chunka, gera embeddings Gemini, insere em knowledge_chunks.
//
// POST /functions/v1/indexar-documento
// Body: { file_base64, mime_type, filename, metadata? }

import { logUsage } from '../_shared/logUsage.ts'

const GEMINI_KEY    = Deno.env.get('GEMINI_KEY') ?? Deno.env.get('GEMINI_API_KEY') ?? ''
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

// ── Extrair texto de PDF via Gemini ─────────────────────────────────────────
async function extractTextFromPdf(base64: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Extraia TODO o texto do documento PDF. Retorne apenas o texto extraído, sem formatação extra, sem comentários.' }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
            { text: 'Extraia todo o texto deste PDF.' },
          ],
        }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini PDF extraction ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Chunking ────────────────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
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
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
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
    let texto: string

    if (mime_type === 'application/pdf') {
      texto = await extractTextFromPdf(file_base64)
    } else {
      const bytes = Uint8Array.from(atob(file_base64), c => c.charCodeAt(0))
      texto = new TextDecoder().decode(bytes)
    }

    if (!texto || texto.length < 20) {
      return jsonRes({ error: 'Não foi possível extrair texto suficiente do arquivo.' }, 422)
    }

    // Gerar contexto automático via IA (estilo NotebookLM)
    let contextoIA = ''
    let perguntasSugeridas: string[] = []
    try {
      const ctxRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `Você é um analista documental da Pousinox, indústria que fabrica FIXADORES DE PORCELANATO em aço inoxidável 304 e 430.

CONTEXTO OBRIGATÓRIO: A Pousinox fabrica fixadores de porcelanato usando chapas de aço inox 304 e 430 (espessura 0.8mm). Qualquer documento que mencione "chapa inox", "aço inoxidável 304/430", "ensaios mecânicos" ou "SENAI/LAMAT" está DIRETAMENTE relacionado aos fixadores de porcelanato da Pousinox — são ensaios do PRODUTO FINAL.

Gere um RESUMO CONTEXTUAL que OBRIGATORIAMENTE inclua:
1. Tipo e finalidade do documento
2. Quem emitiu e para quem
3. Dados e resultados específicos (valores numéricos, conclusões)
4. SEMPRE mencione "fixadores de porcelanato" e explique que as chapas de inox são o material dos fixadores
5. Palavras-chave: inclua SEMPRE "fixador de porcelanato", "laudo", "certificação"

Seja direto e factual. Máximo 500 palavras.` }] },
            contents: [{ role: 'user', parts: [{ text: `Documento: ${filename}\n\nConteúdo:\n${texto.slice(0, 8000)}` }] }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      )
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json()
        contextoIA = ctxData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        console.log('[indexar] contexto IA:', contextoIA.length, 'chars')
      }
    } catch (err) {
      console.warn('[indexar] erro ao gerar contexto IA:', err)
    }

    // Gerar perguntas sugeridas
    try {
      const pergRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: 'Gere exatamente 3 perguntas que um usuário faria sobre este documento. Responda APENAS com um JSON array de strings, sem markdown. Exemplo: ["pergunta 1?","pergunta 2?","pergunta 3?"]' }] },
            contents: [{ role: 'user', parts: [{ text: texto.slice(0, 4000) }] }],
            generationConfig: { maxOutputTokens: 256 },
          }),
        },
      )
      if (pergRes.ok) {
        const pergData = await pergRes.json()
        const pergText = pergData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const cleanJson = pergText.replace(/```json\n?|\n?```/g, '').trim()
        try { perguntasSugeridas = JSON.parse(cleanJson) } catch { /* ignora parse error */ }
        console.log('[indexar] perguntas:', perguntasSugeridas.length)
      }
    } catch (err) { console.warn('[indexar] erro perguntas:', err) }

    // Chunking
    const chunks = chunkText(texto)

    // Deletar chunks anteriores do mesmo arquivo (re-indexação)
    await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?source_file=eq.${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=minimal' },
    })

    // Inserir chunk de contexto IA (index -1, aparece primeiro nas buscas)
    let totalTokens = 0
    if (contextoIA) {
      const ctxEmbedding = await generateEmbedding(contextoIA)
      totalTokens += Math.ceil(contextoIA.length / 4)
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          source_file: filename,
          chunk_index: -1,
          content: `[CONTEXTO DO DOCUMENTO: ${filename}]\n${contextoIA}`,
          embedding: `[${ctxEmbedding.join(',')}]`,
          metadata: { ...(metadata ?? {}), tipo: 'contexto_ia' },
        }),
      })
      await new Promise(r => setTimeout(r, 300))
    }

    // Gerar embeddings e inserir chunks do texto
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i])
      totalTokens += Math.ceil(chunks[i].length / 4)

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          source_file: filename,
          chunk_index: i,
          content: chunks[i],
          embedding: `[${embedding.join(',')}]`,
          metadata: metadata ?? {},
        }),
      })
      if (!insRes.ok) {
        const errBody = await insRes.text()
        console.error(`[indexar] insert chunk ${i} failed:`, errBody)
        return jsonRes({ error: `Falha ao salvar chunk ${i}: ${errBody}` }, 500)
      }

      // Rate limit: 300ms entre chamadas
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 300))
    }

    logUsage('indexar-documento', EMBED_MODEL, totalTokens, 0, { filename, chunks: chunks.length })

    return jsonRes({
      success: true,
      filename,
      chunks: chunks.length + (contextoIA ? 1 : 0),
      contexto_gerado: !!contextoIA,
      resumo: contextoIA.slice(0, 500),
      perguntas_sugeridas: perguntasSugeridas,
      characters: texto.length,
    })

  } catch (err) {
    console.error('indexar-documento error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
