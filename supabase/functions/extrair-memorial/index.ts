// Edge Function: extrair-memorial
// Recebe texto de memorial descritivo + catálogo de atributos.
// Usa Claude para mapear o texto nos atributos padronizados do catálogo.
//
// POST /functions/v1/extrair-memorial
// Body: { texto: string, catalogo: AtributoCatalogo[] }

import { logUsage } from '../_shared/logUsage.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AtributoCatalogo {
  chave: string
  label_pt: string
  tipo_valor: string
  unidade_padrao: string | null
  valores_enum: string[] | null
}

interface AtributoExtraido {
  chave: string
  valor: string
  confianca: number  // 0.0 a 1.0
}

interface CamposBasicos {
  titulo: string | null
  cliente_nome: string | null
  projetista: string | null
  revisao: string | null
  norma: string | null
  escala: string | null
  data_projeto: string | null  // formato YYYY-MM-DD ou null
}

interface ComponenteExtraido {
  nome: string
  quantidade: number | null
  material: string | null
  observacao: string | null
}

function montarPrompt(texto: string, catalogo: AtributoCatalogo[]): string {
  const catalogoFormatado = catalogo.map(a => {
    let desc = `- chave: "${a.chave}" | label: "${a.label_pt}" | tipo: ${a.tipo_valor}`
    if (a.unidade_padrao) desc += ` | unidade: ${a.unidade_padrao}`
    if (a.valores_enum?.length) desc += ` | valores permitidos: [${a.valores_enum.map(v => `"${v}"`).join(', ')}]`
    return desc
  }).join('\n')

  return `Você é um especialista em projetos de construção e arquitetura.

Analise o memorial descritivo abaixo e extraia duas coisas:

1. CAMPOS BÁSICOS do projeto (cabeçalho, rodapé, título, etc.)
2. ATRIBUTOS TÉCNICOS mapeados ao catálogo fornecido

CATÁLOGO DE ATRIBUTOS:
${catalogoFormatado}

MEMORIAL DESCRITIVO:
${texto.slice(0, 12000)}

INSTRUÇÕES PARA CAMPOS BÁSICOS:
- titulo: nome/descrição principal do projeto (ex: "Tampa para caixa de máquina piscina")
- cliente_nome: nome da empresa ou pessoa contratante (campo CLIENTE no cabeçalho)
- projetista: nome do engenheiro, arquiteto ou responsável técnico (campo PROJETISTA)
- revisao: código de revisão — procure campo REVISÃO ou REV (ex: "00", "Rev. A", "A")
- norma: norma técnica aplicável (ex: "ABNT NBR 13818"). Se houver tabela de tolerâncias ISO, registre "Simb. ISO" ou a norma indicada.
- escala: escala do desenho — procure campo ESCALA (ex: "1:10", "1:50", "1:100")
- data_projeto: data do projeto no formato YYYY-MM-DD — procure campo DATA. Se só tiver mês/ano, use o dia 01.
- Use null para campos não encontrados no texto.

INSTRUÇÕES PARA ATRIBUTOS:
- Extraia apenas atributos que aparecem explicitamente ou claramente implícitos no texto.
- Para atributos do tipo "enum", use APENAS um dos valores permitidos listados.
- Para atributos numéricos, extraia apenas o número (sem unidade). Se houver múltiplos valores distintos, separe com " | ".
- Atribua confiança de 0.0 a 1.0: 1.0 = texto explícito, 0.7 = implícito claro, abaixo de 0.5 = incerto.
- Não invente valores que não estejam no texto.

ATENÇÃO ESPECIAL — procure ativamente por:
- DIMENSÕES PRINCIPAIS: para produtos planos/retangulares, comprimento = maior dimensão plana, largura = menor dimensão plana, altura = dimensão perpendicular (profundidade, borda, pé). Nunca agrupe dimensões diferentes na mesma chave com "|" — cada dimensão vai em sua chave específica. Vírgula nos números é separador decimal (ex: "765,0" = 765.0).
- ESPESSURA: espessura da chapa/tubo/perfil — geralmente em mm, aparece junto ao material (ex: "3mm", "1,5mm")
- PESO: valor numérico seguido de "kg" no cabeçalho ou legenda
- MATERIAL: inclui liga (304, 316, 430), espessura e acabamento (fosco, polido, escovado) — podem estar juntos (ex: "Aço inox 304 3mm fosco")
- ACABAMENTO: fosco, polido, escovado, brilhante, jateado — geralmente junto ao material (ex: "304 3mm fosco" → acabamento=fosco). Se não houver indicação explícita de acabamento, use null — NUNCA use "natural", "padrão" ou similares que não estão no enum.
- SUPERFÍCIE: tipo de textura da chapa — procure por "chapa antiderrapante", "chapa xadrez", "chapa perfurada", "chapa lisa", "piso antiderrapante" — mapeie para os valores enum disponíveis (ex: "Chapa antiderrapante" → superficie=antiderrapante). Se não encontrar, use null.
- LIGA: número após "inox" ou "AISI" (ex: "304", "316L")
- APLICAÇÃO: onde o produto será instalado (ex: "piscina", "cozinha industrial", "hospital")
- TIPO DE PRODUTO: o que é o produto (tampa, prateleira, grelha, suporte, bandeja...)
- COMPONENTES ESPECIAIS: drenos, alças, dobradiças, parafusos, reforços — registre como texto no atributo mais adequado

INSTRUÇÕES PARA COMPONENTES:
- Liste cada peça/componente distinto que compõe o produto (ex: chapa principal, tubo de dreno, alça, parafuso, reforço...)
- Procure por lista de materiais, tabela de itens, balão de chamada no desenho, legenda com números e nomes
- Para cada componente: nome (descritivo), quantidade (número inteiro ou null se não informado), material (se especificado para aquele item), observacao (informação adicional relevante)
- Não inclua o produto inteiro como componente — apenas as peças que o compõem
- Se não houver lista de componentes identificável, retorne array vazio

Responda APENAS com JSON válido, sem markdown, no formato:
{
  "campos_basicos": {
    "titulo": "...",
    "cliente_nome": null,
    "projetista": "...",
    "revisao": "...",
    "norma": "...",
    "escala": "...",
    "data_projeto": "2024-03-15"
  },
  "atributos": [
    { "chave": "nome_da_chave", "valor": "valor_extraido", "confianca": 0.95 }
  ],
  "componentes": [
    { "nome": "Chapa antiderrapante", "quantidade": 1, "material": "AISI 304 3mm fosco", "observacao": null },
    { "nome": "Tubo de dreno", "quantidade": 2, "material": null, "observacao": null }
  ]
}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { texto, catalogo } = await req.json() as { texto: string; catalogo: AtributoCatalogo[] }

    if (!texto || !catalogo?.length) {
      return new Response(JSON.stringify({ error: 'texto e catalogo são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = montarPrompt(texto, catalogo)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const data = await res.json()
    const u = data.usage
    if (u) logUsage('extrair-memorial', CLAUDE_MODEL, u.input_tokens ?? 0, u.output_tokens ?? 0)
    const conteudo = data.content?.[0]?.text ?? '[]'

    let parsed: { campos_basicos?: CamposBasicos; atributos?: AtributoExtraido[]; componentes?: ComponenteExtraido[] } = {}
    try {
      parsed = JSON.parse(conteudo)
    } catch {
      const match = conteudo.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    }

    const campos_basicos: CamposBasicos = parsed.campos_basicos ?? {
      titulo: null, cliente_nome: null, projetista: null,
      revisao: null, norma: null, escala: null, data_projeto: null,
    }

    // Filtra apenas chaves válidas e remove duplicatas (mantém maior confiança)
    const chavesValidas = new Set(catalogo.map((a: AtributoCatalogo) => a.chave))
    const vistos = new Map<string, AtributoExtraido>()
    for (const a of (parsed.atributos ?? [])) {
      if (!chavesValidas.has(a.chave) || !a.valor) continue
      const existente = vistos.get(a.chave)
      if (!existente || a.confianca > existente.confianca) vistos.set(a.chave, a)
    }
    const atributos = Array.from(vistos.values())

    const componentes: ComponenteExtraido[] = (parsed.componentes ?? [])
      .filter((c: ComponenteExtraido) => c.nome?.trim())
      .map((c: ComponenteExtraido, i: number) => ({
        nome: String(c.nome).trim(),
        quantidade: c.quantidade != null ? Number(c.quantidade) : null,
        material: c.material ? String(c.material).trim() : null,
        observacao: c.observacao ? String(c.observacao).trim() : null,
        ordem: i,
      }))

    return new Response(JSON.stringify({ campos_basicos, atributos, componentes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
