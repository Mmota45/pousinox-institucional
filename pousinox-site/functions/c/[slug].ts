// Cloudflare Pages Function — intercepta /c/:slug para injetar meta tags OG
// WhatsApp/Telegram/Facebook leem as meta tags sem executar JS, então
// precisamos reescrever o HTML no edge antes de servir.

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3NjE1ODIsImV4cCI6MjA1ODMzNzU4Mn0.6s-QdDVjHROz_IxbPJb6oNabmDjKGBGCcaw9SpuRNMI'

interface Cartao {
  nome: string
  cargo: string | null
  empresa: string | null
  cidade: string | null
  uf: string | null
  foto_url: string | null
  logo_url: string | null
  cor_primaria: string
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const onRequest: PagesFunction = async (context) => {
  const slug = context.params.slug as string
  if (!slug) return context.next()

  // Detectar se é bot/crawler (WhatsApp, Telegram, Facebook, Twitter, etc.)
  const ua = (context.request.headers.get('user-agent') || '').toLowerCase()
  const isBot = /whatsapp|telegrambot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot/i.test(ua)

  // Se não for bot, serve o SPA normalmente
  if (!isBot) return context.next()

  // Buscar dados do cartão no Supabase
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cartoes_digitais?slug=eq.${encodeURIComponent(slug)}&status=eq.publicado&select=nome,cargo,empresa,cidade,uf,foto_url,logo_url,cor_primaria&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Accept': 'application/json',
        },
      }
    )

    if (!res.ok) return context.next()

    const data = await res.json() as Cartao[]
    if (!data.length) return context.next()

    const c = data[0]

    // Montar meta tags
    const title = escapeHtml([c.nome, c.empresa].filter(Boolean).join(' — '))
    const descParts = [c.cargo, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade].filter(Boolean)
    const description = escapeHtml(descParts.length ? descParts.join(' · ') : 'Cartão digital Pousinox®')
    const image = c.foto_url || c.logo_url || 'https://pousinox.com.br/favicon-pousinox.png'
    const url = `https://pousinox.com.br/c/${escapeHtml(slug)}`

    // Servir HTML mínimo com meta tags OG (bots não precisam do SPA inteiro)
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title} — Cartão Digital</title>
  <meta name="description" content="${description}">

  <!-- Open Graph -->
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Pousinox®">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <!-- Redirecionar humanos que chegarem aqui -->
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Redirecionando para o cartão de ${title}...</p>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    // Em caso de erro, serve o SPA normalmente
    return context.next()
  }
}
