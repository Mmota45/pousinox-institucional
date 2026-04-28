import type { ClienteInfo } from '../ClienteForm/ClienteForm'
import type { FreteSummary } from '../../types/frete'

// ── Enums ────────────────────────────────────────────────────────────────────

export type Status = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'cancelado'
export type Vista = 'lista' | 'detalhe' | 'editor'

// ── Entities ─────────────────────────────────────────────────────────────────

export interface EmpresaEmissora {
  id: number; nome_fantasia: string; razao_social: string | null
  cnpj: string | null; cep: string | null; numero: string | null; endereco: string | null
  logradouro: string | null; complemento: string | null; bairro: string | null
  cidade: string | null; uf: string | null
  telefone: string | null; telefone_is_whatsapp: boolean | null
  email: string | null; site: string | null; logo_url: string | null; ativa: boolean
}

export interface Vendedor {
  id: number; nome: string; email: string | null; telefone: string | null
  comissao_pct: number; ativo: boolean
}

export interface OrcamentoResumo {
  id: number; numero: string; status: Status
  empresa_nome: string | null; cliente_empresa: string | null; cliente_nome: string | null
  vendedor_nome: string | null; total: number; criado_em: string
}

export interface Item {
  produto_id: number | null; descricao: string; qtd: string; unidade: string
  valorUnit: string; imagem_url?: string; preco_original?: string; obs_tecnica?: string
}

export interface Instalacao {
  inclui: boolean
  modalidade: 'cobrar' | 'bonus'
  texto: string
  valor: string
}

export interface OrcLink {
  id: string; token: string; short_code: string | null; destinatario: string | null
  criado_em: string; primeiro_acesso: string | null; ultimo_acesso: string | null
  visualizacoes: number; downloads: number; ativo: boolean
}

export interface ExibirProposta {
  cnpj: boolean
  inscricaoEstadual: boolean
  telefone: boolean
  whatsapp: boolean
  email: boolean
  emailNf: boolean
  contatosAdicionais: boolean
  cargo: boolean
  endereco: boolean
  enderecoEntrega: boolean
  entResponsavel: boolean
  obsTecnicaItens: boolean
  instMontagem: boolean
  anexos: boolean
  detalhesLogistica: boolean
}

export interface DadoBancario {
  id: number; apelido: string; banco: string | null; agencia: string | null; conta: string | null
  tipo_conta: string | null; pix_chave: string | null; pix_tipo: string | null
  titular: string | null; cnpj_titular: string | null; observacao: string | null
  ativo: boolean; ordem: number
}

export interface Anexo {
  id?: number; nome: string; url: string; tamanho?: number | null; tipo?: string | null
}

export interface HistoricoItem {
  id: number; evento: string; descricao: string | null; criado_em: string; usuario: string | null
}

export interface ProdutoResult {
  id: number; nome_padronizado: string; unidade: string | null; familia: string | null
}

export interface OutletResult {
  id: number; titulo: string; preco: number; preco_original: number | null
  quantidade: number; exibir_preco: boolean; fotos: string[] | null
}

// ── Constants ────────────────────────────────────────────────────────────────

export const UNIDADES = ['UN', 'CX', 'KG', 'M', 'M²', 'M³', 'L', 'PC', 'JG', 'PAR', 'RL', 'SC', 'H', 'DZ', 'GL']

export const EXIBIR_DEFAULT: ExibirProposta = {
  cnpj: false, inscricaoEstadual: false, telefone: true, whatsapp: false,
  email: false, emailNf: false, contatosAdicionais: false,
  cargo: false, endereco: false, enderecoEntrega: false, entResponsavel: false,
  obsTecnicaItens: false, instMontagem: false, anexos: false, detalhesLogistica: false,
}

export const COND_PAGAMENTO = [
  'À vista', 'À vista com desconto', '30 dias', '30/60 dias', '30/60/90 dias',
  'Cartão de crédito (até 12x)', 'Boleto bancário', 'PIX', 'Depósito/Transferência',
]

export const STATUS_CFG: Record<Status, { label: string; cor: string }> = {
  rascunho:  { label: 'Rascunho',  cor: '#64748b' },
  enviado:   { label: 'Enviado',   cor: '#1d4ed8' },
  aprovado:  { label: 'Aprovado',  cor: '#16a34a' },
  recusado:  { label: 'Recusado',  cor: '#dc2626' },
  cancelado: { label: 'Cancelado', cor: '#9ca3af' },
}

export const EVENTO_LABEL: Record<string, string> = {
  criado: '📝 Criado', editado: '✏️ Editado', status_alterado: '🔄 Status alterado',
  impresso: '🖨️ Impresso/PDF', enviado: '📤 Marcado enviado',
  aprovado: '✅ Aprovado', recusado: '❌ Recusado', cancelado: '🚫 Cancelado',
  anexo_adicionado: '📎 Anexo adicionado', receivel_gerado: '💰 Recebível gerado',
  etiqueta_gerada: '📦 Etiqueta gerada',
}

export const ITEM_VAZIO: Item = { produto_id: null, descricao: '', qtd: '1', unidade: 'UN', valorUnit: '', obs_tecnica: '' }

export const CLIENTE_VAZIO: ClienteInfo = {
  nome: '', empresa: '', nome_fantasia: '', cnpj: '', telefone: '', telefone_is_whatsapp: false,
  email: '', endereco: '',
  tipo_pessoa: 'pj', perfil_comprador: '', whatsapp: '', cargo: '', cargo_outro: '',
  inscricao_estadual: '', cep: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', uf: '', email_nf: '', contatos: [],
  ent_diferente: false, ent_responsavel: '', ent_telefone: '', ent_whatsapp: '',
  ent_cep: '', ent_logradouro: '', ent_numero: '', ent_complemento: '',
  ent_bairro: '', ent_cidade: '', ent_uf: '',
}

export const INST_VAZIO: Instalacao = { inclui: false, modalidade: 'cobrar', texto: '', valor: '' }

export const OBS_DEFAULT = `• Orçamento válido conforme data de validade indicada.\n• Preços sujeitos a alteração sem aviso prévio.\n• Prazo de entrega a partir da confirmação do pedido e aprovação do pagamento.`

// ── Helpers ──────────────────────────────────────────────────────────────────

export function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
export function hoje() { return new Date().toLocaleDateString('pt-BR') }
export function fmtDataISO(iso: string) { return new Date(iso).toLocaleDateString('pt-BR') }

export function formatarDadoBancario(d: DadoBancario): string {
  const parts: string[] = []
  if (d.pix_chave) parts.push(`PIX: ${d.pix_chave}${d.pix_tipo ? ` (${d.pix_tipo})` : ''}`)
  if (d.banco) {
    let line = `Banco: ${d.banco}`
    if (d.agencia) line += ` · Ag: ${d.agencia}`
    if (d.conta) line += ` · ${d.tipo_conta === 'poupanca' ? 'CP' : 'CC'}: ${d.conta}`
    parts.push(line)
  }
  if (d.titular) parts.push(`Favorecido: ${d.titular}`)
  return parts.join('\n')
}

// Re-export for convenience
export type { ClienteInfo, FreteSummary }
