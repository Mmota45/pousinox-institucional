// Edge Function: extrair-orcamento
// POST /functions/v1/extrair-orcamento
// Body: { texto: string }
// Retorna: OrcamentoExtraido ou { error: string }

import { normalizeBudget } from './extractor.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { texto } = await req.json() as { texto?: string }

    if (!texto?.trim()) {
      return new Response(JSON.stringify({ error: 'Campo "texto" é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await normalizeBudget(texto)

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error, raw: result.raw }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
