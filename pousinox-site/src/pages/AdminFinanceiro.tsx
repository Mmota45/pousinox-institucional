import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminFinanceiro.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Categoria  { id: number; nome: string; tipo: 'receita' | 'despesa'; grupo: string; cor: string; ativo: boolean }
interface CentroCusto { id: number; nome: string; descricao: string | null; ativo: boolean }

interface Lancamento {
  id: number
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  data_competencia: string
  data_vencimento: string
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'cancelado' | 'parcial'
  forma_pagamento: string | null
  condicao_pagamento: string | null
  numero_parcelas: number
  categoria_id: number | null
  centro_custo_id: number | null
  nf_chave: string | null
  observacao: string | null
  origem: 'manual' | 'venda' | 'nf' | 'projeto' | 'sistema' | 'pipeline'
  aguarda_categorizacao: boolean
  created_at: string
  fin_categorias?: { nome: string; cor: string } | null
  fin_centros_custo?: { nome: string } | null
}

interface SaldoMes {
  mes: string
  total_receitas: number
  total_despesas: number
  saldo: number
  pendentes: number
  vencidos_receber: number
  vencidos_pagar: number
}

interface ContaBancaria {
  id: number
  nome: string
  banco: string | null
  tipo: string
  negocio: string
  saldo_inicial: number
  ativo: boolean
}

interface Movimentacao {
  id: number
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  conta: string | null           // legado (texto livre)
  conta_id: number | null        // FK fin_contas
  conta_nome: string | null
  negocio: string | null
  status: string
  tipo_pagamento: string | null
  documento_ref: string | null
  conciliado: boolean
  categoria_id: number | null
  categoria_nome: string | null
  categoria_grupo: string | null
  centro_custo_id: number | null
  centro_custo_nome: string | null
  lancamento_id: number | null
  transferencia_id: number | null
  origem_tipo: string | null
  tags: string[]
  descricao: string | null
  created_at: string
}

interface AgingResumo {
  faixa: string
  quantidade: number
  total: number
  prioritarios: number
}

interface AgingItem {
  id: number
  descricao: string
  valor: number
  data_vencimento: string
  origem: string
  prioridade: boolean
  cobranca_status: string
  cobranca_obs: string | null
  cobranca_em: string | null
  cliente_id: number | null
  dias_atraso: number
  faixa: string
  cliente_nome: string | null
  rfm_segmento: string | null
  cliente_telefone: string | null
}

const RFM_SEGMENTO_CONFIG: Record<string, { label: string; css: string; acao: string; alerta?: boolean }> = {
  VIP:        { label: 'VIP',        css: 'rfmVIP',        acao: 'Abordagem personalizada — contato direto' },
  Recorrente: { label: 'Recorrente', css: 'rfmRecorrente', acao: 'Lembrete amigável — preservar relação'    },
  Regular:    { label: 'Regular',    css: 'rfmRegular',    acao: 'Cobrança padrão'                          },
  Novo:       { label: 'Novo',       css: 'rfmNovo',       acao: 'Atenção especial — primeira experiência', alerta: true },
  'Em Risco': { label: 'Em Risco',   css: 'rfmEmRisco',   acao: 'Prioridade alta — contato urgente',       alerta: true },
  Inativo:    { label: 'Inativo',    css: 'rfmInativo',    acao: 'Cobrança direta'                         },
}

type Aba = 'painel' | 'lancamentos' | 'fluxo'

interface DreGrupo {
  grupo: string
  tipo: 'receita' | 'despesa'
  realizado: number
  previsto: number
  atrasado: number
}

interface BudgetItem {
  id: number
  ano: number
  mes: number | null
  categoria_id: number
  centro_custo_id: number | null
  valor_orcado: number
  observacao: string | null
  fin_categorias?: { nome: string; cor: string; grupo: string } | null
  fin_centros_custo?: { nome: string } | null
}

interface BudgetRow extends BudgetItem {
  realizado: number
  variacao: number   // realizado - orcado (positivo = excedido)
  pct: number        // realizado / orcado * 100
  status: 'ok' | 'alerta' | 'excedido'
}

const COBRANCA_STATUS_LABELS: Record<string, string> = {
  nao_cobrado:  'Não cobrado',
  cobrado:      'Cobrado',
  negociado:    'Em negociação',
  prometido:    'Prometido',
  inadimplente: 'Inadimplente',
}

const FAIXA_LABELS: Record<string, string> = {
  a_vencer:       'A vencer',
  vencido_1_7:    '1–7 dias',
  vencido_8_30:   '8–30 dias',
  vencido_31_plus: '31+ dias',
}

