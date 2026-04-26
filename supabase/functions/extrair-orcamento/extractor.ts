import { OrcamentoSchema, OrcamentoExtraido } from './schema.ts'
import { buildPrompt } from './prompt.ts'
import { logUsage } from '../_shared/logUsage.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-haiku-4-5-20251001'

// Tool schema espelhando OrcamentoSchema para structured outputs via tool_use
const TOOL_SCHEMA = {
  name: 'extrair_orcamento',
  description: 'Extrai dados estruturados de um orçamento técnico em texto bruto.',
  input_schema: {
    type: 'object',
    required: ['emitente', 'destinatario', 'orcamento', 'item', 'produto', 'componentes', 'referencias', 'issues'],
    properties: {
      emitente: {
        type: 'object',
        properties: {
          nome:     { type: ['string', 'null'] },
          cidade:   { type: ['string', 'null'] },
          estado:   { type: ['string', 'null'] },
          telefone: { type: ['string', 'null'] },
          email:    { type: ['string', 'null'] },
          site:     { type: ['string', 'null'] },
        },
        required: ['nome', 'cidade', 'estado', 'telefone', 'email', 'site'],
      },
      destinatario: {
        type: 'object',
        properties: {
          nome:   { type: ['string', 'null'] },
          cnpj:   { type: ['string', 'null'] },
          cidade: { type: ['string', 'null'] },
        },
        required: ['nome', 'cnpj', 'cidade'],
      },
      orcamento: {
        type: 'object',
        properties: {
          numero:             { type: ['string', 'null'] },
          emissao:            { type: ['string', 'null'] },
          validade:           { type: ['string', 'null'] },
          subtotal:           { type: ['number', 'null'] },
          desconto:           { type: ['number', 'null'] },
          total:              { type: ['number', 'null'] },
          condicao_pagamento: { type: ['string', 'null'] },
          prazo_entrega:      { type: ['string', 'null'] },
        },
        required: ['numero', 'emissao', 'validade', 'subtotal', 'desconto', 'total', 'condicao_pagamento', 'prazo_entrega'],
      },
      item: {
        type: 'object',
        properties: {
          descricao:  { type: ['string', 'null'] },
          quantidade: { type: ['number', 'null'] },
          unidade:    { type: ['string', 'null'] },
          valor_unit: { type: ['number', 'null'] },
        },
        required: ['descricao', 'quantidade', 'unidade', 'valor_unit'],
      },
      produto: {
        type: 'object',
        properties: {
          tipo_produto: { type: ['string', 'null'] },
          aplicacao:    { type: ['string', 'null'] },
          acabamento:   { type: ['string', 'null'] },
          superficie:   { type: ['string', 'null'] },
          material:     { type: ['string', 'null'] },
          liga:         { type: ['string', 'null'] },
          peso_kg:      { type: ['number', 'null'] },
          dimensoes: {
            type: 'object',
            properties: {
              comprimento_mm: { type: ['number', 'null'] },
              largura_mm:     { type: ['number', 'null'] },
              altura_mm:      { type: ['number', 'null'] },
              espessura_mm:   { type: ['number', 'null'] },
            },
            required: ['comprimento_mm', 'largura_mm', 'altura_mm', 'espessura_mm'],
          },
        },
        required: ['tipo_produto', 'aplicacao', 'acabamento', 'superficie', 'material', 'liga', 'peso_kg', 'dimensoes'],
      },
      componentes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome:       { type: 'string' },
            quantidade: { type: ['number', 'null'] },
          },
          required: ['nome', 'quantidade'],
        },
      },
      referencias: {
        type: 'object',
        properties: {
          projeto:     { type: ['string', 'null'] },
          codigo:      { type: ['string', 'null'] },
          observacoes: { type: ['string', 'null'] },
        },
        required: ['projeto', 'codigo', 'observacoes'],
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            campo:  { type: 'string' },
            tipo:   { type: 'string', enum: ['ausente', 'parcial', 'ruido', 'ambiguo'] },
            motivo: { type: 'string' },
          },
          required: ['campo', 'tipo', 'motivo'],
        },
      },
    },
  },
}

export type ExtractResult =
  | { ok: true;  data: OrcamentoExtraido }
  | { ok: false; error: string; raw?: unknown }

export async function normalizeBudget(rawText: string): Promise<ExtractResult> {
  if (!rawText?.trim()) {
    return { ok: false, error: 'Texto vazio.' }
  }

  const prompt = buildPrompt(rawText)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 4096,
      tools:      [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'extrair_orcamento' },
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { ok: false, error: `Claude API error ${res.status}: ${err}` }
  }

  const response = await res.json()
  const u = response.usage
  if (u) logUsage('extrair-orcamento', MODEL, u.input_tokens ?? 0, u.output_tokens ?? 0)

  // Extrai o input do tool_use
  const toolUse = response.content?.find((b: { type: string }) => b.type === 'tool_use')
  if (!toolUse) {
    return { ok: false, error: 'Claude não retornou tool_use.', raw: response }
  }

  // Valida com Zod
  const parsed = OrcamentoSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    return { ok: false, error: 'Falha na validação Zod.', raw: parsed.error.flatten() }
  }

  return { ok: true, data: parsed.data }
}
