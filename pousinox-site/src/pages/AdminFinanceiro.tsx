import { useState, useEffect, useCallback, Fragment } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminFinanceiro.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import CollapsibleSection from '../components/CollapsibleSection/CollapsibleSection'

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


type Aba = 'painel' | 'lancamentos' | 'fluxo' | 'comissoes'

interface Comissao {
  id: number; vendedor_id: number; vendedor_nome: string | null
  periodo: string; base_valor: number; comissao_pct: number; valor_comissao: number
  status: 'pendente' | 'pago' | 'cancelado'
  data_vencimento: string | null; data_pagamento: string | null
  fin_lancamento_id: number | null
}

// Retorna o N-ésimo dia útil (seg-sex) de um mês
function diaPorUteis(ano: number, mes: number, nUteis: number): string {
  const d = new Date(ano, mes - 1, 1)
  let count = 0
  while (count < nUteis) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    if (count < nUteis) d.setDate(d.getDate() + 1)
  }
  return d.toISOString().slice(0, 10)
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
  const lp = useLoadingProgress(4)
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

  // Baixa inline
  const [baixandoId, setBaixandoId] = useState<number | null>(null)
  const [dataBaixa,  setDataBaixa]  = useState(hoje())

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

  // Comissões
  const [comissoes,       setComissoes]       = useState<Comissao[]>([])
  const [periodoComissao, setPeriodoComissao] = useState(mesAtual())
  const [calculando,      setCalculando]      = useState(false)

  // Edição inline — Fluxo de Caixa
  const [editMovId, setEditMovId] = useState<number | null>(null)
  const [editMovForm, setEditMovForm] = useState<{ descricao: string; valor: string; data: string; tipo_pagamento: string; status: string; categoria_id: number | null; conta_id: number | null }>({ descricao: '', valor: '', data: '', tipo_pagamento: '', status: '', categoria_id: null, conta_id: null })

  // Edição inline — Agenda Financeira (lançamentos)
  const [editLancId, setEditLancId] = useState<number | null>(null)
  const [editLancForm, setEditLancForm] = useState<{ descricao: string; valor: string; data_vencimento: string; categoria_id: string; observacao: string }>({ descricao: '', valor: '', data_vencimento: '', categoria_id: '', observacao: '' })


  // Categorização pendente
  const [pendCatCount, setPendCatCount] = useState(0)

  // Painel — agenda e alertas
  const [agendaItems, setAgendaItems]       = useState<Lancamento[]>([])
  const [saldosContas, setSaldosContas]     = useState<Array<ContaBancaria & { saldo: number }>>([])
  const [vencidosCount, setVencidosCount]   = useState(0)
  const [concilPendCount, setConcilPendCount] = useState(0)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  // ── Carga ──────────────────────────────────────────────────────────────────

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    lp.reset()
    const [{ data: cats }, { data: cts }, { data: cts2 }, { count: pendCat }] = await Promise.all([
      lp.wrap(supabaseAdmin.from('fin_categorias').select('*').eq('ativo', true).order('grupo').order('nome')),
      lp.wrap(supabaseAdmin.from('fin_centros_custo').select('*').eq('ativo', true).order('nome')),
      lp.wrap(supabaseAdmin.from('fin_contas').select('*').eq('ativo', true).order('nome')),
      lp.wrap(supabaseAdmin.from('fin_lancamentos').select('id', { count: 'exact', head: true }).eq('aguarda_categorizacao', true).eq('status', 'pendente')),
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
  }, [filtroTipo, filtroStatus, filtroOrigem, filtroMes, filtroAguarda])

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

  const excluirMovimentacao = async (id: number) => {
    if (!confirm('Excluir esta movimentação? Se vinculada a um lançamento, ele voltará para pendente.')) return
    // Busca o lancamento_id antes de excluir
    const { data: mov } = await supabaseAdmin.from('fin_movimentacoes').select('lancamento_id').eq('id', id).single()
    const { error } = await supabaseAdmin.from('fin_movimentacoes').delete().eq('id', id)
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + error.message }); return }
    // Reverte o lançamento vinculado para pendente
    if (mov?.lancamento_id) {
      await supabaseAdmin.from('fin_lancamentos')
        .update({ status: 'pendente', data_pagamento: null })
        .eq('id', mov.lancamento_id)
    }
    setEditMovId(null)
    carregarMovimentacoes()
    carregarLancamentos()
    carregarSaldo()
  }

  const salvarEdicaoMov = async () => {
    if (!editMovId) return
    setSalvandoFluxo(true)
    const { error } = await supabaseAdmin.from('fin_movimentacoes').update({
      descricao:      editMovForm.descricao,
      valor:          parseFloat(editMovForm.valor.replace(',', '.')),
      data:           editMovForm.data,
      tipo_pagamento: editMovForm.tipo_pagamento || null,
      status:         editMovForm.status,
      categoria_id:   editMovForm.categoria_id,
      conta_id:       editMovForm.conta_id,
    }).eq('id', editMovId)
    setSalvandoFluxo(false)
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message }); return }
    setEditMovId(null)
    carregarMovimentacoes()
  }

  const carregarPainel = useCallback(async () => {
    const hj = hoje()
    const em7 = new Date(); em7.setDate(em7.getDate() + 7)
    const em7str = em7.toISOString().slice(0, 10)

    const [
      { data: saldoData },
      { data: agendaData },
      { count: vencidosN },
      { count: concilN },
      { data: movsContas },
    ] = await Promise.all([
      supabaseAdmin.from('vw_fin_saldo_mes').select('*').order('mes', { ascending: false }).limit(1).single(),
      supabaseAdmin.from('fin_lancamentos')
        .select('*, fin_categorias(nome, cor), fin_centros_custo(nome)')
        .eq('status', 'pendente')
        .gte('data_vencimento', hj)
        .lte('data_vencimento', em7str)
        .order('data_vencimento'),
      supabaseAdmin.from('fin_lancamentos').select('id', { count: 'exact', head: true })
        .eq('status', 'pendente').lt('data_vencimento', hj),
      supabaseAdmin.from('fin_movimentacoes').select('id', { count: 'exact', head: true })
        .eq('conciliado', false).eq('status', 'realizado'),
      supabaseAdmin.from('fin_movimentacoes').select('conta_id, tipo, valor').eq('status', 'realizado'),
    ])

    setSaldoMes(saldoData ?? null)
    setAgendaItems((agendaData ?? []) as Lancamento[])
    setVencidosCount(vencidosN ?? 0)
    setConcilPendCount(concilN ?? 0)
    setPendCatCount(prev => prev) // mantém o valor já carregado em carregarTudo

    // Saldo por conta = saldo_inicial + Σ movimentos realizados
    const movMap: Record<number, number> = {}
    for (const m of (movsContas ?? []) as { conta_id: number; tipo: string; valor: number }[]) {
      if (!m.conta_id) continue
      movMap[m.conta_id] = (movMap[m.conta_id] ?? 0) + (m.tipo === 'entrada' ? Number(m.valor) : -Number(m.valor))
    }
    setSaldosContas(
      contas.map(c => ({ ...c, saldo: (c.saldo_inicial ?? 0) + (movMap[c.id] ?? 0) }))
    )
  }, [contas])

  useEffect(() => {
    if (aba === 'painel')      carregarPainel()
    if (aba === 'lancamentos') carregarLancamentos()
    if (aba === 'fluxo')       carregarMovimentacoes()
    if (aba === 'comissoes')   carregarComissoes()
  }, [aba, carregarPainel, carregarLancamentos, carregarMovimentacoes])  // eslint-disable-line

  async function carregarComissoes() {
    const { data } = await supabaseAdmin
      .from('comissoes')
      .select('*')
      .eq('periodo', periodoComissao)
      .order('vendedor_nome')
    setComissoes((data ?? []) as Comissao[])
  }

  async function calcularComissoes() {
    setCalculando(true)
    const [ano, mes] = periodoComissao.split('-').map(Number)
    const ini = `${periodoComissao}-01`
    const fim = new Date(ano, mes, 0).toISOString().slice(0, 10) // último dia do mês

    // 5º dia útil do mês seguinte
    const mesVenc = mes === 12 ? 1 : mes + 1
    const anoVenc = mes === 12 ? ano + 1 : ano
    const dataVenc = diaPorUteis(anoVenc, mesVenc, 5)

    // Orcamentos aprovados no período
    const { data: orcs } = await supabaseAdmin
      .from('orcamentos')
      .select('vendedor_id, vendedor_nome, total')
      .eq('status', 'aprovado')
      .gte('criado_em', ini)
      .lte('criado_em', fim + 'T23:59:59')

    // Vendas com vendedor_id no período
    const { data: vdas } = await supabaseAdmin
      .from('vendas')
      .select('vendedor_id, vendedor_nome, valor_recebido')
      .not('vendedor_id', 'is', null)
      .gte('data_venda', ini)
      .lte('data_venda', fim)

    // Vendedores com comissao_pct
    const { data: vends } = await supabaseAdmin
      .from('vendedores')
      .select('id, nome, comissao_pct')
      .eq('ativo', true)

    if (!vends) { setCalculando(false); return }

    // Agrupa por vendedor
    const map: Record<number, { nome: string; base: number; pct: number }> = {}
    for (const v of vends) {
      map[v.id] = { nome: v.nome, base: 0, pct: Number(v.comissao_pct ?? 0) }
    }
    for (const o of (orcs ?? [])) {
      if (!o.vendedor_id) continue
      if (!map[o.vendedor_id]) map[o.vendedor_id] = { nome: o.vendedor_nome ?? '', base: 0, pct: 0 }
      map[o.vendedor_id].base += Number(o.total ?? 0)
    }
    for (const v of (vdas ?? [])) {
      if (!v.vendedor_id) continue
      if (!map[v.vendedor_id]) map[v.vendedor_id] = { nome: v.vendedor_nome ?? '', base: 0, pct: 0 }
      map[v.vendedor_id].base += Number(v.valor_recebido ?? 0)
    }

    // Upsert comissões
    const rows = Object.entries(map)
      .filter(([, v]) => v.base > 0)
      .map(([idStr, v]) => ({
        vendedor_id:    Number(idStr),
        vendedor_nome:  v.nome,
        periodo:        periodoComissao,
        base_valor:     v.base,
        comissao_pct:   v.pct,
        valor_comissao: parseFloat((v.base * v.pct / 100).toFixed(2)),
        data_vencimento: dataVenc,
        calculado_em:   new Date().toISOString(),
      }))

    if (rows.length > 0) {
      await supabaseAdmin.from('comissoes').upsert(rows, { onConflict: 'vendedor_id,periodo' })
    }

    await carregarComissoes()
    setCalculando(false)
  }

  async function gerarLancamentoComissao(c: Comissao) {
    const { data: lanc, error } = await supabaseAdmin
      .from('fin_lancamentos')
      .insert({
        tipo:             'despesa',
        descricao:        `Comissão ${c.vendedor_nome} — ${c.periodo}`,
        valor:            c.valor_comissao,
        status:           'pendente',
        data_competencia: `${c.periodo}-01`,
        data_vencimento:  c.data_vencimento,
        origem:           'comissao',
      })
      .select('id')
      .single()
    if (error || !lanc) return
    await supabaseAdmin.from('comissoes').update({ fin_lancamento_id: lanc.id }).eq('id', c.id)
    await carregarComissoes()
  }

  async function pagarComissao(c: Comissao) {
    const hoje = new Date().toISOString().slice(0, 10)
    await supabaseAdmin.from('comissoes').update({ status: 'pago', data_pagamento: hoje }).eq('id', c.id)
    if (c.fin_lancamento_id) {
      await supabaseAdmin.from('fin_lancamentos').update({ status: 'pago', data_pagamento: hoje }).eq('id', c.fin_lancamento_id)
      await supabaseAdmin.from('fin_movimentacoes').insert({
        lancamento_id: c.fin_lancamento_id,
        tipo:          'saida',
        valor:         c.valor_comissao,
        data:          hoje,
        descricao:     `Comissão ${c.vendedor_nome} — ${c.periodo}`,
        status:        'realizado',
      })
    }
    await carregarComissoes()
  }

  useEffect(() => {
    if (aba === 'lancamentos') carregarLancamentos()
  }, [filtroTipo, filtroStatus, filtroOrigem, filtroMes, aba, carregarLancamentos])

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
      try { await supabaseAdmin.rpc('incrementar_usos_categoria_cnpj', { p_cnpj: cnpj, p_tipo: lanc.tipo }) } catch { /* ignora */ }
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

  async function cancelarLancamento(id: number) {
    if (!confirm('Cancelar este lançamento?')) return
    const { error } = await supabaseAdmin
      .from('fin_lancamentos').update({ status: 'cancelado' }).eq('id', id)
    if (!error) { carregarLancamentos(); carregarSaldo() }
  }

  const excluirLancamento = async (id: number) => {
    if (!confirm('Excluir este lançamento? As movimentações vinculadas também serão excluídas.')) return
    const { error } = await supabaseAdmin.rpc('excluir_lancamento', { p_id: id })
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + error.message }); return }
    setEditLancId(null)
    carregarLancamentos(); carregarSaldo(); carregarMovimentacoes()
  }

  const salvarEdicaoLanc = async () => {
    if (!editLancId) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_lancamentos').update({
      descricao:      editLancForm.descricao,
      valor:          parseFloat(editLancForm.valor.replace(',', '.')),
      data_vencimento: editLancForm.data_vencimento,
      categoria_id:   editLancForm.categoria_id ? Number(editLancForm.categoria_id) : null,
      observacao:     editLancForm.observacao || null,
    }).eq('id', editLancId)
    setSalvando(false)
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message }); return }
    setEditLancId(null)
    carregarLancamentos(); carregarSaldo()
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

  if (loading) return <AdminLoading total={lp.total} current={lp.current} label="Carregando..." />

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
          { key: 'lancamentos', label: '📋 Agenda Financeira' },
          { key: 'fluxo',       label: '💰 Fluxo de Caixa' },
          { key: 'comissoes',   label: '🤝 Comissões'       },
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

          {/* ① Alertas */}
          {(vencidosCount > 0 || pendCatCount > 0 || concilPendCount > 0) && (
            <div className={styles.alertasRow}>
              {vencidosCount > 0 && (
                <button className={styles.alertaPill} onClick={() => setAba('lancamentos')}>
                  <span className={styles.alertaDot} style={{ background: '#dc2626' }} />
                  <strong>{vencidosCount}</strong> vencido{vencidosCount !== 1 ? 's' : ''} sem baixa
                </button>
              )}
              {pendCatCount > 0 && (
                <button className={styles.alertaPill} onClick={() => { setFiltroAguarda(true); setAba('lancamentos') }}>
                  <span className={styles.alertaDot} style={{ background: '#f59e0b' }} />
                  <strong>{pendCatCount}</strong> aguardando categorização
                </button>
              )}
              {concilPendCount > 0 && (
                <button className={styles.alertaPill} onClick={() => setAba('fluxo')}>
                  <span className={styles.alertaDot} style={{ background: '#6366f1' }} />
                  <strong>{concilPendCount}</strong> pendente{concilPendCount !== 1 ? 's' : ''} de conciliação
                </button>
              )}
            </div>
          )}

          {/* ② KPIs do mês */}
          <CollapsibleSection title="📊 Resultado do mês" defaultOpen>
            <div className={styles.cards}>
              <div className={`${styles.card} ${styles.cardReceita}`}>
                <span className={styles.cardLabel}>Receitas realizadas</span>
                <strong className={styles.cardVal}>{fmtBRL(saldoMes?.total_receitas ?? 0, ocultarValores)}</strong>
                <span className={styles.cardSub}>mês corrente</span>
              </div>
              <div className={`${styles.card} ${styles.cardDespesa}`}>
                <span className={styles.cardLabel}>Despesas realizadas</span>
                <strong className={styles.cardVal}>{fmtBRL(saldoMes?.total_despesas ?? 0, ocultarValores)}</strong>
                <span className={styles.cardSub}>mês corrente</span>
              </div>
              <div className={`${styles.card} ${(saldoMes?.saldo ?? 0) >= 0 ? styles.cardSaldoPos : styles.cardSaldoNeg}`}>
                <span className={styles.cardLabel}>Resultado líquido</span>
                <strong className={styles.cardVal}>{fmtBRL(saldoMes?.saldo ?? 0, ocultarValores)}</strong>
                <span className={styles.cardSub}>receitas − despesas</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* ③ Saldo por conta */}
          {saldosContas.length > 0 && (
            <CollapsibleSection title="🏦 Saldo atual por conta" defaultOpen>
              <div className={styles.contasGrid}>
                {saldosContas.map(c => (
                  <div key={c.id} className={styles.contaCard}>
                    <div className={styles.contaCardTopo}>
                      <span className={styles.contaCardNome}>{c.nome}</span>
                      <span className={styles.contaCardBanco}>{c.banco ?? c.tipo}</span>
                    </div>
                    <strong className={`${styles.contaCardSaldo} ${c.saldo >= 0 ? styles.fluxoCardValPos : styles.fluxoCardValNeg}`}>
                      {fmtBRL(c.saldo, ocultarValores)}
                    </strong>
                    <span className={styles.contaCardNegocio}>{c.negocio}</span>
                  </div>
                ))}
              </div>
          </CollapsibleSection>
          )}

          {/* ④ Agenda dos próximos 7 dias */}
          <CollapsibleSection title="📅 Agenda — próximos 7 dias" defaultOpen count={agendaItems.length}>
            {agendaItems.length === 0 ? (
              <div className={styles.agendaVazio}>Nenhum vencimento nos próximos 7 dias. 🎉</div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.tabelaAgenda}>
                  <thead>
                    <tr>
                      <th>Vencimento</th>
                      <th>Descrição</th>
                      <th>Tipo</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Ação rápida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendaItems.map(lanc => {
                      const diasAte = Math.ceil(
                        (new Date(lanc.data_vencimento).getTime() - new Date(hoje()).getTime()) / 86400000
                      )
                      const isHoje = diasAte === 0
                      const isAmanha = diasAte === 1
                      return (
                        <tr key={lanc.id} className={isHoje ? styles.agendaHoje : ''}>
                          <td>
                            <div className={styles.agendaData}>{fmtData(lanc.data_vencimento)}</div>
                            <div className={styles.agendaDias}>
                              {isHoje ? <span className={styles.tagHoje}>Hoje</span>
                                : isAmanha ? <span className={styles.tagAmanha}>Amanhã</span>
                                : <span className={styles.tagDias}>em {diasAte}d</span>}
                            </div>
                          </td>
                          <td className={styles.descCell}>{lanc.descricao}</td>
                          <td>
                            <span className={lanc.tipo === 'receita' ? styles.tipoReceita : styles.tipoDespesa}>
                              {lanc.tipo === 'receita' ? '↑ receber' : '↓ pagar'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {lanc.fin_categorias?.nome ?? <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={lanc.tipo === 'receita' ? styles.valorReceita : styles.valorDespesa}>
                              {fmtBRL(lanc.valor, ocultarValores)}
                            </span>
                          </td>
                          <td>
                            {baixandoId === lanc.id ? (
                              <div className={styles.baixaInline}>
                                <input type="date" className={styles.inputSmall} value={dataBaixa}
                                  onChange={e => setDataBaixa(e.target.value)} />
                                <button className={styles.btnBaixa} onClick={() => baixarLancamento(lanc)} disabled={salvando}>
                                  ✓
                                </button>
                                <button className={styles.btnCancelarBaixa} onClick={() => setBaixandoId(null)}>✕</button>
                              </div>
                            ) : (
                              <button className={styles.btnBaixar} onClick={() => { setBaixandoId(lanc.id); setDataBaixa(hoje()) }}>
                                Baixar
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

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
                    <Fragment key={lanc.id}>
                    <tr className={lanc.origem === 'manual' ? styles.rowManual : ''}>
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
                        {(lanc.status === 'pendente' || lanc.status === 'cancelado') && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <button title="Editar" onClick={() => {
                              setEditLancId(editLancId === lanc.id ? null : lanc.id)
                              setEditLancForm({ descricao: lanc.descricao, valor: String(lanc.valor), data_vencimento: lanc.data_vencimento, categoria_id: lanc.categoria_id ? String(lanc.categoria_id) : '', observacao: lanc.observacao ?? '' })
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b', padding: '2px 4px' }}>✏️</button>
                            <button title="Excluir" onClick={() => excluirLancamento(lanc.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', padding: '2px 4px' }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {editLancId === lanc.id && (
                      <tr key={`edit-lanc-${lanc.id}`} style={{ background: '#f8fafc' }}>
                        <td colSpan={8} style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Descrição</div>
                              <input className={styles.inputSmall} value={editLancForm.descricao}
                                onChange={e => setEditLancForm(f => ({ ...f, descricao: e.target.value }))}
                                style={{ width: 240 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Valor</div>
                              <input className={styles.inputSmall} type="number" step="0.01" value={editLancForm.valor}
                                onChange={e => setEditLancForm(f => ({ ...f, valor: e.target.value }))}
                                style={{ width: 110 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Vencimento</div>
                              <input className={styles.inputSmall} type="date" value={editLancForm.data_vencimento}
                                onChange={e => setEditLancForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Categoria</div>
                              <select className={styles.inputSmall} value={editLancForm.categoria_id}
                                onChange={e => setEditLancForm(f => ({ ...f, categoria_id: e.target.value }))}>
                                <option value="">—</option>
                                {categorias.filter(c => c.tipo === lanc.tipo).map(c => (
                                  <option key={c.id} value={String(c.id)}>{c.grupo ? `${c.grupo} / ` : ''}{c.nome}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Observação</div>
                              <input className={styles.inputSmall} value={editLancForm.observacao}
                                onChange={e => setEditLancForm(f => ({ ...f, observacao: e.target.value }))}
                                style={{ width: 180 }} />
                            </div>
                            <button className={styles.btnBaixa} onClick={salvarEdicaoLanc} disabled={salvando}>
                              {salvando ? '...' : '✓ Salvar'}
                            </button>
                            <button className={styles.btnCancelarBaixa} onClick={() => setEditLancId(null)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map(m => (
                    <Fragment key={m.id}>
                    <tr style={{ opacity: m.status === 'cancelado' ? 0.4 : 1 }}>
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
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button title="Editar" onClick={() => {
                          setEditMovId(editMovId === m.id ? null : m.id)
                          setEditMovForm({ descricao: m.descricao ?? '', valor: String(m.valor), data: m.data.slice(0,10), tipo_pagamento: m.tipo_pagamento ?? '', status: m.status, categoria_id: m.categoria_id, conta_id: m.conta_id })
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b', padding: '2px 4px' }}>✏️</button>
                        <button title="Excluir" onClick={() => excluirMovimentacao(m.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', padding: '2px 4px' }}>🗑</button>
                      </td>
                    </tr>
                    {editMovId === m.id && (
                      <tr key={`edit-${m.id}`} style={{ background: '#f8fafc' }}>
                        <td colSpan={11} style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Descrição</div>
                              <input className={styles.inputSmall} value={editMovForm.descricao}
                                onChange={e => setEditMovForm(f => ({ ...f, descricao: e.target.value }))}
                                style={{ width: 220 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Valor</div>
                              <input className={styles.inputSmall} type="number" step="0.01" value={editMovForm.valor}
                                onChange={e => setEditMovForm(f => ({ ...f, valor: e.target.value }))}
                                style={{ width: 110 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Data</div>
                              <input className={styles.inputSmall} type="date" value={editMovForm.data}
                                onChange={e => setEditMovForm(f => ({ ...f, data: e.target.value }))} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Forma pgto</div>
                              <select className={styles.inputSmall} value={editMovForm.tipo_pagamento}
                                onChange={e => setEditMovForm(f => ({ ...f, tipo_pagamento: e.target.value }))}>
                                <option value="">—</option>
                                {FORMAS_PAGAMENTO.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Status</div>
                              <select className={styles.inputSmall} value={editMovForm.status}
                                onChange={e => setEditMovForm(f => ({ ...f, status: e.target.value }))}>
                                {['realizado','previsto','negociado','atrasado','cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Categoria</div>
                              <select className={styles.inputSmall} value={editMovForm.categoria_id ?? ''}
                                onChange={e => setEditMovForm(f => ({ ...f, categoria_id: e.target.value ? Number(e.target.value) : null }))}>
                                <option value="">—</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>Conta</div>
                              <select className={styles.inputSmall} value={editMovForm.conta_id ?? ''}
                                onChange={e => setEditMovForm(f => ({ ...f, conta_id: e.target.value ? Number(e.target.value) : null }))}>
                                <option value="">—</option>
                                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                              </select>
                            </div>
                            <button className={styles.btnBaixa} onClick={salvarEdicaoMov} disabled={salvandoFluxo}>
                              {salvandoFluxo ? '...' : '✓ Salvar'}
                            </button>
                            <button className={styles.btnCancelarBaixa} onClick={() => setEditMovId(null)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ COMISSÕES ══════════════════════════════════════════════════════════ */}
      {aba === 'comissoes' && (
        <div style={{ padding: '0 24px 40px' }}>

          {/* Seletor de período + ações */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              type="month"
              className={styles.input}
              style={{ width: 160 }}
              value={periodoComissao}
              onChange={e => { setPeriodoComissao(e.target.value); setComissoes([]) }}
            />
            <button className={styles.btnSalvar} onClick={calcularComissoes} disabled={calculando}>
              {calculando ? '⏳ Calculando…' : '🔄 Calcular comissões'}
            </button>
            <button className={styles.btnSecondary} onClick={carregarComissoes}>↻ Atualizar</button>
          </div>

          {comissoes.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Nenhuma comissão calculada para {periodoComissao}. Clique em "Calcular comissões".
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Totais */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem' }}>
                  <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '1.1rem' }}>
                    {comissoes.reduce((s, c) => s + c.valor_comissao, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div style={{ color: '#64748b' }}>Total a pagar</div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem' }}>
                  <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '1.1rem' }}>
                    {comissoes.reduce((s, c) => s + c.base_valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div style={{ color: '#64748b' }}>Base de cálculo</div>
                </div>
              </div>

              {comissoes.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{c.vendedor_nome}</span>
                      <span style={{ marginLeft: 10, fontSize: '0.78rem', color: '#64748b' }}>
                        Base: {c.base_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        {' · '}{c.comissao_pct}%
                        {' · '}Venc: {c.data_vencimento ? new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <div style={{ marginTop: 2 }}>
                        <span style={{
                          fontSize: '1rem', fontWeight: 800,
                          color: c.status === 'pago' ? '#16a34a' : '#dc2626',
                        }}>
                          {c.valor_comissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: '0.72rem', background: c.status === 'pago' ? '#dcfce7' : '#fef9c3', color: c.status === 'pago' ? '#166534' : '#92400e', borderRadius: 4, padding: '1px 6px' }}>
                          {c.status === 'pago' ? `✓ Pago em ${new Date((c.data_pagamento ?? '') + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.status === 'pendente' && !c.fin_lancamento_id && (
                        <button className={styles.btnSecondary} style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => gerarLancamentoComissao(c)}>
                          💰 Gerar lançamento
                        </button>
                      )}
                      {c.status === 'pendente' && (
                        <button className={styles.btnSalvar} style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => pagarComissao(c)}>
                          ✓ Marcar pago
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
