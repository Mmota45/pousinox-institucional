import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://pousinox.com.br'
const OG_IMAGE = `${SITE}/og-image.webp`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug') ?? ''

  if (!slug) {
    return Response.redirect(`${SITE}/#/blog`, 302)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: artigo } = await supabase
    .from('artigos')
    .select('titulo, resumo, categoria, data_publicacao, meta_descricao')
    .eq('slug', slug)
    .eq('publicado', true)
    .single()

  if (!artigo) {
    return Response.redirect(`${SITE}/#/blog`, 302)
  }

  const tituloOG = `${artigo.titulo} | POUSINOX®`
  const descricaoOG = `${artigo.meta_descricao || artigo.resumo} — POUSINOX®, Pouso Alegre, MG.`
  const destino = `${SITE}/#/blog/${slug}`
  const urlCanonica = req.url

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloOG}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${urlCanonica}" />
  <meta property="og:title" content="${tituloOG}" />
  <meta property="og:description" content="${descricaoOG}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:site_name" content="POUSINOX®" />
  <meta property="article:published_time" content="${artigo.data_publicacao}" />
  <meta property="article:section" content="${artigo.categoria}" />

  <!-- WhatsApp / Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${tituloOG}" />
  <meta name="twitter:description" content="${descricaoOG}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />

  <link rel="canonical" href="${urlCanonica}" />
</head>
<body>
  <script>window.location.replace("${destino}")</script>
  <p>Redirecionando… <a href="${destino}">Clique aqui</a></p>
</body>
</html>`

  return new Response(html, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
