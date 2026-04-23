import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'
import { useAdmin } from '../contexts/AdminContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmpresaEmissora {
  id: number; nome_fantasia: string; razao_social: string | null
  cnpj: string | null; cep: string | null; numero: string | null; endereco: string | null; telefone: string | null
  telefone_is_whatsapp: boolean | null
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
  produto_id: number | null; descricao: string; qtd: string; unidade: string; valorUnit: string; imagem_url?: string; preco_original?: string; obs_tecnica?: string
}

interface ClienteInfo {
  nome: string; empresa: string; cnpj: string; telefone: string; email: string
  tipo_pessoa: 'pf' | 'pj'
  perfil_comprador: '' | 'revendedor' | 'aplicador' | 'dono_obra' | 'especificador'
  whatsapp: string
  cargo: string
  cargo_outro: string
  inscricao_estadual: string
  // Endereço principal estruturado
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string
  // Endereço legado (somente leitura para registros antigos)
  endereco: string
  // Contatos adicionais
  email_nf: string
  contatos: { tipo: 'telefone' | 'whatsapp' | 'email'; valor: string }[]
  // Endereço de entrega
  ent_diferente: boolean
  ent_responsavel: string; ent_telefone: string; ent_whatsapp: string
  ent_cep: string; ent_logradouro: string; ent_numero: string; ent_complemento: string; ent_bairro: string; ent_cidade: string; ent_uf: string
}

interface Frete {
  tipo: '' | 'CIF' | 'FOB' | 'retirada' | 'cliente' | 'a_combinar'
  modalidade: 'cobrar' | 'bonus'
  valor: string
  prazo: string
  obs: string
}

interface Instalacao {
  inclui: boolean
  modalidade: 'cobrar' | 'bonus'
  texto: string
  valor: string
}

interface OrcLink {
  id: string; token: string; short_code: string | null; destinatario: string | null
  criado_em: string; primeiro_acesso: string | null; ultimo_acesso: string | null
  visualizacoes: number; downloads: number; ativo: boolean
}

