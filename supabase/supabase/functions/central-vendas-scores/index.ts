import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function dbFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(opts.headers ?? {}),
    },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const acao = body.acao ?? 'scores'
    const limit = body.limit ?? 20

    if (acao === 'scores') {
      const uf = body.uf ?? null
      const res = await dbFetch('rpc/fn_top_prospects', {
        method: 'POST',
        body: JSON.stringify({ n: limit, filtro_uf: uf }),
      })
      const data = await res.json()
      return json({ ok: true, data })
    }

    if (acao === 'followups') {
      const status = body.status ?? 'pendente'
      const res = await dbFetch(
        `followups?select=*,prospeccao(id,razao_social,nome_fantasia,cnpj,uf,cidade,telefone1,email),pipeline_deals(id,titulo,estagio,valor_estimado)&status=eq.${status}&order=data_prevista.asc&limit=50`,
        { headers: { Prefer: 'return=representation' } as any }
      )
      const data = await res.json()
      return json({ ok: true, data })
    }

    if (acao === 'dashboard') {
      const hoje = new Date().toISOString().slice(0, 10)
      const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

      // Atividades da semana
      const [atividadesRes, followupsRes, dealsRes] = await Promise.all([
        dbFetch(`activity_log?select=id,tipo,created_at&created_at=gte.${semanaAtras}T00:00:00`, { headers: { Prefer: 'return=representation' } as any }),
        dbFetch(`followups?select=id,status,data_prevista&status=eq.pendente`, { headers: { Prefer: 'return=representation' } as any }),
        dbFetch(`pipeline_deals?select=id,estagio,valor_estimado&created_at=gte.${semanaAtras}T00:00:00`, { headers: { Prefer: 'return=representation' } as any }),
      ])

      const atividades = await atividadesRes.json()
      const followups = await followupsRes.json()
      const deals = await dealsRes.json()

      const contactados = (atividades ?? []).filter((a: any) => a.tipo === 'contacted').length
      const materiaisEnviados = (atividades ?? []).filter((a: any) => a.tipo === 'material_sent').length
      const followupsAtrasados = (followups ?? []).filter((f: any) => f.data_prevista < hoje).length
      const followupsHoje = (followups ?? []).filter((f: any) => f.data_prevista === hoje).length
      const dealsAbertos = (deals ?? []).filter((d: any) => !['ganho', 'perdido'].includes(d.estagio)).length
      const dealsGanhos = (deals ?? []).filter((d: any) => d.estagio === 'ganho').length
      const receitaPipeline = (deals ?? []).filter((d: any) => d.estagio === 'ganho').reduce((s: number, d: any) => s + (d.valor_estimado ?? 0), 0)

      return json({
        ok: true,
        data: {
          contactados, materiaisEnviados,
          followupsAtrasados, followupsHoje,
          dealsAbertos, dealsGanhos, receitaPipeline,
        },
      })
    }

    return json({ error: `Ação desconhecida: ${acao}` }, 400)
  } catch (err) {
    console.error('central-vendas-scores error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
