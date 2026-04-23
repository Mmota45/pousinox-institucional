import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://pousinox.com.br'
const OG_FALLBACK = `${SITE}/og-image.webp`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !uuidRegex.test(id)) {
    return Response.redirect(`${SITE}/pronta-entrega`, 302)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: produto } = await supabase
    .from('produtos_publicos')
    .select('titulo, descricao, fotos, categoria, fabricante')
    .eq('id', id)
    .single()

  const titulo = produto?.titulo ?? 'Equipamento Inox — Pousinox®'
  const descricao = produto?.descricao
    ?? 'Equipamentos em aço inox com pronta entrega em Pouso Alegre, MG. Mesas, bancadas, coifas e pias para restaurantes, hospitais e indústrias.'
  const imagem = produto?.fotos?.[0] ?? OG_FALLBACK
  const categoria = produto?.categoria ? `${produto.categoria} · ` : ''
  const tituloOG = `${titulo} | POUSINOX® Pouso Alegre`
  const sufixo = produto?.fabricante
    ? `— fabricado por ${produto.fabricante}, vendido pela POUSINOX®, Pouso Alegre, MG.`
    : '— POUSINOX®, Pouso Alegre, MG.'
  const descricaoOG = `${categoria}${descricao} ${sufixo}`
  const destino = `${SITE}/pronta-entrega`
  const urlCanonica = req.url

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloOG}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${urlCanonica}" />
  <meta property="og:title" content="${tituloOG}" />
  <meta property="og:description" content="${descricaoOG}" />
  <meta property="og:image" content="${imagem}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="900" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:site_name" content="POUSINOX®" />

  <!-- WhatsApp / Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${tituloOG}" />
  <meta name="twitter:description" content="${descricaoOG}" />
  <meta name="twitter:image" content="${imagem}" />

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
      'Cache-Control': 'public, max-age=300',
    },
  })
})