interface ExibirProposta {
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

interface Anexo {
  id?: number; nome: string; url: string; tamanho?: number | null; tipo?: string | null
}

interface HistoricoItem {
  id: number; evento: string; descricao: string | null; criado_em: string; usuario: string | null
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
  logradouro?: string | null; numero?: string | null; bairro?: string | null
  cidade?: string | null; uf?: string | null; cep?: string | null
}

type Status = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'cancelado'
type Vista = 'lista' | 'editor' | 'empresas' | 'vendedores'

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIDADES = ['UN', 'CX', 'KG', 'M', 'M²', 'M³', 'L', 'PC', 'JG', 'PAR', 'RL', 'SC', 'H', 'DZ', 'GL']

const FRETE_TIPOS: Record<string, string> = {
  '': 'Sem frete',
  'CIF': 'CIF — Por conta do fornecedor',
  'FOB': 'FOB — Por conta do comprador',
  'retirada': 'Retirada na fábrica',
  'cliente': 'Por conta do cliente',
  'a_combinar': 'A combinar',
}

const EXIBIR_DEFAULT: ExibirProposta = {
  cnpj: false, inscricaoEstadual: false, telefone: true, whatsapp: false,
  email: false, emailNf: false, contatosAdicionais: false,
  cargo: false, endereco: false, enderecoEntrega: false, entResponsavel: false,
  obsTecnicaItens: false, instMontagem: false, anexos: false, detalhesLogistica: false,
}

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

const CARGOS = [
  'Comprador(a)', 'Diretor(a)', 'Engenheiro(a)', 'Gerente', 'Proprietário(a)',
  'Responsável Técnico', 'Financeiro', 'Administrativo', 'Arquiteto(a)', 'Outro',
]

const ITEM_VAZIO: Item = { produto_id: null, descricao: '', qtd: '1', unidade: 'UN', valorUnit: '', obs_tecnica: '' }
const CLIENTE_VAZIO: ClienteInfo = {
  nome: '', empresa: '', cnpj: '', telefone: '', email: '', endereco: '',
  tipo_pessoa: 'pj', perfil_comprador: '', whatsapp: '', cargo: '', cargo_outro: '', inscricao_estadual: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  email_nf: '', contatos: [],
  ent_diferente: false,
  ent_responsavel: '', ent_telefone: '', ent_whatsapp: '',
  ent_cep: '', ent_logradouro: '', ent_numero: '', ent_complemento: '', ent_bairro: '', ent_cidade: '', ent_uf: '',
}
const FRETE_VAZIO: Frete = { tipo: '', modalidade: 'cobrar', valor: '', prazo: '', obs: '' }
const INST_VAZIO: Instalacao = { inclui: false, modalidade: 'cobrar', texto: '', valor: '' }
const OBS_DEFAULT = `• Orçamento válido conforme data de validade indicada.\n• Preços sujeitos a alteração sem aviso prévio.\n• Prazo de entrega a partir da confirmação do pedido e aprovação do pagamento.`

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hoje() { return new Date().toLocaleDateString('pt-BR') }
function fmtDataISO(iso: string) { return new Date(iso).toLocaleDateString('pt-BR') }
function fmtEvento(iso: string) { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4')
    .replace(/^(\d{2})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/^(\d{2})(\d{3})/, '$1.$2')
}
function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    .replace(/^(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/^(\d{3})(\d{3})/, '$1.$2')
    .replace(/^(\d{3})/, '$1')
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/\($/, '(').replace(/-$/, '')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}
function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '')
}

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
  const [condicoes, setCondicoes]   = useState<string[]>([])
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [dadosPagamento, setDadosPagamento] = useState('')
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
  const [previewMode, setPreviewMode] = useState<'pdf' | 'mobile'>('pdf')
  const [verTodoHistorico, setVerTodoHistorico] = useState(false)
  const [empresaSnapshot, setEmpresaSnapshot] = useState<Record<string, unknown> | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [gerandoRec, setGerandoRec] = useState(false)
  const [msg, setMsg]               = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [frete, setFrete]           = useState<Frete>(FRETE_VAZIO)
  const [instalacao, setInstalacao] = useState<Instalacao>(INST_VAZIO)
  const [obsInternas, setObsInternas] = useState('')
  const [origemLead, setOrigemLead] = useState('')
  const [exibir, setExibir]         = useState<ExibirProposta>(EXIBIR_DEFAULT)
  const [showControles, setShowControles] = useState(false)
  const [links, setLinks]             = useState<OrcLink[]>([])
  const [gerandoLink, setGerandoLink] = useState(false)
  const [novoLinkDest, setNovoLinkDest] = useState('')
  const [acessosLink, setAcessosLink] = useState<Record<string, any[]>>({})
  const [expandedLink, setExpandedLink] = useState<string | null>(null)
  const [watermarkLogo, setWatermarkLogo] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const anexoRef  = useRef<HTMLInputElement>(null)

  const empresaSel  = empresas.find(e => e.id === empresaId) ?? null

  const empresaDesatualizada = !!editandoId && !!empresaSel && !!empresaSnapshot && (() => {
    const campos: Array<keyof EmpresaEmissora> = ['nome_fantasia','razao_social','cnpj','numero','endereco','telefone','email','site','logo_url','telefone_is_whatsapp']
    return campos.some(k => String(empresaSel[k] ?? '') !== String((empresaSnapshot[k] as unknown) ?? ''))
  })()

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
  function valorFrete() {
    const v = parseFloat(frete.valor.replace(',', '.')) || 0
    return frete.modalidade === 'cobrar' ? v : 0
  }
  function valorFreteBruto() { return parseFloat(frete.valor.replace(',', '.')) || 0 }
  function valorInst() {
    if (!instalacao.inclui) return 0
    const v = parseFloat(instalacao.valor.replace(',', '.')) || 0
    return instalacao.modalidade === 'cobrar' ? v : 0
  }
  function valorInstBruto() { return instalacao.inclui ? (parseFloat(instalacao.valor.replace(',', '.')) || 0) : 0 }
  function total() { return subtotal() - valorDesc() + valorFrete() + valorInst() }


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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      supabaseAdmin.from('admin_perfis').select('nome, permissoes').eq('user_id', session.user.id).single().then(({ data }) => {
        if (data) {
          setNomeUsuario((data as any).nome || session.user.email || '')
          setIsAdminUser(((data as any).permissoes ?? []).includes('usuarios'))
        }
      })
    })
  }, [])

  useEffect(() => {
    if (!fromProjeto?.projeto) return
    const p = fromProjeto.projeto
    setCliente({ ...CLIENTE_VAZIO, empresa: p.cliente_nome ?? '', cnpj: p.cliente_cnpj ?? '', tipo_pessoa: 'pj' })
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
      const { data: pros } = await supabaseAdmin
        .from('prospeccao')
        .select('cnpj, razao_social, telefone1, email, endereco, bairro, cidade, uf, cep, cliente_ativo')
        .ilike('razao_social', termo).limit(10)
      setResultadosCliente(
        ((pros ?? []) as any[]).map(p => ({
          cnpj: p.cnpj, nome: p.razao_social ?? '',
          telefone: p.telefone1 ?? null, email: p.email ?? null,
          fonte: p.cliente_ativo ? ('cliente' as const) : ('prospect' as const),
          logradouro: p.endereco ?? null, bairro: p.bairro ?? null,
          cidade: p.cidade ?? null, uf: p.uf ?? null, cep: p.cep ?? null,
        }))
      )
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
    const { data: numData } = await supabaseAdmin.rpc('next_orcamento_numero')
    const novoNumero = (numData as string) ?? `${new Date().getFullYear()}/001`
    // Reset all state first
    setEditandoId(null); setNumero(novoNumero); setStatus('rascunho'); setFinLancId(null)
    setCliente(CLIENTE_VAZIO); setItens([{ ...ITEM_VAZIO }])
    setDesconto(''); setTipoDesc('%'); setCondicoes([]); setPrazoEntrega(''); setDadosPagamento('')
    setValidadeDias('7'); setObservacoes(OBS_DEFAULT)
    setWatermarkAtivo(false); setWatermarkTexto('CONFIDENCIAL'); setWatermarkLogo(false)
    setImagemUrl(''); setAnexos([]); setHistorico([]); setLinks([])
    setBuscaCliente(''); setFrete(FRETE_VAZIO); setInstalacao(INST_VAZIO)
    setObsInternas(''); setOrigemLead(''); setExibir(EXIBIR_DEFAULT)
    // Create in DB immediately
    const emp = empresas.find(e => e.id === empresaId)
    const { data: created, error } = await supabaseAdmin.from('orcamentos').insert({
      numero: novoNumero, status: 'rascunho',
      empresa_id: empresaId ?? null,
      empresa_nome: emp?.nome_fantasia ?? null, empresa_razao_social: emp?.razao_social ?? null,
      empresa_cnpj: emp?.cnpj ?? null, empresa_numero: emp?.numero ?? null, empresa_endereco: emp?.endereco ?? null,
      empresa_telefone: emp?.telefone ?? null, empresa_email: emp?.email ?? null,
      empresa_site: emp?.site ?? null, empresa_logo_url: emp?.logo_url ?? null, empresa_telefone_is_whatsapp: emp?.telefone_is_whatsapp ?? null,
      desconto: 0, tipo_desconto: '%', subtotal: 0, total: 0, validade_dias: 7,
      observacoes: OBS_DEFAULT, watermark_ativo: false, watermark_texto: 'CONFIDENCIAL', watermark_logo: false,
    }).select('id').single()
    if (!error && created) {
      const newId = (created as any).id
      setEditandoId(newId)
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: newId, evento: 'criado', descricao: null, usuario: nomeUsuario || null })
      setHistorico([{ id: 0, evento: 'criado', descricao: null, usuario: nomeUsuario || null, criado_em: new Date().toISOString() }])
    }
    setVista('editor')
    carregarLista()
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
    setCliente({
      nome: o.cliente_nome ?? '', empresa: o.cliente_empresa ?? '',
      cnpj: (o.cliente_tipo_pessoa === 'pf' ? maskCPF : maskCNPJ)(o.cliente_cnpj ?? ''),
      telefone: o.cliente_telefone ?? '',
      email: o.cliente_email ?? '', endereco: o.cliente_endereco ?? '',
      tipo_pessoa: o.cliente_tipo_pessoa ?? 'pj',
      perfil_comprador: o.perfil_comprador ?? '',
      whatsapp: o.cliente_whatsapp ?? '', cargo: o.cliente_cargo ?? '',
      cargo_outro: '', inscricao_estadual: o.cliente_inscricao_est ?? '',
      cep: o.cliente_cep ?? '', logradouro: o.cliente_logradouro ?? '',
      numero: o.cliente_numero ?? '', complemento: o.cliente_complemento ?? '',
      bairro: o.cliente_bairro ?? '', cidade: o.cliente_cidade ?? '', uf: o.cliente_uf ?? '',
      email_nf: o.cliente_email_nf ?? '',
      contatos: (() => { try { return Array.isArray(o.cliente_contatos) ? o.cliente_contatos : [] } catch { return [] } })(),
      ent_diferente: !!(o.cliente_ent_logradouro || o.cliente_ent_cep || o.cliente_ent_responsavel),
      ent_responsavel: o.cliente_ent_responsavel ?? '', ent_telefone: o.cliente_ent_telefone ?? '', ent_whatsapp: o.cliente_ent_whatsapp ?? '',
      ent_cep: o.cliente_ent_cep ?? '', ent_logradouro: o.cliente_ent_logradouro ?? '',
      ent_numero: o.cliente_ent_numero ?? '', ent_complemento: o.cliente_ent_complemento ?? '',
      ent_bairro: o.cliente_ent_bairro ?? '', ent_cidade: o.cliente_ent_cidade ?? '', ent_uf: o.cliente_ent_uf ?? '',
    })
    setItens((itensD ?? []).length > 0
      ? (itensD as any[]).map(i => ({
          produto_id: i.produto_id, descricao: i.descricao, qtd: String(i.qtd),
          unidade: i.unidade, valorUnit: String(i.valor_unit),
          imagem_url: i.imagem_url ?? undefined,
          preco_original: i.preco_original ? String(i.preco_original) : undefined,
          obs_tecnica: i.obs_tecnica ?? '',
        }))
      : [{ ...ITEM_VAZIO }])
    setDesconto(o.desconto > 0 ? String(o.desconto) : ''); setTipoDesc(o.tipo_desconto ?? '%')
    const rawCond = o.condicao_pagamento ?? ''
    try { setCondicoes(rawCond ? JSON.parse(rawCond) : []) } catch { setCondicoes(rawCond ? [rawCond] : []) }
    setPrazoEntrega(o.prazo_entrega ?? '')
    setDadosPagamento((o as any).dados_pagamento ?? '')
    setValidadeDias(String(o.validade_dias ?? 7)); setObservacoes(o.observacoes ?? OBS_DEFAULT)
    setWatermarkAtivo(o.watermark_ativo ?? false); setWatermarkTexto(o.watermark_texto ?? 'CONFIDENCIAL')
    setImagemUrl(o.imagem_url ?? '')
    setFrete({ tipo: o.frete_tipo ?? '', modalidade: o.frete_modalidade ?? 'cobrar', valor: o.frete_valor ? String(o.frete_valor) : '', prazo: o.frete_prazo ?? '', obs: o.frete_obs ?? '' })
    setInstalacao({ inclui: o.inst_inclui ?? false, modalidade: o.inst_modalidade ?? 'cobrar', texto: o.inst_texto ?? '', valor: o.inst_valor ? String(o.inst_valor) : '' })
    setObsInternas(o.obs_internas ?? '')
    setOrigemLead(o.origem_lead ?? '')
    setExibir({ ...EXIBIR_DEFAULT, ...(o.exibir_config ?? {}) })
    setWatermarkLogo(o.watermark_logo ?? false)
    setAnexos((anexosD ?? []) as Anexo[]); setHistorico((histD ?? []) as HistoricoItem[])
    setEmpresaSnapshot({
      nome_fantasia: o.empresa_nome ?? null,
      razao_social: o.empresa_razao_social ?? null,
      cnpj: o.empresa_cnpj ?? null,
      numero: o.empresa_numero ?? null,
      endereco: o.empresa_endereco ?? null,
      telefone: o.empresa_telefone ?? null,
      email: o.empresa_email ?? null,
      site: o.empresa_site ?? null,
      logo_url: o.empresa_logo_url ?? null,
      telefone_is_whatsapp: o.empresa_telefone_is_whatsapp ?? null,
    })
    await carregarLinks(id)
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
      empresa_nome: emp?.nome_fantasia ?? null, empresa_razao_social: emp?.razao_social ?? null,
      empresa_cnpj: emp?.cnpj ?? null, empresa_numero: emp?.numero ?? null, empresa_endereco: emp?.endereco ?? null,
      empresa_telefone: emp?.telefone ?? null, empresa_email: emp?.email ?? null,
      empresa_site: emp?.site ?? null, empresa_logo_url: emp?.logo_url ?? null, empresa_telefone_is_whatsapp: emp?.telefone_is_whatsapp ?? null,
      vendedor_id: vendedorId ?? null, vendedor_nome: vend?.nome ?? null, vendedor_telefone: vend?.telefone ?? null,
      cliente_nome: cliente.nome || null, cliente_empresa: cliente.empresa || null,
      cliente_cnpj: cliente.cnpj || null, cliente_telefone: cliente.telefone || null,
      cliente_email: cliente.email || null, cliente_endereco: cliente.endereco || null,
      cliente_tipo_pessoa: cliente.tipo_pessoa,
      perfil_comprador: cliente.perfil_comprador || null,
      cliente_whatsapp: cliente.whatsapp || null,
      cliente_cargo: cliente.cargo === 'Outro' ? (cliente.cargo_outro || 'Outro') : (cliente.cargo || null),
      cliente_inscricao_est: cliente.inscricao_estadual || null,
      cliente_cep: cliente.cep || null,
      cliente_logradouro: cliente.logradouro || null,
      cliente_numero: cliente.numero || null,
      cliente_complemento: cliente.complemento || null,
      cliente_bairro: cliente.bairro || null,
      cliente_cidade: cliente.cidade || null,
      cliente_uf: cliente.uf || null,
      cliente_endereco_ent: cliente.ent_diferente ? [cliente.ent_logradouro, cliente.ent_numero, cliente.ent_complemento, cliente.ent_bairro, cliente.ent_cidade].filter(Boolean).join(', ') : null,
      cliente_email_nf: cliente.email_nf || null,
      cliente_contatos: cliente.contatos.length > 0 ? cliente.contatos : null,
      cliente_ent_responsavel: cliente.ent_diferente ? (cliente.ent_responsavel || null) : null,
      cliente_ent_telefone: cliente.ent_diferente ? (cliente.ent_telefone || null) : null,
      cliente_ent_whatsapp: cliente.ent_diferente ? (cliente.ent_whatsapp || null) : null,
      cliente_ent_cep: cliente.ent_diferente ? (cliente.ent_cep || null) : null,
      cliente_ent_logradouro: cliente.ent_diferente ? (cliente.ent_logradouro || null) : null,
      cliente_ent_numero: cliente.ent_diferente ? (cliente.ent_numero || null) : null,
      cliente_ent_complemento: cliente.ent_diferente ? (cliente.ent_complemento || null) : null,
      cliente_ent_bairro: cliente.ent_diferente ? (cliente.ent_bairro || null) : null,
      cliente_ent_cidade: cliente.ent_diferente ? (cliente.ent_cidade || null) : null,
      cliente_ent_uf: cliente.ent_diferente ? (cliente.ent_uf || null) : null,
      frete_tipo: frete.tipo || null,
      frete_modalidade: frete.modalidade,
      frete_valor: parseFloat(frete.valor.replace(',', '.')) || 0,
      frete_prazo: frete.prazo || null,
      frete_obs: frete.obs || null,
      inst_inclui: instalacao.inclui,
      inst_modalidade: instalacao.modalidade,
      inst_texto: instalacao.texto || null,
      inst_valor: parseFloat(instalacao.valor.replace(',', '.')) || 0,
      watermark_logo: watermarkLogo,
      obs_internas: obsInternas || null,
      origem_lead: origemLead || null,
      exibir_config: exibir,
      desconto: parseFloat(desconto.replace(',', '.')) || 0, tipo_desconto: tipoDesc,
      subtotal: subtotal(), total: total(),
      condicao_pagamento: condicoes.length ? JSON.stringify(condicoes) : null, prazo_entrega: prazoEntrega || null, dados_pagamento: dadosPagamento || null,
      validade_dias: parseInt(validadeDias) || 7, observacoes: observacoes || null,
      watermark_ativo: watermarkAtivo, watermark_texto: watermarkTexto,
      imagem_url: imagemUrl || null,
    }
    let orcId = editandoId
    if (editandoId) {
      const { error: errUpd } = await supabaseAdmin.from('orcamentos').update(payload).eq('id', editandoId)
      if (errUpd) { showMsg('erro', 'Erro ao atualizar orçamento: ' + errUpd.message); setSalvando(false); return }
      const { error: errDel } = await supabaseAdmin.from('itens_orcamento').delete().eq('orcamento_id', editandoId)
      if (errDel) { showMsg('erro', 'Erro ao limpar itens: ' + errDel.message); setSalvando(false); return }
    } else {
      const { data, error: errIns } = await supabaseAdmin.from('orcamentos').insert(payload).select('id').single()
      if (errIns) { showMsg('erro', 'Erro ao criar orçamento: ' + errIns.message); setSalvando(false); return }
      orcId = (data as any)?.id ?? null
      setEditandoId(orcId)
    }
    if (orcId) {
      const itensPayload = itens.filter(i => i.descricao.trim()).map((i, idx) => ({
        orcamento_id: orcId, produto_id: typeof i.produto_id === 'number' ? i.produto_id : null, descricao: i.descricao,
        qtd: parseFloat(i.qtd.replace(',', '.')) || 1, unidade: i.unidade,
        valor_unit: parseFloat(i.valorUnit.replace(',', '.')) || 0,
        total: (parseFloat(i.qtd.replace(',', '.')) || 1) * (parseFloat(i.valorUnit.replace(',', '.')) || 0),
        imagem_url: i.imagem_url ?? null,
        preco_original: i.preco_original ? parseFloat(i.preco_original) : null,
        obs_tecnica: i.obs_tecnica || null,
        ordem: idx,
      }))
      if (itensPayload.length) {
        const { error: errItens } = await supabaseAdmin.from('itens_orcamento').insert(itensPayload)
        if (errItens) { showMsg('erro', 'Erro ao salvar itens: ' + errItens.message); setSalvando(false); return }
      }
      const evento = !editandoId ? 'criado' : novoStatus ? 'status_alterado' : 'editado'
      const descEvento = novoStatus ? `Status → ${STATUS_CFG[novoStatus].label}` : null
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: orcId, evento, descricao: descEvento, usuario: nomeUsuario || null })
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', orcId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
    }
    if (novoStatus) setStatus(novoStatus)
    setEmpresaSnapshot(empresaSel ? {
      nome_fantasia: empresaSel.nome_fantasia, razao_social: empresaSel.razao_social,
      cnpj: empresaSel.cnpj, numero: empresaSel.numero, endereco: empresaSel.endereco,
      telefone: empresaSel.telefone, email: empresaSel.email, site: empresaSel.site,
      logo_url: empresaSel.logo_url, telefone_is_whatsapp: empresaSel.telefone_is_whatsapp,
    } : null)
    setSalvando(false)
    showMsg('ok', editandoId ? 'Salvo.' : 'Orçamento criado.')
    carregarLista()
    // Integração automática: Pipeline + Clientes
    if (orcId != null) integrarPosSalvar(orcId)
  }

  async function integrarPosSalvar(orcId: number) {
    const cnpjLimpo = cliente.cnpj.replace(/\D/g, '')
    const valorTotal = total()

    // 0b. Prospect — atualiza status para "Orçamento enviado"
    if (cnpjLimpo.length === 14) {
      await supabaseAdmin.from('prospeccao')
        .update({ status_contato: 'Orçamento enviado', contatado: true })
        .eq('cnpj', cnpjLimpo)
    }

    // 1. Pipeline — cria deal em "proposta" se não existir para este orçamento
    if (cnpjLimpo || cliente.empresa) {
      const { data: existente } = await supabaseAdmin
        .from('pipeline_deals').select('id').eq('orcamento_id', orcId).maybeSingle()
      if (!existente) {
        await supabaseAdmin.from('pipeline_deals').insert({
          titulo: cliente.empresa || cliente.nome || 'Proposta',
          empresa_cnpj: cnpjLimpo || null,
          estagio: 'proposta',
          valor_estimado: valorTotal || null,
          orcamento_id: orcId,
        })
      } else {
        // Atualiza valor se orçamento foi editado
        await supabaseAdmin.from('pipeline_deals')
          .update({ valor_estimado: valorTotal || null })
          .eq('orcamento_id', orcId)
      }
    }

    // 2. Clientes — upsert pelo CNPJ (só campos que existem na tabela)
    if (cnpjLimpo.length === 14) {
      await supabaseAdmin.from('clientes').upsert({
        cnpj: cnpjLimpo,
        razao_social: cliente.empresa || null,
      }, { onConflict: 'cnpj', ignoreDuplicates: true })
    }
  }

  async function imprimir() {
    if (!editandoId) return
    await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'impresso', descricao: null, usuario: nomeUsuario || null })
    const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
    setHistorico((hd ?? []) as HistoricoItem[])
    window.open(`/print/orcamento/${editandoId}`, '_blank')
  }

  async function gerarReceivel() {
    if (!editandoId) return
    setGerandoRec(true)
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: lanc } = await supabaseAdmin.from('fin_lancamentos').insert({
      descricao: `Orçamento ${numero} — ${cliente.empresa || cliente.nome || 'Cliente'}`,
      tipo: 'receita', valor: total(), status: 'pendente',
      data_competencia: hoje,
      data_vencimento: new Date(Date.now() + (parseInt(validadeDias) || 7) * 864e5).toISOString().slice(0, 10),
      origem: 'manual',
    }).select('id').single()
    if (lanc) {
      const lid = (lanc as any).id
      await supabaseAdmin.from('orcamentos').update({ fin_lancamento_id: lid }).eq('id', editandoId)
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'receivel_gerado', descricao: `Lançamento #${lid}`, usuario: nomeUsuario || null })
      setFinLancId(lid)
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
      showMsg('ok', 'Recebível criado no Financeiro.')
    }
    setGerandoRec(false)
  }

  async function uploadLogo(file: File, empId: number, input: HTMLInputElement) {
    setUploadandoLogo(true)
    const ext = file.name.split('.').pop()
    const path = `empresa-${empId}.${ext}`
    const { error } = await supabaseAdmin.storage.from('orcamentos-logo').upload(path, file, { upsert: true })
    if (error) { showMsg('erro', `Erro no upload: ${error.message}`); setUploadandoLogo(false); return }
    const { data: url } = supabaseAdmin.storage.from('orcamentos-logo').getPublicUrl(path)
    // cache-bust para forçar atualização da imagem
    const publicUrl = `${url.publicUrl}?t=${Date.now()}`
    await supabaseAdmin.from('empresas_emissoras').update({ logo_url: publicUrl }).eq('id', empId)
    setEmpresas(prev => prev.map(e => e.id === empId ? { ...e, logo_url: publicUrl } : e))
    input.value = '' // reset para permitir selecionar o mesmo arquivo novamente
    showMsg('ok', 'Logo atualizada!')
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
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'anexo_adicionado', descricao: file.name, usuario: nomeUsuario || null })
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

  async function buscarCEP(cep: string, destino: 'principal' | 'entrega') {
    const raw = cep.replace(/\D/g, '')
    if (raw.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const d = await res.json()
      if (d.erro) return
      if (destino === 'principal') {
        setCliente(c => ({ ...c, logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.localidade ?? '', uf: d.uf ?? '' }))
      } else {
        setCliente(c => ({ ...c, ent_logradouro: d.logradouro ?? '', ent_bairro: d.bairro ?? '', ent_cidade: d.localidade ?? '', ent_uf: d.uf ?? '' }))
      }
    } catch { /* silently ignore */ }
  }

  async function carregarLinks(orcId: number) {
    const { data } = await supabaseAdmin.from('orcamento_links').select('id, token, short_code, destinatario, criado_em, primeiro_acesso, ultimo_acesso, visualizacoes, downloads, ativo').eq('orcamento_id', orcId).order('criado_em', { ascending: false })
    setLinks((data ?? []) as OrcLink[])
  }

  async function toggleAcessos(linkId: string) {
    if (expandedLink === linkId) { setExpandedLink(null); return }
    setExpandedLink(linkId)
    if (acessosLink[linkId]) return
    const { data } = await supabaseAdmin
      .from('orcamento_link_acessos')
      .select('acessado_em, ip, user_agent')
      .eq('link_id', linkId)
      .order('acessado_em', { ascending: false })
    setAcessosLink(prev => ({ ...prev, [linkId]: data ?? [] }))
  }

  function gerarShortCode(len = 7) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function gerarLink() {
    if (!editandoId) return
    setGerandoLink(true)
    const short_code = gerarShortCode()
    const { data } = await supabaseAdmin.from('orcamento_links').insert({
      orcamento_id: editandoId,
      destinatario: novoLinkDest.trim() || null,
      short_code,
    }).select('*').single()
    if (data) {
      setLinks(prev => [data as OrcLink, ...prev])
      setNovoLinkDest('')
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'link_gerado', descricao: novoLinkDest.trim() || 'Link gerado', usuario: nomeUsuario || null })
    }
    setGerandoLink(false)
  }

  async function desativarLink(linkId: string) {
    await supabaseAdmin.from('orcamento_links').update({ ativo: false }).eq('id', linkId)
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, ativo: false } : l))
  }

  function linkUrl(l: OrcLink) {
    return l.short_code
      ? `${window.location.origin}/p/${l.short_code}`
      : `${window.location.origin}/view/orcamento/${l.token}`
  }

  async function excluirOrcamento(id: number) {
    const { error } = await supabaseAdmin.from('orcamentos').delete().eq('id', id)
    if (error) { showMsg('erro', 'Erro ao excluir: ' + error.message); return }
    showMsg('ok', 'Orçamento excluído.')
    setConfirmExcluir(false)
    if (vista === 'editor') setVista('lista')
    carregarLista()
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
    if (editVendedorId) { const { id: _id, ...payload } = formVendedor as Vendedor; await supabaseAdmin.from('vendedores').update(payload).eq('id', editVendedorId) }
    else { await supabaseAdmin.from('vendedores').insert({ ...formVendedor, ativo: true }) }
    setFormVendedor({}); setEditVendedorId(null); carregarVendedores()
  }

  function showMsg(tipo: 'ok' | 'erro', texto: string) {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000)
  }
  function selecionarCliente(r: ClienteResult) {
    setBuscaCliente(''); setShowDropCliente(false)
    setCliente({
      ...CLIENTE_VAZIO,
      empresa: r.nome,
      cnpj: maskCNPJ(r.cnpj),
      telefone: r.telefone ? maskPhone(r.telefone) : '',
      email: r.email ?? '',
      logradouro: r.logradouro ?? '',
      bairro: r.bairro ?? '',
      cidade: r.cidade ?? '',
      uf: r.uf ?? '',
      cep: r.cep ? maskCEP(r.cep) : '',
    })
  }
  function adicionarProduto(p: ProdutoResult) {
    setItens(prev => {
      const idx = prev.findIndex(i => i.produto_id === p.id)
      if (idx >= 0) {
        const novo = [...prev]
        novo[idx] = { ...novo[idx], qtd: String((parseFloat(novo[idx].qtd.replace(',', '.')) || 1) + 1) }
        return novo
      }
      return [...prev, { produto_id: p.id, descricao: p.nome_padronizado, qtd: '1', unidade: p.unidade ?? 'UN', valorUnit: '', obs_tecnica: '' }]
    })
    setBuscaProduto(''); setResultadosProduto([]); setShowBuscaProduto(false)
  }
  function adicionarOutlet(p: OutletResult) {
    setItens(prev => {
      const idx = prev.findIndex(i => i.produto_id === p.id)
      if (idx >= 0) {
        const novo = [...prev]
        novo[idx] = { ...novo[idx], qtd: String((parseFloat(novo[idx].qtd.replace(',', '.')) || 1) + 1) }
        return novo
      }
      return [...prev, {
        produto_id: p.id, descricao: p.titulo, qtd: '1', unidade: 'UN',
        valorUnit: String(p.preco),
        preco_original: p.preco_original && p.preco_original > p.preco ? String(p.preco_original) : undefined,
        imagem_url: p.fotos?.[0] ?? undefined, obs_tecnica: '',
      }]
    })
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

      <div className={styles.navHeader}>
      <div className={styles.navTabs}>
        <button className={`${styles.navTab} ${vista === 'lista' ? styles.navTabAtivo : ''}`} onClick={() => setVista('lista')}>📋 Orçamentos</button>
        {vista === 'editor' && (
          <button className={`${styles.navTab} ${styles.navTabAtivo}`}>✏️ {editandoId ? numero : 'Novo'}</button>
        )}
        <button className={`${styles.navTab} ${vista === 'empresas' ? styles.navTabAtivo : ''}`} onClick={() => setVista('empresas')}>🏢 Empresas</button>
        <button className={`${styles.navTab} ${vista === 'vendedores' ? styles.navTabAtivo : ''}`} onClick={() => setVista('vendedores')}>👤 Consultores</button>
      </div>
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
            <>
              {/* Cards — mobile */}
              <div className={styles.listaCards}>
                {lista.map(o => {
                  const cfg = STATUS_CFG[o.status as Status]
                  return (
                    <div key={o.id} className={styles.listaCard}>
                      <div className={styles.listaCardTopo}>
                        <div>
                          <div className={styles.listaCardNum}>{o.numero}</div>
                          <div className={styles.listaCardEmpresa}>{o.cliente_empresa || o.cliente_nome || '—'}</div>
                          <div className={styles.listaCardCliente}>{o.empresa_nome ?? ''} · {o.vendedor_nome ?? ''}</div>
                        </div>
                        <span className={styles.statusBadge} style={{ background: cfg?.cor + '22', color: cfg?.cor }}>{cfg?.label}</span>
                      </div>
                      <div className={styles.listaCardMeta}>
                        <span className={styles.listaCardTotal}>{ocultarValores ? '••••' : fmtBRL(Number(o.total))}</span>
                        <span className={styles.listaCardData}>{fmtDataISO(o.criado_em)}</span>
                        <div className={styles.listaCardAcoes}>
                          <button className={styles.btnAcao} onClick={() => carregarOrcamento(o.id)}>✏️ Editar</button>
                          {isAdminUser && (
                            <button className={styles.btnAcao} style={{ color: '#dc2626', borderColor: '#fecaca' }}
                              onClick={() => { if (window.confirm(`Excluir orçamento ${o.numero}?`)) excluirOrcamento(o.id) }}>🗑</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Tabela — tablet/desktop */}
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
                      <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className={styles.btnAcao} onClick={() => carregarOrcamento(o.id)}>✏️ Editar</button>
                        {isAdminUser && (
                          <button className={styles.btnAcao} style={{ color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => { if (window.confirm(`Excluir orçamento ${o.numero}? Esta ação não pode ser desfeita.`)) excluirOrcamento(o.id) }}>
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ EDITOR ═══ */}
      {vista === 'editor' && (
        <>
          {empresaDesatualizada && (
            <div style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#92400e' }}>
              <span>⚠️ Os dados da empresa emissora no PDF estão desatualizados em relação ao cadastro.</span>
              <button onClick={() => salvar()} disabled={salvando} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.80rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {salvando ? '...' : '↻ Atualizar'}
              </button>
            </div>
          )}
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
              {isAdminUser && editandoId && (
                confirmExcluir
                  ? <><span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Confirmar exclusão?</span>
                      <button style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }} onClick={() => excluirOrcamento(editandoId)}>Sim, excluir</button>
                      <button style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }} onClick={() => setConfirmExcluir(false)}>Cancelar</button>
                    </>
                  : <button style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem' }} onClick={() => setConfirmExcluir(true)}>🗑 Excluir</button>
              )}
            </div>
          </div>

          <div className={styles.layout}>
            <div className={styles.formCol}>

              {/* Destinatário */}
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
                  <div className={styles.fg}>
                    <label>Tipo</label>
                    <select className={styles.input} value={cliente.tipo_pessoa} onChange={e => setCliente(c => ({ ...c, tipo_pessoa: e.target.value as 'pf' | 'pj', cnpj: '' }))}>
                      <option value="pj">Pessoa Jurídica</option>
                      <option value="pf">Pessoa Física</option>
                    </select>
                  </div>
                  <div className={styles.fg}>
                    <label>Perfil do comprador</label>
                    <select className={styles.input} value={cliente.perfil_comprador} onChange={e => setCliente(c => ({ ...c, perfil_comprador: e.target.value as ClienteInfo['perfil_comprador'] }))}>
                      <option value="">— Não informado —</option>
                      <option value="revendedor">Revendedor / Distribuidor</option>
                      <option value="aplicador">Aplicador / Instalador</option>
                      <option value="dono_obra">Dono de Obra / Uso Próprio</option>
                      <option value="especificador">Especificador (Arq. / Eng.)</option>
                    </select>
                  </div>
                  <div className={styles.fg}><label>{cliente.tipo_pessoa === 'pf' ? 'Nome completo *' : 'Empresa *'}</label><input className={styles.input} value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))} placeholder={cliente.tipo_pessoa === 'pf' ? 'Nome completo' : 'Razão social'} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>A/C. (Responsável)</label><input className={styles.input} value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} placeholder="Nome do contato" /></div>
                  <div className={styles.fg}>
                    <label>Cargo</label>
                    <select className={styles.input} value={cliente.cargo} onChange={e => setCliente(c => ({ ...c, cargo: e.target.value }))}>
                      <option value="">— Selecionar —</option>
                      {CARGOS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {cliente.cargo === 'Outro' && (
                      <input className={styles.input} style={{ marginTop: 4 }} placeholder="Especificar cargo" value={cliente.cargo_outro} onChange={e => setCliente(c => ({ ...c, cargo_outro: e.target.value }))} />
                    )}
                  </div>
                </div>
                <div className={styles.row3}>
                  <div className={styles.fg}>
                    <label>{cliente.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}</label>
                    <input className={styles.input} value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: c.tipo_pessoa === 'pj' ? maskCNPJ(e.target.value) : maskCPF(e.target.value) }))} placeholder={cliente.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} maxLength={cliente.tipo_pessoa === 'pj' ? 18 : 14} />
                  </div>
                  <div className={styles.fg}><label>Insc. Estadual</label><input className={styles.input} value={cliente.inscricao_estadual} onChange={e => setCliente(c => ({ ...c, inscricao_estadual: e.target.value }))} /></div>
                  <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={cliente.telefone} onChange={e => setCliente(c => ({ ...c, telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.whatsapp} onChange={e => setCliente(c => ({ ...c, whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
                  <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={cliente.email} onChange={e => setCliente(c => ({ ...c, email: e.target.value }))} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>E-mail para NFs / Boletos</label><input className={styles.input} value={cliente.email_nf} onChange={e => setCliente(c => ({ ...c, email_nf: e.target.value }))} placeholder="financeiro@empresa.com.br" /></div>
                </div>

                {/* Contatos adicionais */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contatos adicionais</div>
                  {cliente.contatos.map((ct, ci) => (
                    <div key={ci} className={styles.row3} style={{ marginBottom: 4 }}>
                      <div style={{ width: 130, flexShrink: 0 }}>
                        <select className={styles.input} value={ct.tipo} onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], tipo: e.target.value as 'telefone' | 'whatsapp' | 'email' }; return { ...c, contatos: cc } })}>
                          <option value="telefone">Telefone</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">E-mail</option>
                        </select>
                      </div>
                      <div className={styles.fg}>
                        <input className={styles.input} value={ct.valor}
                          onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], valor: ct.tipo === 'email' ? e.target.value : maskPhone(e.target.value) }; return { ...c, contatos: cc } })}
                          placeholder={ct.tipo === 'email' ? 'contato@empresa.com' : '(00) 00000-0000'}
                          maxLength={ct.tipo === 'email' ? 120 : 15} />
                      </div>
                      <button className={styles.btnRemoveItem} style={{ marginTop: 0 }} onClick={() => setCliente(c => ({ ...c, contatos: c.contatos.filter((_, j) => j !== ci) }))}>✕</button>
                    </div>
                  ))}
                  <button className={styles.btnSecondary} style={{ marginTop: 2, fontSize: '0.78rem', padding: '4px 10px' }}
                    onClick={() => setCliente(c => ({ ...c, contatos: [...c.contatos, { tipo: 'whatsapp', valor: '' }] }))}>
                    + Adicionar contato
                  </button>
                </div>

                {/* Endereço principal */}
                <div style={{ marginTop: 8, marginBottom: 4, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Endereço principal</div>
                <div className={styles.row2}>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <label>CEP</label>
                    <input className={styles.input} value={cliente.cep} maxLength={9}
                      onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'principal') }}
                      placeholder="00000-000" />
                  </div>
                  <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.logradouro} onChange={e => setCliente(c => ({ ...c, logradouro: e.target.value }))} placeholder="Rua / Av. / Alameda..." /></div>
                </div>
                <div className={styles.row3}>
                  <div style={{ width: 90, flexShrink: 0 }}><label>Número</label><input className={styles.input} value={cliente.numero} onChange={e => setCliente(c => ({ ...c, numero: e.target.value }))} /></div>
                  <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.complemento} onChange={e => setCliente(c => ({ ...c, complemento: e.target.value }))} placeholder="Sala, Bloco..." /></div>
                  <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.bairro} onChange={e => setCliente(c => ({ ...c, bairro: e.target.value }))} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.cidade} onChange={e => setCliente(c => ({ ...c, cidade: e.target.value }))} /></div>
                  <div style={{ width: 70, flexShrink: 0 }}><label>UF</label><input className={styles.input} value={cliente.uf} onChange={e => setCliente(c => ({ ...c, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} placeholder="MG" /></div>
                </div>
                {cliente.endereco && !cliente.logradouro && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
                    ℹ️ Legado: {cliente.endereco}
                  </div>
                )}

                {/* Endereço de entrega */}
                <label className={styles.toggleLabel} style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={cliente.ent_diferente} onChange={e => setCliente(c => ({ ...c, ent_diferente: e.target.checked }))} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Endereço de entrega diferente do principal</span>
                </label>
                {cliente.ent_diferente && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>LOCAL DE ENTREGA</div>
                    <div className={styles.row3}>
                      <div className={styles.fg}><label>Responsável local</label><input className={styles.input} value={cliente.ent_responsavel} onChange={e => setCliente(c => ({ ...c, ent_responsavel: e.target.value }))} placeholder="Nome do responsável" /></div>
                      <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={cliente.ent_telefone} onChange={e => setCliente(c => ({ ...c, ent_telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
                      <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.ent_whatsapp} onChange={e => setCliente(c => ({ ...c, ent_whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
                    </div>
                    <div className={styles.row2}>
                      <div style={{ width: 150, flexShrink: 0 }}>
                        <label>CEP</label>
                        <input className={styles.input} value={cliente.ent_cep} maxLength={9}
                          onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, ent_cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'entrega') }}
                          placeholder="00000-000" />
                      </div>
                      <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.ent_logradouro} onChange={e => setCliente(c => ({ ...c, ent_logradouro: e.target.value }))} /></div>
                    </div>
                    <div className={styles.row3}>
                      <div style={{ width: 90, flexShrink: 0 }}><label>Número</label><input className={styles.input} value={cliente.ent_numero} onChange={e => setCliente(c => ({ ...c, ent_numero: e.target.value }))} /></div>
                      <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.ent_complemento} onChange={e => setCliente(c => ({ ...c, ent_complemento: e.target.value }))} /></div>
                      <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.ent_bairro} onChange={e => setCliente(c => ({ ...c, ent_bairro: e.target.value }))} /></div>
                    </div>
                    <div className={styles.row2}>
                      <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.ent_cidade} onChange={e => setCliente(c => ({ ...c, ent_cidade: e.target.value }))} /></div>
                      <div style={{ width: 70, flexShrink: 0 }}><label>UF</label><input className={styles.input} value={cliente.ent_uf} onChange={e => setCliente(c => ({ ...c, ent_uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></div>
                    </div>
                  </div>
                )}
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
                      <div className={styles.itemDesc} style={{display:'flex',flexDirection:'column',gap:2}}>
                        <input className={styles.input} placeholder="Produto / serviço" value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} />
                        {exibir.obsTecnicaItens && (
                          <input className={styles.input} style={{fontSize:'0.75rem',color:'#64748b'}} placeholder="Obs. técnica (opcional)" value={item.obs_tecnica ?? ''} onChange={e => updateItem(i,'obs_tecnica',e.target.value)} />
                        )}
                      </div>
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
                  <div className={styles.fg}>
                    <label>Pagamento <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.78em' }}>(selecione uma ou mais)</span></label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
                      {COND_PAGAMENTO.map(c => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 400 }}>
                          <input type="checkbox" checked={condicoes.includes(c)}
                            onChange={e => setCondicoes(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))} />
                          {c}
                        </label>
                      ))}
                    </div>
                    {condicoes.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                        O envio será realizado após a confirmação do pagamento.
                      </div>
                    )}
                    {(condicoes.includes('PIX') || condicoes.includes('Depósito/Transferência')) && (
                      <div style={{ marginTop: 8 }}>
                        <label>Dados para pagamento (PIX / Transferência)</label>
                        <textarea className={`${styles.input} ${styles.textarea}`} rows={3}
                          placeholder={'Ex: PIX: 12.115.379/0001-64 (CNPJ)\nBanco: Bradesco · Ag: 1234 · CC: 56789-0\nFavorecido: Pousinox Ind. Com. LTDA'}
                          value={dadosPagamento} onChange={e => setDadosPagamento(e.target.value)} />
                      </div>
                    )}
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label className={styles.toggleLabel}>
                        <input type="checkbox" checked={watermarkLogo} onChange={e => setWatermarkLogo(e.target.checked)} />
                        <span style={{ fontSize: '0.82rem' }}>Usar logomarca</span>
                      </label>
                      {!watermarkLogo && (
                        <input className={styles.input} style={{ maxWidth: 220 }} placeholder="Ex: CONFIDENCIAL" value={watermarkTexto} onChange={e => setWatermarkTexto(e.target.value)} />
                      )}
                    </div>
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

              {/* Frete */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Frete</div>
                <div className={styles.row2}>
                  <div className={styles.fg}>
                    <label>Tipo de frete</label>
                    <select className={styles.input} value={frete.tipo} onChange={e => setFrete(f => ({ ...f, tipo: e.target.value as Frete['tipo'] }))}>
                      {Object.entries(FRETE_TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className={styles.fg}>
                    <label>Modalidade comercial</label>
                    <select className={styles.input} value={frete.modalidade} onChange={e => setFrete(f => ({ ...f, modalidade: e.target.value as 'cobrar' | 'bonus' }))}>
                      <option value="cobrar">Cobrar do cliente (entra no total)</option>
                      <option value="bonus">Frete bonificado (benefício comercial)</option>
                    </select>
                  </div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}>
                    <label>Valor do frete (R$)</label>
                    <input className={styles.input} type="number" min="0" step="0.01" placeholder="0,00" value={frete.valor} onChange={e => setFrete(f => ({ ...f, valor: e.target.value }))} />
                    {frete.modalidade === 'bonus' && valorFreteBruto() > 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>✓ Aparece na proposta como benefício — não soma no total</div>
                    )}
                  </div>
                  <div className={styles.fg}><label>Prazo logístico</label><input className={styles.input} placeholder="Ex: 3 dias úteis" value={frete.prazo} onChange={e => setFrete(f => ({ ...f, prazo: e.target.value }))} /></div>
                </div>
                <div className={styles.fg}><label>Observação logística</label><input className={styles.input} placeholder="Ex: Entrega apenas no período da tarde" value={frete.obs} onChange={e => setFrete(f => ({ ...f, obs: e.target.value }))} /></div>
              </div>

              {/* Instalação/Montagem */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Instalação / Montagem</div>
                <div className={styles.watermarkRow}>
                  <label className={styles.toggleLabel}>
                    <input type="checkbox" checked={instalacao.inclui} onChange={e => setInstalacao(i => ({ ...i, inclui: e.target.checked }))} />
                    <span>Inclui instalação/montagem</span>
                  </label>
                </div>
                {instalacao.inclui && (
                  <>
                    <div className={styles.row2} style={{ marginTop: 8 }}>
                      <div className={styles.fg}>
                        <label>Modalidade comercial</label>
                        <select className={styles.input} value={instalacao.modalidade} onChange={e => setInstalacao(i => ({ ...i, modalidade: e.target.value as 'cobrar' | 'bonus' }))}>
                          <option value="cobrar">Cobrar do cliente (entra no total)</option>
                          <option value="bonus">Instalação bonificada (benefício comercial)</option>
                        </select>
                      </div>
                      <div className={styles.fg}>
                        <label>Valor (R$) — deixe 0 se incluso no preço</label>
                        <input className={styles.input} type="number" min="0" step="0.01" value={instalacao.valor} onChange={e => setInstalacao(i => ({ ...i, valor: e.target.value }))} />
                        {instalacao.modalidade === 'bonus' && valorInstBruto() > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>✓ Aparece na proposta como benefício — não soma no total</div>
                        )}
                      </div>
                    </div>
                    <div className={styles.fg}><label>Descrição</label><input className={styles.input} placeholder="Ex: Instalação e comissionamento incluso" value={instalacao.texto} onChange={e => setInstalacao(i => ({ ...i, texto: e.target.value }))} /></div>
                  </>
                )}
              </div>

              {/* Internos */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Dados internos <span style={{color:'#94a3b8',fontWeight:400,fontSize:'0.75rem'}}>(não aparecem no PDF)</span></div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Origem do lead</label><input className={styles.input} placeholder="Ex: Indicação, LinkedIn, Feira..." value={origemLead} onChange={e => setOrigemLead(e.target.value)} /></div>
                </div>
                <div className={styles.fg}><label>Observações internas</label><textarea className={`${styles.input} ${styles.textarea}`} rows={3} placeholder="Notas internas, instruções para a equipe..." value={obsInternas} onChange={e => setObsInternas(e.target.value)} /></div>
              </div>

              {/* Controles da Proposta */}
              <div className={styles.section}>
                <div className={styles.sectionTitle} style={{cursor:'pointer',userSelect:'none'}} onClick={() => setShowControles(v=>!v)}>
                  Controles da Proposta {showControles ? '▲' : '▼'}
                  <span style={{color:'#94a3b8',fontWeight:400,fontSize:'0.73rem',marginLeft:8}}>campos opcionais visíveis no PDF</span>
                </div>
                {showControles && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px',marginTop:8}}>
                    {([
                      ['telefone','Telefone'],['whatsapp','WhatsApp'],['email','E-mail'],
                      ['emailNf','E-mail NFs/Boletos'],['contatosAdicionais','Contatos adicionais'],
                      ['cnpj','CNPJ/CPF'],['inscricaoEstadual','Insc. Estadual'],
                      ['cargo','Cargo do contato'],['endereco','Endereço principal'],
                      ['enderecoEntrega','Endereço de entrega'],['entResponsavel','Responsável na entrega'],
                      ['obsTecnicaItens','Obs. técnica dos itens'],
                      ['instMontagem','Instalação/montagem'],
                      ['anexos','Anexos'],['detalhesLogistica','Detalhes logísticos'],
                    ] as [keyof ExibirProposta, string][]).map(([key, label]) => (
                      <label key={key} className={styles.toggleLabel}>
                        <input type="checkbox" checked={exibir[key]} onChange={e => setExibir(x=>({...x,[key]:e.target.checked}))} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
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

              {/* Links de rastreamento */}
              {editandoId && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Links de Rastreamento</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input className={styles.input} style={{ flex: 1 }} placeholder="Destinatário (ex: João — Construtora ABC)" value={novoLinkDest} onChange={e => setNovoLinkDest(e.target.value)} />
                    <button className={styles.btnAddItem} onClick={gerarLink} disabled={gerandoLink}>{gerandoLink ? '...' : '🔗 Gerar link'}</button>
                    <button className={styles.btnSecondary} onClick={() => editandoId && carregarLinks(editandoId)} title="Atualizar contadores">↻</button>
                  </div>
                  {links.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {links.map(l => (
                        <div key={l.id} style={{ background: l.ativo ? '#f8fafc' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>{l.destinatario || '— Sem destinatário —'}</span>
                              {!l.ativo && <span style={{ marginLeft: 6, color: '#94a3b8' }}>(inativo)</span>}
                              <div style={{ color: '#64748b', marginTop: 2 }}>
                                {l.visualizacoes > 0 ? `👁 ${l.visualizacoes} visualiz. · ` : ''}
                                {l.downloads > 0 ? `⬇️ ${l.downloads} download(s) · ` : ''}
                                  {l.primeiro_acesso ? `1º acesso: ${new Date(l.primeiro_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Nunca acessado'}
                                {l.visualizacoes > 0 && (
                                  <span
                                    style={{ marginLeft: 8, cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                                    onClick={() => toggleAcessos(l.id)}
                                  >
                                    {expandedLink === l.id ? '▾ ocultar detalhes' : '▸ ver por IP'}
                                  </span>
                                )}
                              </div>
                              {expandedLink === l.id && (
                                <div style={{ marginTop: 8, fontSize: '0.7rem', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                                  {!acessosLink[l.id] ? (
                                    <span style={{ color: '#94a3b8' }}>carregando…</span>
                                  ) : acessosLink[l.id].length === 0 ? (
                                    <span style={{ color: '#94a3b8' }}>nenhum acesso registrado</span>
                                  ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ color: '#64748b' }}>
                                          <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Quando</th>
                                          <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>IP</th>
                                          <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Dispositivo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {acessosLink[l.id].map((a, i) => {
                                          const ua = a.user_agent ?? ''
                                          const device = /Mobile|Android|iPhone/i.test(ua) ? '📱 Mobile' : '🖥 Desktop'
                                          const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Outro'
                                          return (
                                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '3px 0', color: '#475569' }}>{new Date(a.acessado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                              <td style={{ padding: '3px 8px', color: '#475569', fontFamily: 'monospace' }}>{a.ip ?? '—'}</td>
                                              <td style={{ padding: '3px 0', color: '#475569' }}>{device} · {browser}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              {l.ativo && (
                                <>
                                  <button className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                                    onClick={() => { navigator.clipboard.writeText(linkUrl(l)); showMsg('ok', 'Link copiado!') }}>
                                    📋 Copiar
                                  </button>
                                  {(() => {
                                    const vend = vendedores.find(v => v.id === vendedorId)
                                    const nomeCompleto = cliente.tipo_pessoa === 'pf' ? (cliente.nome || cliente.empresa) : cliente.empresa
                                    const primeiroNome = nomeCompleto ? nomeCompleto.split(' ')[0] : ''
                                    const assinaturaWa = vend?.nome ?? ''
                                    const assinaturaEmail = [vend?.nome, vend?.telefone].filter(Boolean).join(' · ')
                                    const corpo = (assinatura: string) => [
                                      `Olá${primeiroNome ? ', ' + primeiroNome : ''}!`,
                                      '',
                                      `Segue o orçamento ${numero} da Pousinox conforme conversamos.`,
                                      '',
                                      linkUrl(l),
                                      '',
                                      'Qualquer dúvida estou à disposição.',
                                      assinatura,
                                    ].join('\n')
                                    return (
                                      <>
                                        <a href={`https://wa.me/?text=${encodeURIComponent(corpo(assinaturaWa))}`} target="_blank" rel="noreferrer"
                                          className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem', textDecoration: 'none' }}>
                                          📲 WhatsApp
                                        </a>
                                        <a href={`mailto:${l.destinatario ?? ''}?subject=${encodeURIComponent(`Orçamento ${numero} — Pousinox`)}&body=${encodeURIComponent(corpo(assinaturaEmail))}`}
                                          className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem', textDecoration: 'none' }}>
                                          ✉️ E-mail
                                        </a>
                                      </>
                                    )
                                  })()}
                                  <button className={styles.btnRemoveItem} onClick={() => desativarLink(l.id)} title="Desativar link">✕</button>
                                </>
                              )}
                            </div>
                          </div>
                          <div style={{ color: '#94a3b8', marginTop: 3, wordBreak: 'break-all' }}>{linkUrl(l)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginTop: 6 }}>
                    ℹ️ Cada link é único por destinatário. O rastreamento registra acessos via link — PDFs baixados offline não são rastreados.
                  </div>
                </div>
              )}

              {/* Rastreabilidade */}
              {historico.length > 0 && (() => {
                // Colapsar entradas consecutivas do mesmo evento no mesmo dia
                const grupos: { evento: string; descricao: string | null; criado_em: string; usuario: string | null; count: number }[] = []
                for (const h of historico) {
                  const dia = h.criado_em.slice(0, 10)
                  const last = grupos[grupos.length - 1]
                  if (last && last.evento === h.evento && last.criado_em.slice(0, 10) === dia) {
                    last.count++
                  } else {
                    grupos.push({ evento: h.evento, descricao: h.descricao, criado_em: h.criado_em, usuario: h.usuario, count: 1 })
                  }
                }
                const visiveis = verTodoHistorico ? grupos : grupos.slice(0, 5)
                return (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Rastreabilidade</div>
                    <div className={styles.historicoList}>
                      {visiveis.map((g, i) => (
                        <div key={i} className={styles.historicoItem}>
                          <span className={styles.historicoEvento}>
                            {EVENTO_LABEL[g.evento] ?? g.evento}
                            {g.count > 1 && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#e2e8f0', color: '#64748b', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>×{g.count}</span>}
                          </span>
                          {g.descricao && <span className={styles.historicoDesc}>{g.descricao}</span>}
                          <span className={styles.historicoData}>{fmtEvento(g.criado_em)}{g.usuario ? ` · ${g.usuario}` : ''}</span>
                        </div>
                      ))}
                    </div>
                    {grupos.length > 5 && (
                      <button type="button" onClick={() => setVerTodoHistorico(v => !v)}
                        style={{ marginTop: 8, fontSize: '0.78rem', color: '#1a5fa8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                        {verTodoHistorico ? '▲ Ver menos' : `▼ Ver histórico completo (${grupos.length} entradas)`}
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Preview */}
            <div className={styles.previewCol}>
              <div className={styles.previewLabel}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setPreviewMode('pdf')}
                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: previewMode === 'pdf' ? '#1a2f4e' : 'transparent', color: previewMode === 'pdf' ? '#fff' : '#94a3b8' }}
                  >⬛ PDF</button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: previewMode === 'mobile' ? '#1a2f4e' : 'transparent', color: previewMode === 'mobile' ? '#fff' : '#94a3b8' }}
                  >📱 Mobile</button>
                </div>
                <button className={styles.btnFullscreen} onClick={() => setPreviewFullscreen(true)}>
                  ⛶ Ampliar
                </button>
              </div>
              {previewMode === 'mobile' ? (
                (() => {
                  const linkAtivo = links.find(l => l.ativo)
                  if (!linkAtivo) return (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      Gere um link público para ver a pré-visualização mobile.
                    </div>
                  )
                  return (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                      <div style={{ width: 390, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
                        <iframe
                          src={linkUrl(linkAtivo)}
                          style={{ width: '100%', height: 720, border: 'none', display: 'block' }}
                          title="Pré-visualização mobile"
                        />
                      </div>
                    </div>
                  )
                })()
              ) : (
                editandoId
                  ? <iframe
                      key={editandoId}
                      src={`/print/orcamento/${editandoId}?preview=1`}
                      style={{ width: '100%', height: 900, border: 'none', display: 'block', borderRadius: 8 }}
                      title="Pré-visualização PDF"
                    />
                  : <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Salve o orçamento para ver o preview do PDF.
                    </div>
              )}

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

      {/* Fullscreen portal — renderiza fora da hierarquia DOM para position:fixed funcionar */}
      {previewFullscreen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1e293b', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 20px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Pré-visualização · PDF — Orçamento Nº {numero}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {editandoId && <button onClick={() => window.open(`/print/orcamento/${editandoId}`, '_blank')} style={{ background: '#1a2f4e', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>⬇️ Baixar PDF</button>}
              <button onClick={() => setPreviewFullscreen(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>✕ Fechar</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {editandoId
              ? <iframe
                  key={editandoId}
                  src={`/print/orcamento/${editandoId}?preview=1`}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Pré-visualização PDF fullscreen"
                />
              : <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Salve o orçamento para ver o preview do PDF.
                </div>
            }
          </div>
        </div>,
        document.body
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
              <div className={styles.fg}>
                <label>Telefone</label>
                <input className={styles.input} value={formEmpresa.telefone ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, telefone: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!formEmpresa.telefone_is_whatsapp}
                    onChange={e => setFormEmpresa(f => ({ ...f, telefone_is_whatsapp: e.target.checked }))} />
                  Este número também é WhatsApp
                </label>
              </div>
              <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={formEmpresa.email ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className={styles.row2}>
              <div className={styles.fg}>
                <label>CEP</label>
                <input className={styles.input} placeholder="00000-000"
                  value={formEmpresa.cep ?? ''}
                  onChange={e => setFormEmpresa(f => ({ ...f, cep: maskCEP(e.target.value) }))}
                  onBlur={async e => {
                    const cep = e.target.value.replace(/\D/g, '')
                    if (cep.length !== 8) return
                    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
                    const d = await r.json()
                    if (d.erro) return
                    setFormEmpresa(f => ({
                      ...f,
                      endereco: `${d.logradouro}${f.numero ? ', nº ' + f.numero : ''} - ${d.bairro} - ${d.localidade}/${d.uf}`,
                    }))
                  }}
                />
              </div>
              <div className={styles.fg}>
                <label>Número</label>
                <input className={styles.input} placeholder="1020"
                  value={formEmpresa.numero ?? ''}
                  onChange={e => setFormEmpresa(f => ({ ...f, numero: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fg}>
              <label>Endereço completo</label>
              <input className={styles.input} placeholder="Preenchido pelo CEP — edite se necessário"
                value={formEmpresa.endereco ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div className={styles.fg}>
              <label>Site</label>
              <input className={styles.input} placeholder="pousinox.com.br"
                value={formEmpresa.site ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, site: e.target.value }))} />
            </div>
            <div className={styles.formActionsEmpresa}>
              <button className={styles.btnPrimary} onClick={salvarEmpresa}>{editEmpresaId ? 'Atualizar empresa' : 'Criar empresa'}</button>
              {editEmpresaId && <button className={styles.btnSecondary} onClick={() => { setFormEmpresa({}); setEditEmpresaId(null) }}>Cancelar</button>}
            </div>
          </div>
          {/* Cards — mobile */}
          <div className={styles.listaCards}>
            {empresas.map(e => (
              <div key={e.id} className={styles.listaCard}>
                <div className={styles.listaCardTopo}>
                  <div>
                    <div className={styles.listaCardEmpresa}>{e.nome_fantasia}</div>
                    {e.razao_social && e.razao_social !== e.nome_fantasia && <div className={styles.listaCardCliente}>{e.razao_social}</div>}
                    <div className={styles.listaCardCliente}>{e.cnpj || ''}</div>
                  </div>
                  {e.logo_url && <img src={e.logo_url} alt="logo" style={{ height: 40, objectFit: 'contain' }} />}
                </div>
                <div className={styles.listaCardMeta}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {e.telefone && <div>{e.telefone}</div>}
                    {e.email && <div>{e.email}</div>}
                  </div>
                  <div className={styles.listaCardAcoes}>
                    <input type="file" accept="image/*" id={`logo-${e.id}`} style={{ display: 'none' }} onChange={ev => ev.target.files?.[0] && uploadLogo(ev.target.files[0], e.id, ev.target)} />
                    <label htmlFor={`logo-${e.id}`} className={styles.btnAcao} style={{ cursor: 'pointer' }}>⬆ Logo</label>
                    <button className={styles.btnAcao} onClick={() => { setEditEmpresaId(e.id); setFormEmpresa({ ...e }) }}>✏️ Editar</button>
                    <button className={styles.btnAcao} style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={async () => {
                      if (!window.confirm(`Excluir "${e.nome_fantasia}"?`)) return
                      await supabaseAdmin.from('empresas_emissoras').update({ ativa: false }).eq('id', e.id)
                      carregarEmpresas()
                    }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Tabela — tablet/desktop */}
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
                    <input type="file" accept="image/*" id={`logo-tbl-${e.id}`} style={{ display: 'none' }} onChange={ev => ev.target.files?.[0] && uploadLogo(ev.target.files[0], e.id, ev.target)} />
                    <label htmlFor={`logo-tbl-${e.id}`} style={{ marginLeft: 8, fontSize: '0.75rem', cursor: 'pointer', color: '#1a5fa8', fontWeight: 600 }}>
                      {uploadandoLogo ? '...' : '⬆ Upload logo'}
                    </label>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className={styles.btnAcao} title="Editar" onClick={() => { setEditEmpresaId(e.id); setFormEmpresa({ ...e }) }}>✏️</button>
                    <button className={styles.btnAcao} title="Excluir" style={{ color: '#dc2626' }} onClick={async () => {
                      if (!window.confirm(`Excluir a empresa "${e.nome_fantasia}"?`)) return
                      await supabaseAdmin.from('empresas_emissoras').update({ ativa: false }).eq('id', e.id)
                      carregarEmpresas()
                    }}>🗑</button>
                  </td>
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
              <button className={styles.btnPrimary} onClick={salvarVendedor}>{editVendedorId ? 'Atualizar' : 'Cadastrar consultor'}</button>
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
              {vendedores.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>Nenhum consultor cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
