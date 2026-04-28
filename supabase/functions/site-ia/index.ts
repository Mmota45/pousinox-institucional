import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logUsage } from '../_shared/logUsage.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'gemini-2.5-flash'
const GEMINI_KEY = Deno.env.get('GEMINI_KEY') ?? ''

const CONTEXTO_POUSINOX = `A Pousinox é fabricante de fixadores de porcelanato em aço inox, sediada em Pouso Alegre/MG.
Público: construtoras, marmorarias, revendas de materiais de construção (B2B).
Produtos: fixadores para fachada ventilada, piso elevado, revestimento interno/externo.
Diferenciais: aço inox 304/316, ensaios técnicos SENAI/LAMAT, produção própria, projetos sob medida.
Site: pousinox.com.br | fixadorporcelanato.com.br`

type Acao = 'melhorar_texto' | 'gerar_seo' | 'gerar_faq' | 'melhorar_depoimento'

interface RequestBody {
  acao: Acao
  // melhorar_texto
  texto?: string
  campo?: string
  pagina?: string
  // gerar_seo
  rota?: string
  conteudo_pagina?: Record<string, string>
  // gerar_faq
  categoria?: string
  quantidade?: number
  // melhorar_depoimento
  depoimento?: string
  nome_cliente?: string
}

function buildPrompt(body: RequestBody): { system: string; user: string } {
  switch (body.acao) {
    case 'melhorar_texto':
      return {
        system: `Você é um copywriter especialista em marketing industrial B2B.
Contexto da empresa: ${CONTEXTO_POUSINOX}

Sua tarefa é MELHORAR o texto fornecido, tornando-o mais persuasivo e profissional.

Regras CRÍTICAS:
- MANTENHA O ASSUNTO ORIGINAL do texto — não mude o tema nem insira assuntos diferentes
- Se o texto fala de contato, melhore o texto de contato. Se fala de história, melhore o texto de história. NÃO force o tema "fixadores de porcelanato" onde não existe.
- Use português brasileiro formal mas acessível
- Seja conciso — máximo 20% mais longo que o original
- Não use clichês genéricos
- Retorne APENAS o texto melhorado, sem explicações nem aspas`,
        user: `Campo: ${body.campo ?? 'texto'}\nPágina: ${body.pagina ?? 'geral'}\n\nTexto original:\n${body.texto}`,
      }

    case 'gerar_seo':
      return {
        system: `${CONTEXTO_POUSINOX}

Você é um especialista em SEO técnico para indústria de construção civil. Gere meta tags otimizadas para páginas do site da Pousinox.

Regras:
- Título: 50-60 caracteres, keyword principal no início
- Descrição: 150-160 caracteres, inclua CTA implícito
- Use keywords relevantes: fixador porcelanato, fachada ventilada, aço inox, etc.
- Responda APENAS em JSON: {"titulo": "...", "descricao": "..."}`,
        user: `Rota: ${body.rota}\n\nConteúdo da página:\n${JSON.stringify(body.conteudo_pagina ?? {}, null, 2)}`,
      }

    case 'gerar_faq':
      return {
        system: `${CONTEXTO_POUSINOX}

Você é um especialista em conteúdo FAQ para SEO e experiência do usuário. Gere perguntas frequentes relevantes para o site da Pousinox.

Regras:
- Perguntas que clientes reais fariam (construtoras, engenheiros, arquitetos)
- Respostas técnicas mas acessíveis, 2-4 frases cada
- Inclua keywords naturais para SEO
- Foque em dúvidas de decisão de compra
- Responda APENAS em JSON: [{"pergunta": "...", "resposta": "..."}, ...]`,
        user: `Categoria: ${body.categoria ?? 'geral'}\nQuantidade: ${body.quantidade ?? 5}\n\nGere ${body.quantidade ?? 5} perguntas frequentes para a categoria "${body.categoria ?? 'geral'}".`,
      }

    case 'melhorar_depoimento':
      return {
        system: `${CONTEXTO_POUSINOX}

Você é um editor de depoimentos de clientes. Melhore o texto mantendo autenticidade e naturalidade.

Regras:
- Corrija erros gramaticais e de digitação
- Mantenha o tom pessoal e autêntico do cliente
- Não invente informações nem exagere
- Mantenha comprimento similar (±20%)
- Retorne APENAS o texto melhorado, sem explicações`,
        user: `Cliente: ${body.nome_cliente ?? 'Anônimo'}\n\nDepoimento original:\n${body.depoimento}`,
      }

    default:
      throw new Error(`Ação desconhecida: ${body.acao}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body: RequestBody = await req.json()

    if (!body.acao) {
      return new Response(JSON.stringify({ error: 'Campo "acao" é obrigatório' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { system, user } = buildPrompt(body)

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[site-ia] Gemini error:', errText)
      return new Response(JSON.stringify({ error: 'Erro na API Gemini', detail: errText }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const usage = data.usageMetadata

    // Log usage
    if (usage) {
      logUsage('site-ia', MODEL, usage.promptTokenCount ?? 0, usage.candidatesTokenCount ?? 0, {
        acao: body.acao,
        campo: body.campo,
        rota: body.rota,
        categoria: body.categoria,
      })
    }

    // Parse JSON responses for gerar_seo and gerar_faq
    let resultado: unknown = content
    if (body.acao === 'gerar_seo' || body.acao === 'gerar_faq') {
      try {
        const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/)
        if (jsonMatch) resultado = JSON.parse(jsonMatch[0])
      } catch {
        resultado = content
      }
    }

    return new Response(JSON.stringify({ resultado, usage }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[site-ia] error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
