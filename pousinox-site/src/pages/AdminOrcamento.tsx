import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'
import { useAdmin } from '../contexts/AdminContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmpresaEmissora {
  id: number; nome_fantasia: string; razao_social: string | null
  cnpj: string | null; endereco: string | null; telefone: string | null
  email: string | null; site: string | null; logo_url: string | null; ativa: boolean
}

interface Vendedor {
  id: number; nome: string; email: string | null; telefone: string | null
  comissao_pct: number; ativo: boolean
}

interface OrcamentoResumo {
  id: number; numero: string; status: Status
  empresa_nome: string | null; cliente_empresa: string | null; cliente_nome: string | null
  vendedor_nome: string | null; total: number; criado_em: string
}

interface Item {
  produto_id: number | null; descricao: string; qtd: string; unidade: string; valorUnit: string; imagem_url?: string; preco_original?: string
}

interface ClienteInfo {
  nome: string; empresa: string; cnpj: string; telefone: string; email: string; endereco: string
}

interface Anexo {
  id?: number; nome: string; url: string; tamanho?: number | null; tipo?: string | null
}

interface HistoricoItem {
  id: number; evento: string; descricao: string | null; criado_em: string
}

interface ProdutoResult {
  id: number; nome_padronizado: string; unidade: string | null; familia: string | null
}

interface OutletResult {
  id: number; titulo: string; preco: number; preco_original: number | null; quantidade: number; exibir_preco: boolean; fotos: string[] | null
}

interface ClienteResult {
  cnpj: string; nome: string; telefone: string | null; email: string | null
  fonte: 'cliente' | 'prospect'
}

type Status = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'cancelado'
type Vista = 'lista' | 'editor' | 'empresas' | 'vendedores'

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIDADES = ['UN', 'CX', 'KG', 'M', 'M²', 'M³', 'L', 'PC', 'JG', 'PAR', 'RL', 'SC', 'H', 'DZ', 'GL']

const COND_PAGAMENTO = [
  'À vista', 'À vista com desconto', '30 dias', '30/60 dias', '30/60/90 dias',
  'Cartão de crédito (até 12x)', 'Boleto bancário', 'PIX', 'Depósito/Transferência',
]

const STATUS_CFG: Record<Status, { label: string; cor: string }> = {
  rascunho:  { label: 'Rascunho',  cor: '#64748b' },
  enviado:   { label: 'Enviado',   cor: '#1d4ed8' },
  aprovado:  { label: 'Aprovado',  cor: '#16a34a' },
  recusado:  { label: 'Recusado',  cor: '#dc2626' },
  cancelado: { label: 'Cancelado', cor: '#9ca3af' },
}

const EVENTO_LABEL: Record<string, string> = {
  criado: '📝 Criado', editado: '✏️ Editado', status_alterado: '🔄 Status alterado',
  impresso: '🖨️ Impresso/PDF', enviado: '📤 Marcado enviado',
  aprovado: '✅ Aprovado', recusado: '❌ Recusado', cancelado: '🚫 Cancelado',
  anexo_adicionado: '📎 Anexo adicionado', receivel_gerado: '💰 Recebível gerado',
}

