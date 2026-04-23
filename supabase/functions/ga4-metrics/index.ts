const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROPERTY_ID = '530616170'

const brasilFilter = {
  dimensionFilter: {
    filter: {
      fieldName: 'country',
      stringFilter: { matchType: 'EXACT', value: 'Brazil' },
    },
  },
}

async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const signingInput = `${enc(header)}.${enc(payload)}`

  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData))
  return tokenData.access_token
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const saJson = Deno.env.get('GOOGLE_SA_JSON') ?? ''
    if (!saJson) throw new Error('GOOGLE_SA_JSON não configurado')
    const sa = JSON.parse(saJson)

    const token = await getAccessToken(sa)

    const params = new URL(req.url).searchParams

    // ── Tempo Real ──────────────────────────────────────────────────────────
    if (params.get('realtime') === '1') {
      const runRT = async (body: unknown) => {
        const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runRealtimeReport`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await r.json()
        if (!r.ok || data.error) throw new Error(JSON.stringify(data.error ?? data))
        return data
      }

      const [rAtivos, rPaginas, rDispositivos, rCidades] = await Promise.all([
        runRT({ metrics: [{ name: 'activeUsers' }] }),
        runRT({
          dimensions: [{ name: 'unifiedScreenName' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 5,
        }),
        runRT({
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        }),
        runRT({
          dimensions: [{ name: 'city' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 5,
          dimensionFilter: {
            filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Brazil' } },
          },
        }),
      ])

      const deviceLabel: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }

      return new Response(JSON.stringify({
        ativos: parseInt(rAtivos.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
        paginas: (rPaginas.rows ?? []).map((r: { dimensionValues: {value:string}[]; metricValues: {value:string}[] }) => ({
          pagina: r.dimensionValues[0].value,
          usuarios: parseInt(r.metricValues[0].value),
        })),
        dispositivos: (rDispositivos.rows ?? []).map((r: { dimensionValues: {value:string}[]; metricValues: {value:string}[] }) => ({
          tipo: deviceLabel[r.dimensionValues[0].value] ?? r.dimensionValues[0].value,
          usuarios: parseInt(r.metricValues[0].value),
        })),
        cidades: (rCidades.rows ?? [])
          .map((r: { dimensionValues: {value:string}[]; metricValues: {value:string}[] }) => ({
            cidade: r.dimensionValues[0].value,
            usuarios: parseInt(r.metricValues[0].value),
          }))
          .filter(c => c.cidade && c.cidade !== '(not set)'),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Relatório histórico ──────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)
    const startDate = params.get('startDate') ?? (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
    const endDate = params.get('endDate') ?? today
    const d7ago = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })()

    const run = async (body: unknown) => {
      const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(JSON.stringify(data.error ?? data))
      return data
    }

    const [r30, r7, rPaginas, rCanais, rCidades, rEstados] = await Promise.all([
      // Métricas gerais — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }],
        ...brasilFilter,
      }),
      // Métricas 7 dias fixos, apenas Brasil
      run({
        dateRanges: [{ startDate: d7ago, endDate: today }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        ...brasilFilter,
      }),
      // Top páginas — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
        ...brasilFilter,
      }),
      // Canais de tráfego — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6,
        ...brasilFilter,
      }),
      // Top cidades — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'city' }, { name: 'region' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
        ...brasilFilter,
      }),
      // Top estados — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'region' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
        ...brasilFilter,
      }),
    ])

    const m30 = r30.rows?.[0]?.metricValues ?? []
    const m7 = r7.rows?.[0]?.metricValues ?? []

    const resultado = {
      ultimos30dias: {
        sessoes: parseInt(m30[0]?.value ?? '0'),
        usuarios: parseInt(m30[1]?.value ?? '0'),
        taxaRejeicao: parseFloat(m30[2]?.value ?? '0'),
        duracaoMedia: parseFloat(m30[3]?.value ?? '0'),
      },
      ultimos7dias: {
        sessoes: parseInt(m7[0]?.value ?? '0'),
        usuarios: parseInt(m7[1]?.value ?? '0'),
      },
      topPaginas: (rPaginas.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        titulo: r.dimensionValues[0].value,
        visualizacoes: parseInt(r.metricValues[0].value),
      })),
      canais: (rCanais.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        canal: r.dimensionValues[0].value,
        sessoes: parseInt(r.metricValues[0].value),
      })),
      cidades: (rCidades.rows ?? [])
        .map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
          cidade: r.dimensionValues[0].value,
          estado: r.dimensionValues[1].value,
          usuarios: parseInt(r.metricValues[0].value),
        }))
        .filter(c => c.cidade && c.cidade !== '(not set)'),
      estados: (rEstados.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        estado: r.dimensionValues[0].value,
        usuarios: parseInt(r.metricValues[0].value),
      })),
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
