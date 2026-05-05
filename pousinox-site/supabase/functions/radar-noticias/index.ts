// Edge Function: radar-noticias
// Cron: 0 6 * * * (6h diário)
// Busca notícias do setor e filtra por relevância via IA

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const KEYWORDS = [
  'porcelanato fachada',
  'revestimento fachada ventilada',
  'fixador porcelanato',
  'aço inox construção civil',
  'NBR 13755',
  'queda revestimento fachada',
  'construção civil inox',
  'Expo Revestir',
]

interface RSSItem {
  titulo: string
  resumo: string
  url: string
  fonte: string
}

async function buscarNoticias(): Promise<RSSItem[]> {
  const items: RSSItem[] = []
  const braveKey = Deno.env.get('BRAVE_API_KEY')
  if (!braveKey) return items

  // Buscar via Brave Search (news)
  for (const kw of KEYWORDS.slice(0, 4)) { // limitar para não estourar rate limit
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(kw)}&count=5&freshness=pd`, {
        headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const r of data.results ?? []) {
        items.push({
          titulo: r.title,
          resumo: r.description || '',
          url: r.url,
          fonte: r.meta_url?.hostname || 'web',
        })
      }
    } catch { /* skip */ }
  }

  return items
}

async function filtrarRelevancia(items: RSSItem[]): Promise<(RSSItem & { relevancia: number })[]> {
  if (items.length === 0) return []

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) {
    // Sem IA: relevância baseada em keywords
    return items.map(item => {
      let score = 5
      const t = (item.titulo + ' ' + item.resumo).toLowerCase()
      if (t.includes('porcelanato') || t.includes('fachada')) score += 2
      if (t.includes('inox') || t.includes('fixador')) score += 2
      if (t.includes('nbr') || t.includes('norma')) score += 1
      return { ...item, relevancia: Math.min(score, 10) }
    })
  }

  // Filtrar com IA
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: 'Você avalia relevância de notícias para a Pousinox, fabricante de fixadores de porcelanato em aço inox. Responda APENAS com JSON array de números (0-10) na mesma ordem das notícias. 10=extremamente relevante, 0=irrelevante.',
        }, {
          role: 'user',
          content: items.map((item, i) => `${i + 1}. ${item.titulo} — ${item.resumo}`).join('\n'),
        }],
        temperature: 0,
        max_tokens: 200,
      }),
    })
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    const scores: number[] = JSON.parse(content.replace(/[^[\]0-9,]/g, ''))
    return items.map((item, i) => ({ ...item, relevancia: scores[i] ?? 5 }))
  } catch {
    return items.map(item => ({ ...item, relevancia: 5 }))
  }
}

Deno.serve(async () => {
  const items = await buscarNoticias()
  const scored = await filtrarRelevancia(items)

  // Filtrar score >= 5 e evitar duplicatas por URL
  const relevantes = scored.filter(s => s.relevancia >= 5)

  let inseridos = 0
  for (const n of relevantes) {
    const { data: existe } = await supabase
      .from('noticias_radar')
      .select('id')
      .eq('url', n.url)
      .limit(1)
      .single()

    if (!existe) {
      await supabase.from('noticias_radar').insert({
        titulo: n.titulo,
        resumo: n.resumo,
        url: n.url,
        fonte: n.fonte,
        relevancia: n.relevancia,
      })
      inseridos++
    }
  }

  return new Response(JSON.stringify({ ok: true, encontradas: items.length, relevantes: relevantes.length, inseridas: inseridos }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