const FORMAS_PAGAMENTO = [
  { value: 'pix',           label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto',        label: 'Boleto' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'cartao_credito',label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'outro',         label: 'Outro' },
]

const CONDICOES = [
  { value: 'a_vista',   label: 'À Vista' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: '7d',  label: '7 dias'  }, { value: '14d', label: '14 dias' },
  { value: '21d', label: '21 dias' }, { value: '28d', label: '28 dias' },
  { value: '30d', label: '30 dias' }, { value: '45d', label: '45 dias' },
  { value: '60d', label: '60 dias' }, { value: '90d', label: '90 dias' },
]

const ORIGENS_LABEL: Record<string, string> = {
  venda:   'Venda',
  nf:      'NF importada',
  projeto: 'Projeto',
  sistema: 'Automático',
  manual:  'Manual',
}

const hoje = () => new Date().toISOString().slice(0, 10)
const mesAtual = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function fmtBRL(v: number, ocultar = false) {
  if (ocultar) return '••••'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(v: string | null) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const FORM_VAZIO = {
  tipo: 'despesa' as 'receita' | 'despesa',   // despesas são mais comuns no manual
  descricao: '',
  valor: '',
  data_competencia: hoje(),
  data_vencimento: hoje(),
  forma_pagamento: 'pix',
  condicao_pagamento: 'a_vista',
  numero_parcelas: '1',
  categoria_id: '',
  centro_custo_id: '',
  nf_chave: '',
  observacao: '',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminFinanceiro() {
  const { ocultarValores } = useAdmin()
  const [aba, setAba] = useState<Aba>('painel')

  const [saldoMes, setSaldoMes]         = useState<SaldoMes | null>(null)
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [categorias, setCategorias]     = useState<Categoria[]>([])
  const [centros, setCentros]           = useState<CentroCusto[]>([])
  const [contas, setContas]             = useState<ContaBancaria[]>([])

  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg]           = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Formulário manual — oculto por padrão (fallback operacional)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]               = useState(FORM_VAZIO)

  // Filtros
  const [filtroTipo,   setFiltroTipo]   = useState<'' | 'receita' | 'despesa'>('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pendente' | 'pago' | 'cancelado' | 'parcial'>('')
  const [filtroAguarda, setFiltroAguarda] = useState(false)
  const [categorizandoId, setCategorizandoId] = useState<number | null>(null)
  const [catSelecionada,  setCatSelecionada]  = useState('')
  const [ccSelecionado,   setCcSelecionado]   = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState<'' | 'manual' | 'automatico'>('')
  const [filtroMes,    setFiltroMes]    = useState(mesAtual())

  // Aging
  const [agingResumo, setAgingResumo] = useState<AgingResumo[]>([])
  const [aging, setAging]             = useState<AgingItem[]>([])
  const [filtroFaixa, setFiltroFaixa] = useState<string>('')
  const [filtroCobrStatus, setFiltroCobrStatus] = useState<string>('')
  const [filtroPrioridade, setFiltroPrioridade] = useState(false)
  const [filtroRFMSegmento, setFiltroRFMSegmento] = useState<string>('')
  const [editandoObsId, setEditandoObsId] = useState<number | null>(null)
  const [obsTexto, setObsTexto]           = useState('')

  // Baixa inline
  const [baixandoId, setBaixandoId] = useState<number | null>(null)
  const [dataBaixa,  setDataBaixa]  = useState(hoje())

  // Config
  const [formCat,    setFormCat]    = useState({ nome: '', tipo: 'receita' as 'receita' | 'despesa', grupo: '', cor: '#16a34a' })
  const [formCentro, setFormCentro] = useState({ nome: '', descricao: '' })
  const [salvandoCat,    setSalvandoCat]    = useState(false)
  const [salvandoCentro, setSalvandoCentro] = useState(false)

  // Fluxo de Caixa — formulário de entrada diária
  const FORM_FLUXO_VAZIO = {
    tipo: 'saida' as 'entrada' | 'saida',
    descricao: '',
    valor: '',
    data: hoje(),
    conta_id: '',
    negocio: 'pousinox',
    status: 'realizado',
    tipo_pagamento: 'pix',
    categoria_id: '',
    centro_custo_id: '',
    documento_ref: '',
  }
  const [mostrarFormFluxo,   setMostrarFormFluxo]   = useState(false)
  const [formFluxo,          setFormFluxo]          = useState(FORM_FLUXO_VAZIO)
  const [salvandoFluxo,      setSalvandoFluxo]      = useState(false)
  const [filtroFluxoStatus,  setFiltroFluxoStatus]  = useState('')
  const [filtroFluxoConta,   setFiltroFluxoConta]   = useState('')
  const [filtroFluxoNegocio, setFiltroFluxoNegocio] = useState('')
  const [filtroFluxoConcil,  setFiltroFluxoConcil]  = useState<'' | 'pendente' | 'conciliado'>('')
  const [filtroFluxoMes,     setFiltroFluxoMes]     = useState(mesAtual())

  // Categorização pendente
  const [pendCatCount, setPendCatCount] = useState(0)

  // DRE
  const [dreGrupos, setDreGrupos] = useState<DreGrupo[]>([])
  const [dreAno, setDreAno] = useState(new Date().getFullYear())
  const [dreMes, setDreMes] = useState<number | 0>(0) // 0 = ano todo

  // Budget
  const [budgetItens,      setBudgetItens]      = useState<BudgetRow[]>([])
  const [anoB,             setAnoB]             = useState(new Date().getFullYear())
  const [mesB,             setMesB]             = useState<number | ''>(new Date().getMonth() + 1)
  const [editandoBudgetId, setEditandoBudgetId] = useState<number | null>(null)
  const [editValor,        setEditValor]        = useState('')
  const [salvandoBudget,   setSalvandoBudget]   = useState(false)
  const [novaCatB,         setNovaCatB]         = useState('')
  const [novoValorB,       setNovoValorB]       = useState('')
  const [adicionando,      setAdicionando]      = useState(false)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  // ── Carga ──────────────────────────────────────────────────────────────────

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: cts }, { data: cts2 }, { count: pendCat }] = await Promise.all([
      supabaseAdmin.from('fin_categorias').select('*').eq('ativo', true).order('grupo').order('nome'),
      supabaseAdmin.from('fin_centros_custo').select('*').eq('ativo', true).order('nome'),
      supabaseAdmin.from('fin_contas').select('*').eq('ativo', true).order('nome'),
      supabaseAdmin.from('fin_lancamentos').select('id', { count: 'exact', head: true }).eq('aguarda_categorizacao', true).eq('status', 'pendente'),
    ])
    setPendCatCount(pendCat ?? 0)
    setCategorias(cats ?? [])
    setCentros(cts ?? [])
    setContas((cts2 ?? []) as ContaBancaria[])
    setLoading(false)
  }, [])

  useEffect(() => { carregarTudo() }, [carregarTudo])

  const carregarSaldo = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from('vw_fin_saldo_mes')
      .select('*')
      .order('mes', { ascending: false })
      .limit(1)
      .single()
    setSaldoMes(data ?? null)
  }, [])

  const carregarLancamentos = useCallback(async () => {
    let q = supabaseAdmin
      .from('fin_lancamentos')
      .select('*, fin_categorias(nome, cor), fin_centros_custo(nome)')
      .order('data_vencimento', { ascending: false })
      .limit(100)

    if (filtroTipo)    q = q.eq('tipo', filtroTipo)
    if (filtroStatus)  q = q.eq('status', filtroStatus)
    if (filtroAguarda) q = q.eq('aguarda_categorizacao', true)
    if (filtroOrigem === 'manual')     q = q.eq('origem', 'manual')
    if (filtroOrigem === 'automatico') q = q.neq('origem', 'manual')
    if (filtroMes) {
      const [y, m] = filtroMes.split('-')
      const fim = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)
      q = q.gte('data_competencia', `${y}-${m}-01`).lte('data_competencia', fim)
    }
    const { data } = await q
    setLancamentos((data ?? []) as Lancamento[])
  }, [filtroTipo, filtroStatus, filtroOrigem, filtroMes])

  const carregarMovimentacoes = useCallback(async () => {
    let q = supabaseAdmin
      .from('vw_fin_extrato')
      .select('*')
      .order('data', { ascending: false })
      .limit(200)

    if (filtroFluxoStatus)  q = q.eq('status', filtroFluxoStatus)
    if (filtroFluxoConta)   q = q.eq('conta_id', filtroFluxoConta)
    if (filtroFluxoNegocio) q = q.eq('negocio', filtroFluxoNegocio)
    if (filtroFluxoConcil === 'pendente')   q = q.eq('conciliado', false)
    if (filtroFluxoConcil === 'conciliado') q = q.eq('conciliado', true)
    if (filtroFluxoMes) {
      const [y, m] = filtroFluxoMes.split('-')
      const dim = new Date(Number(y), Number(m), 0).getDate()
      q = q.gte('data', `${y}-${m}-01`).lte('data', `${y}-${m}-${dim}`)
    }

    const { data } = await q
    setMovimentacoes((data ?? []) as Movimentacao[])
  }, [filtroFluxoStatus, filtroFluxoConta, filtroFluxoNegocio, filtroFluxoConcil, filtroFluxoMes])

  const salvarMovimentacao = async () => {
    if (!formFluxo.descricao || !formFluxo.valor || !formFluxo.data) {
      setMsg({ tipo: 'erro', texto: 'Preencha descrição, valor e data.' }); return
    }
    setSalvandoFluxo(true)
    const payload: Record<string, unknown> = {
      tipo:           formFluxo.tipo,
      descricao:      formFluxo.descricao,
      valor:          Number(formFluxo.valor.replace(',', '.')),
      data:           formFluxo.data,
      negocio:        formFluxo.negocio,
      status:         formFluxo.status,
      tipo_pagamento: formFluxo.tipo_pagamento || null,
      documento_ref:  formFluxo.documento_ref  || null,
      origem_tipo:    'manual',
      conta_id:       formFluxo.conta_id       ? Number(formFluxo.conta_id)       : null,
      categoria_id:   formFluxo.categoria_id   ? Number(formFluxo.categoria_id)   : null,
      centro_custo_id:formFluxo.centro_custo_id? Number(formFluxo.centro_custo_id): null,
      conciliado:     formFluxo.status === 'realizado',
      conciliado_em:  formFluxo.status === 'realizado' ? new Date().toISOString() : null,
    }
    const { error } = await supabaseAdmin.from('fin_movimentacoes').insert(payload)
    setSalvandoFluxo(false)
    if (error) { setMsg({ tipo: 'erro', texto: error.message }); return }
    setMsg({ tipo: 'ok', texto: 'Movimentação registrada.' })
    setMostrarFormFluxo(false)
    setFormFluxo(FORM_FLUXO_VAZIO)
    carregarMovimentacoes()
  }

  const conciliarMovimentacao = async (id: number, conciliado: boolean) => {
    const { error } = await supabaseAdmin
      .from('fin_movimentacoes')
      .update({
        conciliado,
        conciliado_em:  conciliado ? new Date().toISOString() : null,
        conciliado_por: conciliado ? 'admin' : null,
      })
      .eq('id', id)
    if (!error) carregarMovimentacoes()
  }

  const carregarAgingResumo = useCallback(async () => {
    const { data } = await supabaseAdmin.from('vw_fin_aging_resumo').select('*')
    setAgingResumo((data ?? []) as AgingResumo[])
  }, [])

  const carregarAging = useCallback(async () => {
    let q = supabaseAdmin
      .from('vw_fin_aging')
      .select('*')
      .order('dias_atraso', { ascending: false })
      .limit(200)
    if (filtroFaixa)        q = q.eq('faixa', filtroFaixa)
    if (filtroCobrStatus)   q = q.eq('cobranca_status', filtroCobrStatus)
    if (filtroPrioridade)   q = q.eq('prioridade', true)
    if (filtroRFMSegmento)  q = q.eq('rfm_segmento', filtroRFMSegmento)
    const { data } = await q
    setAging((data ?? []) as AgingItem[])
  }, [filtroFaixa, filtroCobrStatus, filtroPrioridade, filtroRFMSegmento])

  const carregarBudget = useCallback(async () => {
    // 1. Orçamento cadastrado para o período
    let bq = supabaseAdmin
      .from('fin_budget')
      .select('*, fin_categorias(nome, cor, grupo), fin_centros_custo(nome)')
      .eq('ano', anoB)
    if (mesB !== '') bq = bq.eq('mes', mesB)
    else             bq = bq.is('mes', null)
    const { data: budgets } = await bq

    // 2. Realizado: despesas não canceladas no mesmo período
    const mesStr  = mesB !== '' ? String(mesB).padStart(2, '0') : null
    const dimMes  = mesB !== '' ? new Date(anoB, mesB as number, 0).getDate() : 31
    const dataIni = mesStr ? `${anoB}-${mesStr}-01`           : `${anoB}-01-01`
    const dataFim = mesStr ? `${anoB}-${mesStr}-${dimMes}`    : `${anoB}-12-31`
    const { data: lancs } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('categoria_id, valor')
      .eq('tipo', 'despesa')
      .in('status', ['pendente', 'pago', 'parcial'])
      .gte('data_competencia', dataIni)
      .lte('data_competencia', dataFim)

    // 3. Agrupa realizado por categoria
    const realMap: Record<number, number> = {}
    for (const l of (lancs ?? [])) {
      if (l.categoria_id != null)
        realMap[l.categoria_id] = (realMap[l.categoria_id] ?? 0) + (l.valor as number)
    }

    // 4. Monta linhas enriquecidas
    const rows: BudgetRow[] = (budgets ?? []).map(b => {
      const realizado = realMap[b.categoria_id] ?? 0
      const variacao  = realizado - b.valor_orcado
      const pct       = b.valor_orcado > 0 ? (realizado / b.valor_orcado) * 100 : (realizado > 0 ? 999 : 0)
      const status: BudgetRow['status'] = pct >= 100 ? 'excedido' : pct >= 80 ? 'alerta' : 'ok'
      return { ...(b as BudgetItem), realizado, variacao, pct, status }
    })
    rows.sort((a, b) => {
      const ga = a.fin_categorias?.grupo ?? ''; const gb = b.fin_categorias?.grupo ?? ''
      return ga !== gb ? ga.localeCompare(gb) : (a.fin_categorias?.nome ?? '').localeCompare(b.fin_categorias?.nome ?? '')
    })
    setBudgetItens(rows)
  }, [anoB, mesB])

  const carregarDre = useCallback(async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    const dataIni = dreMes ? `${dreAno}-${String(dreMes).padStart(2,'0')}-01` : `${dreAno}-01-01`
    const dimMes  = dreMes ? new Date(dreAno, dreMes, 0).getDate() : 31
    const dataFim = dreMes ? `${dreAno}-${String(dreMes).padStart(2,'0')}-${dimMes}` : `${dreAno}-12-31`

    // Realizado: fin_movimentacoes no período (agrupado por tipo entrada/saida)
    const { data: movs } = await supabaseAdmin
      .from('fin_movimentacoes')
      .select('tipo, valor')
      .gte('data', dataIni)
      .lte('data', dataFim)

    // Previsto: fin_lancamentos pendente + vencimento futuro no período
    const { data: previstos } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('tipo, valor, fin_categorias(grupo, tipo)')
      .eq('status', 'pendente')
      .gte('data_vencimento', hoje)
      .gte('data_vencimento', dataIni)
      .lte('data_vencimento', dataFim)

    // Atrasado: fin_lancamentos pendente + vencimento passado dentro do período
    const { data: atrasados } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('tipo, valor, fin_categorias(grupo, tipo)')
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje)
      .gte('data_vencimento', dataIni)
      .lte('data_vencimento', dataFim)

    // Agrega por grupo+tipo
    const map: Record<string, DreGrupo> = {}
    const key = (grupo: string, tipo: 'receita' | 'despesa') => `${tipo}::${grupo || 'Sem categoria'}`
    const ensure = (grupo: string, tipo: 'receita' | 'despesa') => {
      const k = key(grupo, tipo)
      if (!map[k]) map[k] = { grupo: grupo || 'Sem categoria', tipo, realizado: 0, previsto: 0, atrasado: 0 }
      return map[k]
    }

    // Realizado: sem categoria (movimentacoes não têm join direto configurado)
    let totEntrada = 0; let totSaida = 0
    for (const m of (movs ?? []) as any[]) {
      if (m.tipo === 'entrada') totEntrada += Number(m.valor) || 0
      else totSaida += Number(m.valor) || 0
    }
    if (totEntrada > 0) ensure('Caixa', 'receita').realizado += totEntrada
    if (totSaida  > 0) ensure('Caixa', 'despesa').realizado += totSaida

    for (const l of (previstos ?? []) as any[]) {
      const cat  = (l as any).fin_categorias
      const tipo = cat?.tipo ?? l.tipo
      ensure(cat?.grupo ?? '', tipo).previsto += Number(l.valor) || 0
    }
    for (const l of (atrasados ?? []) as any[]) {
      const cat  = (l as any).fin_categorias
      const tipo = cat?.tipo ?? l.tipo
      ensure(cat?.grupo ?? '', tipo).atrasado += Number(l.valor) || 0
    }

    setDreGrupos(Object.values(map).sort((a, b) =>
      a.tipo !== b.tipo ? a.tipo.localeCompare(b.tipo) : a.grupo.localeCompare(b.grupo)
    ))
  }, [dreAno, dreMes])

  useEffect(() => {
    if (aba === 'painel')      { carregarSaldo(); carregarAgingResumo() }
    if (aba === 'lancamentos') carregarLancamentos()
    if (aba === 'recebiveis')  carregarAging()
    if (aba === 'fluxo')       carregarMovimentacoes()
    if (aba === 'budget')      carregarBudget()
    if (aba === 'dre')         carregarDre()
  }, [aba, carregarSaldo, carregarAgingResumo, carregarLancamentos, carregarAging, carregarMovimentacoes, carregarBudget, carregarDre])

  useEffect(() => {
    if (aba === 'lancamentos') carregarLancamentos()
  }, [filtroTipo, filtroStatus, filtroOrigem, filtroMes, aba, carregarLancamentos])

  useEffect(() => {
    if (aba === 'recebiveis') carregarAging()
  }, [filtroFaixa, filtroCobrStatus, filtroPrioridade, filtroRFMSegmento, aba, carregarAging])

  useEffect(() => {
    if (aba === 'budget') carregarBudget()
  }, [anoB, mesB, aba, carregarBudget])

  // ── Budget — salvar inline ─────────────────────────────────────────────────

  async function salvarBudgetInline(id: number) {
    setSalvandoBudget(true)
    const v = parseFloat(editValor.replace(',', '.'))
    if (isNaN(v) || v < 0) {
      setMsg({ tipo: 'erro', texto: 'Valor inválido.' })
      setSalvandoBudget(false)
      return
    }
    const { error } = await supabaseAdmin.from('fin_budget').update({ valor_orcado: v }).eq('id', id)
    if (error) setMsg({ tipo: 'erro', texto: 'Erro ao salvar budget.' })
    else { setMsg({ tipo: 'ok', texto: 'Budget atualizado.' }); setEditandoBudgetId(null); carregarBudget() }
    setSalvandoBudget(false)
  }

  async function adicionarBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!novaCatB) return
    setAdicionando(true)
    const v = parseFloat(novoValorB.replace(',', '.')) || 0
    const { error } = await supabaseAdmin.from('fin_budget').insert({
      ano:          anoB,
      mes:          mesB !== '' ? mesB : null,
      categoria_id: Number(novaCatB),
      valor_orcado: v,
    })
    if (error) setMsg({ tipo: 'erro', texto: error.code === '23505' ? 'Categoria já existe neste período.' : error.message })
    else { setMsg({ tipo: 'ok', texto: 'Linha de budget adicionada.' }); setNovaCatB(''); setNovoValorB(''); carregarBudget() }
    setAdicionando(false)
  }

  async function removerBudget(id: number) {
    if (!window.confirm('Remover esta linha do budget?')) return
    await supabaseAdmin.from('fin_budget').delete().eq('id', id)
    carregarBudget()
  }

  // ── Salvar lançamento manual ───────────────────────────────────────────────

  async function salvarLancamento(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao.trim() || !form.valor) {
      setMsg({ tipo: 'erro', texto: 'Preencha descrição e valor.' })
      return
    }
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_lancamentos').insert({
      tipo:               form.tipo,
      descricao:          form.descricao.trim(),
      valor:              parseFloat(form.valor),
      data_competencia:   form.data_competencia,
      data_vencimento:    form.data_vencimento,
      forma_pagamento:    form.forma_pagamento || null,
      condicao_pagamento: form.condicao_pagamento || null,
      numero_parcelas:    parseInt(form.numero_parcelas) || 1,
      categoria_id:       form.categoria_id    ? parseInt(form.categoria_id)    : null,
      centro_custo_id:    form.centro_custo_id ? parseInt(form.centro_custo_id) : null,
      nf_chave:           form.nf_chave.trim() || null,
      observacao:         form.observacao.trim() || null,
      status:             'pendente',
      origem:             'manual',   // sempre manual aqui
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Lançamento manual registrado.' })
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      carregarLancamentos()
      carregarSaldo()
    }
    setSalvando(false)
  }

  // ── Baixar (marcar como pago) ──────────────────────────────────────────────

  async function confirmarCategorizacao(lanc: Lancamento) {
    if (!catSelecionada) return
    setSalvando(true)
    // Atualiza o lançamento com a categoria escolhida
    await supabaseAdmin.from('fin_lancamentos').update({
      categoria_id:          catSelecionada || null,
      centro_custo_id:       ccSelecionado  || null,
      aguarda_categorizacao: false,
    }).eq('id', lanc.id)

    // Aprende CNPJ → categoria para próximas NFs
    const cnpj = (lanc.nf_chave ?? '').slice(6, 20) // extrai CNPJ da chave NF-e (pos 6-19)
    if (cnpj && cnpj.length === 14) {
      await supabaseAdmin.from('fin_categoria_cnpj').upsert({
        cnpj,
        tipo:           lanc.tipo,
        categoria_id:   catSelecionada || null,
        centro_custo_id: ccSelecionado || null,
        usos:           1,
      }, { onConflict: 'cnpj,tipo', ignoreDuplicates: false })
      // Incrementa usos se já existia
      await supabaseAdmin.rpc('incrementar_usos_categoria_cnpj', { p_cnpj: cnpj, p_tipo: lanc.tipo }).throwOnError().then(() => {}).catch(() => {})
    }

    setCategorizandoId(null); setCatSelecionada(''); setCcSelecionado('')
    setSalvando(false)
    await carregarTudo()
    setMsg({ tipo: 'ok', texto: 'Categoria confirmada e memória atualizada.' })
  }

  async function baixarLancamento(lanc: Lancamento) {
    setSalvando(true)
    const { error } = await supabaseAdmin
      .from('fin_lancamentos')
      .update({ status: 'pago', data_pagamento: dataBaixa })
      .eq('id', lanc.id)

    if (!error) {
      await supabaseAdmin.from('fin_movimentacoes').insert({
        lancamento_id: lanc.id,
        tipo:          lanc.tipo === 'receita' ? 'entrada' : 'saida',
        valor:         lanc.valor,
        data:          dataBaixa,
        conta:         lanc.forma_pagamento === 'dinheiro' ? 'caixa' : 'banco',
        descricao:     lanc.descricao,
      })
      setMsg({ tipo: 'ok', texto: 'Baixa registrada.' })
      setBaixandoId(null)
      carregarLancamentos()
      carregarSaldo()
    } else {
      setMsg({ tipo: 'erro', texto: 'Erro ao baixar: ' + error.message })
    }
    setSalvando(false)
  }

  async function togglePrioridade(item: AgingItem) {
    await supabaseAdmin
      .from('fin_lancamentos')
      .update({ prioridade: !item.prioridade })
      .eq('id', item.id)
    carregarAging()
  }

  async function atualizarCobrancaStatus(id: number, status: string) {
    await supabaseAdmin
      .from('fin_lancamentos')
      .update({ cobranca_status: status, cobranca_em: new Date().toISOString() })
      .eq('id', id)
    carregarAging()
  }

  async function salvarObsCobranca(item: AgingItem) {
    await supabaseAdmin
      .from('fin_lancamentos')
      .update({ cobranca_obs: obsTexto.trim() || null })
      .eq('id', item.id)
    setEditandoObsId(null)
    carregarAging()
  }

  async function baixarDoAging(item: AgingItem) {
    const data = prompt('Data de recebimento (AAAA-MM-DD):', hoje())
    if (!data) return
    const { error } = await supabaseAdmin
      .from('fin_lancamentos')
      .update({ status: 'pago', data_pagamento: data })
      .eq('id', item.id)
    if (!error) {
      await supabaseAdmin.from('fin_movimentacoes').insert({
        lancamento_id: item.id,
        tipo:          'entrada',
        valor:         item.valor,
        data,
        conta:         'banco',
        descricao:     item.descricao,
      })
      setMsg({ tipo: 'ok', texto: 'Recebimento registrado.' })
      carregarAging()
      carregarAgingResumo()
      carregarSaldo()
    } else {
      setMsg({ tipo: 'erro', texto: 'Erro: ' + error.message })
    }
  }

  async function cancelarLancamento(id: number) {
    if (!confirm('Cancelar este lançamento?')) return
    const { error } = await supabaseAdmin
      .from('fin_lancamentos').update({ status: 'cancelado' }).eq('id', id)
    if (!error) { carregarLancamentos(); carregarSaldo() }
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  async function salvarCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!formCat.nome.trim()) return
    setSalvandoCat(true)
    const { error } = await supabaseAdmin.from('fin_categorias').insert({
      nome: formCat.nome.trim(), tipo: formCat.tipo,
      grupo: formCat.grupo.trim() || null, cor: formCat.cor,
    })
    if (!error) {
      setMsg({ tipo: 'ok', texto: 'Categoria criada.' })
      setFormCat({ nome: '', tipo: 'receita', grupo: '', cor: '#16a34a' })
      carregarTudo()
    }
    setSalvandoCat(false)
  }

  async function salvarCentro(e: React.FormEvent) {
    e.preventDefault()
    if (!formCentro.nome.trim()) return
    setSalvandoCentro(true)
    const { error } = await supabaseAdmin.from('fin_centros_custo').insert({
      nome: formCentro.nome.trim(), descricao: formCentro.descricao.trim() || null,
    })
    if (!error) {
      setMsg({ tipo: 'ok', texto: 'Centro criado.' })
      setFormCentro({ nome: '', descricao: '' })
      carregarTudo()
    }
    setSalvandoCentro(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function statusEfetivo(lanc: Lancamento) {
    if (lanc.status !== 'pendente') return lanc.status
    return lanc.data_vencimento < hoje() ? 'vencido' : 'pendente'
  }

  function BadgeStatus({ status }: { status: string }) {
    const map: Record<string, string> = {
      pago: styles.badgePago, pendente: styles.badgePendente,
      vencido: styles.badgeVencido, parcial: styles.badgeParcial,
      cancelado: styles.badgeCancelado,
    }
    const labels: Record<string, string> = {
      pago: 'Pago', pendente: 'Pendente', parcial: 'Parcial',
      cancelado: 'Cancelado', vencido: 'Vencido',
    }
    return <span className={map[status] ?? styles.badgePendente}>{labels[status] ?? status}</span>
  }

  function BadgeOrigem({ origem }: { origem: string }) {
    const isAuto = origem !== 'manual'
    return (
      <span className={isAuto ? styles.origemAuto : styles.origemManual}>
        {isAuto ? '⚡' : '✍'} {ORIGENS_LABEL[origem] ?? origem}
      </span>
    )
  }

  const catsPorTipo = (tipo: 'receita' | 'despesa') => categorias.filter(c => c.tipo === tipo)

  if (loading) return <div className={styles.loading}>Carregando...</div>

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {/* Abas */}
      <div className={styles.abas}>
        {([
          { key: 'painel',      label: '📊 Painel'         },
          { key: 'lancamentos', label: '📋 Lançamentos'    },
          { key: 'fluxo',       label: '💰 Fluxo de Caixa' },
        ] as { key: Aba; label: string }[]).map(a => (
          <button key={a.key}
            className={`${styles.aba} ${aba === a.key ? styles.abaAtiva : ''}`}
            onClick={() => setAba(a.key)}>
            {a.label}
          </button>
        ))}
        <a href="/admin/relatorios" className={styles.aba} style={{ textDecoration: 'none' }}>🎯 Budget / DRE</a>
        <a href="/admin/configuracao-financeiro" className={styles.aba} style={{ textDecoration: 'none' }}>⚙️ Categorias</a>
      </div>

      {/* ══ PAINEL ══════════════════════════════════════════════════════════ */}
      {aba === 'painel' && (
        <div className={styles.painelWrap}>

          {/* Banner automation-first */}
          <div className={styles.autoFirst}>
            <span className={styles.autoFirstIcon}>⚡</span>
            <div>
              <strong>Lançamentos automáticos</strong>
              <p>Receitas nascem em <strong>Vendas</strong>. Despesas nascem de <strong>NFs importadas</strong> e <strong>Projetos</strong>. O lançamento manual é reservado para ajustes, taxas e exceções.</p>
            </div>
          </div>

          {/* Cards */}
          <div className={styles.cards}>
            <div className={`${styles.card} ${styles.cardReceita}`}>
              <span className={styles.cardLabel}>Receitas do mês</span>
              <strong className={styles.cardVal}>{fmtBRL(saldoMes?.total_receitas ?? 0, ocultarValores)}</strong>
            </div>
            <div className={`${styles.card} ${styles.cardDespesa}`}>
              <span className={styles.cardLabel}>Despesas do mês</span>
              <strong className={styles.cardVal}>{fmtBRL(saldoMes?.total_despesas ?? 0, ocultarValores)}</strong>
            </div>
            <div className={`${styles.card} ${(saldoMes?.saldo ?? 0) >= 0 ? styles.cardSaldoPos : styles.cardSaldoNeg}`}>
              <span className={styles.cardLabel}>Saldo do mês</span>
              <strong className={styles.cardVal}>{fmtBRL(saldoMes?.saldo ?? 0, ocultarValores)}</strong>
            </div>
            <div className={`${styles.card} ${styles.cardAlerta}`}>
              <span className={styles.cardLabel}>A receber (vencidos)</span>
              <strong className={styles.cardVal}>{fmtBRL(saldoMes?.vencidos_receber ?? 0, ocultarValores)}</strong>
            </div>
            <div className={`${styles.card} ${styles.cardAlerta}`}>
              <span className={styles.cardLabel}>A pagar (vencidos)</span>
              <strong className={styles.cardVal}>{fmtBRL(saldoMes?.vencidos_pagar ?? 0, ocultarValores)}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Pendentes</span>
              <strong className={styles.cardVal}>{saldoMes?.pendentes ?? 0}</strong>
            </div>
          </div>

          {pendCatCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff8e0', border: '1px solid #f39c12',
              borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <span style={{ fontSize: '0.88rem', color: '#7a5000', fontWeight: 600 }}>
                {pendCatCount} lançamento{pendCatCount > 1 ? 's' : ''} aguardando categorização
              </span>
              <button onClick={() => setAba('lancamentos')}
                style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#7a5000', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Categorizar →
              </button>
            </div>
          )}

          {/* Aging de recebíveis */}
          {agingResumo.length > 0 && (
            <div>
              <div className={styles.secaoTitulo}>
                Recebíveis em aberto
                <button className={styles.btnLinkSmall} onClick={() => setAba('lancamentos')}>
                  Ver todos →
                </button>
              </div>
              <div className={styles.agingCards}>
                {(['a_vencer', 'vencido_1_7', 'vencido_8_30', 'vencido_31_plus'] as const).map(faixa => {
                  const item = agingResumo.find(r => r.faixa === faixa)
                  if (!item) return null
                  return (
                    <div key={faixa}
                      className={`${styles.agingCard} ${faixa !== 'a_vencer' ? styles.agingCardVencido : ''}`}
                      onClick={() => { setFiltroFaixa(faixa); setAba('lancamentos') }}>
                      <span className={styles.agingFaixa}>{FAIXA_LABELS[faixa]}</span>
                      <strong className={styles.agingTotal}>{fmtBRL(item.total, ocultarValores)}</strong>
                      <span className={styles.agingQtd}>{item.quantidade} título{item.quantidade !== 1 ? 's' : ''}</span>
                      {item.prioritarios > 0 && (
                        <span className={styles.agingPrioritarios}>⭐ {item.prioritarios} prioritári{item.prioritarios !== 1 ? 'os' : 'o'}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Atalhos de origem */}
          <div className={styles.atalhos}>
            <div className={styles.atalho}>
              <span className={styles.atalhoIcon}>📦</span>
              <div>
                <div className={styles.atalhoTitulo}>Recebimento de venda</div>
                <div className={styles.atalhoDesc}>Ao registrar uma venda em <strong>Vendas</strong>, o lançamento financeiro é criado automaticamente como pago</div>
              </div>
              <span className={styles.atalhoStatusOk}>⚡ Ativo</span>
            </div>
            <div className={styles.atalho}>
              <span className={styles.atalhoIcon}>🧾</span>
              <div>
                <div className={styles.atalhoTitulo}>Lançar despesa/receita de NF</div>
                <div className={styles.atalhoDesc}>Em <strong>Fiscal → Docs Recebidos/Emitidos</strong>, abra um doc autorizado e clique em "💰 Gerar lançamento financeiro"</div>
              </div>
              <span className={styles.atalhoStatusOk}>⚡ Ativo</span>
            </div>
            <div className={styles.atalho}>
              <span className={styles.atalhoIcon}>📐</span>
              <div>
                <div className={styles.atalhoTitulo}>Lançar receita de projeto</div>
                <div className={styles.atalhoDesc}>Vá em <strong>Projetos</strong> → detalhe do projeto → botão "💰 Gerar Recebível"</div>
              </div>
              <span className={styles.atalhoStatusOk}>⚡ Ativo</span>
            </div>
          </div>

          {/* Acesso ao manual */}
          <div className={styles.manualAcesso}>
            <button className={styles.btnSecondary}
              onClick={() => { setAba('lancamentos'); setMostrarForm(true) }}>
              ✍ Lançamento manual (ajuste / taxa / exceção)
            </button>
          </div>
        </div>
      )}

      {/* ══ LANÇAMENTOS ═════════════════════════════════════════════════════ */}
      {aba === 'lancamentos' && (
        <div className={styles.lancWrap}>

          {/* Filtros */}
          <div className={styles.filtros}>
            <select className={styles.filtroSelect} value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}>
              <option value="">Todos os tipos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
            <select className={styles.filtroSelect} value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="parcial">Parcial</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select className={styles.filtroSelect} value={filtroOrigem}
              onChange={e => setFiltroOrigem(e.target.value as typeof filtroOrigem)}>
              <option value="">Todas as origens</option>
              <option value="automatico">⚡ Automáticos</option>
              <option value="manual">✍ Manuais</option>
            </select>
            <input type="month" className={styles.filtroSelect}
              value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />

            <button
              onClick={() => setFiltroAguarda(v => !v)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
                background: filtroAguarda ? '#fff8e0' : '#fff',
                border: filtroAguarda ? '1px solid #f39c12' : '1px solid #d0d7de',
                color: filtroAguarda ? '#7a5000' : '#555',
              }}>
              {filtroAguarda ? '⚠️ Aguardando categoria' : '⚠️ Aguardando categoria'}
              {pendCatCount > 0 && !filtroAguarda && (
                <span style={{ marginLeft: 6, background: '#f39c12', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem' }}>
                  {pendCatCount}
                </span>
              )}
            </button>

            {/* Lançamento manual — secundário, não é o CTA principal */}
            <button className={styles.btnManual}
              onClick={() => setMostrarForm(v => !v)}>
              {mostrarForm ? '✕ Fechar' : '✍ Lançamento manual'}
            </button>
          </div>

          {/* Formulário manual — área secundária, colapsável */}
          {mostrarForm && (
            <details open className={styles.formManualWrap}>
              <summary className={styles.formManualSummary}>
                ✍ Lançamento manual — use apenas para ajustes, taxas, sangrias e exceções
              </summary>
              <form className={styles.form} onSubmit={salvarLancamento}>

                {/* Tipo */}
                <div className={styles.tipoToggle}>
                  {(['receita', 'despesa'] as const).map(t => (
                    <button key={t} type="button"
                      className={`${styles.tipoBtn} ${form.tipo === t ? (t === 'receita' ? styles.tipoBtnReceita : styles.tipoBtnDespesa) : ''}`}
                      onClick={() => setForm(f => ({ ...f, tipo: t }))}>
                      {t === 'receita' ? '↑ Receita' : '↓ Despesa'}
                    </button>
                  ))}
                </div>

                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label>Descrição *</label>
                    <input className={styles.input} value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Ex: Taxa bancária, Sangria, Ajuste..." required />
                  </div>
                  <div className={styles.field}>
                    <label>Valor (R$) *</label>
                    <input className={styles.input} type="number" step="0.01" min="0.01"
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      placeholder="0,00" required />
                  </div>
                </div>

                <div className={styles.row3}>
                  <div className={styles.field}>
                    <label>Data de competência *</label>
                    <input className={styles.input} type="date" value={form.data_competencia}
                      onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} required />
                  </div>
                  <div className={styles.field}>
                    <label>Data de vencimento *</label>
                    <input className={styles.input} type="date" value={form.data_vencimento}
                      onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} required />
                  </div>
                  <div className={styles.field}>
                    <label>Parcelas</label>
                    <input className={styles.input} type="number" min="1" max="60"
                      value={form.numero_parcelas}
                      onChange={e => setForm(f => ({ ...f, numero_parcelas: e.target.value }))} />
                  </div>
                </div>

                <div className={styles.row3}>
                  <div className={styles.field}>
                    <label>Forma de pagamento</label>
                    <select className={styles.input} value={form.forma_pagamento}
                      onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                      {FORMAS_PAGAMENTO.map(fp => (
                        <option key={fp.value} value={fp.value}>{fp.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Condição</label>
                    <select className={styles.input} value={form.condicao_pagamento}
                      onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}>
                      {CONDICOES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Categoria</label>
                    <select className={styles.input} value={form.categoria_id}
                      onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                      <option value="">— sem categoria —</option>
                      {catsPorTipo(form.tipo).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label>Centro de custo</label>
                    <select className={styles.input} value={form.centro_custo_id}
                      onChange={e => setForm(f => ({ ...f, centro_custo_id: e.target.value }))}>
                      <option value="">— sem centro —</option>
                      {centros.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Chave NF-e (referência)</label>
                    <input className={styles.input} value={form.nf_chave}
                      onChange={e => setForm(f => ({ ...f, nf_chave: e.target.value }))}
                      placeholder="44 dígitos (opcional)" maxLength={44} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Observação</label>
                  <input className={styles.input} value={form.observacao}
                    onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    placeholder="Informação adicional..." />
                </div>

                <div className={styles.formActions}>
                  <button type="button" className={styles.btnSecondary}
                    onClick={() => { setMostrarForm(false); setForm(FORM_VAZIO) }}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Registrar lançamento manual'}
                  </button>
                </div>
              </form>
            </details>
          )}

          {/* Tabela */}
          {lancamentos.length === 0 ? (
            <div className={styles.vazio}>Nenhum lançamento encontrado para os filtros selecionados.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Origem</th>
                    <th>Categoria</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(lanc => (
                    <tr key={lanc.id} className={lanc.origem === 'manual' ? styles.rowManual : ''}>
                      <td>
                        <span className={lanc.tipo === 'receita' ? styles.tipoReceita : styles.tipoDespesa}>
                          {lanc.tipo === 'receita' ? '↑' : '↓'} {lanc.tipo}
                        </span>
                      </td>
                      <td>
                        <div className={styles.descCell}>{lanc.descricao}</div>
                        {lanc.observacao && <div className={styles.obs}>{lanc.observacao}</div>}
                      </td>
                      <td><BadgeOrigem origem={lanc.origem} /></td>
                      <td>
                        {lanc.fin_categorias ? (
                          <span className={styles.catBadge} style={{ borderColor: lanc.fin_categorias.cor }}>
                            {lanc.fin_categorias.nome}
                          </span>
                        ) : '—'}
                      </td>
                      <td className={styles.data}>{fmtData(lanc.data_vencimento)}</td>
                      <td className={lanc.tipo === 'receita' ? styles.valorReceita : styles.valorDespesa}>
                        {fmtBRL(lanc.valor, ocultarValores)}
                      </td>
                      <td><BadgeStatus status={statusEfetivo(lanc)} /></td>
                      <td>
                        {lanc.status === 'pendente' && (
                          baixandoId === lanc.id ? (
                            <div className={styles.baixaInline}>
                              <input type="date" className={styles.inputSmall}
                                value={dataBaixa} onChange={e => setDataBaixa(e.target.value)} />
                              <button className={styles.btnBaixa} disabled={salvando}
                                onClick={() => baixarLancamento(lanc)}>
                                {salvando ? '...' : '✓ Baixar'}
                              </button>
                              <button className={styles.btnCancelarBaixa}
                                onClick={() => setBaixandoId(null)}>✕</button>
                            </div>
                          ) : (
                            <div className={styles.acoes}>
                              {lanc.aguarda_categorizacao && categorizandoId !== lanc.id && (
                                <button
                                  onClick={() => { setCategorizandoId(lanc.id); setCatSelecionada(''); setCcSelecionado('') }}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 5, border: '1px solid #f39c12', background: '#fff8e0', color: '#7a5000', cursor: 'pointer', fontWeight: 600 }}>
                                  ⚠️ Categorizar
                                </button>
                              )}
                              {categorizandoId === lanc.id && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#fffbf0', border: '1px solid #f39c12', borderRadius: 6, padding: 8, minWidth: 220 }}>
                                  <select value={catSelecionada} onChange={e => setCatSelecionada(e.target.value)}
                                    style={{ fontSize: '0.78rem', padding: '3px 6px', borderRadius: 4, border: '1px solid #d0d7de' }}>
                                    <option value="">Categoria…</option>
                                    {categorias.filter(c => c.tipo === lanc.tipo).map(c => (
                                      <option key={c.id} value={String(c.id)}>{c.grupo ? `${c.grupo} / ` : ''}{c.nome}</option>
                                    ))}
                                  </select>
                                  <select value={ccSelecionado} onChange={e => setCcSelecionado(e.target.value)}
                                    style={{ fontSize: '0.78rem', padding: '3px 6px', borderRadius: 4, border: '1px solid #d0d7de' }}>
                                    <option value="">Centro de custo (opcional)</option>
                                    {centros.map(cc => <option key={cc.id} value={String(cc.id)}>{cc.nome}</option>)}
                                  </select>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button disabled={!catSelecionada || salvando} onClick={() => confirmarCategorizacao(lanc)}
                                      style={{ flex: 1, fontSize: '0.75rem', padding: '3px 0', borderRadius: 4, border: 'none', background: '#27ae60', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                      ✓ Confirmar
                                    </button>
                                    <button onClick={() => setCategorizandoId(null)}
                                      style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 4, border: '1px solid #d0d7de', background: '#fff', cursor: 'pointer' }}>
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              )}
                              <button className={styles.btnBaixar}
                                onClick={() => { setBaixandoId(lanc.id); setDataBaixa(hoje()) }}>
                                Baixar
                              </button>
                              <button className={styles.btnCancelar}
                                onClick={() => cancelarLancamento(lanc.id)}>
                                Cancelar
                              </button>
                            </div>
                          )
                        )}
                        {lanc.status === 'pago' && (
                          <span className={styles.pagoDia}>{fmtData(lanc.data_pagamento)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ RECEBÍVEIS (removido — ver Lançamentos) ══ */}
      {false && (
        <div className={styles.lancWrap}>

          {/* Filtros */}
          <div className={styles.filtros}>
            <select className={styles.filtroSelect} value={filtroFaixa}
              onChange={e => setFiltroFaixa(e.target.value)}>
              <option value="">Todas as faixas</option>
              <option value="a_vencer">A vencer</option>
              <option value="vencido_1_7">Vencido 1–7 dias</option>
              <option value="vencido_8_30">Vencido 8–30 dias</option>
              <option value="vencido_31_plus">Vencido 31+ dias</option>
            </select>
            <select className={styles.filtroSelect} value={filtroCobrStatus}
              onChange={e => setFiltroCobrStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(COBRANCA_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select className={styles.filtroSelect} value={filtroRFMSegmento}
              onChange={e => setFiltroRFMSegmento(e.target.value)}>
              <option value="">Todos os segmentos</option>
              {Object.keys(RFM_SEGMENTO_CONFIG).map(s => (
                <option key={s} value={s}>{RFM_SEGMENTO_CONFIG[s].label}</option>
              ))}
            </select>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={filtroPrioridade}
                onChange={e => setFiltroPrioridade(e.target.checked)} />
              Só prioritários
            </label>
          </div>

          {aging.length === 0 ? (
            <div className={styles.vazio}>Nenhum recebível pendente para os filtros selecionados.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>⭐</th>
                    <th>Descrição / Cliente</th>
                    <th>RFM</th>
                    <th>Vencimento</th>
                    <th>Atraso</th>
                    <th>Valor</th>
                    <th>Cobrança</th>
                    <th>Observação</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map(item => (
                    <tr key={item.id} className={item.prioridade ? styles.rowPrioritario : ''}>
                      <td>
                        <button
                          className={`${styles.btnEstrela} ${item.prioridade ? styles.btnEstrelaAtiva : ''}`}
                          title={item.prioridade ? 'Remover prioridade' : 'Marcar como prioritário'}
                          onClick={() => togglePrioridade(item)}>
                          {item.prioridade ? '⭐' : '☆'}
                        </button>
                      </td>
                      <td>
                        <div className={styles.descCell}>{item.descricao}</div>
                        {item.cliente_nome && (
                          <div className={styles.clienteNomeAging}>{item.cliente_nome}</div>
                        )}
                        <BadgeOrigem origem={item.origem} />
                      </td>
                      <td>
                        {item.rfm_segmento ? (() => {
                          const cfg = RFM_SEGMENTO_CONFIG[item.rfm_segmento]
                          return cfg ? (
                            <span className={styles[cfg.css as keyof typeof styles]}
                              title={cfg.acao}>
                              {cfg.label}
                            </span>
                          ) : <span className={styles.rfmRegular}>{item.rfm_segmento}</span>
                        })() : <span className={styles.rfmSemDado}>—</span>}
                      </td>
                      <td className={styles.data}>{fmtData(item.data_vencimento)}</td>
                      <td>
                        <span className={
                          item.faixa === 'a_vencer'        ? styles.badgeFaixaOk :
                          item.faixa === 'vencido_1_7'     ? styles.badgeFaixaLeve :
                          item.faixa === 'vencido_8_30'    ? styles.badgeFaixaMedio :
                                                             styles.badgeFaixaGrave
                        }>
                          {item.dias_atraso <= 0 ? `em ${Math.abs(item.dias_atraso)}d` : `${item.dias_atraso}d`}
                        </span>
                      </td>
                      <td className={styles.valorReceita}>{fmtBRL(item.valor, ocultarValores)}</td>
                      <td>
                        <select
                          className={styles.selectCobranca}
                          value={item.cobranca_status}
                          onChange={e => atualizarCobrancaStatus(item.id, e.target.value)}>
                          {Object.entries(COBRANCA_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {editandoObsId === item.id ? (
                          <div className={styles.obsInline}>
                            <input className={styles.inputSmall} autoFocus
                              value={obsTexto}
                              onChange={e => setObsTexto(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') salvarObsCobranca(item); if (e.key === 'Escape') setEditandoObsId(null) }}
                              placeholder="Observação..." />
                            <button className={styles.btnBaixa} onClick={() => salvarObsCobranca(item)}>✓</button>
                            <button className={styles.btnCancelarBaixa} onClick={() => setEditandoObsId(null)}>✕</button>
                          </div>
                        ) : (
                          <span className={styles.obsClick}
                            onClick={() => { setEditandoObsId(item.id); setObsTexto(item.cobranca_obs ?? '') }}
                            title="Clique para editar">
                            {item.cobranca_obs || <span className={styles.obsVazio}>+ obs</span>}
                          </span>
                        )}
                      </td>
                      <td>
                        <button className={styles.btnBaixar} onClick={() => baixarDoAging(item)}>
                          Receber
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ FLUXO DE CAIXA ══════════════════════════════════════════════════ */}
      {aba === 'fluxo' && (
        <div className={styles.fluxoWrap}>

          {/* ── Toolbar ── */}
          <div className={styles.fluxoToolbar}>
            <select className={styles.filtro} value={filtroFluxoMes}
              onChange={e => setFiltroFluxoMes(e.target.value)}>
              {Array.from({ length: 13 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - 6 + i)
                const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                return <option key={val} value={val}>{val}</option>
              })}
            </select>

            <select className={styles.filtro} value={filtroFluxoStatus}
              onChange={e => setFiltroFluxoStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="realizado">Realizado</option>
              <option value="previsto">Previsto</option>
              <option value="atrasado">Atrasado</option>
              <option value="negociado">Negociado</option>
            </select>

            <select className={styles.filtro} value={filtroFluxoConta}
              onChange={e => setFiltroFluxoConta(e.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
            </select>

            <select className={styles.filtro} value={filtroFluxoNegocio}
              onChange={e => setFiltroFluxoNegocio(e.target.value)}>
              <option value="">Todos os negócios</option>
              <option value="pousinox">Pousinox</option>
              <option value="mp">MP</option>
              <option value="pouso_inox">Pouso Inox</option>
            </select>

            <select className={styles.filtro} value={filtroFluxoConcil}
              onChange={e => setFiltroFluxoConcil(e.target.value as '' | 'pendente' | 'conciliado')}>
              <option value="">Conciliação: todas</option>
              <option value="pendente">⚠ Pendente</option>
              <option value="conciliado">✓ Conciliado</option>
            </select>

            <button className={styles.btnSecondary} onClick={carregarMovimentacoes}>Aplicar</button>
            <div className={styles.fluxoToolbarSpacer} />
            <button className={styles.btnPrimary} onClick={() => setMostrarFormFluxo(f => !f)}>
              {mostrarFormFluxo ? '✕ Cancelar' : '+ Registrar'}
            </button>
          </div>

          {/* ── Formulário de registro ── */}
          {mostrarFormFluxo && (
            <div className={styles.formFluxo}>
              <div className={styles.formFluxoTitulo}>Nova movimentação</div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select className={styles.input} value={formFluxo.tipo}
                    onChange={e => setFormFluxo(f => ({ ...f, tipo: e.target.value as 'entrada'|'saida' }))}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Data</label>
                  <input type="date" className={styles.input} value={formFluxo.data}
                    onChange={e => setFormFluxo(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label>Descrição *</label>
                  <input className={styles.input} value={formFluxo.descricao}
                    onChange={e => setFormFluxo(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Histórico da movimentação" />
                </div>
                <div className={styles.field}>
                  <label>Valor (R$) *</label>
                  <input className={styles.input} value={formFluxo.valor}
                    onChange={e => setFormFluxo(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00" />
                </div>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Conta</label>
                  <select className={styles.input} value={formFluxo.conta_id}
                    onChange={e => setFormFluxo(f => ({ ...f, conta_id: e.target.value }))}>
                    <option value="">Não informada</option>
                    {contas.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Negócio</label>
                  <select className={styles.input} value={formFluxo.negocio}
                    onChange={e => setFormFluxo(f => ({ ...f, negocio: e.target.value }))}>
                    <option value="pousinox">Pousinox</option>
                    <option value="mp">MP</option>
                    <option value="pouso_inox">Pouso Inox</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Status</label>
                  <select className={styles.input} value={formFluxo.status}
                    onChange={e => setFormFluxo(f => ({ ...f, status: e.target.value }))}>
                    <option value="realizado">Realizado</option>
                    <option value="previsto">Previsto</option>
                    <option value="negociado">Negociado</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Pagamento</label>
                  <select className={styles.input} value={formFluxo.tipo_pagamento}
                    onChange={e => setFormFluxo(f => ({ ...f, tipo_pagamento: e.target.value }))}>
                    <option value="">—</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão Crédito</option>
                    <option value="cartao_debito">Cartão Débito</option>
                    <option value="cheque">Cheque</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Categoria (plano de contas)</label>
                  <select className={styles.input} value={formFluxo.categoria_id}
                    onChange={e => setFormFluxo(f => ({ ...f, categoria_id: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categorias.map(c => (
                      <option key={c.id} value={String(c.id)}>
                        {c.grupo ? `${c.grupo} / ` : ''}{c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Centro de custo</label>
                  <select className={styles.input} value={formFluxo.centro_custo_id}
                    onChange={e => setFormFluxo(f => ({ ...f, centro_custo_id: e.target.value }))}>
                    <option value="">—</option>
                    {centros.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Doc. referência</label>
                  <input className={styles.input} value={formFluxo.documento_ref}
                    onChange={e => setFormFluxo(f => ({ ...f, documento_ref: e.target.value }))}
                    placeholder="Chave PIX, nº boleto…" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className={styles.btnSalvar} onClick={salvarMovimentacao} disabled={salvandoFluxo}>
                  {salvandoFluxo ? 'Salvando…' : '✓ Salvar movimentação'}
                </button>
              </div>
            </div>
          )}

          {/* ── Cards de saldo rápido ── */}
          {(() => {
            const entradas = movimentacoes.filter(m => m.tipo === 'entrada' && m.status === 'realizado').reduce((s, m) => s + m.valor, 0)
            const saidas   = movimentacoes.filter(m => m.tipo === 'saida'   && m.status === 'realizado').reduce((s, m) => s + m.valor, 0)
            const previsto = movimentacoes.filter(m => m.status === 'previsto' || m.status === 'negociado').reduce((s, m) =>
              s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0)
            return (
              <div className={styles.fluxoCards}>
                <div className={`${styles.fluxoCard} ${styles.fluxoCardEntrada}`}>
                  <span className={styles.fluxoCardLabel}>Entradas realizadas</span>
                  <span className={`${styles.fluxoCardVal} ${styles.fluxoCardValPos}`}>{fmtBRL(entradas, ocultarValores)}</span>
                  <span className={styles.fluxoCardSub}>no período</span>
                </div>
                <div className={`${styles.fluxoCard} ${styles.fluxoCardSaida}`}>
                  <span className={styles.fluxoCardLabel}>Saídas realizadas</span>
                  <span className={`${styles.fluxoCardVal} ${styles.fluxoCardValNeg}`}>{fmtBRL(saidas, ocultarValores)}</span>
                  <span className={styles.fluxoCardSub}>no período</span>
                </div>
                <div className={`${styles.fluxoCard} ${styles.fluxoCardSaldo}`}>
                  <span className={styles.fluxoCardLabel}>Saldo realizado</span>
                  <span className={`${styles.fluxoCardVal} ${(entradas - saidas) >= 0 ? styles.fluxoCardValPos : styles.fluxoCardValNeg}`}>
                    {fmtBRL(entradas - saidas, ocultarValores)}
                  </span>
                  <span className={styles.fluxoCardSub}>entradas − saídas</span>
                </div>
                <div className={`${styles.fluxoCard} ${styles.fluxoCardProj}`}>
                  <span className={styles.fluxoCardLabel}>Saldo projetado</span>
                  <span className={`${styles.fluxoCardVal} ${(entradas - saidas + previsto) >= 0 ? styles.fluxoCardValPos : styles.fluxoCardValNeg}`}>
                    {fmtBRL(entradas - saidas + previsto, ocultarValores)}
                  </span>
                  <span className={styles.fluxoCardSub}>inclui previstos</span>
                </div>
              </div>
            )
          })()}

          {/* ── Tabela ── */}
          {movimentacoes.length === 0 ? (
            <div className={styles.vazio}>Nenhuma movimentação encontrada para os filtros selecionados.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.tabelaFluxo}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Negócio</th>
                    <th>Conta</th>
                    <th>Categoria</th>
                    <th>Pgto</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Entrada</th>
                    <th style={{ textAlign: 'right' }}>Saída</th>
                    <th style={{ textAlign: 'center' }}>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map(m => (
                    <tr key={m.id} style={{ opacity: m.status === 'cancelado' ? 0.4 : 1 }}>
                      <td className={styles.data}>{fmtData(m.data)}</td>
                      <td className={styles.descCell}>
                        {m.descricao ?? '—'}
                        {m.documento_ref && (
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                            {m.documento_ref}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={styles.contaBadge} style={{ textTransform: 'lowercase', background: '#eff6ff', color: '#1d4ed8' }}>
                          {m.negocio ?? '—'}
                        </span>
                      </td>
                      <td>
                        {m.conta_nome
                          ? <span className={styles.contaBadge}>{m.conta_nome}</span>
                          : m.conta
                            ? <span className={styles.contaBadge}>{m.conta}</span>
                            : <span style={{ color: '#d1d5db' }}>—</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {m.categoria_grupo
                          ? <><span style={{ color: '#94a3b8' }}>{m.categoria_grupo} /</span> {m.categoria_nome}</>
                          : (m.categoria_nome ?? <span style={{ color: '#d1d5db' }}>—</span>)
                        }
                      </td>
                      <td style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.03em' }}>
                        {m.tipo_pagamento?.toUpperCase() ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        <span className={
                          m.status === 'realizado' ? styles.badgeRealizado
                          : m.status === 'previsto'  ? styles.badgePrevisto
                          : m.status === 'atrasado'  ? styles.badgeAtrasado
                          : m.status === 'negociado' ? styles.badgeNegociado
                          : styles.badgeCancelado2
                        }>
                          {m.status === 'realizado' ? '✓ realizado'
                            : m.status === 'previsto'  ? '◷ previsto'
                            : m.status === 'atrasado'  ? '⚠ atrasado'
                            : m.status === 'negociado' ? '↻ negociado'
                            : m.status}
                        </span>
                      </td>
                      <td className={styles.valorReceita} style={{ textAlign: 'right' }}>
                        {m.tipo === 'entrada' ? fmtBRL(m.valor, ocultarValores) : ''}
                      </td>
                      <td className={styles.valorDespesa} style={{ textAlign: 'right' }}>
                        {m.tipo === 'saida' ? fmtBRL(m.valor, ocultarValores) : ''}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={m.conciliado}
                          title={m.conciliado ? 'Conciliado — clique para desmarcar' : 'Marcar como conciliado'}
                          onChange={() => conciliarMovimentacao(m.id, !m.conciliado)}
                          style={{ cursor: 'pointer', accentColor: '#16a34a', width: 16, height: 16 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ BUDGET (removido — ver Relatórios) ══ */}
      {false && (() => {
        const catsSemBudget = categorias.filter(c =>
          c.tipo === 'despesa' && !budgetItens.find(b => b.categoria_id === c.id)
        )
        const totalOrcado   = budgetItens.reduce((s, r) => s + r.valor_orcado, 0)
        const totalRealizado = budgetItens.reduce((s, r) => s + r.realizado, 0)
        const totalVariacao  = totalRealizado - totalOrcado
        const totalPct       = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0
        const grupos = [...new Set(budgetItens.map(r => r.fin_categorias?.grupo ?? ''))].sort()
        return (
          <div className={styles.budgetWrap}>

            {/* Filtros de período */}
            <div className={styles.budgetFiltros}>
              <div className={styles.field}>
                <label>Ano</label>
                <select className={styles.input} value={anoB}
                  onChange={e => setAnoB(Number(e.target.value))}>
                  {[anoB - 1, anoB, anoB + 1].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Mês</label>
                <select className={styles.input} value={mesB}
                  onChange={e => setMesB(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">Anual</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
                    .map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Cards resumo */}
            {budgetItens.length > 0 && (
              <div className={styles.budgetResumo}>
                <div className={styles.budgetCard}>
                  <span className={styles.budgetCardLabel}>Total Orçado</span>
                  <span className={styles.budgetCardVal}>{fmtBRL(totalOrcado, ocultarValores)}</span>
                </div>
                <div className={styles.budgetCard}>
                  <span className={styles.budgetCardLabel}>Total Realizado</span>
                  <span className={styles.budgetCardVal}>{fmtBRL(totalRealizado, ocultarValores)}</span>
                </div>
                <div className={`${styles.budgetCard} ${totalVariacao > 0 ? styles.budgetCardExcedido : styles.budgetCardOk}`}>
                  <span className={styles.budgetCardLabel}>Variação</span>
                  <span className={styles.budgetCardVal}>
                    {totalVariacao > 0 ? '+' : ''}{fmtBRL(totalVariacao, ocultarValores)}
                  </span>
                </div>
                <div className={styles.budgetCard}>
                  <span className={styles.budgetCardLabel}>Utilização</span>
                  <span className={styles.budgetCardVal}>{totalPct.toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Tabela por grupo */}
            {budgetItens.length === 0 && (
              <div className={styles.emptyMsg}>Nenhum orçamento cadastrado para este período.</div>
            )}
            {grupos.map(grupo => (
              <div key={grupo} className={styles.budgetGrupo}>
                <div className={styles.budgetGrupoTitulo}>{grupo || 'Sem grupo'}</div>
                <table className={styles.budgetTable}>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th className={styles.right}>Orçado</th>
                      <th className={styles.right}>Realizado</th>
                      <th className={styles.right}>Variação</th>
                      <th className={styles.right}>%</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItens.filter(r => (r.fin_categorias?.grupo ?? '') === grupo).map(row => (
                      <tr key={row.id}>
                        <td>
                          <span className={styles.catDot} style={{ background: row.fin_categorias?.cor ?? '#888' }} />
                          {row.fin_categorias?.nome ?? `#${row.categoria_id}`}
                        </td>
                        <td className={styles.right}>
                          {editandoBudgetId === row.id ? (
                            <span className={styles.inlineEdit}>
                              <input className={styles.inputSmall} value={editValor}
                                onChange={e => setEditValor(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') salvarBudgetInline(row.id); if (e.key === 'Escape') setEditandoBudgetId(null) }}
                                autoFocus />
                              <button className={styles.btnBaixa} onClick={() => salvarBudgetInline(row.id)} disabled={salvandoBudget}>✓</button>
                              <button className={styles.btnCancelarBaixa} onClick={() => setEditandoBudgetId(null)}>✕</button>
                            </span>
                          ) : (
                            <span className={styles.editableVal}
                              onClick={() => { setEditandoBudgetId(row.id); setEditValor(String(row.valor_orcado)) }}>
                              {fmtBRL(row.valor_orcado, ocultarValores)} ✏️
                            </span>
                          )}
                        </td>
                        <td className={styles.right}>{fmtBRL(row.realizado, ocultarValores)}</td>
                        <td className={`${styles.right} ${row.variacao > 0 ? styles.txtRed : styles.txtGreen}`}>
                          {row.variacao > 0 ? '+' : ''}{fmtBRL(row.variacao, ocultarValores)}
                        </td>
                        <td className={styles.right}>
                          <span className={styles.budgetBar}>
                            <span className={styles.budgetBarFill}
                              style={{ width: `${Math.min(row.pct, 100)}%`,
                                background: row.status === 'excedido' ? 'var(--color-danger,#dc2626)' :
                                            row.status === 'alerta'   ? '#f59e0b' : 'var(--color-success,#16a34a)' }} />
                          </span>
                          {row.pct.toFixed(0)}%
                        </td>
                        <td>
                          <span className={`${styles.budgetStatus} ${styles[`budget_${row.status}`]}`}>
                            {row.status === 'ok' ? 'OK' : row.status === 'alerta' ? 'Alerta' : 'Excedido'}
                          </span>
                        </td>
                        <td>
                          <button className={styles.btnRemover} onClick={() => removerBudget(row.id)} title="Remover">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Adicionar nova linha */}
            {catsSemBudget.length > 0 && (
              <form className={styles.budgetAddForm} onSubmit={adicionarBudget}>
                <div className={styles.budgetAddTitulo}>Adicionar categoria ao budget</div>
                <div className={styles.row3}>
                  <div className={styles.field}>
                    <label>Categoria (despesa)</label>
                    <select className={styles.input} value={novaCatB}
                      onChange={e => setNovaCatB(e.target.value)} required>
                      <option value="">Selecione…</option>
                      {catsSemBudget.map(c => (
                        <option key={c.id} value={c.id}>{c.grupo ? `${c.grupo} — ` : ''}{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Valor orçado (R$)</label>
                    <input className={styles.input} type="text" value={novoValorB}
                      onChange={e => setNovoValorB(e.target.value)}
                      placeholder="0,00" />
                  </div>
                  <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
                    <button type="submit" className={styles.btnPrimary} disabled={adicionando || !novaCatB}>
                      {adicionando ? 'Adicionando…' : '+ Adicionar'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )
      })()}

      {/* ══ DRE (removido — ver Relatórios) ══ */}
      {false && (() => {
        const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
        const receitas = dreGrupos.filter(g => g.tipo === 'receita')
        const despesas = dreGrupos.filter(g => g.tipo === 'despesa')
        const totR = (arr: DreGrupo[], col: keyof DreGrupo) => arr.reduce((s, g) => s + (g[col] as number), 0)
        const totRecReal = totR(receitas, 'realizado'); const totRecPrev = totR(receitas, 'previsto'); const totRecAtr = totR(receitas, 'atrasado')
        const totDesReal = totR(despesas, 'realizado'); const totDesPrev = totR(despesas, 'previsto'); const totDesAtr = totR(despesas, 'atrasado')
        const resReal = totRecReal - totDesReal; const resPrev = totRecPrev - totDesPrev; const resAtr = totRecAtr - totDesAtr
        const thStyle: React.CSSProperties = { padding: '8px 14px', textAlign: 'right' as const, fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: '#f5f7fa', borderBottom: '2px solid #e0e4ea', whiteSpace: 'nowrap' as const }
        const tdStyle: React.CSSProperties = { padding: '8px 14px', textAlign: 'right' as const, fontSize: '0.84rem', borderBottom: '1px solid #f0f2f5' }
        const secStyle: React.CSSProperties = { padding: '7px 14px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f0f4f8', borderBottom: '1px solid #e0e4ea', color: '#1a3a5c' }
        const totStyle: React.CSSProperties = { padding: '9px 14px', textAlign: 'right' as const, fontSize: '0.84rem', fontWeight: 700, borderTop: '2px solid #e0e4ea', background: '#f5f7fa' }
        const resColor = (v: number) => v >= 0 ? '#27ae60' : '#c0392b'
        return (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Ano</label>
                <select value={dreAno} onChange={e => setDreAno(Number(e.target.value))}
                  style={{ padding: '6px 10px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: '0.83rem' }}>
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Período</label>
                <select value={dreMes} onChange={e => setDreMes(Number(e.target.value))}
                  style={{ padding: '6px 10px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: '0.83rem' }}>
                  <option value={0}>Ano todo</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <button className={styles.btnFiltrar} onClick={carregarDre}>Atualizar</button>
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#888', alignSelf: 'flex-end' }}>
                Regime de caixa · {dreAno}{dreMes ? ` / ${String(dreMes).padStart(2,'0')}` : ''}
              </span>
            </div>

            {/* Tabela DRE */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>Grupo / Categoria</th>
                    <th style={thStyle}>Realizado</th>
                    <th style={thStyle}>Previsto</th>
                    <th style={thStyle}>Atrasado</th>
                    <th style={{ ...thStyle, color: '#1a3a5c' }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Receitas */}
                  <tr><td colSpan={5} style={{ ...secStyle, color: '#27ae60' }}>🟢 Receitas</td></tr>
                  {receitas.map(g => (
                    <tr key={g.grupo}>
                      <td style={{ padding: '8px 14px 8px 28px', borderBottom: '1px solid #f0f2f5', fontSize: '0.83rem' }}>{g.grupo}</td>
                      <td style={{ ...tdStyle, color: '#27ae60' }}>{fmtR(g.realizado)}</td>
                      <td style={{ ...tdStyle, color: '#888' }}>{fmtR(g.previsto)}</td>
                      <td style={{ ...tdStyle, color: g.atrasado > 0 ? '#e67e22' : '#888' }}>{fmtR(g.atrasado)}</td>
                      <td style={{ ...tdStyle, color: resColor(g.realizado - g.previsto - g.atrasado) }}></td>
                    </tr>
                  ))}
                  {receitas.length === 0 && <tr><td colSpan={5} style={{ padding: '12px 28px', color: '#aaa', fontSize: '0.8rem' }}>Sem receitas no período</td></tr>}
                  <tr>
                    <td style={{ ...totStyle, textAlign: 'left', paddingLeft: 14 }}>Total Receitas</td>
                    <td style={{ ...totStyle, color: '#27ae60' }}>{fmtR(totRecReal)}</td>
                    <td style={totStyle}>{fmtR(totRecPrev)}</td>
                    <td style={{ ...totStyle, color: totRecAtr > 0 ? '#e67e22' : '#333' }}>{fmtR(totRecAtr)}</td>
                    <td style={totStyle}></td>
                  </tr>

                  {/* Despesas */}
                  <tr><td colSpan={5} style={{ ...secStyle, color: '#c0392b', paddingTop: 16 }}>🔴 Despesas</td></tr>
                  {despesas.map(g => (
                    <tr key={g.grupo}>
                      <td style={{ padding: '8px 14px 8px 28px', borderBottom: '1px solid #f0f2f5', fontSize: '0.83rem' }}>{g.grupo}</td>
                      <td style={{ ...tdStyle, color: '#c0392b' }}>{fmtR(g.realizado)}</td>
                      <td style={{ ...tdStyle, color: '#888' }}>{fmtR(g.previsto)}</td>
                      <td style={{ ...tdStyle, color: g.atrasado > 0 ? '#e67e22' : '#888' }}>{fmtR(g.atrasado)}</td>
                      <td style={{ ...tdStyle }}></td>
                    </tr>
                  ))}
                  {despesas.length === 0 && <tr><td colSpan={5} style={{ padding: '12px 28px', color: '#aaa', fontSize: '0.8rem' }}>Sem despesas no período</td></tr>}
                  <tr>
                    <td style={{ ...totStyle, textAlign: 'left', paddingLeft: 14 }}>Total Despesas</td>
                    <td style={{ ...totStyle, color: '#c0392b' }}>{fmtR(totDesReal)}</td>
                    <td style={totStyle}>{fmtR(totDesPrev)}</td>
                    <td style={{ ...totStyle, color: totDesAtr > 0 ? '#e67e22' : '#333' }}>{fmtR(totDesAtr)}</td>
                    <td style={totStyle}></td>
                  </tr>

                  {/* Resultado */}
                  <tr style={{ background: '#1a3a5c' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>Resultado Líquido</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: resReal >= 0 ? '#7fffb4' : '#ffaaaa' }}>{fmtR(resReal)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: resPrev >= 0 ? '#7fffb4' : '#ffaaaa' }}>{fmtR(resPrev)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: resAtr >= 0 ? '#7fffb4' : '#ffaaaa' }}>{fmtR(resAtr)}</td>
                    <td style={{ padding: '12px 14px' }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )
      })()}

      {/* ══ CONFIGURAÇÃO (removido — ver /admin/configuracao-financeiro) ══ */}
      {false && (
        <div className={styles.configWrap}>

          {/* Categorias */}
          <div>
            <div className={styles.configSecao}>Categorias</div>
            <form className={styles.formSmall} onSubmit={salvarCategoria}>
              <div className={styles.row3}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formCat.nome}
                    onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Comissão de vendas" required />
                </div>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select className={styles.input} value={formCat.tipo}
                    onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value as 'receita' | 'despesa' }))}>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Grupo</label>
                  <input className={styles.input} value={formCat.grupo}
                    onChange={e => setFormCat(f => ({ ...f, grupo: e.target.value }))}
                    placeholder="Ex: Operacional" />
                </div>
              </div>
              <div className={styles.formActions}>
                <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.81rem', fontWeight: 600 }}>Cor</span>
                  <input type="color" className={styles.inputColor} value={formCat.cor}
                    onChange={e => setFormCat(f => ({ ...f, cor: e.target.value }))} />
                </label>
                <button type="submit" className={styles.btnPrimary} disabled={salvandoCat}>
                  {salvandoCat ? 'Salvando...' : 'Criar categoria'}
                </button>
              </div>
            </form>

            <div className={styles.listaConfig}>
              {(['receita', 'despesa'] as const).map(tipo => (
                <div key={tipo}>
                  <div className={styles.grupoTitulo}>{tipo === 'receita' ? '↑ Receitas' : '↓ Despesas'}</div>
                  <div className={styles.catGrid}>
                    {catsPorTipo(tipo).map(c => (
                      <div key={c.id} className={styles.catItem} style={{ borderLeftColor: c.cor }}>
                        <span className={styles.catNome}>{c.nome}</span>
                        {c.grupo && <span className={styles.catGrupo}>{c.grupo}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Centros de custo */}
          <div>
            <div className={styles.configSecao}>Centros de Custo</div>
            <form className={styles.formSmall} onSubmit={salvarCentro}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formCentro.nome}
                    onChange={e => setFormCentro(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Exportação" required />
                </div>
                <div className={styles.field}>
                  <label>Descrição</label>
                  <input className={styles.input} value={formCentro.descricao}
                    onChange={e => setFormCentro(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Opcional" />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={salvandoCentro}>
                  {salvandoCentro ? 'Salvando...' : 'Criar centro'}
                </button>
              </div>
            </form>
            <div className={styles.catGrid} style={{ marginTop: 16 }}>
              {centros.map(c => (
                <div key={c.id} className={styles.catItem} style={{ borderLeftColor: 'var(--color-primary)' }}>
                  <span className={styles.catNome}>{c.nome}</span>
                  {c.descricao && <span className={styles.catGrupo}>{c.descricao}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
