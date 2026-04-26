import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PROMPT_VERSION = '1.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Enums permitidos ─────────────────────────────────────────────────────────
const TIPOS_POST = ['solucao', 'guia', 'aplicacao', 'institucional'] as const
const ORIGENS_OFERTA = ['produto_proprio', 'parceiro', 'nenhum'] as const
const TIPOS_CTA = ['orcamento', 'pronta_entrega', 'parceiro', 'nenhum'] as const
const TONS = ['informativo', 'promocional', 'urgente', 'educativo'] as const

type TipoPost = typeof TIPOS_POST[number]
type OrigemOferta = typeof ORIGENS_OFERTA[number]
type TipoCTA = typeof TIPOS_CTA[number]
type Tom = typeof TONS[number]

// ── Schema de entrada ────────────────────────────────────────────────────────
interface InputPayload {
  tema: string
  categoria: string
  tipoPost: TipoPost
  origemOferta: OrigemOferta
  ctaTipo: TipoCTA
  keywords: string[]
  tom: Tom
  fabricanteParceiro?: string
}

// ── Schema de saída ──────────────────────────────────────────────────────────
interface ArticleOutput {
  titulo: string
  subtitulo: string
  meta: string
  resumo: string
  corpo: string
  keywords_sugeridas: string[]
  imagem_sugestao: string
  prompt_version: string
}

// ── Validação de entrada ─────────────────────────────────────────────────────
function validateInput(body: Record<string, unknown>): { ok: true; data: InputPayload } | { ok: false; errors: string[] } {
  const errors: string[] = []

  if (!body.tema || typeof body.tema !== 'string' || !body.tema.trim()) {
    errors.push('"tema" é obrigatório e deve ser uma string não vazia.')
  }
  if (!body.categoria || typeof body.categoria !== 'string' || !body.categoria.trim()) {
    errors.push('"categoria" é obrigatória.')
  }
  if (!body.tipoPost || !TIPOS_POST.includes(body.tipoPost as TipoPost)) {
    errors.push(`"tipoPost" deve ser um de: ${TIPOS_POST.join(', ')}.`)
  }
  if (!body.origemOferta || !ORIGENS_OFERTA.includes(body.origemOferta as OrigemOferta)) {
    errors.push(`"origemOferta" deve ser um de: ${ORIGENS_OFERTA.join(', ')}.`)
  }
  if (!body.ctaTipo || !TIPOS_CTA.includes(body.ctaTipo as TipoCTA)) {
    errors.push(`"ctaTipo" deve ser um de: ${TIPOS_CTA.join(', ')}.`)
  }
  if (body.keywords !== undefined && !Array.isArray(body.keywords)) {
    errors.push('"keywords" deve ser um array.')
  }
  if (body.tom !== undefined && !TONS.includes(body.tom as Tom)) {
    errors.push(`"tom" deve ser um de: ${TONS.join(', ')}.`)
  }
  if (body.origemOferta === 'parceiro' && body.fabricanteParceiro !== undefined && typeof body.fabricanteParceiro !== 'string') {
    errors.push('"fabricanteParceiro" deve ser uma string.')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      tema: (body.tema as string).trim(),
      categoria: (body.categoria as string).trim(),
      tipoPost: body.tipoPost as TipoPost,
      origemOferta: body.origemOferta as OrigemOferta,
      ctaTipo: body.ctaTipo as TipoCTA,
      keywords: Array.isArray(body.keywords) ? (body.keywords as string[]).slice(0, 6) : [],
      tom: (body.tom as Tom) ?? 'informativo',
      fabricanteParceiro: typeof body.fabricanteParceiro === 'string' ? body.fabricanteParceiro.trim() : undefined,
    },
  }
}

// ── Validação de saída ───────────────────────────────────────────────────────
function validateOutput(parsed: Record<string, unknown>): { ok: true; data: ArticleOutput } | { ok: false; missing: string[] } {
  const missing: string[] = []

  // Campos essenciais — sem eles o artigo não pode ser publicado
  if (!parsed.titulo || typeof parsed.titulo !== 'string' || !parsed.titulo.trim()) missing.push('titulo')
  if (!parsed.corpo || typeof parsed.corpo !== 'string' || parsed.corpo.trim().length < 100) missing.push('corpo')

  if (missing.length > 0) return { ok: false, missing }

  // Campos opcionais — normaliza para string/array vazio se ausentes
  return {
    ok: true,
    data: {
      titulo: (parsed.titulo as string).trim(),
      subtitulo: typeof parsed.subtitulo === 'string' ? parsed.subtitulo.trim() : '',
      meta: typeof parsed.meta === 'string' ? parsed.meta.trim() : '',
      resumo: typeof parsed.resumo === 'string' ? parsed.resumo.trim() : '',
      corpo: (parsed.corpo as string).trim(),
      keywords_sugeridas: Array.isArray(parsed.keywords_sugeridas)
        ? (parsed.keywords_sugeridas as unknown[]).filter((k): k is string => typeof k === 'string')
        : [],
      imagem_sugestao: typeof parsed.imagem_sugestao === 'string' ? parsed.imagem_sugestao.trim() : '',
      prompt_version: PROMPT_VERSION,
    },
  }
}