const ITEM_VAZIO: Item = { produto_id: null, descricao: '', qtd: '1', unidade: 'UN', valorUnit: '' }
const CLIENTE_VAZIO: ClienteInfo = { nome: '', empresa: '', cnpj: '', telefone: '', email: '', endereco: '' }
const OBS_DEFAULT = `• Orçamento válido conforme data de validade indicada.\n• Preços sujeitos a alteração sem aviso prévio.\n• Prazo de entrega a partir da confirmação do pedido e aprovação do pagamento.`

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hoje() { return new Date().toLocaleDateString('pt-BR') }
function addDias(dias: number) {
  const d = new Date(); d.setDate(d.getDate() + dias); return d.toLocaleDateString('pt-BR')
}
function fmtDataISO(iso: string) { return new Date(iso).toLocaleDateString('pt-BR') }
function fmtEvento(iso: string) { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminOrcamento() {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const location = useLocation()
  const fromProjeto = location.state as {
    projeto?: { titulo: string; cliente_nome: string | null; cliente_cnpj: string | null; observacoes: string | null }
    componentes?: { nome: string; quantidade: number | null }[]
  } | null

  const [vista, setVista]           = useState<Vista>('lista')
  const [lista, setLista]           = useState<OrcamentoResumo[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<Status | 'todos'>('todos')
  const [empresas, setEmpresas]     = useState<EmpresaEmissora[]>([])
  const [empresaId, setEmpresaId]   = useState<number | null>(null)
  const [formEmpresa, setFormEmpresa] = useState<Partial<EmpresaEmissora>>({})
  const [editEmpresaId, setEditEmpresaId] = useState<number | null>(null)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [formVendedor, setFormVendedor] = useState<Partial<Vendedor>>({})
  const [editVendedorId, setEditVendedorId] = useState<number | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [numero, setNumero]         = useState('')
  const [status, setStatus]         = useState<Status>('rascunho')
  const [finLancId, setFinLancId]   = useState<number | null>(null)
  const [dataEmissao]               = useState(hoje)
  const [validadeDias, setValidadeDias] = useState('7')
  const [cliente, setCliente]       = useState<ClienteInfo>(CLIENTE_VAZIO)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<ClienteResult[]>([])
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [showDropCliente, setShowDropCliente] = useState(false)
  const [itens, setItens]           = useState<Item[]>([{ ...ITEM_VAZIO }])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [resultadosProduto, setResultadosProduto] = useState<ProdutoResult[]>([])
  const [loadingProduto, setLoadingProduto] = useState(false)
  const [showBuscaProduto, setShowBuscaProduto] = useState(false)
  const [buscaOutlet, setBuscaOutlet] = useState('')
  const [resultadosOutlet, setResultadosOutlet] = useState<OutletResult[]>([])
  const [loadingOutlet, setLoadingOutlet] = useState(false)
  const [showBuscaOutlet, setShowBuscaOutlet] = useState(false)
  const [desconto, setDesconto]     = useState('')
  const [tipoDesc, setTipoDesc]     = useState<'%' | 'R$'>('%')
  const [condicao, setCondicao]     = useState('')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [observacoes, setObservacoes] = useState(OBS_DEFAULT)
  const [watermarkAtivo, setWatermarkAtivo] = useState(false)
  const [watermarkTexto, setWatermarkTexto] = useState('CONFIDENCIAL')
  const [imagemUrl, setImagemUrl]   = useState('')
  const [uploadandoImagem, setUploadandoImagem] = useState(false)
  const imagemRef = useRef<HTMLInputElement>(null)
  const [anexos, setAnexos]         = useState<Anexo[]>([])
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false)
  const [historico, setHistorico]   = useState<HistoricoItem[]>([])
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [gerandoRec, setGerandoRec] = useState(false)
  const [msg, setMsg]               = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const anexoRef  = useRef<HTMLInputElement>(null)

  const empresaSel  = empresas.find(e => e.id === empresaId) ?? null
  const vendedorSel = vendedores.find(v => v.id === vendedorId) ?? null
  const dataValidade = addDias(parseInt(validadeDias) || 7)

  function subtotal() {
    return itens.reduce((s, i) => {
      const q = parseFloat(i.qtd.replace(',', '.')) || 0
      const v = parseFloat(i.valorUnit.replace(',', '.')) || 0
      return s + q * v
    }, 0)
  }
  function valorDesc() {
    const sub = subtotal(), d = parseFloat(desconto.replace(',', '.')) || 0
    return tipoDesc === '%' ? sub * d / 100 : Math.min(d, sub)
  }
  function total() { return subtotal() - valorDesc() }

  // ── Load ───────────────────────────────────────────────────────────────────

  const carregarLista = useCallback(async () => {
    setLoadingLista(true)
    const base = supabaseAdmin
      .from('orcamentos')
      .select('id, numero, status, empresa_nome, cliente_empresa, cliente_nome, vendedor_nome, total, criado_em')
      .order('criado_em', { ascending: false })
    const { data } = await (filtroStatus !== 'todos' ? base.eq('status', filtroStatus) : base)
    setLista((data ?? []) as OrcamentoResumo[])
    setLoadingLista(false)
  }, [filtroStatus])

  const carregarEmpresas = useCallback(async () => {
    const { data } = await supabaseAdmin.from('empresas_emissoras').select('*').eq('ativa', true).order('nome_fantasia')
    const list = (data ?? []) as EmpresaEmissora[]
    setEmpresas(list)
    if (!empresaId && list.length > 0) setEmpresaId(list[0].id)
  }, [])

  const carregarVendedores = useCallback(async () => {
    const { data } = await supabaseAdmin.from('vendedores').select('*').eq('ativo', true).order('nome')
    setVendedores((data ?? []) as Vendedor[])
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])
  useEffect(() => { carregarEmpresas() }, [carregarEmpresas])
  useEffect(() => { carregarVendedores() }, [carregarVendedores])

  useEffect(() => {
    if (!fromProjeto?.projeto) return
    const p = fromProjeto.projeto
    setCliente({ ...CLIENTE_VAZIO, empresa: p.cliente_nome ?? '', cnpj: p.cliente_cnpj ?? '' })
    if (fromProjeto.componentes?.length) {
      setItens(fromProjeto.componentes.map(c => ({
        produto_id: null,
        descricao: `${c.nome}${c.quantidade ? ` (${c.quantidade} un)` : ''}`,
        qtd: String(c.quantidade ?? 1), unidade: 'UN', valorUnit: '',
      })))
    }
    if (p.observacoes) setObservacoes(p.observacoes)
    supabaseAdmin.rpc('next_orcamento_numero').then(({ data }) => {
      setNumero((data as string) ?? `${new Date().getFullYear()}/001`)
    })
    setVista('editor')
  }, [])

  useEffect(() => {
    if (buscaCliente.length < 2) { setResultadosCliente([]); return }
    const t = setTimeout(async () => {
      setLoadingCliente(true)
      const termo = `%${buscaCliente}%`
      const [{ data: clis }, { data: pros }] = await Promise.all([
        supabaseAdmin.from('clientes').select('cnpj, razao_social').ilike('razao_social', termo).limit(5),
        supabaseAdmin.from('prospeccao').select('cnpj, razao_social, telefone1, email').ilike('razao_social', termo).limit(5),
      ])
      setResultadosCliente([
        ...((clis ?? []) as any[]).map(c => ({ cnpj: c.cnpj, nome: c.razao_social ?? '', telefone: null, email: null, fonte: 'cliente' as const })),
        ...((pros ?? []) as any[]).map(p => ({ cnpj: p.cnpj, nome: p.razao_social ?? '', telefone: p.telefone1, email: p.email, fonte: 'prospect' as const })),
      ])
      setLoadingCliente(false)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  useEffect(() => {
    if (buscaProduto.length < 2) { setResultadosProduto([]); return }
    const t = setTimeout(async () => {
      setLoadingProduto(true)
      const { data } = await supabaseAdmin
        .from('produtos_catalogo').select('id, nome_padronizado, unidade, familia')
        .ilike('nome_padronizado', `%${buscaProduto}%`).eq('ativo', true).limit(8)
      setResultadosProduto((data ?? []) as ProdutoResult[])
      setLoadingProduto(false)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaProduto])

  useEffect(() => {
    if (buscaOutlet.length < 2) { setResultadosOutlet([]); return }
    const t = setTimeout(async () => {
      setLoadingOutlet(true)
      const { data } = await supabaseAdmin
        .from('produtos').select('id, titulo, preco, preco_original, quantidade, exibir_preco, fotos')
        .ilike('titulo', `%${buscaOutlet}%`).eq('disponivel', true).limit(8)
      setResultadosOutlet((data ?? []) as OutletResult[])
      setLoadingOutlet(false)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaOutlet])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function abrirNovo() {
    const { data } = await supabaseAdmin.rpc('next_orcamento_numero')
    setEditandoId(null); setNumero((data as string) ?? `${new Date().getFullYear()}/001`)
    setStatus('rascunho'); setFinLancId(null); setCliente(CLIENTE_VAZIO)
    setItens([{ ...ITEM_VAZIO }]); setDesconto(''); setTipoDesc('%')
    setCondicao(''); setPrazoEntrega(''); setValidadeDias('7'); setObservacoes(OBS_DEFAULT)
    setWatermarkAtivo(false); setWatermarkTexto('CONFIDENCIAL')
    setImagemUrl('')
    setAnexos([]); setHistorico([]); setBuscaCliente(''); setVista('editor')
  }

  async function carregarOrcamento(id: number) {
    const [{ data: orc }, { data: itensD }, { data: anexosD }, { data: histD }] = await Promise.all([
      supabaseAdmin.from('orcamentos').select('*').eq('id', id).single(),
      supabaseAdmin.from('itens_orcamento').select('*').eq('orcamento_id', id).order('ordem'),
      supabaseAdmin.from('orcamentos_anexos').select('*').eq('orcamento_id', id).order('criado_em'),
      supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', id).order('criado_em', { ascending: false }),
    ])
    if (!orc) return
    const o = orc as any
    setEditandoId(id); setNumero(o.numero); setStatus(o.status); setFinLancId(o.fin_lancamento_id ?? null)
    setEmpresaId(o.empresa_id); setVendedorId(o.vendedor_id ?? null)
    setCliente({ nome: o.cliente_nome ?? '', empresa: o.cliente_empresa ?? '', cnpj: o.cliente_cnpj ?? '', telefone: o.cliente_telefone ?? '', email: o.cliente_email ?? '', endereco: o.cliente_endereco ?? '' })
    setItens((itensD ?? []).length > 0
      ? (itensD as any[]).map(i => ({ produto_id: i.produto_id, descricao: i.descricao, qtd: String(i.qtd), unidade: i.unidade, valorUnit: String(i.valor_unit), imagem_url: i.imagem_url ?? undefined, preco_original: i.preco_original ? String(i.preco_original) : undefined }))
      : [{ ...ITEM_VAZIO }])
    setDesconto(o.desconto > 0 ? String(o.desconto) : ''); setTipoDesc(o.tipo_desconto ?? '%')
    setCondicao(o.condicao_pagamento ?? ''); setPrazoEntrega(o.prazo_entrega ?? '')
    setValidadeDias(String(o.validade_dias ?? 7)); setObservacoes(o.observacoes ?? OBS_DEFAULT)
    setWatermarkAtivo(o.watermark_ativo ?? false); setWatermarkTexto(o.watermark_texto ?? 'CONFIDENCIAL')
    setImagemUrl(o.imagem_url ?? '')
    setAnexos((anexosD ?? []) as Anexo[]); setHistorico((histD ?? []) as HistoricoItem[])
    setVista('editor')
  }

  async function salvar(novoStatus?: Status) {
    setSalvando(true)
    const statusFinal = novoStatus ?? status
    const emp = empresas.find(e => e.id === empresaId)
    const vend = vendedores.find(v => v.id === vendedorId)
    const payload: any = {
      numero, status: statusFinal,
      empresa_id: empresaId ?? null,
      empresa_nome: emp?.nome_fantasia ?? null, empresa_cnpj: emp?.cnpj ?? null,
      empresa_endereco: emp?.endereco ?? null, empresa_telefone: emp?.telefone ?? null,
      empresa_email: emp?.email ?? null, empresa_site: emp?.site ?? null, empresa_logo_url: emp?.logo_url ?? null,
      vendedor_id: vendedorId ?? null, vendedor_nome: vend?.nome ?? null,
      cliente_nome: cliente.nome || null, cliente_empresa: cliente.empresa || null,
      cliente_cnpj: cliente.cnpj || null, cliente_telefone: cliente.telefone || null,
      cliente_email: cliente.email || null, cliente_endereco: cliente.endereco || null,
      desconto: parseFloat(desconto.replace(',', '.')) || 0, tipo_desconto: tipoDesc,
      subtotal: subtotal(), total: total(),
      condicao_pagamento: condicao || null, prazo_entrega: prazoEntrega || null,
      validade_dias: parseInt(validadeDias) || 7, observacoes: observacoes || null,
      watermark_ativo: watermarkAtivo, watermark_texto: watermarkTexto,
      imagem_url: imagemUrl || null,
    }
    let orcId = editandoId
    if (editandoId) {
      await supabaseAdmin.from('orcamentos').update(payload).eq('id', editandoId)
      await supabaseAdmin.from('itens_orcamento').delete().eq('orcamento_id', editandoId)
    } else {
      const { data } = await supabaseAdmin.from('orcamentos').insert(payload).select('id').single()
      orcId = (data as any)?.id ?? null
      setEditandoId(orcId)
    }
    if (orcId) {
      const itensPayload = itens.filter(i => i.descricao.trim()).map((i, idx) => ({
        orcamento_id: orcId, produto_id: i.produto_id, descricao: i.descricao,
        qtd: parseFloat(i.qtd.replace(',', '.')) || 1, unidade: i.unidade,
        valor_unit: parseFloat(i.valorUnit.replace(',', '.')) || 0,
        total: (parseFloat(i.qtd.replace(',', '.')) || 1) * (parseFloat(i.valorUnit.replace(',', '.')) || 0),
        imagem_url: i.imagem_url ?? null,
        preco_original: i.preco_original ? parseFloat(i.preco_original) : null,
        ordem: idx,
      }))
      if (itensPayload.length) await supabaseAdmin.from('itens_orcamento').insert(itensPayload)
      const evento = !editandoId ? 'criado' : novoStatus ? 'status_alterado' : 'editado'
      const descEvento = novoStatus ? `Status → ${STATUS_CFG[novoStatus].label}` : null
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: orcId, evento, descricao: descEvento })
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', orcId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
    }
    if (novoStatus) setStatus(novoStatus)
    setSalvando(false)
    showMsg('ok', editandoId ? 'Salvo.' : 'Orçamento criado.')
    carregarLista()
  }

  async function imprimir() {
    if (editandoId) {
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'impresso', descricao: null })
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
    }
    window.print()
  }

  async function gerarReceivel() {
    if (!editandoId) return
    setGerandoRec(true)
    const { data: lanc } = await supabaseAdmin.from('fin_lancamentos').insert({
      descricao: `Orçamento ${numero} — ${cliente.empresa || cliente.nome || 'Cliente'}`,
      tipo: 'receita', valor: total(), status: 'pendente',
      data_vencimento: new Date(Date.now() + (parseInt(validadeDias) || 7) * 864e5).toISOString().slice(0, 10),
      origem: 'manual',
    }).select('id').single()
    if (lanc) {
      const lid = (lanc as any).id
      await supabaseAdmin.from('orcamentos').update({ fin_lancamento_id: lid }).eq('id', editandoId)
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'receivel_gerado', descricao: `Lançamento #${lid}` })
      setFinLancId(lid)
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
      showMsg('ok', 'Recebível criado no Financeiro.')
    }
    setGerandoRec(false)
  }

  async function uploadLogo(file: File, empId: number) {
    setUploadandoLogo(true)
    const ext = file.name.split('.').pop()
    const { data: up } = await supabaseAdmin.storage.from('orcamentos-logo').upload(`empresa-${empId}.${ext}`, file, { upsert: true })
    if (up) {
      const { data: url } = supabaseAdmin.storage.from('orcamentos-logo').getPublicUrl(`empresa-${empId}.${ext}`)
      await supabaseAdmin.from('empresas_emissoras').update({ logo_url: url.publicUrl }).eq('id', empId)
      setEmpresas(prev => prev.map(e => e.id === empId ? { ...e, logo_url: url.publicUrl } : e))
    }
    setUploadandoLogo(false)
  }

  async function uploadAnexo(file: File) {
    if (!editandoId) { showMsg('erro', 'Salve o orçamento antes de anexar.'); return }
    setUploadandoAnexo(true)
    const path = `orc-${editandoId}/${Date.now()}-${file.name}`
    const { data: up } = await supabaseAdmin.storage.from('orcamentos-anexos').upload(path, file)
    if (up) {
      const { data: url } = supabaseAdmin.storage.from('orcamentos-anexos').getPublicUrl(path)
      const { data: anx } = await supabaseAdmin.from('orcamentos_anexos').insert({ orcamento_id: editandoId, nome: file.name, url: url.publicUrl, tamanho: file.size, tipo: file.type }).select().single()
      if (anx) setAnexos(prev => [...prev, anx as Anexo])
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'anexo_adicionado', descricao: file.name })
    }
    setUploadandoAnexo(false)
  }

  async function uploadImagem(file: File) {
    setUploadandoImagem(true)
    const path = `img-${editandoId ?? 'novo'}-${Date.now()}.${file.name.split('.').pop()}`
    const { data: up } = await supabaseAdmin.storage.from('orcamentos-anexos').upload(path, file, { upsert: true })
    if (up) {
      const { data: url } = supabaseAdmin.storage.from('orcamentos-anexos').getPublicUrl(path)
      setImagemUrl(url.publicUrl)
    }
    setUploadandoImagem(false)
  }

  async function removerAnexo(id: number) {
    await supabaseAdmin.from('orcamentos_anexos').delete().eq('id', id)
    setAnexos(prev => prev.filter(a => a.id !== id))
  }

  async function salvarEmpresa() {
    if (!formEmpresa.nome_fantasia?.trim()) return
    if (editEmpresaId) { await supabaseAdmin.from('empresas_emissoras').update(formEmpresa).eq('id', editEmpresaId) }
    else { await supabaseAdmin.from('empresas_emissoras').insert({ ...formEmpresa, ativa: true }) }
    setFormEmpresa({}); setEditEmpresaId(null); carregarEmpresas()
  }

  async function salvarVendedor() {
    if (!formVendedor.nome?.trim()) return
    if (editVendedorId) { await supabaseAdmin.from('vendedores').update(formVendedor).eq('id', editVendedorId) }
    else { await supabaseAdmin.from('vendedores').insert({ ...formVendedor, ativo: true }) }
    setFormVendedor({}); setEditVendedorId(null); carregarVendedores()
  }

  function showMsg(tipo: 'ok' | 'erro', texto: string) {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000)
  }
  function selecionarCliente(r: ClienteResult) {
    setCliente({ nome: '', empresa: r.nome, cnpj: r.cnpj, telefone: r.telefone ?? '', email: r.email ?? '', endereco: '' })
    setBuscaCliente(''); setShowDropCliente(false)
  }
  function adicionarProduto(p: ProdutoResult) {
    setItens(prev => [...prev, { produto_id: p.id, descricao: p.nome_padronizado, qtd: '1', unidade: p.unidade ?? 'UN', valorUnit: '' }])
    setBuscaProduto(''); setResultadosProduto([]); setShowBuscaProduto(false)
  }
  function adicionarOutlet(p: OutletResult) {
    setItens(prev => [...prev, {
      produto_id: p.id, descricao: p.titulo, qtd: '1', unidade: 'UN',
      valorUnit: String(p.preco),
      preco_original: p.preco_original && p.preco_original > p.preco ? String(p.preco_original) : undefined,
      imagem_url: p.fotos?.[0] ?? undefined,
    }])
    setBuscaOutlet(''); setResultadosOutlet([]); setShowBuscaOutlet(false)
  }
  function addItem() { setItens(prev => [...prev, { ...ITEM_VAZIO }]) }
  function removeItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof Item, val: string) {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.toast} ${msg.tipo === 'ok' ? styles.toastOk : styles.toastErro}`}>
          {msg.texto}
        </div>
      )}

      <div className={styles.navTabs}>
        <button className={`${styles.navTab} ${vista === 'lista' ? styles.navTabAtivo : ''}`} onClick={() => setVista('lista')}>📋 Orçamentos</button>
        {vista === 'editor' && (
          <button className={`${styles.navTab} ${styles.navTabAtivo}`}>✏️ {editandoId ? numero : 'Novo'}</button>
        )}
        <button className={`${styles.navTab} ${vista === 'empresas' ? styles.navTabAtivo : ''}`} onClick={() => setVista('empresas')}>🏢 Empresas</button>
        <button className={`${styles.navTab} ${vista === 'vendedores' ? styles.navTabAtivo : ''}`} onClick={() => setVista('vendedores')}>👤 Vendedores</button>
        <button className={styles.btnNovo} onClick={abrirNovo}>+ Novo Orçamento</button>
      </div>

      {/* ═══ LISTA ═══ */}
      {vista === 'lista' && (
        <div className={styles.listaWrap}>
          <div className={styles.listaFiltros}>
            {(['todos', 'rascunho', 'enviado', 'aprovado', 'recusado', 'cancelado'] as const).map(s => (
              <button key={s} className={`${styles.filtroBtn} ${filtroStatus === s ? styles.filtroBtnAtivo : ''}`} onClick={() => setFiltroStatus(s)}>
                {s === 'todos' ? 'Todos' : STATUS_CFG[s as Status].label}
              </button>
            ))}
          </div>
          {loadingLista ? (
            <div className={styles.loading}>Carregando...</div>
          ) : lista.length === 0 ? (
            <div className={styles.vazio}>
              <p>Nenhum orçamento encontrado.</p>
            </div>
          ) : (
            <table className={styles.listaTable}>
              <thead><tr><th>Número</th><th>Empresa</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Status</th><th>Data</th><th></th></tr></thead>
              <tbody>
                {lista.map(o => (
                  <tr key={o.id}>
                    <td><strong>{o.numero}</strong></td>
                    <td>{o.empresa_nome ?? '—'}</td>
                    <td>{o.cliente_empresa || o.cliente_nome || '—'}</td>
                    <td>{o.vendedor_nome ?? '—'}</td>
                    <td>{ocultarValores ? '••••' : fmtBRL(Number(o.total))}</td>
                    <td><span className={styles.statusBadge} style={{ background: STATUS_CFG[o.status as Status]?.cor + '22', color: STATUS_CFG[o.status as Status]?.cor }}>{STATUS_CFG[o.status as Status]?.label}</span></td>
                    <td>{fmtDataISO(o.criado_em)}</td>
                    <td><button className={styles.btnAcao} onClick={() => carregarOrcamento(o.id)}>✏️ Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ EDITOR ═══ */}
      {vista === 'editor' && (
        <>
          <div className={styles.editorBar}>
            <div className={styles.editorBarLeft}>
              <span className={styles.editorNumero}>{numero}</span>
              <span className={styles.statusBadge} style={{ background: STATUS_CFG[status].cor + '22', color: STATUS_CFG[status].cor }}>{STATUS_CFG[status].label}</span>
              <select className={styles.empresaSelect} value={empresaId ?? ''} onChange={e => setEmpresaId(Number(e.target.value))}>
                <option value="">— Empresa emissora —</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia}</option>)}
              </select>
              <select className={styles.vendedorSelect} value={vendedorId ?? ''} onChange={e => setVendedorId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Vendedor —</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
            <div className={styles.editorBarRight}>
              {status === 'aprovado' && !finLancId && <button className={styles.btnReceivel} onClick={gerarReceivel} disabled={gerandoRec}>{gerandoRec ? '...' : '💰 Gerar Recebível'}</button>}
              {status === 'aprovado' && finLancId && <span className={styles.receivelOk}>✓ Recebível #{finLancId}</span>}
              {status === 'rascunho' && <button className={styles.btnEnviar} onClick={() => salvar('enviado')} disabled={salvando}>📤 Marcar Enviado</button>}
              {status === 'enviado' && <>
                <button className={styles.btnAprovar} onClick={() => salvar('aprovado')} disabled={salvando}>✅ Aprovado</button>
                <button className={styles.btnRecusar} onClick={() => salvar('recusado')} disabled={salvando}>❌ Recusado</button>
              </>}
              <button className={styles.btnImprimir} onClick={imprimir}>🖨️ PDF</button>
              <button className={styles.btnPrimary} onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>

          <div className={styles.layout}>
            <div className={styles.formCol}>

              {/* Cliente */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Destinatário</div>
                <div className={styles.buscaWrap}>
                  <input className={styles.input} placeholder="🔍 Buscar cliente por nome..."
                    value={buscaCliente}
                    onChange={e => { setBuscaCliente(e.target.value); setShowDropCliente(true) }}
                    onFocus={() => setShowDropCliente(true)}
                    onBlur={() => setTimeout(() => setShowDropCliente(false), 200)}
                  />
                  {showDropCliente && buscaCliente.length >= 2 && (
                    <div className={styles.dropdown}>
                      {loadingCliente && <div className={styles.dropItem}>Buscando...</div>}
                      {resultadosCliente.map(r => (
                        <div key={r.cnpj} className={styles.dropItem} onMouseDown={() => selecionarCliente(r)}>
                          <strong>{r.nome}</strong>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}> · {r.cnpj} · {r.fonte === 'cliente' ? '🟢 cliente' : '🔵 prospect'}</span>
                        </div>
                      ))}
                      {!loadingCliente && resultadosCliente.length === 0 && (
                        <div className={styles.dropItem} style={{ color: '#94a3b8' }}>Nenhum resultado — preencha manualmente</div>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Responsável</label><input className={styles.input} value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} placeholder="Att.: Nome" /></div>
                  <div className={styles.fg}><label>Empresa *</label><input className={styles.input} value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))} placeholder="Razão social" /></div>
                </div>
                <div className={styles.row3}>
                  <div className={styles.fg}><label>CNPJ / CPF</label><input className={styles.input} value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: e.target.value }))} /></div>
                  <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={cliente.telefone} onChange={e => setCliente(c => ({ ...c, telefone: e.target.value }))} /></div>
                  <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={cliente.email} onChange={e => setCliente(c => ({ ...c, email: e.target.value }))} /></div>
                </div>
                <div className={styles.fg}><label>Endereço</label><input className={styles.input} value={cliente.endereco} onChange={e => setCliente(c => ({ ...c, endereco: e.target.value }))} placeholder="Rua, Nº — Cidade / UF" /></div>
              </div>

              {/* Itens */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Itens</div>
                <div className={styles.itensHeader}>
                  <span className={styles.itemDesc}>Descrição</span>
                  <span className={styles.itemQtd}>Qtd</span>
                  <span className={styles.itemUn}>Un</span>
                  <span className={styles.itemVu}>Vl. Unit.</span>
                  <span className={styles.itemTotal}>Total</span>
                  <span style={{ width: 28 }} />
                </div>
                {itens.map((item, i) => {
                  const q = parseFloat(item.qtd.replace(',', '.')) || 0
                  const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
                  return (
                    <div key={i} className={styles.itemRow}>
                      <input className={`${styles.input} ${styles.itemDesc}`} placeholder="Produto / serviço" value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} />
                      <input className={`${styles.input} ${styles.itemQtd}`} type="number" min="0" step="any" value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)} />
                      <select className={`${styles.input} ${styles.itemUn}`} value={item.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input className={`${styles.input} ${styles.itemVu}`} type="number" min="0" step="any" placeholder="0,00" value={item.valorUnit} onChange={e => updateItem(i, 'valorUnit', e.target.value)} />
                      <span className={styles.itemTotal}>{q > 0 && v > 0 ? fmtBRL(q * v) : '—'}</span>
                      <button className={styles.btnRemoveItem} onClick={() => removeItem(i)}>✕</button>
                    </div>
                  )
                })}
                {showBuscaProduto && (
                  <div className={styles.buscaProdWrap}>
                    <input className={styles.input} autoFocus placeholder="Nome do produto cadastrado..."
                      value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
                    {loadingProduto && <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>Buscando...</div>}
                    {resultadosProduto.length > 0 && (
                      <div className={styles.dropdown} style={{ position: 'static', boxShadow: 'none', border: '1px solid #e2e8f0', borderTop: 'none' }}>
                        {resultadosProduto.map(p => (
                          <div key={p.id} className={styles.dropItem} onClick={() => adicionarProduto(p)}>
                            <strong>{p.nome_padronizado}</strong>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}> · {p.familia} · {p.unidade}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {showBuscaOutlet && (
                  <div className={styles.buscaProdWrap}>
                    <input className={styles.input} autoFocus placeholder="Buscar no Pronta Entrega..."
                      value={buscaOutlet} onChange={e => setBuscaOutlet(e.target.value)} />
                    {loadingOutlet && <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>Buscando...</div>}
                    {resultadosOutlet.length > 0 && (
                      <div className={styles.dropdown} style={{ position: 'static', boxShadow: 'none', border: '1px solid #e2e8f0', borderTop: 'none' }}>
                        {resultadosOutlet.map(p => (
                          <div key={p.id} className={styles.dropItem} onClick={() => adicionarOutlet(p)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.fotos?.[0] && <img src={p.fotos[0]} alt={p.titulo} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e2e8f0' }} />}
                            <div>
                              <strong>{p.titulo}</strong>
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                {p.preco_original && p.preco_original > p.preco
                                  ? <><s style={{ color: '#94a3b8' }}>{fmtBRL(p.preco_original)}</s> {fmtBRL(p.preco)}</>
                                  : fmtBRL(p.preco)
                                } · {p.quantidade} un. disponível
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!loadingOutlet && buscaOutlet.length >= 2 && resultadosOutlet.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '4px 0' }}>Nenhum produto disponível encontrado</div>
                    )}
                  </div>
                )}
                <div className={styles.itensActions}>
                  <button className={styles.btnAddItem} onClick={addItem}>+ Linha manual</button>
                  <button className={styles.btnAddItem} onClick={() => { setShowBuscaProduto(v => !v); setShowBuscaOutlet(false) }}>🔍 Catálogo</button>
                  <button className={styles.btnAddItem} onClick={() => { setShowBuscaOutlet(v => !v); setShowBuscaProduto(false) }}>🏪 Pronta Entrega</button>
                </div>
                <div className={styles.totaisWrap}>
                  <div className={styles.totaisRow}><span>Subtotal</span><span>{fmt(subtotal())}</span></div>
                  {subtotal() > 0 && (
                    <div className={styles.totaisRow}>
                      <span>Desconto</span>
                      <div className={styles.descontoGroup}>
                        <input className={`${styles.input} ${styles.descontoInput}`} type="number" min="0" step="any" placeholder="0" value={desconto} onChange={e => setDesconto(e.target.value)} />
                        <select className={`${styles.input} ${styles.descontoTipo}`} value={tipoDesc} onChange={e => setTipoDesc(e.target.value as '%' | 'R$')}><option>%</option><option>R$</option></select>
                        {valorDesc() > 0 && <span className={styles.descontoValor}>−{fmt(valorDesc())}</span>}
                      </div>
                    </div>
                  )}
                  <div className={`${styles.totaisRow} ${styles.totaisTotal}`}><span>Total</span><span>{fmt(total())}</span></div>
                </div>
              </div>

              {/* Condições */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Condições</div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Pagamento</label>
                    <select className={styles.input} value={condicao} onChange={e => setCondicao(e.target.value)}>
                      <option value="">Selecionar...</option>
                      {COND_PAGAMENTO.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className={styles.fg}><label>Prazo de entrega</label><input className={styles.input} placeholder="Ex: 10 dias úteis" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Validade (dias)</label><input className={styles.input} type="number" min="1" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} /></div>
                  <div className={styles.fg}><label>Emissão</label><input className={styles.input} value={dataEmissao} readOnly style={{ background: '#f8fafc' }} /></div>
                </div>
                <div className={styles.fg}><label>Observações</label><textarea className={`${styles.input} ${styles.textarea}`} rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
              </div>

              {/* Opções */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Opções</div>
                <div className={styles.watermarkRow}>
                  <label className={styles.toggleLabel}>
                    <input type="checkbox" checked={watermarkAtivo} onChange={e => setWatermarkAtivo(e.target.checked)} />
                    <span>Marca d'água</span>
                  </label>
                  {watermarkAtivo && (
                    <input className={styles.input} style={{ maxWidth: 220 }} placeholder="Ex: CONFIDENCIAL" value={watermarkTexto} onChange={e => setWatermarkTexto(e.target.value)} />
                  )}
                </div>
                <div className={styles.imagemOrcRow}>
                  <span className={styles.imagemOrcLabel}>Imagem do produto / projeto <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></span>
                  {imagemUrl ? (
                    <div className={styles.imagemOrcPreview}>
                      <img src={imagemUrl} alt="Imagem orçamento" className={styles.imagemOrcThumb} />
                      <div className={styles.imagemOrcActions}>
                        <input className={styles.input} placeholder="URL da imagem" value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} style={{ fontSize: '0.75rem' }} />
                        <button className={styles.btnRemoveItem} onClick={() => setImagemUrl('')} title="Remover imagem">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.imagemOrcActions}>
                      <input className={styles.input} placeholder="Cole a URL de uma imagem..." value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>ou</span>
                      <input type="file" ref={imagemRef} accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadImagem(e.target.files[0])} />
                      <button className={styles.btnAddItem} onClick={() => imagemRef.current?.click()} disabled={uploadandoImagem}>
                        {uploadandoImagem ? 'Enviando...' : '📷 Upload'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Anexos */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Anexos</div>
                {anexos.length > 0 && (
                  <div className={styles.anexosList}>
                    {anexos.map(a => (
                      <div key={a.id ?? a.nome} className={styles.anexoItem}>
                        <a href={a.url} target="_blank" rel="noreferrer" className={styles.anexoLink}>📎 {a.nome}</a>
                        {a.tamanho && <span className={styles.anexoSize}>{(a.tamanho / 1024).toFixed(0)} KB</span>}
                        {a.id && <button className={styles.btnRemoveItem} onClick={() => removerAnexo(a.id!)}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" ref={anexoRef} style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadAnexo(e.target.files[0])} />
                <button className={styles.btnAddItem} onClick={() => anexoRef.current?.click()} disabled={uploadandoAnexo}>
                  {uploadandoAnexo ? 'Enviando...' : '📎 Anexar arquivo'}
                </button>
              </div>

              {/* Rastreabilidade */}
              {historico.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Rastreabilidade</div>
                  <div className={styles.historicoList}>
                    {historico.map(h => (
                      <div key={h.id} className={styles.historicoItem}>
                        <span className={styles.historicoEvento}>{EVENTO_LABEL[h.evento] ?? h.evento}</span>
                        {h.descricao && <span className={styles.historicoDesc}>{h.descricao}</span>}
                        <span className={styles.historicoData}>{fmtEvento(h.criado_em)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className={`${styles.previewCol} ${previewFullscreen ? styles.previewColFull : ''}`}>
              <div className={styles.previewLabel}>
                Pré-visualização · PDF
                <button className={styles.btnFullscreen} onClick={() => setPreviewFullscreen(v => !v)}>
                  {previewFullscreen ? '✕ Fechar' : '⛶ Ampliar'}
                </button>
              </div>
              <div className={styles.previewSheet} id="orcamento-print">
                {watermarkAtivo && watermarkTexto && (
                  <div className={styles.watermark}>{watermarkTexto}</div>
                )}

                {/* Header executivo */}
                <div className={styles.pHeaderBand}>
                  <div className={styles.pHeaderLeft}>
                    {empresaSel?.logo_url
                      ? <img src={empresaSel.logo_url} alt="Logo" className={styles.pLogo} />
                      : <div className={styles.pLogoPlaceholder}>{(empresaSel?.nome_fantasia ?? 'PX').slice(0, 2).toUpperCase()}</div>
                    }
                    <div className={styles.pEmpresaInfo}>
                      <strong>{empresaSel?.nome_fantasia ?? '— Selecione a empresa —'}</strong>
                      {empresaSel?.razao_social && empresaSel.razao_social !== empresaSel.nome_fantasia && <span>{empresaSel.razao_social}</span>}
                      {empresaSel?.cnpj && <span>CNPJ: {empresaSel.cnpj}</span>}
                      {empresaSel?.endereco && <span>{empresaSel.endereco}</span>}
                      {empresaSel?.telefone && <span>{empresaSel.telefone}</span>}
                    </div>
                  </div>
                  <div className={styles.pHeaderRight}>
                    <div className={styles.pOrcTitulo}>ORÇAMENTO COMERCIAL</div>
                    <div className={styles.pOrcNum}>Nº {numero}</div>
                    <div className={styles.pOrcData}>Emissão: {dataEmissao}</div>
                    <div className={styles.pOrcData}>Validade: {dataValidade}</div>
                    {vendedorSel && <div className={styles.pOrcVendedor}>Vendedor: {vendedorSel.nome}</div>}
                  </div>
                </div>

                <div className={styles.pAccentLine} />

                {/* Cliente + imagem lado a lado */}
                <div className={styles.pCliente}>
                  <div className={styles.pClienteInfo}>
                  <div className={styles.pClienteTitle}>DESTINATÁRIO</div>
                  <div className={styles.pClienteGrid}>
                    {cliente.empresa && <div><strong>{cliente.empresa}</strong></div>}
                    {cliente.nome && <div>Att.: {cliente.nome}</div>}
                    {cliente.cnpj && <div>CNPJ: {cliente.cnpj}</div>}
                    {cliente.telefone && <div>Tel.: {cliente.telefone}</div>}
                    {cliente.email && <div>E-mail: {cliente.email}</div>}
                    {cliente.endereco && <div className={styles.pClienteEnd}>{cliente.endereco}</div>}
                    {!cliente.empresa && !cliente.nome && <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>— Preencha os dados do cliente —</div>}
                  </div>
                  </div>{/* /pClienteInfo */}
                </div>{/* /pCliente */}

                {/* Tabela itens */}
                <table className={styles.pTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}>#</th>
                      {itens.some(i => i.imagem_url) && <th style={{ width: 52 }} />}
                      <th>Descrição</th>
                      <th className={styles.pTdCenter}>Qtd</th>
                      <th className={styles.pTdCenter}>Un</th>
                      <th className={styles.pTdRight}>Vl. Unit.</th>
                      <th className={styles.pTdRight}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.filter(i => i.descricao.trim()).map((item, i) => {
                      const q = parseFloat(item.qtd.replace(',', '.')) || 0
                      const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
                      return (
                        <tr key={i}>
                          <td style={{ color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                          {itens.some(it => it.imagem_url) && (
                            <td style={{ padding: '4px 6px' }}>
                              {item.imagem_url
                                ? <img src={item.imagem_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'block' }} />
                                : <div style={{ width: 44, height: 44 }} />
                              }
                            </td>
                          )}
                          <td>{item.descricao}</td>
                          <td className={styles.pTdCenter}>{item.qtd}</td>
                          <td className={styles.pTdCenter}>{item.unidade}</td>
                          <td className={styles.pTdRight}>
                            {item.preco_original && (
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textDecoration: 'line-through', lineHeight: 1 }}>
                                {fmt(parseFloat(item.preco_original))}
                              </div>
                            )}
                            {v > 0 ? fmt(v) : '—'}
                          </td>
                          <td className={styles.pTdRight} style={{ fontWeight: 600 }}>{q > 0 && v > 0 ? fmt(q * v) : '—'}</td>
                        </tr>
                      )
                    })}
                    {itens.filter(i => i.descricao.trim()).length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>Adicione itens ao orçamento</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Totais */}
                <div className={styles.pTotais}>
                  <div className={styles.pTotaisRow}><span>Subtotal</span><span>{fmt(subtotal())}</span></div>
                  {valorDesc() > 0 && (
                    <div className={styles.pTotaisRow} style={{ color: '#dc2626' }}>
                      <span>Desconto ({tipoDesc === '%' ? `${desconto}%` : `R$ ${desconto}`})</span>
                      <span>−{fmt(valorDesc())}</span>
                    </div>
                  )}
                  <div className={`${styles.pTotaisRow} ${styles.pTotaisTotal}`}><span>TOTAL</span><span>{fmt(total())}</span></div>
                </div>

                {/* Condições */}
                {(condicao || prazoEntrega || validadeDias) && (
                  <div className={styles.pCondicoes}>
                    {condicao && <div className={styles.pCondicaoItem}>💳 <strong>Pagamento:</strong> {condicao}</div>}
                    {prazoEntrega && <div className={styles.pCondicaoItem}>🚚 <strong>Entrega:</strong> {prazoEntrega}</div>}
                    <div className={styles.pCondicaoItem}>📅 <strong>Validade:</strong> {validadeDias} dias (até {dataValidade})</div>
                    {empresaSel?.email && <div className={styles.pCondicaoItem}>✉️ <strong>Contato:</strong> {empresaSel.email}</div>}
                  </div>
                )}

                {observacoes && (
                  <div className={styles.pObs}>
                    <div className={styles.pObsTitle}>OBSERVAÇÕES</div>
                    <div style={{ whiteSpace: 'pre-line', fontSize: '0.72rem', color: '#475569', lineHeight: 1.6 }}>{observacoes}</div>
                  </div>
                )}

                <div className={styles.pAssinatura}>
                  <div className={styles.pAssinaturaBox}>
                    <div className={styles.pAssinaturaLinha} />
                    <span>{empresaSel?.nome_fantasia ?? 'Fornecedor'}</span>
                    {vendedorSel && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{vendedorSel.nome}</span>}
                  </div>
                  <div className={styles.pAssinaturaBox}>
                    <div className={styles.pAssinaturaLinha} />
                    <span>{cliente.empresa || cliente.nome || 'Cliente'}</span>
                  </div>
                </div>

                <div className={styles.pFooter}>
                  {[empresaSel?.email, empresaSel?.site, empresaSel?.telefone].filter(Boolean).join(' · ')}
                </div>
              </div>

              {anexos.length > 0 && (
                <div className={styles.previewAnexos}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ANEXOS ({anexos.length})</span>
                  {anexos.map(a => <a key={a.id ?? a.nome} href={a.url} target="_blank" rel="noreferrer" className={styles.anexoLink}>📎 {a.nome}</a>)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ EMPRESAS ═══ */}
      {vista === 'empresas' && (
        <div className={styles.empresasWrap}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{editEmpresaId ? 'Editar Empresa' : 'Nova Empresa Emissora'}</div>
            <div className={styles.row2}>
              <div className={styles.fg}><label>Nome fantasia *</label><input className={styles.input} value={formEmpresa.nome_fantasia ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, nome_fantasia: e.target.value }))} /></div>
              <div className={styles.fg}><label>Razão social</label><input className={styles.input} value={formEmpresa.razao_social ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, razao_social: e.target.value }))} /></div>
            </div>
            <div className={styles.row3}>
              <div className={styles.fg}><label>CNPJ</label><input className={styles.input} value={formEmpresa.cnpj ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, cnpj: e.target.value }))} /></div>
              <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={formEmpresa.telefone ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, telefone: e.target.value }))} /></div>
              <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={formEmpresa.email ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className={styles.row2}>
              <div className={styles.fg}><label>Endereço</label><input className={styles.input} value={formEmpresa.endereco ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, endereco: e.target.value }))} /></div>
              <div className={styles.fg}><label>Site</label><input className={styles.input} value={formEmpresa.site ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, site: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnPrimary} onClick={salvarEmpresa}>{editEmpresaId ? 'Atualizar' : 'Criar empresa'}</button>
              {editEmpresaId && <button className={styles.btnSecondary} onClick={() => { setFormEmpresa({}); setEditEmpresaId(null) }}>Cancelar</button>}
            </div>
          </div>
          <table className={styles.listaTable}>
            <thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Logo</th><th></th></tr></thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.nome_fantasia}</strong>{e.razao_social && e.razao_social !== e.nome_fantasia && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{e.razao_social}</div>}</td>
                  <td>{e.cnpj || '—'}</td>
                  <td><div>{e.telefone}</div><div style={{ fontSize: '0.74rem', color: '#64748b' }}>{e.email}</div></td>
                  <td>
                    {e.logo_url ? <img src={e.logo_url} alt="logo" style={{ height: 32, objectFit: 'contain' }} /> : <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>Sem logo</span>}
                    <input type="file" accept="image/*" id={`logo-${e.id}`} style={{ display: 'none' }} onChange={ev => ev.target.files?.[0] && uploadLogo(ev.target.files[0], e.id)} />
                    <label htmlFor={`logo-${e.id}`} style={{ marginLeft: 8, fontSize: '0.75rem', cursor: 'pointer', color: '#1a5fa8', fontWeight: 600 }}>
                      {uploadandoLogo ? '...' : '⬆ Upload logo'}
                    </label>
                  </td>
                  <td><button className={styles.btnAcao} onClick={() => { setEditEmpresaId(e.id); setFormEmpresa({ ...e }) }}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ VENDEDORES ═══ */}
      {vista === 'vendedores' && (
        <div className={styles.empresasWrap}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{editVendedorId ? 'Editar Vendedor' : 'Novo Vendedor'}</div>
            <div className={styles.row3}>
              <div className={styles.fg}><label>Nome *</label><input className={styles.input} value={formVendedor.nome ?? ''} onChange={e => setFormVendedor(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={formVendedor.email ?? ''} onChange={e => setFormVendedor(f => ({ ...f, email: e.target.value }))} /></div>
              <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={formVendedor.telefone ?? ''} onChange={e => setFormVendedor(f => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div className={styles.fg} style={{ maxWidth: 200 }}>
              <label>Comissão padrão (%)</label>
              <input className={styles.input} type="number" min="0" step="0.01" value={formVendedor.comissao_pct ?? ''} onChange={e => setFormVendedor(f => ({ ...f, comissao_pct: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnPrimary} onClick={salvarVendedor}>{editVendedorId ? 'Atualizar' : 'Cadastrar vendedor'}</button>
              {editVendedorId && <button className={styles.btnSecondary} onClick={() => { setFormVendedor({}); setEditVendedorId(null) }}>Cancelar</button>}
            </div>
          </div>
          <table className={styles.listaTable}>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Comissão</th><th></th></tr></thead>
            <tbody>
              {vendedores.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.nome}</strong></td>
                  <td>{v.email || '—'}</td>
                  <td>{v.telefone || '—'}</td>
                  <td>{v.comissao_pct > 0 ? `${v.comissao_pct}%` : '—'}</td>
                  <td><button className={styles.btnAcao} onClick={() => { setEditVendedorId(v.id); setFormVendedor({ ...v }) }}>✏️</button></td>
                </tr>
              ))}
              {vendedores.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>Nenhum vendedor cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
