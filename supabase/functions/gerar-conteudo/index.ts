const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_KEY = Deno.env.get('GEMINI_KEY') ?? ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  let body: { tema: string; redes: string[]; tom: string; tamanho?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { tema, redes, tom, tamanho = 'medio' } = body

  const tamanhoBlog: Record<string, { palavras: string; secoes: string }> = {
    curto: { palavras: '250 a 350 palavras no total', secoes: '2 a 3 seções curtas' },
    medio: { palavras: '500 a 700 palavras no total', secoes: '3 a 4 seções' },
    longo: { palavras: 'mínimo 900 palavras', secoes: '5 a 6 seções detalhadas' },
  }
  const { palavras: palavrasBlog, secoes: secoesBlog } = tamanhoBlog[tamanho] ?? tamanhoBlog['medio']
  if (!tema || !redes?.length || !tom) {
    return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios: tema, redes, tom' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Passo 1 — pesquisa em tempo real com Google Search grounding
  let contexto = ''
  try {
    const searchRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Pesquise informações atuais sobre: "${tema}" no contexto de equipamentos em aço inox, cozinhas profissionais, hospitais e indústrias no Brasil em 2025/2026. Inclua tendências, notícias recentes ou dados relevantes. Responda em português, máximo 400 palavras.` }]
        }],
        tools: [{ google_search: {} }],
      }),
    })
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      contexto = searchData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }
  } catch {
    // grounding falhou — segue sem contexto adicional
  }

  // Passo 2 — geração de conteúdo estruturado
  const camposRede: string[] = []
  if (redes.includes('linkedin'))  camposRede.push(`"linkedin": "post profissional para LinkedIn (máx 1200 chars), ${tom}, 3 a 5 hashtags relevantes ao final"`)
  if (redes.includes('instagram')) camposRede.push(`"instagram": "legenda para Instagram (máx 300 chars), ${tom}, emojis, 5 a 10 hashtags relevantes ao final, CTA para link na bio"`)
  if (redes.includes('facebook'))  camposRede.push(`"facebook": "post para Facebook (máx 500 chars), ${tom}, emojis moderados, CTA no final"`)
  if (redes.includes('whatsapp'))  camposRede.push(`"whatsapp": "mensagem para WhatsApp Status ou grupos de clientes (máx 280 chars), informal, 1 emoji por linha"`)
  if (redes.includes('email'))     camposRede.push(`"email_assunto": "assunto do e-mail (máx 55 chars)", "email_corpo": "corpo do e-mail em texto corrido (sem HTML), ${tom}, parágrafos curtos, assinatura POUSINOX®"`)
  if (redes.includes('youtube'))   camposRede.push(`"youtube_titulo": "título do vídeo (máx 60 chars, com palavra-chave principal)", "youtube_desc": "descrição do YouTube (400 a 600 chars) com palavras-chave, CTA e link do WhatsApp (35) 3423-8994"`)
  if (redes.includes('blog'))      camposRede.push(`"blog_titulo": "título SEO do artigo (máx 65 chars, incluindo a palavra-chave principal o mais à esquerda possível)", "blog_meta_desc": "meta description para o Google (máx 155 chars, inclui a palavra-chave principal e um CTA implícito, ex: Saiba como... Descubra...)", "blog_palavras_chave": "array com 5 a 8 palavras-chave e variações long-tail relevantes para o tema, priorizando buscas locais (Pouso Alegre, Sul de Minas, Minas Gerais)", "blog_intro": "1 parágrafo de introdução direto ao ponto (2 frases), inclui a palavra-chave principal", "blog_corpo": "${secoesBlog}, cada seção com título em negrito (**Título**) seguido de 1 a 2 parágrafos objetivos — ${palavrasBlog}, ${tom}, linguagem direta e escaneável (o leitor deve conseguir entender lendo só os títulos das seções)", "blog_cta": "1 frase de chamada para ação convidando a contato pelo WhatsApp (35) 3423-8994 ou pousinox.com.br"`)

  const genRes = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `Você é um especialista em SEO e marketing digital B2B para o setor industrial brasileiro.

═══════════════════════════════════════
CONTEXTO FIXO — POUSINOX®
═══════════════════════════════════════

EMPRESA: POUSINOX® — fabricante de equipamentos em aço inox sob medida
LOCALIZAÇÃO: Pouso Alegre, MG | ATENDIMENTO: Brasil
EXPERIÊNCIA: 25 anos de mercado
CONTATO: WhatsApp (35) 3423-8994 | Site: pousinox.com.br

PRODUTOS FABRICADOS (todos 100% sob medida):
• Bancadas inox • Mesas inox (preparo e apoio) • Pias inox (com cubas sob medida)
• Coifas inox • Prateleiras e estantes inox • Ralos inox e ralos lineares inox
• Corrimãos inox • Carrinhos inox • Tampos inox • Suportes e estruturas inox
• Projetos completos de cozinha industrial (do projeto à instalação)

MATERIAIS UTILIZADOS:
• Aço inox 430 — uso geral, boa resistência, custo acessível
• Aço inox 304 — maior resistência à corrosão, padrão profissional
• Aço inox 316 — onde normas exigem (hospitais, laboratórios, indústria química/farmacêutica)
A especificação correta do aço é parte do atendimento consultivo da Pousinox.

SEGMENTOS ATENDIDOS (clientes reais):
• Hospitais e saúde: Santa Casa de Itajubá, Fundação Santaritense de Saúde
• Farmacêutico/laboratorial: Biolab, União Química, Multigel
• Supermercados e varejo: Supermercado Geraldo, Noel Supermercados, Mart Minas
• Restaurantes e hotelaria: Mont Vert, Empório Português, GAMA Hotelaria
• Indústria alimentícia: Maxibom Alimentos, Kerry do Brasil, Guanapack
• Construtoras: RC Borges, Legna, ABC e Dagama Incorporadora
• Educação: Instituto Federal, Univás/FESV
• Pessoas físicas: reformas de alto padrão, cozinhas gourmet, projetos residenciais
(80% PJ, 20% PF)

REGIÃO PRINCIPAL: Sul de Minas Gerais
Cidades atendidas: Pouso Alegre, Extrema, Cambuí, Varginha, Poços de Caldas,
Itajubá, Santa Rita do Sapucaí, Poços de Caldas e toda a região do Sul de Minas.
Entrega e instalação em todo o Brasil.

DIFERENCIAIS REAIS (não usar clichês — usar estes argumentos concretos):
1. Fabricação 100% sob medida — aproveitamento total do espaço, sem adaptações
2. Corrige e refaz trabalhos mal executados pela concorrência — experiência comprovada
3. Especifica o aço correto para cada aplicação (430, 304 ou 316)
4. Projetos completos: da bancada avulsa à cozinha industrial inteira equipada
5. Atendimento consultivo: "o que eu posso te ajudar hoje?" — escuta antes de vender
6. Presença local no Sul de Minas com entrega para o Brasil

TOM DE VOZ:
• Consultivo e próximo — nunca arrogante ou genérico
• Técnico quando necessário, acessível sempre
• Orgulho de origem: "feito no Sul de Minas para o Brasil"
• Foco no problema do cliente, não no produto

QUEBRA DE OBJEÇÕES (incorporar naturalmente ao conteúdo, nunca de forma forçada):
• "É caro" → inox dura 20-30 anos; custo por ano é menor que refazer alumínio ou plástico a cada 3-5 anos
• "Tem opção mais barata" → alumínio corrói com produtos de limpeza; plástico não atende ANVISA; inox é a única opção higiênica de longo prazo
• "Compro pronto na internet" → medida padrão não existe em cozinha profissional; sob medida aproveita 100% do espaço
• "Concorrente cobra menos" → a Pousinox já foi chamada para corrigir trabalhos da concorrência; qualidade é obrigação, não promessa

FRASES QUE REPRESENTAM A MARCA:
✓ "Sob medida para o seu espaço"
✓ "Qualidade é obrigação, não promessa"
✓ "Feito no Sul de Minas para o Brasil"
✗ EVITAR: "melhor do mercado", "líder", "número 1", "preço imbatível"

═══════════════════════════════════════
DIRETRIZES SEO (obrigatórias para blog):
═══════════════════════════════════════
• Palavra-chave principal no título, meta description, introdução e ≥2 títulos de seção
• Variações long-tail distribuídas naturalmente (sem keyword stuffing)
• Referências geográficas locais quando natural (Pouso Alegre, Sul de Minas, MG)
• Intenção de busca clara: informativa ou comercial
• Mínimo 800 palavras

═══════════════════════════════════════

Tema do conteúdo: ${tema}
Tom desejado: ${tom}

Contexto atual pesquisado na internet:
${contexto || '(sem dados adicionais)'}

Gere conteúdo de marketing para as redes solicitadas. Use linguagem brasileira natural. Responda APENAS com JSON válido, sem markdown:
{
${camposRede.join(',\n')}
}` }]
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!genRes.ok) {
    const errBody = await genRes.json().catch(() => ({}))
    const msg = errBody?.error?.message ?? `HTTP ${genRes.status}`
    return new Response(JSON.stringify({ error: msg }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const genData = await genRes.json()
  const texto = genData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  let parsed: unknown
  try {
    parsed = JSON.parse(texto)
  } catch {
    // Remove caracteres de controle inválidos dentro de strings JSON e tenta novamente
    const sanitizado = texto.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    try {
      parsed = JSON.parse(sanitizado)
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta inválida da IA. Tente novamente.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify(parsed), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
