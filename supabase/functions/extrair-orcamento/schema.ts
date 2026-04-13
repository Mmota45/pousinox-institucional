import { z } from 'npm:zod@3'

export const ProdutoSchema = z.object({
  tipo_produto:  z.string().nullable(),
  aplicacao:     z.string().nullable(),
  acabamento:    z.string().nullable(),
  superficie:    z.string().nullable(),
  material:      z.string().nullable(),
  liga:          z.string().nullable(),
  peso_kg:       z.number().nullable(),
  dimensoes: z.object({
    comprimento_mm: z.number().nullable(),
    largura_mm:     z.number().nullable(),
    altura_mm:      z.number().nullable(),
    espessura_mm:   z.number().nullable(),
  }),
})

export const OrcamentoSchema = z.object({
  emitente: z.object({
    nome:     z.string().nullable(),
    cidade:   z.string().nullable(),
    estado:   z.string().nullable(),
    telefone: z.string().nullable(),
    email:    z.string().nullable(),
    site:     z.string().nullable(),
  }),
  destinatario: z.object({
    nome:   z.string().nullable(),
    cnpj:   z.string().nullable(),
    cidade: z.string().nullable(),
  }),
  orcamento: z.object({
    numero:    z.string().nullable(),
    emissao:   z.string().nullable(),  // YYYY-MM-DD
    validade:  z.string().nullable(),  // YYYY-MM-DD
    subtotal:  z.number().nullable(),
    desconto:  z.number().nullable(),
    total:     z.number().nullable(),
    condicao_pagamento: z.string().nullable(),
    prazo_entrega:      z.string().nullable(),
  }),
  item: z.object({
    descricao: z.string().nullable(),
    quantidade: z.number().nullable(),
    unidade:    z.string().nullable(),
    valor_unit: z.number().nullable(),
  }),
  produto: ProdutoSchema,
  componentes: z.array(z.object({
    nome:       z.string(),
    quantidade: z.number().nullable(),
  })).default([]),
  referencias: z.object({
    projeto:     z.string().nullable(),
    codigo:      z.string().nullable(),
    observacoes: z.string().nullable(),
  }),
  issues: z.array(z.object({
    campo:  z.string(),
    tipo:   z.enum(['ausente', 'parcial', 'ruido', 'ambiguo']),
    motivo: z.string(),
  })).default([]),
})

export type OrcamentoExtraido = z.infer<typeof OrcamentoSchema>
