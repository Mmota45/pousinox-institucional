// ── Fornecedores & Contatos ──────────────────────────────────────────────────

export interface Fornecedor {
  id:                   number
  codigo:               string | null
  razao_social:         string
  nome_fantasia:        string | null
  cnpj:                 string | null
  segmento:             string | null   // distribuidor | fabricante | servico | representante
  categoria:            string | null   // aco_inox | fixadores | corte_laser | outros
  cidade:               string | null
  estado:               string | null
  cep:                  string | null
  endereco:             string | null
  telefone:             string | null
  email:                string | null
  site:                 string | null
  whatsapp:             string | null
  ativo:                boolean
  preferencial:         boolean
  observacoes:          string | null
  prazo_entrega_padrao: number | null   // dias
  condicao_pagamento:   string | null
  importado_csv:        boolean
  created_at:           string
  updated_at:           string
  // join opcional
  qtd_contatos?:        number
}

export interface ContatoFornecedor {
  id:            number
  fornecedor_id: number
  nome:          string
  cargo:         string | null
  telefone:      string | null
  whatsapp:      string | null
  email:         string | null
  principal:     boolean
  created_at:    string
}

// ── Form states ───────────────────────────────────────────────────────────────

export const FORNECEDOR_VAZIO: Omit<Fornecedor, 'id' | 'created_at' | 'updated_at' | 'importado_csv' | 'qtd_contatos'> = {
  codigo:               null,
  razao_social:         '',
  nome_fantasia:        null,
  cnpj:                 null,
  segmento:             null,
  categoria:            null,
  cidade:               null,
  estado:               null,
  cep:                  null,
  endereco:             null,
  telefone:             null,
  email:                null,
  site:                 null,
  whatsapp:             null,
  ativo:                true,
  preferencial:         false,
  observacoes:          null,
  prazo_entrega_padrao: null,
  condicao_pagamento:   null,
}

export const CONTATO_VAZIO: Omit<ContatoFornecedor, 'id' | 'fornecedor_id' | 'created_at'> = {
  nome:      '',
  cargo:     null,
  telefone:  null,
  whatsapp:  null,
  email:     null,
  principal: false,
}

// ── Enums de domínio ──────────────────────────────────────────────────────────

export const SEGMENTOS_FORNECEDOR = [
  'distribuidor',
  'fabricante',
  'servico',
  'representante',
  'outro',
] as const

export const CATEGORIAS_FORNECEDOR = [
  'aco_inox',
  'fixadores',
  'corte_laser',
  'dobramento',
  'solda',
  'acabamento',
  'embalagem',
  'logistica',
  'outros',
] as const

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
] as const

// ── Fase 2 — tipos já declarados para não quebrar imports futuros ─────────────

export interface Material {
  id:             number
  codigo:         string | null
  descricao:      string
  categoria:      string | null
  unidade:        string           // kg | m | m² | pc | un
  liga:           string | null
  espessura_mm:   number | null
  largura_mm:     number | null
  comprimento_mm: number | null
  peso_kg_m:      number | null
  observacoes:    string | null
  ativo:          boolean
  created_at:     string
  updated_at:     string
}

export interface FornecedorMaterial {
  id:               number
  fornecedor_id:    number
  material_id:      number
  preco_unit:       number | null
  unidade:          string | null
  prazo_entrega:    number | null  // dias
  preferencial:     boolean
  observacoes:      string | null
  updated_at:       string
  // joins
  fornecedor?:      Pick<Fornecedor, 'id' | 'razao_social' | 'nome_fantasia'>
  material?:        Pick<Material,   'id' | 'descricao' | 'unidade'>
}

export interface HistoricoPreco {
  id:                    number
  fornecedor_material_id: number
  preco_unit:            number
  data_cotacao:          string
  validade:              string | null
  observacoes:           string | null
  created_at:            string
}
