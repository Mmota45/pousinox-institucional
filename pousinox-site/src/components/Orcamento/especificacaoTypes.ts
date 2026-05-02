// ── Especificação Técnica de Materiais — Types ─────────────────────────────

export interface FixadorModelo {
  id: number
  nome: string
  sku: string | null
  material: string
  espessura_mm: number | null
  acabamento: string | null
  obs_tecnica: string | null
  ativo: boolean
  possui_laudo: boolean
  laudo_numero: string | null
  laudo_laboratorio: string | null
  laudo_data: string | null
  laudo_resumo: string | null
}

export interface RegraCalculo {
  id: number
  modelo_id: number | null
  nome: string
  lado_max_cm: number | null
  area_max_cm2: number | null
  peso_max_kg: number | null
  fixadores_por_peca: number
  exige_revisao: boolean
  prioridade: number
}

export interface Consumivel {
  id: number
  nome: string
  tipo: string
  unidade: string
  proporcao_por: number
  ordem: number
}

// ── Input do cálculo ────────────────────────────────────────────────────────

export interface EspecificacaoInput {
  area_total_m2: number
  largura_cm: number
  altura_cm: number
  peso_peca_kg?: number
  peso_m2_kg?: number
  espessura_mm?: number
  perda_pct: number
  modelo_id?: number
  abertura_mm?: number
  material?: string
  revisao_manual?: boolean
  obs?: string
}

// ── Resultado do cálculo ────────────────────────────────────────────────────

export type StatusAnalise = 'padrao' | 'alerta' | 'revisao'

export interface ItemCalculado {
  nome: string
  quantidade: number
  unidade: string
  tipo: string
}

export interface ResultadoEspecificacao {
  area_peca_m2: number
  qtd_pecas_bruto: number
  qtd_pecas: number           // com perda
  peso_peca_kg?: number
  peso_estimado: boolean
  fixadores_por_peca: number
  total_fixadores: number
  regra_aplicada: string
  laudo_referencia?: string
  itens: ItemCalculado[]
  revisao_tecnica: boolean
  revisao_motivos: string[]
  status: StatusAnalise
}

// ── Especificação salva ─────────────────────────────────────────────────────

export interface EspecificacaoSalva {
  id: number
  orcamento_id: number
  modelo_id: number | null
  area_total_m2: number
  largura_cm: number
  altura_cm: number
  peso_peca_kg: number | null
  peso_m2_kg: number | null
  espessura_mm: number | null
  perda_pct: number
  qtd_pecas: number | null
  fixadores_por_peca: number | null
  total_fixadores: number | null
  revisao_tecnica: boolean
  revisao_motivos: string[] | null
  obs: string | null
  criado_em: string
  itens?: ItemCalculado[]
}
