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
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
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

    // ── Teste GSC ──────────────────────────────────────────────────────────
    // ── Search Console ──────────────────────────────────────────────────────
    if (params.get('gsc') === '1') {
      const siteUrl = 'https://pousinox.com.br/'
      const gscStart = params.get('startDate') ?? (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10) })()
      const gscEnd = params.get('endDate') ?? new Date().toISOString().slice(0, 10)

      const gscRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: gscStart,
          endDate: gscEnd,
          dimensions: ['query'],
          rowLimit: 20,
        }),
      })
      const gscData = await gscRes.json()
      if (!gscRes.ok || gscData.error) throw new Error(JSON.stringify(gscData.error ?? gscData))

      // Top páginas por query
      const gscPagesRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: gscStart,
          endDate: gscEnd,
          dimensions: ['page'],
          rowLimit: 10,
        }),
      })
      const gscPagesData = await gscPagesRes.json()

      // Oportunidades: posição 5-20 (quase na 1ª página ou início da 2ª)
      const gscOppRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: gscStart,
          endDate: gscEnd,
          dimensions: ['query'],
          rowLimit: 50,
        }),
      })
      const gscOppData = await gscOppRes.json()
      const oportunidades = (gscOppData.rows ?? [])
        .filter((r: { position: number }) => r.position >= 5 && r.position <= 20)
        .slice(0, 15)

      return new Response(JSON.stringify({
        queries: (gscData.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
          query: r.keys[0],
          cliques: r.clicks,
          impressoes: r.impressions,
          ctr: r.ctr,
          posicao: r.position,
        })),
        paginas: (gscPagesData.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
          pagina: r.keys[0].replace('https://pousinox.com.br', ''),
          cliques: r.clicks,
          impressoes: r.impressions,
          ctr: r.ctr,
          posicao: r.position,
        })),
        oportunidades: oportunidades.map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
          query: r.keys[0],
          cliques: r.clicks,
          impressoes: r.impressions,
          ctr: r.ctr,
          posicao: r.position,
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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

    const [r30, r7, rPaginas, rCanais, rCidades, rEstados, rDispositivos, rNovosRec, rConversoes, rDiario] = await Promise.all([
      // Métricas gerais — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }, { name: 'screenPageViews' }],
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
      // Dispositivos — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        ...brasilFilter,
      }),
      // Novos vs Recorrentes — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        ...brasilFilter,
      }),
      // Conversões (eventos-chave) — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Brazil' } } },
              { filter: { fieldName: 'eventName', inListFilter: { values: ['whatsapp_click', 'generate_lead', 'form_submit', 'contact_click'] } } },
            ],
          },
        },
      }),
      // Evolução diária — período selecionado, apenas Brasil
      run({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        ...brasilFilter,
      }),
    ])

    const m30 = r30.rows?.[0]?.metricValues ?? []
    const m7 = r7.rows?.[0]?.metricValues ?? []

    const deviceLabel: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }
    const eventoLabel: Record<string, string> = {
      whatsapp_click: 'Cliques WhatsApp',
      generate_lead: 'Leads gerados',
      form_submit: 'Formulários enviados',
      contact_click: 'Cliques contato',
    }

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
      pageviews: parseInt(m30[4]?.value ?? '0'),
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
      dispositivos: (rDispositivos.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        tipo: deviceLabel[r.dimensionValues[0].value] ?? r.dimensionValues[0].value,
        sessoes: parseInt(r.metricValues[0].value),
      })),
      novosVsRecorrentes: (rNovosRec.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        tipo: r.dimensionValues[0].value,
        usuarios: parseInt(r.metricValues[0].value),
      })),
      conversoes: (rConversoes.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        evento: eventoLabel[r.dimensionValues[0].value] ?? r.dimensionValues[0].value,
        total: parseInt(r.metricValues[0].value),
      })),
      diario: (rDiario.rows ?? []).map((r: { dimensionValues: {value: string}[]; metricValues: {value: string}[] }) => ({
        data: r.dimensionValues[0].value,
        sessoes: parseInt(r.metricValues[0].value),
        usuarios: parseInt(r.metricValues[1].value),
        pageviews: parseInt(r.metricValues[2].value),
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
