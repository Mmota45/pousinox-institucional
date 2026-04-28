import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as base64url } from 'https://deno.land/std@0.168.0/encoding/base64url.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── JWT para Google Service Account ──────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get('GSC_SERVICE_ACCOUNT_JSON') ?? '{}')
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = new TextEncoder()
  const headerB64 = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const signInput = `${headerB64}.${payloadB64}`

  // Import private key
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signInput))
  const sigB64 = base64url(new Uint8Array(signature))

  const jwt = `${signInput}.${sigB64}`

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── GSC Search Analytics ─────────────────────────────────────────────────────

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function queryGSC(token: string, siteUrl: string, startDate: string, endDate: string, dimensions: string[]): Promise<GscRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit: 500,
      dataState: 'all',
    }),
  })
  const data = await res.json()
  return data.rows ?? []
}

// ── DB helper ────────────────────────────────────────────────────────────────

async function dbFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
      ...(opts.headers ?? {}),
    },
  })
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const acao = body.acao ?? 'fetch'
    const dias = body.dias ?? 28

    if (acao === 'fetch') {
      const token = await getAccessToken()
      const endDate = new Date().toISOString().slice(0, 10)
      const startDate = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)

      const sites = [
        'https://pousinox.com.br/',
        'sc-domain:fixadorporcelanato.com.br',
      ]

      const allRows: any[] = []

      for (const site of sites) {
        // Queries por país
        const rows = await queryGSC(token, site, startDate, endDate, ['query', 'country'])
        for (const r of rows) {
          allRows.push({
            query: r.keys[0],
            country: r.keys[1],
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: Math.round(r.position * 100) / 100,
            date: endDate,
            page: site,
            device: null,
            fetched_at: new Date().toISOString(),
          })
        }
      }

      // Limpar cache antigo e inserir novo
      await dbFetch('gsc_cache?date=eq.' + endDate, { method: 'DELETE' })
      if (allRows.length > 0) {
        // Inserir em lotes de 100
        for (let i = 0; i < allRows.length; i += 100) {
          await dbFetch('gsc_cache', {
            method: 'POST',
            body: JSON.stringify(allRows.slice(i, i + 100)),
          })
        }
      }

      return json({ ok: true, total: allRows.length, sites: sites.length })
    }

    if (acao === 'read') {
      // Ler do cache
      const limit = body.limit ?? 50
      const res = await dbFetch(
        `gsc_cache?select=*&order=impressions.desc&limit=${limit}`,
        { headers: { Prefer: 'return=representation' } }
      )
      const data = await res.json()
      return json({ ok: true, data })
    }

    if (acao === 'summary') {
      // Resumo: top queries, total clicks/impressions
      const res = await dbFetch(
        'gsc_cache?select=query,clicks,impressions,ctr,position&order=impressions.desc&limit=100',
        { headers: { Prefer: 'return=representation' } }
      )
      const rows = await res.json()

      const totalClicks = (rows ?? []).reduce((s: number, r: any) => s + r.clicks, 0)
      const totalImpressions = (rows ?? []).reduce((s: number, r: any) => s + r.impressions, 0)
      const avgPosition = (rows ?? []).length > 0
        ? (rows ?? []).reduce((s: number, r: any) => s + r.position, 0) / rows.length
        : 0

      return json({
        ok: true,
        data: {
          totalClicks,
          totalImpressions,
          avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
          avgPosition: Math.round(avgPosition * 10) / 10,
          topQueries: (rows ?? []).slice(0, 20),
          totalQueries: (rows ?? []).length,
        },
      })
    }

    return json({ error: `Ação desconhecida: ${acao}` }, 400)
  } catch (err) {
    console.error('central-vendas-gsc error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