// ── Templates por tipo editorial ─────────────────────────────────────────────
const TEMPLATES: Record<TipoPost, string> = {
  solucao: `**O problema que ele resolve**
[problema enfrentado pelo cliente/segmento]

**Como funciona**
[mecanismo ou processo técnico da solução]

**Diferenciais técnicos**
- [material ou especificação]
- [dimensão, capacidade ou variante]
- [facilidade de uso, instalação ou manutenção]

**Para quem é indicado**
[segmentos e perfis de clientes]

**Por que escolher inox**
[durabilidade, higiene, resistência, normas]`,

  guia: `**O que você vai aprender**
[introdução e utilidade para o leitor]

**Por que isso importa**
[contexto e relevância do tema]

**Passo a passo**
- [passo 1]
- [passo 2]
- [passo 3]

**Dicas e boas práticas**
[cuidados, erros comuns, recomendações]

**Conclusão**
[fechamento com próximo passo claro]`,

  aplicacao: `**O contexto do projeto**
[segmento, cliente ou situação que originou o projeto]

**O desafio encontrado**
[problema específico e restrições]

**A solução aplicada**
[o que foi desenvolvido, materiais, dimensões, processo]

**Resultado entregue**
- [resultado ou benefício 1]
- [resultado ou benefício 2]
- [resultado ou benefício 3]

**Por que inox foi a escolha certa**
[justificativa técnica e comercial]`,

  institucional: `**Nossa atuação neste segmento**
[presença e experiência da Pousinox® neste tema]

**O que nos diferencia**
- [diferencial técnico ou de produção]
- [atendimento ou personalização]
- [certificação, norma ou garantia]

**Nosso processo**
[do briefing à entrega]

**Projetos e resultados**
[números, projetos, segmentos, alcance]`,
}

// ── Montagem do prompt ───────────────────────────────────────────────────────
function buildPrompt(data: InputPayload): string {
  const { tema, categoria, tipoPost, origemOferta, ctaTipo, fabricanteParceiro, keywords, tom } = data

  const origemLabel = origemOferta === 'produto_proprio'
    ? 'produto fabricado e desenvolvido pela Pousinox®'
    : origemOferta === 'parceiro'
      ? `produto fabricado por parceiro${fabricanteParceiro ? ` (${fabricanteParceiro})` : ''} e comercializado pela Pousinox® — NÃO apresentar como se fosse fabricado pela Pousinox®`
      : 'sem produto específico — conteúdo informativo/institucional'

  const ctaLabel = ctaTipo === 'orcamento' ? 'solicitar orçamento pelo WhatsApp'
    : ctaTipo === 'pronta_entrega' ? 'ver produto disponível na pronta entrega'
    : ctaTipo === 'parceiro' ? 'consultar disponibilidade com a Pousinox®'
    : 'sem CTA direto'

  const kwSection = keywords.length > 0
    ? `\nPalavras-chave SEO para usar naturalmente (sem keyword stuffing): ${keywords.join(', ')}`
    : ''

  return `Você é um redator técnico-comercial especializado em equipamentos industriais em aço inox.
Escreva um artigo de blog para a empresa POUSINOX® (fabricante de equipamentos em aço inox, Pouso Alegre/MG, Sul de Minas Gerais).

CONTEXTO:
- Tema: ${tema}
- Categoria do blog: ${categoria}
- Tipo editorial: ${tipoPost}
- Origem da oferta: ${origemLabel}
- CTA principal: ${ctaLabel}
- Tom: ${tom}${kwSection}

ESTRUTURA OBRIGATÓRIA DO CORPO (use exatamente este formato de headings):

${TEMPLATES[tipoPost]}

REGRAS INEGOCIÁVEIS:
1. Cada heading DEVE estar sozinho na linha: **Título da seção**
2. Deixe linha em branco antes e depois de cada heading
3. Listas usam "- item" (hífen + espaço) — uma por linha
4. Tom técnico, direto, sem jargão excessivo
5. Se origem for parceiro, deixe claro que é comercializado, não fabricado pela Pousinox®
6. Escreva 3 a 5 seções com headings — nem mais, nem menos

Retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON:

{
  "titulo": "título SEO do artigo (até 65 caracteres)",
  "subtitulo": "frase de apoio ao título (até 120 caracteres)",
  "meta": "meta description para SEO (até 155 caracteres)",
  "resumo": "- ponto principal 1\\n- ponto principal 2\\n- ponto principal 3",
  "corpo": "corpo completo com **headings** e conteúdo separados por linha em branco",
  "keywords_sugeridas": ["keyword complementar 1", "keyword complementar 2"],
  "imagem_sugestao": "descrição da foto ideal para este artigo"
}`
}

// ── Parse seguro do JSON da IA ───────────────────────────────────────────────
function parseIAResponse(text: string): Record<string, unknown> {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Resposta da IA não é JSON válido')
  }
}

// ── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const raw = await req.json().catch(() => null)
    if (!raw || typeof raw !== 'object') {
      return json({ error: 'Body inválido ou não é JSON.' }, 400)
    }

    // Valida entrada
    const inputResult = validateInput(raw as Record<string, unknown>)
    if (!inputResult.ok) {
      return json({ error: 'Payload inválido.', details: inputResult.errors }, 400)
    }
    const { data: inputData } = inputResult

    const { logUsage } = await import('../_shared/logUsage.ts')
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

    const prompt = buildPrompt(inputData)

    const iaRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!iaRes.ok) {
      const err = await iaRes.text()
      throw new Error(`Anthropic API ${iaRes.status}: ${err}`)
    }

    const iaData = await iaRes.json()
    const u = iaData?.usage
    if (u) logUsage('gerar-artigo', 'claude-haiku-4-5-20251001', u.input_tokens ?? 0, u.output_tokens ?? 0)
    const rawText: string = iaData?.content?.[0]?.text ?? ''

    if (!rawText) throw new Error('IA retornou resposta vazia.')

    const parsed = parseIAResponse(rawText)

    // Valida saída
    const outputResult = validateOutput(parsed)
    if (!outputResult.ok) {
      return json({
        error: 'Resposta da IA incompleta.',
        missing_fields: outputResult.missing,
        raw_response: rawText.slice(0, 500), // debug truncado
      }, 422)
    }

    return json(outputResult.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return json({ error: msg }, 500)
  }
})
