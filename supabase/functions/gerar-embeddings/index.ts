// Edge Function: gerar-embeddings
// Gera embeddings vetoriais para projetos pendentes usando Gemini text-embedding.
// Chamada manualmente (backfill) ou automaticamente após salvar projeto.
//
// POST /functions/v1/gerar-embeddings
// Body (opcional): { projeto_id: number }  — se omitido, processa todos os pendentes

import { logUsage } from '../_shared/logUsage.ts'

const GEMINI_KEY    = Deno.env.get('GEMINI_KEY')            ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')          ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MODELO        = 'gemini-embedding-001'
const MODELO_LABEL  = 'gemini-embedding-001-3072'
const GEMINI_EMBED  = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:embedContent`

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
}

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Monta texto_base a partir do projeto e seus atributos ─────────────────────
function montarTextoBase(segmento: string | null, titulo: string, atributos: { chave: string; valor: string }[]): string {
  const attrs = atributos
    .filter(a => a.chave && a.valor)
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .map(a => `${a.chave}=${a.valor}`)
    .join(', ')
  return `${segmento ?? 'geral'}: ${titulo}${attrs ? '. ' + attrs : ''}`
}

// ── Gera embedding via Gemini ─────────────────────────────────────────────────
async function gerarEmbedding(texto: string): Promise<number[]> {
  const res = await fetch(`${GEMINI_EMBED}?key=${GEMINI_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: texto }] },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const json = await res.json()
  // Estima tokens (~4 chars/token) — Gemini embedding não retorna usage
  const estTokens = Math.ceil(texto.length / 4)
  logUsage('gerar-embeddings', 'gemini-embedding-001', estTokens, 0)
  return json.embedding.values as number[]
}

// ── Upsert embedding no banco ─────────────────────────────────────────────────
async function salvarEmbedding(projeto_id: number, embedding: number[], texto_base: string) {
  const conteudo_hash = await hashMd5(texto_base)
  const agora = new Date().toISOString()

  const res = await fetch(`${SUPABASE_URL}/rest/v1/projeto_embeddings`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      projeto_id,
      embedding:     '[' + embedding.join(',') + ']',
      modelo:        MODELO_LABEL,
      texto_base,
      conteudo_hash,
      status:        'valido',
      gerado_em:     agora,
      updated_at:    agora,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase upsert error ${res.status}: ${err}`)
  }
}

// ── Marca projeto como erro ───────────────────────────────────────────────────
async function marcarErro(projeto_id: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/projeto_embeddings`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ projeto_id, status: 'erro', updated_at: new Date().toISOString() }),
  })
}

// ── MD5 simples via Web Crypto (Deno) ─────────────────────────────────────────
async function hashMd5(text: string): Promise<string> {
  // Deno não tem MD5 nativo — usa SHA-1 truncado como hash de conteúdo
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// ── Buscar projetos para processar ────────────────────────────────────────────
async function buscarProjetos(projeto_id?: number): Promise<{ projeto_id: number; titulo: string; segmento: string | null; atributos: { chave: string; valor: string }[] }[]> {
  // Chama RPC que já filtra pendentes/invalidados
  let url = `${SUPABASE_URL}/rest/v1/rpc/listar_projetos_para_embedding`
  if (projeto_id) {
    // Busca projeto específico independente do status
    url = `${SUPABASE_URL}/rest/v1/rpc/listar_projeto_para_embedding_por_id`
  }

  const res = await fetch(url, {
    method:  projeto_id ? 'POST' : 'GET',
    headers,
    body:    projeto_id ? JSON.stringify({ p_projeto_id: projeto_id }) : undefined,
  })

  if (!res.ok) {
    // Fallback: busca direta na tabela
    const projRes = await fetch(
      `${SUPABASE_URL}/rest/v1/projetos?select=id,titulo,segmento${projeto_id ? `&id=eq.${projeto_id}` : ''}`,
      { headers }
    )
    const projetos = await projRes.json()

    const result = []
    for (const p of projetos) {
      const attrRes = await fetch(
        `${SUPABASE_URL}/rest/v1/projeto_atributos?projeto_id=eq.${p.id}&select=chave,valor&order=chave`,
        { headers }
      )
      const atributos = await attrRes.json()
      result.push({ projeto_id: p.id, titulo: p.titulo, segmento: p.segmento, atributos })
    }
    return result
  }

  const data = await res.json()
  return (data ?? []).map((r: { projeto_id: number; titulo: string; segmento: string | null; atributos: { chave: string; valor: string }[] }) => r)
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    // Modo query: retorna só o vetor sem salvar (usado pelo shadow mode do frontend)
    // POST { mode: 'query', titulo, segmento, atributos: [{chave, valor}] }
    if (body.mode === 'query') {
      const texto = montarTextoBase(body.segmento ?? null, body.titulo ?? '', body.atributos ?? [])
      const embedding = await gerarEmbedding(texto)
      return new Response(
        JSON.stringify({ ok: true, embedding, texto_base: texto }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let projeto_id: number | undefined = body.projeto_id ?? undefined

    const projetos = await buscarProjetos(projeto_id)

    if (projetos.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processados: 0, mensagem: 'Nenhum projeto pendente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resultados: { projeto_id: number; status: string; erro?: string }[] = []

    for (const p of projetos) {
      try {
        const texto = montarTextoBase(p.segmento, p.titulo, p.atributos)
        const embedding = await gerarEmbedding(texto)
        await salvarEmbedding(p.projeto_id, embedding, texto)
        resultados.push({ projeto_id: p.projeto_id, status: 'ok' })
      } catch (e) {
        await marcarErro(p.projeto_id)
        resultados.push({ projeto_id: p.projeto_id, status: 'erro', erro: String(e) })
      }

      // Delay entre chamadas para respeitar rate limit do Gemini
      if (projetos.length > 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processados: resultados.length, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, erro: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
