// ── Enums ────────────────────────────────────────────────────────────────────

export type FreteProvedor = 'correios' | 'braspress' | 'proprio'
export type FreteTipo = '' | 'CIF' | 'FOB' | 'retirada' | 'cliente' | 'a_combinar'
export type FreteModalidade = 'cobrar' | 'bonus'

// ── Volume ───────────────────────────────────────────────────────────────────

export interface Volume {
  id?: number
  descricao: string
  quantidade: number
  peso_kg: number
  comprimento_cm: number
  largura_cm: number
  altura_cm: number
  ordem: number
}

export const VOLUME_VAZIO: Volume = {
  descricao: '', quantidade: 1, peso_kg: 0,
  comprimento_cm: 0, largura_cm: 0, altura_cm: 0, ordem: 0,
}

// ── Componente do frete próprio ──────────────────────────────────────────────

export interface FreteProprioComponente {
  chave: string
  label: string
  valor: number
  formula: string
  editavel: boolean
}

export const FRETE_PROPRIO_COMPONENTES: FreteProprioComponente[] = [
  { chave: 'combustivel', label: 'Combustível', valor: 0, formula: '', editavel: true },
  { chave: 'pedagio', label: 'Pedágio', valor: 0, formula: '', editavel: true },
  { chave: 'motorista', label: 'Motorista', valor: 0, formula: '', editavel: true },
  { chave: 'ajudante', label: 'Ajudante', valor: 0, formula: '', editavel: true },
  { chave: 'depreciacao', label: 'Depreciação veículo', valor: 0, formula: '', editavel: true },
  { chave: 'manutencao', label: 'Manutenção', valor: 0, formula: '', editavel: true },
  { chave: 'seguro', label: 'Seguro carga', valor: 0, formula: '', editavel: true },
  { chave: 'gris', label: 'GRIS / Risco', valor: 0, formula: '', editavel: true },
  { chave: 'administrativo', label: 'Custo administrativo', valor: 0, formula: '', editavel: true },
  { chave: 'contingencia', label: 'Contingência', valor: 0, formula: '', editavel: true },
  { chave: 'outros', label: 'Outros', valor: 0, formula: '', editavel: true },
]

// ── Opção de frete ───────────────────────────────────────────────────────────

export interface FreteOpcao {
  id?: number
  cotacao_id?: number
  provedor: FreteProvedor
  servico: string
  codigo: string
  custo: number
  preco_venda: number
  margem_pct: number
  prazo_dias: number | null
  prazo_texto: string
  componentes_json: FreteProprioComponente[] | null
  selecionada: boolean
  obs: string
}

// ── Cotação ──────────────────────────────────────────────────────────────────

export interface FreteCotacao {
  id?: number
  provedor: FreteProvedor
  cep_origem: string
  cep_destino: string
  peso_total_kg: number
  peso_cubado_kg: number
  peso_taxado_kg: number
  valor_mercadoria: number
  sucesso: boolean
  erro: string | null
  cotado_em: string
  cotado_por: string
  valido_ate: string | null
  opcoes: FreteOpcao[]
}

// ── Recomendação ─────────────────────────────────────────────────────────────

export interface FreteRecomendacao {
  melhor_preco: FreteOpcao | null
  melhor_prazo: FreteOpcao | null
  melhor_margem: FreteOpcao | null
  recomendada: FreteOpcao | null
  motivo: string
}

// ── Parâmetros da empresa ────────────────────────────────────────────────────

export interface FreteParametro {
  chave: string
  valor: number
  unidade: string
  descricao: string
}

// ── State do reducer ─────────────────────────────────────────────────────────

export interface FreteState {
  tipo: FreteTipo
  modalidade: FreteModalidade
  volumes: Volume[]
  cotacoes: FreteCotacao[]
  opcoes: FreteOpcao[]
  opcaoSelecionada: FreteOpcao | null
  recomendacao: FreteRecomendacao | null
  cotando: FreteProvedor | null
  parametros: FreteParametro[]
  proprioComponentes: FreteProprioComponente[]
  proprioDistanciaKm: number
  proprioDias: number
  dirty: boolean
}

export const FRETE_STATE_INICIAL: FreteState = {
  tipo: '',
  modalidade: 'cobrar',
  volumes: [],
  cotacoes: [],
  opcoes: [],
  opcaoSelecionada: null,
  recomendacao: null,
  cotando: null,
  parametros: [],
  proprioComponentes: FRETE_PROPRIO_COMPONENTES.map(c => ({ ...c })),
  proprioDistanciaKm: 0,
  proprioDias: 1,
  dirty: false,
}

// ── Actions ──────────────────────────────────────────────────────────────────

export type FreteAction =
  | { type: 'SET_TIPO'; payload: FreteTipo }
  | { type: 'SET_MODALIDADE'; payload: FreteModalidade }
  | { type: 'ADD_VOLUME' }
  | { type: 'REMOVE_VOLUME'; payload: number }
  | { type: 'UPDATE_VOLUME'; payload: { index: number; vol: Partial<Volume> } }
  | { type: 'COTACAO_START'; payload: FreteProvedor }
  | { type: 'COTACAO_OK'; payload: { cotacao: FreteCotacao; opcoes: FreteOpcao[] } }
  | { type: 'COTACAO_ERRO'; payload: string }
  | { type: 'SELECIONAR_OPCAO'; payload: FreteOpcao }
  | { type: 'SET_PRECO_VENDA'; payload: { opcaoIdx: number; valor: number } }
  | { type: 'SET_PROPRIO_COMPONENTE'; payload: { idx: number; valor: number; formula: string } }
  | { type: 'SET_PROPRIO_DISTANCIA'; payload: number }
  | { type: 'SET_PROPRIO_DIAS'; payload: number }
  | { type: 'LOAD'; payload: Partial<FreteState> }
  | { type: 'RESET' }

// ── Callback para o pai ──────────────────────────────────────────────────────

export interface FreteSummary {
  tipo: FreteTipo
  modalidade: FreteModalidade
  valor: number
  custo: number
  prazo: string
  prazo_dias: number | null
  provedor: string
  servico: string
  opcao_id: number | null
  obs: string
  peso_total_kg: number
  volumes_qtd: number
}

// ── Input para cotação externa ───────────────────────────────────────────────

export interface CotacaoExternaParams {
  cep_destino: string
  peso_kg: number
  comprimento_cm: number
  largura_cm: number
  altura_cm: number
}

export interface CotacaoExternaResult {
  cep_origem: string
  cep_destino: string
  peso_kg: number
  dimensoes: { comprimento: number; largura: number; altura: number }
  correios_elegivel: boolean
  opcoes: Array<{
    servico: string
    codigo: string
    preco: number
    prazo: number
    erro: string | null
  }>
}
