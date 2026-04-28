import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CANVA_CLIENT_ID     = Deno.env.get('CANVA_CLIENT_ID') ?? ''
const CANVA_CLIENT_SECRET = Deno.env.get('CANVA_CLIENT_SECRET') ?? ''
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CANVA_AUTH_URL  = 'https://www.canva.com/api/oauth/authorize'
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'
const CANVA_API       = 'https://api.canva.com/rest/v1'

const SCOPES = [
  'asset:write',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'profile:read',
].join(' ')

// ── Supabase helpers ──
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

async function getStoredToken(): Promise<{ access_token: string; refresh_token: string; expires_at: string } | null> {
  const res = await dbFetch('canva_tokens?order=id.desc&limit=1', { headers: { Prefer: 'return=representation' } as any })
  const rows = await res.json()
  return rows?.[0] ?? null
}

async function saveToken(access_token: string, refresh_token: string, expires_in: number, scope?: string) {
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString()
  // Delete old tokens, keep only latest
  await dbFetch('canva_tokens?id=gt.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } as any })
  await dbFetch('canva_tokens', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' } as any,
    body: JSON.stringify({ access_token, refresh_token, expires_at, scope }),
  })
}

async function getValidToken(): Promise<string | null> {
  const stored = await getStoredToken()
  if (!stored) return null

  // If token expires in less than 5 min, refresh
  if (new Date(stored.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(stored.refresh_token)
    if (!refreshed) return null
    return refreshed
  }
  return stored.access_token
}

async function refreshAccessToken(refresh_token: string): Promise<string | null> {
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    }),
  })
  if (!res.ok) { console.error('Refresh failed:', await res.text()); return null }
  const data = await res.json()
  await saveToken(data.access_token, data.refresh_token ?? refresh_token, data.expires_in, data.scope)
  return data.access_token
}

// ── Canva API call ──
async function canvaFetch(path: string, token: string, opts: RequestInit = {}) {
  return fetch(`${CANVA_API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  })
}

// ── Actions ──

type Acao =
  | 'auth_url'        // Returns OAuth URL to connect Canva
  | 'callback'        // Exchanges auth code for tokens
  | 'status'          // Check if connected
  | 'brand_templates' // List brand templates
  | 'autofill'        // Autofill a template with data
  | 'create_design'   // Create a new design
  | 'export'          // Export design to PNG/PDF
  | 'export_status'   // Check export job status
  | 'upload_asset'    // Upload image asset
  | 'list_designs'    // Search designs

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const acao: Acao = body.acao

    // ── Auth URL ──
    if (acao === 'auth_url') {
      const redirect_uri = body.redirect_uri
      const state = crypto.randomUUID()
      const code_verifier = crypto.randomUUID() + crypto.randomUUID()
      // SHA-256 for PKCE
      const encoder = new TextEncoder()
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(code_verifier))
      const code_challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const url = `${CANVA_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: CANVA_CLIENT_ID,
        redirect_uri,
        scope: SCOPES,
        state,
        code_challenge_method: 'S256',
        code_challenge,
      }).toString()

      return json({ url, state, code_verifier })
    }

    // ── OAuth Callback ──
    if (acao === 'callback') {
      const { code, redirect_uri, code_verifier } = body
      console.log('[canva-api] callback redirect_uri:', redirect_uri)
      console.log('[canva-api] callback code_verifier length:', code_verifier?.length ?? 0)
      const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
          code_verifier,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('[canva-api] callback token exchange failed:', res.status, errText)
        return json({ error: 'Token exchange failed', detail: errText }, 400)
      }
      const data = await res.json()
      console.log('[canva-api] callback token received, prefix:', data.access_token?.substring(0, 20), 'expires_in:', data.expires_in)
      await saveToken(data.access_token, data.refresh_token, data.expires_in, data.scope)
      return json({ ok: true })
    }

    // ── Status ──
    if (acao === 'status') {
      const token = await getValidToken()
      return json({ connected: !!token })
    }

    // ── All other actions require a valid token ──
    const token = await getValidToken()
    if (!token) return json({ error: 'Canva não conectado. Faça a autenticação primeiro.' }, 401)

    // ── Brand Templates ──
    if (acao === 'brand_templates') {
      const query = body.query ? `&query=${encodeURIComponent(body.query)}` : ''
      const res = await canvaFetch(`/brand-templates?ownership=owned${query}`, token)
      return json(await res.json())
    }

    // ── Autofill Template ──
    if (acao === 'autofill') {
      const { brand_template_id, data: fillData, title } = body
      const res = await canvaFetch('/autofills', token, {
        method: 'POST',
        body: JSON.stringify({
          brand_template_id,
          title: title ?? 'Pousinox — Documento',
          data: fillData, // { "field_name": { type: "text", text: "value" } }
        }),
      })
      return json(await res.json())
    }

    // ── Create Design ──
    if (acao === 'create_design') {
      const { design_type, title, width, height } = body
      const payload: Record<string, unknown> = {
        design_type: design_type ?? { type: 'preset', name: 'doc' },
        title: title ?? 'Novo Design Pousinox',
      }
      if (width && height) payload.design_type = { type: 'custom', width, height }
      console.log('[canva-api] create_design token prefix:', token.substring(0, 20))
      console.log('[canva-api] create_design payload:', JSON.stringify(payload))
      const res = await canvaFetch('/designs', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const resData = await res.json()
      console.log('[canva-api] create_design response status:', res.status, JSON.stringify(resData))
      return json(resData)
    }

    // ── Export Design ──
    if (acao === 'export') {
      const { design_id, format, quality } = body
      const res = await canvaFetch('/exports', token, {
        method: 'POST',
        body: JSON.stringify({
          design_id,
          format: { type: format ?? 'pdf' },
          ...(quality ? { quality } : {}),
        }),
      })
      return json(await res.json())
    }

    // ── Export Status ──
    if (acao === 'export_status') {
      const { export_id } = body
      const res = await canvaFetch(`/exports/${export_id}`, token)
      return json(await res.json())
    }

    // ── Upload Asset ──
    if (acao === 'upload_asset') {
      const { url, name } = body
      const res = await canvaFetch('/asset-uploads', token, {
        method: 'POST',
        body: JSON.stringify({
          name_base64: btoa(name ?? 'asset'),
          url,
        }),
      })
      return json(await res.json())
    }

    // ── List/Search Designs ──
    if (acao === 'list_designs') {
      const query = body.query ? `&query=${encodeURIComponent(body.query)}` : ''
      const res = await canvaFetch(`/designs?ownership=owned${query}`, token)
      return json(await res.json())
    }

    return json({ error: `Ação desconhecida: ${acao}` }, 400)

  } catch (err) {
    console.error('canva-api error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
