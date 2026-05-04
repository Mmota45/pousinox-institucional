import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, Eye, Settings, ClipboardList, FileText, Link, History, AlertTriangle, User, Truck, Wrench, StickyNote, Paperclip, X, Camera, RefreshCw, ArrowLeft, Check } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import CollapsibleSection from '../components/CollapsibleSection/CollapsibleSection'
import { useAdmin } from '../contexts/AdminContext'
import ClienteForm from '../components/ClienteForm/ClienteForm'
import { maskCNPJ, maskCPF } from '../lib/masks'
import FreteSection from '../components/FreteSection/FreteSection'
// useCanva removido — abre template direto até Autofill API ser aprovado
import { useEtiqueta } from '../components/Orcamento/hooks/useEtiqueta'
import { useLinks } from '../components/Orcamento/hooks/useLinks'
import HistoricoSection from '../components/Orcamento/sections/HistoricoSection'
import LinksSection from '../components/Orcamento/sections/LinksSection'
import ResumoSidebar from '../components/Orcamento/sections/ResumoSidebar'
import ItensSection from '../components/Orcamento/sections/ItensSection'
import CondicoesSection from '../components/Orcamento/sections/CondicoesSection'
import DetalheView from '../components/Orcamento/sections/DetalheView'
import OrcamentoList from '../components/Orcamento/OrcamentoList'
import ConfigDrawer from '../components/Orcamento/ConfigDrawer'
import PropostaSection, { type PropostaData, PROPOSTA_VAZIA } from '../components/Orcamento/sections/PropostaSection'
import CompartilharProposta from '../components/Orcamento/CompartilharProposta'
import EspecificacaoSection from '../components/Orcamento/sections/EspecificacaoSection'

import type {
  EmpresaEmissora, Vendedor, OrcamentoResumo, Item, Instalacao, OrcLink,
  ExibirProposta, DadoBancario, Anexo, HistoricoItem, ProdutoResult,
  OutletResult, Status, ClienteInfo, FreteSummary,
} from '../components/Orcamento/types'

import {
  EXIBIR_DEFAULT, STATUS_CFG,
  ITEM_VAZIO, CLIENTE_VAZIO, INST_VAZIO, OBS_DEFAULT,
  fmtBRL, hoje, fmtDataISO, formatarDadoBancario,
} from '../components/Orcamento/types'
// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminOrcamento() {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (() => {
    const s = location.state as {
      projeto?: { titulo: string; cliente_nome: string | null; cliente_cnpj: string | null; observacoes: string | null }
      componentes?: { nome: string; quantidade: number | null }[]
      prospect?: { razao_social: string; nome_fantasia?: string; cnpj?: string; telefone?: string; email?: string; cidade?: string; uf?: string; segmento?: string }
      returnTo?: string
    } | null
    if (s) return s
    // Fallback: ler prospect do sessionStorage (quando aberto em nova aba)
    try {
      const stored = sessionStorage.getItem('orcamento_prospect')
      if (stored) {
        sessionStorage.removeItem('orcamento_prospect')
        return { prospect: JSON.parse(stored) } as typeof s
      }
    } catch { /* ignore */ }
    return null
  })()

  const [modoEditor, setModoEditor] = useState(false) // false=detalhe, true=editor
  const [mobileTab, setMobileTab]   = useState<'lista' | 'editor' | 'acoes'>('lista')
  const [lista, setLista]           = useState<OrcamentoResumo[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const lp = useLoadingProgress(4)
  const [filtroStatus, setFiltroStatus] = useState<Status | 'todos'>('todos')
  // ordenação agora dentro do OrcamentoList
  const [empresas, setEmpresas]     = useState<EmpresaEmissora[]>([])
  const [empresaId, setEmpresaId]   = useState<number | null>(null)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [numero, setNumero]         = useState('')
  const [status, setStatus]         = useState<Status>('rascunho')
  const [finLancId, setFinLancId]   = useState<number | null>(null)
  const [dataEmissao]               = useState(hoje)
  const [validadeDias, setValidadeDias] = useState('7')
  const [cliente, setCliente]       = useState<ClienteInfo>(CLIENTE_VAZIO)
  // busca cliente movida para ClienteForm
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
  const [dadosBancarios, setDadosBancarios] = useState<DadoBancario[]>([])
  const [dadosBancariosSel, setDadosBancariosSel] = useState<number[]>([])
  const [observacoes, setObservacoes] = useState(OBS_DEFAULT)
  const [watermarkAtivo, setWatermarkAtivo] = useState(false)
  const [watermarkTexto, setWatermarkTexto] = useState('CONFIDENCIAL')
  const [imagemUrl, setImagemUrl]   = useState('')
  const [uploadandoImagem, setUploadandoImagem] = useState(false)
  const imagemRef = useRef<HTMLInputElement>(null)
  const [anexos, setAnexos]         = useState<Anexo[]>([])
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false)
  const [historico, setHistorico]   = useState<HistoricoItem[]>([])
  // Preview removido — PDF acessível via botão na toolbar
  const [empresaSnapshot, setEmpresaSnapshot] = useState<Record<string, unknown> | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [gerandoRec, setGerandoRec] = useState(false)
  const [gerandoCanva, setGerandoCanva] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [enviandoWa, setEnviandoWa] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [msg, setMsg]               = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const showMsg = useCallback((tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000)
  }, [])
  const etiq = useEtiqueta({ editandoId, cliente, itens, totalFn: total, nomeUsuario, showMsg, setHistorico })
  const { etiquetaPreId, setEtiquetaPreId, gerandoEtiq, baixandoRotulo, baixandoDace, cancelandoEtiq, gerarEtiqueta, baixarRotulo, baixarDace, cancelarEtiqueta } = etiq
  const freteSummaryRef = useRef<FreteSummary>({ tipo: '', modalidade: 'cobrar', valor: 0, custo: 0, prazo: '', prazo_dias: null, provedor: '', servico: '', opcao_id: null, obs: '', peso_total_kg: 0, volumes_qtd: 0 })
  const handleFreteChange = useCallback((s: FreteSummary) => { freteSummaryRef.current = s }, [])
  const [instalacao, setInstalacao] = useState<Instalacao>(INST_VAZIO)
  const [obsInternas, setObsInternas] = useState('')
  const [modoProposta, setModoProposta] = useState(false)
  const [proposta, setProposta] = useState<PropostaData>(PROPOSTA_VAZIA)
  const [origemLead, setOrigemLead] = useState('')
  const [exibir, setExibir]         = useState<ExibirProposta>(EXIBIR_DEFAULT)
  const [showControles, setShowControles] = useState(false)
  const linksHook = useLinks({ editandoId, nomeUsuario })
  const { links, setLinks, gerandoLink, novoLinkDest, setNovoLinkDest, acessosLink, expandedLink, carregarLinks, toggleAcessos, gerarLink, desativarLink, linkUrl } = linksHook
  const [watermarkLogo, setWatermarkLogo] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
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
    const s = freteSummaryRef.current
    if (s.modalidade === 'bonus') return 0
    if (s.tipo === 'FOB') return 0
    return s.valor
  }
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
    try {
      const base = supabaseAdmin
        .from('orcamentos')
        .select('id, numero, status, empresa_nome, cliente_empresa, cliente_nome, vendedor_nome, total, criado_em')
        .order('criado_em', { ascending: false })
        .limit(200)
      const { data, error } = await (filtroStatus !== 'todos' ? base.eq('status', filtroStatus) : base)
      if (error) throw error
      setLista((data ?? []) as OrcamentoResumo[])
      lp.step()
    } catch (err) {
      console.error('Erro ao carregar lista:', err)
      showMsg('erro', 'Erro ao carregar orçamentos.')
    } finally {
      setLoadingLista(false)
    }
  }, [filtroStatus, showMsg])

  const carregarEmpresas = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from('empresas_emissoras').select('*').eq('ativa', true).order('nome_fantasia')
      if (error) throw error
      const list = (data ?? []) as EmpresaEmissora[]
      setEmpresas(list)
      if (!empresaId && list.length > 0) setEmpresaId(list[0].id)
      lp.step()
    } catch (err) { console.error('Erro ao carregar empresas:', err) }
  }, [])

  const carregarVendedores = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from('vendedores').select('*').eq('ativo', true).order('nome')
      if (error) throw error
      setVendedores((data ?? []) as Vendedor[])
      lp.step()
    } catch (err) { console.error('Erro ao carregar vendedores:', err) }
  }, [])

  const carregarDadosBancarios = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from('dados_bancarios').select('*').eq('ativo', true).order('ordem')
      if (error) throw error
      setDadosBancarios((data ?? []) as DadoBancario[])
      lp.step()
    } catch (err) { console.error('Erro ao carregar dados bancários:', err) }
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])
  useEffect(() => { carregarEmpresas() }, [carregarEmpresas])
  useEffect(() => { carregarVendedores() }, [carregarVendedores])
  useEffect(() => { carregarDadosBancarios() }, [carregarDadosBancarios])
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      supabaseAdmin.from('admin_perfis').select('nome, permissoes').eq('user_id', session.user.id).single().then(({ data }) => {
        if (data) {
          const d = data as Record<string, unknown>
          setNomeUsuario((d.nome as string) || session.user.email || '')
          setIsAdminUser(((d.permissoes as string[]) ?? []).includes('usuarios'))
        }
      })
    })
  }, [])

  useEffect(() => {
    if (fromState?.projeto) {
      const p = fromState.projeto
      setCliente({ ...CLIENTE_VAZIO, empresa: p.cliente_nome ?? '', cnpj: p.cliente_cnpj ?? '', tipo_pessoa: 'pj' })
      if (fromState.componentes?.length) {
        setItens(fromState.componentes.map(c => ({
          produto_id: null,
          descricao: `${c.nome}${c.quantidade ? ` (${c.quantidade} un)` : ''}`,
          qtd: String(c.quantidade ?? 1), unidade: 'UN', valorUnit: '',
        })))
      }
      if (p.observacoes) setObservacoes(p.observacoes)
      supabaseAdmin.rpc('next_orcamento_numero').then(({ data }) => {
        setNumero((data as string) ?? `${new Date().getFullYear()}/001`)
      })
      setModoEditor(true); setMobileTab('editor')
    } else if (fromState?.prospect) {
      const pr = fromState.prospect
      setCliente({
        ...CLIENTE_VAZIO,
        empresa: pr.razao_social,
        nome_fantasia: pr.nome_fantasia ?? '',
        cnpj: pr.cnpj ?? '',
        telefone: pr.telefone ?? '',
        email: pr.email ?? '',
        cidade: pr.cidade ?? '',
        uf: pr.uf ?? '',
        tipo_pessoa: 'pj',
      })
      supabaseAdmin.rpc('next_orcamento_numero').then(({ data }) => {
        setNumero((data as string) ?? `${new Date().getFullYear()}/001`)
      })
      setModoEditor(true); setMobileTab('editor')
    }
  }, [])

  // useEffect busca cliente movido para ClienteForm

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
    try {
      const { data: numData } = await supabaseAdmin.rpc('next_orcamento_numero')
      const novoNumero = (numData as string) ?? `${new Date().getFullYear()}/001`
      setEditandoId(null); setNumero(novoNumero); setStatus('rascunho'); setFinLancId(null); setEtiquetaPreId(null)
      setCliente(CLIENTE_VAZIO); setItens([{ ...ITEM_VAZIO }])
      setDesconto(''); setTipoDesc('%'); setCondicoes([]); setPrazoEntrega(''); setDadosPagamento('')
      setValidadeDias('7'); setObservacoes(OBS_DEFAULT)
      setWatermarkAtivo(false); setWatermarkTexto('CONFIDENCIAL'); setWatermarkLogo(false)
      setImagemUrl(''); setAnexos([]); setHistorico([]); setLinks([])
      setInstalacao(INST_VAZIO)
      setModoProposta(false); setProposta(PROPOSTA_VAZIA)
      setObsInternas(''); setOrigemLead(''); setExibir(EXIBIR_DEFAULT); setDadosBancariosSel([])
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
      if (error) throw error
      if (created) {
        const newId = (created as Record<string, unknown>).id as number
        setEditandoId(newId)
        await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: newId, evento: 'criado', descricao: null, usuario: nomeUsuario || null })
        setHistorico([{ id: 0, evento: 'criado', descricao: null, usuario: nomeUsuario || null, criado_em: new Date().toISOString() }])
      }
      setModoEditor(true); setMobileTab('editor')
      carregarLista()
    } catch (err) {
      console.error('Erro ao criar orçamento:', err)
      showMsg('erro', 'Erro ao criar orçamento.')
    }
  }

  async function carregarOrcamento(id: number, destino: 'editor' | 'detalhe' = 'editor') {
    try {
    const [{ data: orc, error: errOrc }, { data: itensD }, { data: anexosD }, { data: histD }] = await Promise.all([
      supabaseAdmin.from('orcamentos').select('*').eq('id', id).single(),
      supabaseAdmin.from('itens_orcamento').select('*').eq('orcamento_id', id).order('ordem'),
      supabaseAdmin.from('orcamentos_anexos').select('*').eq('orcamento_id', id).order('criado_em'),
      supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', id).order('criado_em', { ascending: false }),
    ])
    if (errOrc) throw errOrc
    if (!orc) return
    const o = orc as any
    setEditandoId(id); setNumero(o.numero); setStatus(o.status); setFinLancId(o.fin_lancamento_id ?? null); setEtiquetaPreId(o.etiqueta_pre_id ?? null)
    setEmpresaId(o.empresa_id); setVendedorId(o.vendedor_id ?? null)
    setCliente({
      nome: o.cliente_nome ?? '', empresa: o.cliente_empresa ?? '',
      nome_fantasia: o.cliente_nome_fantasia ?? '',
      cnpj: (o.cliente_tipo_pessoa === 'pf' ? maskCPF : maskCNPJ)(o.cliente_cnpj ?? ''),
      telefone: o.cliente_telefone ?? '', telefone_is_whatsapp: o.cliente_telefone_is_whatsapp ?? false,
      email: o.cliente_email ?? '', endereco: o.cliente_endereco ?? '',
      tipo_pessoa: o.cliente_tipo_pessoa ?? 'pj',
      perfil_comprador: o.perfil_comprador ?? '',
      whatsapp: o.cliente_whatsapp ?? '',
      cargo: ['Comprador(a)','Diretor(a)','Engenheiro(a)','Gerente','Proprietário(a)','Responsável Técnico','Financeiro','Administrativo','Arquiteto(a)','Síndico(a)','Outro'].includes(o.cliente_cargo ?? '') ? (o.cliente_cargo ?? '') : (o.cliente_cargo ? 'Outro' : ''),
      cargo_outro: ['Comprador(a)','Diretor(a)','Engenheiro(a)','Gerente','Proprietário(a)','Responsável Técnico','Financeiro','Administrativo','Arquiteto(a)','Síndico(a)','Outro'].includes(o.cliente_cargo ?? '') ? '' : (o.cliente_cargo ?? ''),
      inscricao_estadual: o.cliente_inscricao_est ?? '',
      cep: o.cliente_cep ?? '', logradouro: o.cliente_logradouro ?? '',
      numero: o.cliente_numero ?? '', complemento: o.cliente_complemento ?? '',
      bairro: o.cliente_bairro ?? '', cidade: o.cliente_cidade ?? '', uf: o.cliente_uf ?? '',
      email_nf: o.cliente_email_nf ?? '',
      contatos: (() => {
        try {
          const cts = Array.isArray(o.cliente_contatos) ? o.cliente_contatos : []
          // Migra email_nf legado para contatos se não existir
          if (o.cliente_email_nf && !cts.some((c: Record<string, unknown>) => c.tipo === 'email_nf'))
            cts.push({ tipo: 'email_nf', valor: o.cliente_email_nf })
          return cts
        } catch { return [] }
      })(),
      ent_diferente: !!(o.cliente_ent_logradouro || o.cliente_ent_cep || o.cliente_ent_responsavel),
      ent_responsavel: o.cliente_ent_responsavel ?? '', ent_telefone: o.cliente_ent_telefone ?? '', ent_whatsapp: o.cliente_ent_whatsapp ?? '',
      ent_cep: o.cliente_ent_cep ?? '', ent_logradouro: o.cliente_ent_logradouro ?? '',
      ent_numero: o.cliente_ent_numero ?? '', ent_complemento: o.cliente_ent_complemento ?? '',
      ent_bairro: o.cliente_ent_bairro ?? '', ent_cidade: o.cliente_ent_cidade ?? '', ent_uf: o.cliente_ent_uf ?? '',
    })
    setItens((itensD ?? []).length > 0
      ? (itensD as any[]).map((i: any) => ({
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
    setDadosPagamento((o.dados_pagamento as string) ?? '')
    setDadosBancariosSel(Array.isArray(o.dados_bancarios_ids) ? o.dados_bancarios_ids : [])
    setValidadeDias(String(o.validade_dias ?? 7)); setObservacoes(o.observacoes ?? OBS_DEFAULT)
    setWatermarkAtivo(o.watermark_ativo ?? false); setWatermarkTexto(o.watermark_texto ?? 'CONFIDENCIAL')
    setImagemUrl(o.imagem_url ?? '')
    // Frete carregado pelo FreteSection via orcamentoId
    setInstalacao({ inclui: o.inst_inclui ?? false, modalidade: o.inst_modalidade ?? 'cobrar', texto: o.inst_texto ?? '', valor: o.inst_valor ? String(o.inst_valor) : '' })
    setObsInternas(o.obs_internas ?? '')
    setOrigemLead(o.origem_lead ?? '')
    setExibir({ ...EXIBIR_DEFAULT, ...(o.exibir_config ?? {}) })
    setWatermarkLogo(o.watermark_logo ?? false)
    setModoProposta(o.modo_proposta ?? false)
    setProposta(o.proposta_comercial ?? PROPOSTA_VAZIA)
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
    setModoEditor(destino === 'editor')
    setMobileTab('editor')
    } catch (err) {
      console.error('Erro ao carregar orçamento:', err)
      showMsg('erro', 'Erro ao carregar orçamento.')
    }
  }

  async function salvar(novoStatus?: Status) {
    setSalvando(true)
    try {
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
      cliente_nome_fantasia: cliente.nome_fantasia || null,
      cliente_cnpj: cliente.cnpj || null, cliente_telefone: cliente.telefone || null,
      cliente_telefone_is_whatsapp: cliente.telefone_is_whatsapp || false,
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
      cliente_email_nf: cliente.contatos.find(c => c.tipo === 'email_nf')?.valor || cliente.email_nf || null,
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
      frete_tipo: freteSummaryRef.current.tipo || null,
      frete_modalidade: freteSummaryRef.current.modalidade,
      frete_valor: freteSummaryRef.current.valor,
      frete_custo: freteSummaryRef.current.custo,
      frete_preco_venda: freteSummaryRef.current.valor,
      frete_prazo: freteSummaryRef.current.prazo || null,
      frete_prazo_dias: freteSummaryRef.current.prazo_dias,
      frete_provedor: freteSummaryRef.current.provedor || null,
      frete_servico: freteSummaryRef.current.servico || null,
      frete_opcao_id: freteSummaryRef.current.opcao_id,
      frete_obs: freteSummaryRef.current.obs || null,
      peso_total_kg: freteSummaryRef.current.peso_total_kg || null,
      volumes_qtd: freteSummaryRef.current.volumes_qtd || null,
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
      condicao_pagamento: condicoes.length ? JSON.stringify(condicoes) : null, prazo_entrega: prazoEntrega || null, dados_pagamento: dadosPagamento || null, dados_bancarios_ids: dadosBancariosSel.length ? dadosBancariosSel : null,
      validade_dias: parseInt(validadeDias) || 7, observacoes: observacoes || null,
      watermark_ativo: watermarkAtivo, watermark_texto: watermarkTexto,
      imagem_url: imagemUrl || null,
      modo_proposta: modoProposta,
      proposta_comercial: modoProposta ? proposta : null,
    }
    let orcId = editandoId
    if (editandoId) {
      const { error: errUpd } = await supabaseAdmin.from('orcamentos').update(payload).eq('id', editandoId)
      if (errUpd) { showMsg('erro', 'Erro ao atualizar orçamento: ' + errUpd.message); return }
      const { error: errDel } = await supabaseAdmin.from('itens_orcamento').delete().eq('orcamento_id', editandoId)
      if (errDel) { showMsg('erro', 'Erro ao limpar itens: ' + errDel.message); return }
    } else {
      const { data, error: errIns } = await supabaseAdmin.from('orcamentos').insert(payload).select('id').single()
      if (errIns) { showMsg('erro', 'Erro ao criar orçamento: ' + errIns.message); return }
      orcId = (data as Record<string, unknown>)?.id as number | null
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
        if (errItens) { showMsg('erro', 'Erro ao salvar itens: ' + errItens.message); return }
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
    showMsg('ok', editandoId ? 'Salvo.' : 'Orçamento criado.')
    carregarLista()
    if (orcId != null) integrarPosSalvar(orcId)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      showMsg('erro', 'Erro ao salvar orçamento.')
    } finally {
      setSalvando(false)
    }
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

    // 1. Pipeline — cria/atualiza deal sincronizado com orçamento
    const estagioMap: Record<string, string> = {
      rascunho: 'proposta', enviado: 'negociacao',
      aprovado: 'ganho', recusado: 'perdido', cancelado: 'perdido',
    }
    const estagioAlvo = estagioMap[status] || 'proposta'
    const titulo = cliente.empresa || cliente.nome || 'Proposta'
    if (cnpjLimpo || cliente.empresa) {
      const { data: existente } = await supabaseAdmin
        .from('pipeline_deals').select('id').eq('orcamento_id', orcId).maybeSingle()
      if (!existente) {
        await supabaseAdmin.from('pipeline_deals').insert({
          titulo, empresa_cnpj: cnpjLimpo || null,
          estagio: estagioAlvo, valor_estimado: valorTotal || null,
          orcamento_id: orcId,
        })
      } else {
        await supabaseAdmin.from('pipeline_deals')
          .update({ titulo, valor_estimado: valorTotal || null, estagio: estagioAlvo })
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
    // Salva antes de abrir o PDF para garantir dados atualizados
    await salvar()
    if (!editandoId) return
    await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'impresso', descricao: null, usuario: nomeUsuario || null })
    const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
    setHistorico((hd ?? []) as HistoricoItem[])
    window.open(`/print/orcamento/${editandoId}`, '_blank')
  }

  async function gerarCanva() {
    setGerandoCanva(true)
    try {
      await salvar()
      const empresaSel = empresas.find(e => e.id === empresaId)
      const nomeCliente = cliente.empresa || cliente.nome || 'Cliente'
      const titulo = `Orçamento ${numero || 'Novo'} — ${nomeCliente}`

      // Copia dados do orçamento para clipboard para colar no Canva
      const itensTexto = itens
        .filter(i => i.descricao)
        .map((i, idx) => {
          const q = parseFloat(i.qtd.replace(',', '.')) || 0
          const v = parseFloat(i.valorUnit.replace(',', '.')) || 0
          return `${idx + 1}. ${i.descricao} — ${i.qtd} ${i.unidade} × ${fmtBRL(v)} = ${fmtBRL(q * v)}`
        })
        .join('\n')

      const dadosBanc = dadosBancariosSel
        .map(id => dadosBancarios.find(d => d.id === id))
        .filter(Boolean)
        .map(d => formatarDadoBancario(d!))
        .join('\n\n')

      const textoCompleto = [
        `ORÇAMENTO ${numero || 'Novo'}`,
        `Data: ${fmtDataISO(dataEmissao)} | Validade: ${validadeDias} dias`,
        '',
        `EMPRESA: ${empresaSel?.nome_fantasia ?? ''}`,
        `CNPJ: ${empresaSel?.cnpj ?? ''} | Tel: ${empresaSel?.telefone ?? ''} | Email: ${empresaSel?.email ?? ''}`,
        '',
        `CLIENTE: ${nomeCliente}`,
        `Doc: ${cliente.cnpj || ''}`,
        `Tel: ${cliente.telefone} | Email: ${cliente.email}`,
        `End: ${[cliente.endereco, cliente.bairro, cliente.cidade, cliente.uf, cliente.cep].filter(Boolean).join(', ')}`,
        '',
        'ITENS:',
        itensTexto || '(nenhum item)',
        '',
        `Subtotal: ${fmtBRL(subtotal())}`,
        valorDesc() > 0 ? `Desconto: -${fmtBRL(valorDesc())}` : '',
        `TOTAL: ${fmtBRL(total())}`,
        '',
        condicoes.length ? `Condições: ${condicoes.join(' | ')}` : '',
        prazoEntrega ? `Prazo de entrega: ${prazoEntrega}` : '',
        '',
        observacoes ? `Observações: ${observacoes}` : '',
        dadosBanc ? `\nDADOS BANCÁRIOS:\n${dadosBanc}` : '',
      ].filter(Boolean).join('\n')

      // Copiar dados para clipboard
      await navigator.clipboard.writeText(textoCompleto)

      // Abrir template do orçamento no Canva + dados no clipboard
      const TEMPLATE_EDIT_URL = 'https://www.canva.com/design/DAHIExyT0R8/edit'
      showMsg('ok', 'Template aberto — dados copiados (Ctrl+V para colar)')
      window.open(TEMPLATE_EDIT_URL, '_blank')
    } catch (e) {
      showMsg('erro', `Erro Canva: ${(e as Error).message}`)
    } finally {
      setGerandoCanva(false)
    }
  }

  async function enviarEmail() {
    if (!editandoId || !cliente.email) return
    setEnviandoEmail(true)
    try {
      // Salvar antes de enviar
      await salvar()
      // Gerar link se não existir (com destinatário preenchido)
      let url = ''
      if (!links.length) {
        setNovoLinkDest(cliente.empresa || cliente.nome)
        await gerarLink()
        await carregarLinks(editandoId)
      } else {
        url = linkUrl(links[0])
      }
      // Pegar link atualizado
      const { data: linkD } = await supabaseAdmin
        .from('orcamento_links').select('token, short_code')
        .eq('orcamento_id', editandoId).eq('ativo', true).limit(1).maybeSingle()
      if (linkD) {
        const l = linkD as any
        url = l.short_code
          ? `${window.location.origin}/p/${l.short_code}`
          : `${window.location.origin}/view/orcamento/${l.token}`
      }

      // Preparar laudos com links e senhas
      const laudos = (proposta.laudos || []).map(l => ({
        nome: l.nome || 'Laudo Técnico',
        link: `${window.location.origin}/laudo/${l.watermark_id}`,
        senha: l.senha,
      }))

      const { data, error } = await supabaseAdmin.functions.invoke('enviar-email', {
        body: {
          acao: 'orcamento',
          para: cliente.email,
          nome: cliente.nome || '',
          empresa: cliente.empresa || '',
          numero,
          link: url,
          vendedor: nomeUsuario,
          whatsapp: cliente.whatsapp || (cliente.telefone_is_whatsapp ? cliente.telefone : '') || '',
          laudos,
        }
      })
      if (error) throw error
      if (data?.ok) {
        const waMsg = data.whatsapp_enviado ? ' + WhatsApp' : ''
        showMsg('ok', `E-mail enviado com sucesso!${waMsg}`)
        await salvar('enviado')
      } else {
        showMsg('erro', data?.erro || 'Erro ao enviar e-mail')
      }
    } catch (e: any) {
      showMsg('erro', e.message || 'Erro ao enviar e-mail')
    }
    setEnviandoEmail(false)
  }

  async function enviarWhatsApp() {
    const wa = cliente.whatsapp || (cliente.telefone_is_whatsapp ? cliente.telefone : '')
    if (!editandoId || !wa) return
    setEnviandoWa(true)
    try {
      let url = ''
      if (links.length) {
        url = linkUrl(links[0])
      } else {
        setNovoLinkDest(cliente.empresa || cliente.nome)
        await gerarLink()
        await carregarLinks(editandoId)
      }
      const { data: linkD } = await supabaseAdmin
        .from('orcamento_links').select('token, short_code')
        .eq('orcamento_id', editandoId).eq('ativo', true).limit(1).maybeSingle()
      if (linkD) {
        const l = linkD as any
        url = l.short_code
          ? `${window.location.origin}/p/${l.short_code}`
          : `${window.location.origin}/view/orcamento/${l.token}`
      }
      const { data, error } = await supabaseAdmin.functions.invoke('enviar-email', {
        body: {
          acao: 'orcamento',
          para: '',
          nome: cliente.nome || '',
          empresa: cliente.empresa || '',
          numero,
          link: url,
          vendedor: nomeUsuario,
          whatsapp: wa,
          laudos: (proposta.laudos || []).map(l => ({
            nome: l.nome || 'Laudo Técnico',
            link: `${window.location.origin}/laudo/${l.watermark_id}`,
            senha: l.senha,
          })),
        }
      })
      if (error) throw error
      if (data?.whatsapp_enviado) {
        showMsg('ok', 'WhatsApp enviado com sucesso!')
      } else {
        showMsg('erro', data?.erro || 'Erro ao enviar WhatsApp')
      }
    } catch (e: any) {
      showMsg('erro', e.message || 'Erro ao enviar WhatsApp')
    }
    setEnviandoWa(false)
  }

  async function gerarReceivel() {
    if (!editandoId) return
    setGerandoRec(true)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data: lanc, error } = await supabaseAdmin.from('fin_lancamentos').insert({
        descricao: `Orçamento ${numero} — ${cliente.empresa || cliente.nome || 'Cliente'}`,
        tipo: 'receita', valor: total(), status: 'pendente',
        data_competencia: hoje,
        data_vencimento: new Date(Date.now() + (parseInt(validadeDias) || 7) * 864e5).toISOString().slice(0, 10),
        origem: 'manual',
      }).select('id').single()
      if (error) throw error
      if (lanc) {
        const lid = (lanc as Record<string, unknown>).id as number
        await supabaseAdmin.from('orcamentos').update({ fin_lancamento_id: lid }).eq('id', editandoId)
        await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'receivel_gerado', descricao: `Lançamento #${lid}`, usuario: nomeUsuario || null })
        setFinLancId(lid)
        const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
        setHistorico((hd ?? []) as HistoricoItem[])
        showMsg('ok', 'Recebível criado no Financeiro.')
      }
    } catch (err) {
      console.error('Erro ao gerar recebível:', err)
      showMsg('erro', 'Erro ao gerar recebível.')
    } finally {
      setGerandoRec(false)
    }
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
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) { showMsg('erro', 'Arquivo muito grande (máx. 10 MB).'); return }
    setUploadandoAnexo(true)
    try {
      const path = `orc-${editandoId}/${Date.now()}-${file.name}`
      const { data: up, error } = await supabaseAdmin.storage.from('orcamentos-anexos').upload(path, file)
      if (error) throw error
      if (up) {
        const { data: url } = supabaseAdmin.storage.from('orcamentos-anexos').getPublicUrl(path)
        const { data: anx } = await supabaseAdmin.from('orcamentos_anexos').insert({ orcamento_id: editandoId, nome: file.name, url: url.publicUrl, tamanho: file.size, tipo: file.type }).select().single()
        if (anx) setAnexos(prev => [...prev, anx as Anexo])
        await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'anexo_adicionado', descricao: file.name, usuario: nomeUsuario || null })
      }
    } catch (err) {
      console.error('Erro no upload:', err)
      showMsg('erro', 'Erro ao enviar anexo.')
    } finally {
      setUploadandoAnexo(false)
    }
  }

  async function uploadImagem(file: File) {
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) { showMsg('erro', 'Imagem muito grande (máx. 5 MB).'); return }
    setUploadandoImagem(true)
    try {
      const path = `img-${editandoId ?? 'novo'}-${Date.now()}.${file.name.split('.').pop()}`
      const { data: up, error } = await supabaseAdmin.storage.from('orcamentos-anexos').upload(path, file, { upsert: true })
      if (error) throw error
      if (up) {
        const { data: url } = supabaseAdmin.storage.from('orcamentos-anexos').getPublicUrl(path)
        setImagemUrl(url.publicUrl)
      }
    } catch (err) {
      console.error('Erro no upload imagem:', err)
      showMsg('erro', 'Erro ao enviar imagem.')
    } finally {
      setUploadandoImagem(false)
    }
  }

  // buscarCEP movido para ClienteForm

  async function excluirOrcamento(id: number) {
    try {
      await supabaseAdmin.from('pipeline_deals').delete().eq('orcamento_id', id)
      const { error } = await supabaseAdmin.from('orcamentos').delete().eq('id', id)
      if (error) throw error
      showMsg('ok', 'Orçamento excluído.')
      setConfirmExcluir(false)
      if (modoEditor) { setEditandoId(null); setModoEditor(false); setMobileTab('lista') }
      carregarLista()
    } catch (err) {
      console.error('Erro ao excluir:', err)
      showMsg('erro', 'Erro ao excluir orçamento.')
    }
  }

  async function removerAnexo(id: number) {
    try {
      const { error } = await supabaseAdmin.from('orcamentos_anexos').delete().eq('id', id)
      if (error) throw error
      setAnexos(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Erro ao remover anexo:', err)
      showMsg('erro', 'Erro ao remover anexo.')
    }
  }

  // selecionarCliente movido para ClienteForm
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


  // ── Helpers ────────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = [['Número','Empresa','Cliente','Vendedor','Total','Status','Data']]
    lista.forEach(o => rows.push([o.numero, o.empresa_nome ?? '', o.cliente_empresa || o.cliente_nome || '', o.vendedor_nome ?? '', String(o.total), STATUS_CFG[o.status as Status]?.label ?? o.status, fmtDataISO(o.criado_em)]))
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orcamentos-${filtroStatus}.csv`; a.click()
  }

  const hasOrcamento = editandoId != null

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {msg && (
        <div className={`${styles.toast} ${msg.tipo === 'ok' ? styles.toastOk : styles.toastErro}`}>
          {msg.texto}
        </div>
      )}

      <div className={styles.hubWrap}>

        {/* Mobile tabs */}
        <div className={styles.mobileTabs}>
          {(['lista', 'editor', 'acoes'] as const).map(tab => (
            <button key={tab} className={`${styles.mobileTab} ${mobileTab === tab ? styles.mobileTabActive : ''}`}
              onClick={() => setMobileTab(tab)}>
              {tab === 'lista' ? 'Lista' : tab === 'editor' ? 'Orçamento' : 'Ações'}
            </button>
          ))}
        </div>

        {/* ═══ LEFT PANEL — Lista ═══ */}
        <div className={`${styles.listPanel} ${mobileTab !== 'lista' ? styles.mobileHidden : ''}`}>
          <OrcamentoList
            lista={lista} loading={loadingLista} editandoId={editandoId}
            filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
            ocultarValores={ocultarValores} isAdminUser={isAdminUser}
            onSelecionar={id => carregarOrcamento(id, 'detalhe')}
            onEditar={id => carregarOrcamento(id, 'editor')}
            onNovo={abrirNovo} onExcluir={excluirOrcamento} onExportCsv={exportCsv}
            styles={styles}
          />
        </div>

        {/* ═══ CENTER PANEL — Editor / Detalhe / Empty ═══ */}
        <div className={`${styles.editorPanel} ${mobileTab !== 'editor' ? styles.mobileHidden : ''}`}>

          {/* Editor header bar */}
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.panelTitle}>
                {!hasOrcamento ? 'Orçamento' : modoEditor ? (editandoId ? `Editando ${numero}` : 'Novo') : `Detalhe ${numero}`}
              </span>
              {hasOrcamento && !modoEditor && (
                <button className={styles.btnMini} onClick={() => setModoEditor(true)} style={{ fontSize: '0.74rem', padding: '4px 10px' }}><Pencil size={13} /> Editar</button>
              )}
              {hasOrcamento && modoEditor && (
                <button className={styles.btnMini} onClick={() => setModoEditor(false)} style={{ fontSize: '0.74rem', padding: '4px 10px' }}><Eye size={13} /> Ver</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={styles.btnMini} onClick={() => setDrawerOpen(true)} style={{ fontSize: '0.74rem', padding: '4px 10px' }}><Settings size={13} /> Config</button>
            </div>
          </div>

          {/* Center content */}
          {!hasOrcamento ? (
            <div className={styles.editorEmpty}>
              <div className={styles.editorEmptyIcon}><ClipboardList size={40} /></div>
              <div className={styles.editorEmptyTitle}>Selecione um orçamento</div>
              <div className={styles.editorEmptySub}>Escolha na lista à esquerda ou crie um novo.</div>
              {fromState?.returnTo && (
                <button onClick={() => navigate(fromState.returnTo!)} className={styles.btnSecondary} style={{ marginTop: 16 }}>
                  <ArrowLeft size={13} /> Voltar para {fromState.returnTo.includes('central') ? 'Central de Vendas' : fromState.returnTo.includes('projetos') ? 'Projetos' : 'módulo anterior'}
                </button>
              )}
            </div>
          ) : !modoEditor ? (
            /* ═══ DETALHE (read-only) ═══ */
            <div className={styles.editorPanelBody}>
              <DetalheView
                numero={numero} status={status} empresaSel={empresaSel} vendedores={vendedores}
                vendedorId={vendedorId} cliente={cliente} itens={itens}
                subtotal={subtotal()} valorDesc={valorDesc()} desconto={desconto} tipoDesc={tipoDesc}
                valorFrete={valorFrete()} valorInst={valorInst()} total={total()} fmt={fmt}
                freteSummary={freteSummaryRef.current} condicoes={condicoes}
                dadosBancarios={dadosBancarios} dadosBancariosSel={dadosBancariosSel}
                prazoEntrega={prazoEntrega} validadeDias={validadeDias} dataEmissao={dataEmissao}
                instalacao={instalacao} observacoes={observacoes} anexos={anexos}
                finLancId={finLancId} historico={historico}
                onEditar={() => setModoEditor(true)} onImprimir={imprimir} styles={styles}
              />
            </div>
          ) : (
            /* ═══ EDITOR ═══ */
            <div className={styles.editorPanelBody}>
              {empresaDesatualizada && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#92400e' }}>
                  <span><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> Dados da empresa desatualizados.</span>
                  <button onClick={() => salvar()} disabled={salvando} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.80rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {salvando ? '...' : <><RefreshCw size={13} /> Atualizar</>}
                  </button>
                </div>
              )}

              <CollapsibleSection title="Emissão">
                <div className={styles.row2}>
                  <div className={styles.fg}>
                    <label>Empresa emissora</label>
                    <select className={styles.input} value={empresaId ?? ''} onChange={e => setEmpresaId(Number(e.target.value))}>
                      <option value="">— Selecione —</option>
                      {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia}</option>)}
                    </select>
                  </div>
                  <div className={styles.fg}>
                    <label>Vendedor / Consultor</label>
                    <select className={styles.input} value={vendedorId ?? ''} onChange={e => setVendedorId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— Selecione —</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title={<><User size={16} /> Destinatário</>}>
                <ClienteForm cliente={cliente} setCliente={setCliente} styles={styles} />
              </CollapsibleSection>

              <ItensSection
                itens={itens} setItens={setItens} exibir={exibir}
                subtotal={subtotal()} desconto={desconto} setDesconto={setDesconto}
                tipoDesc={tipoDesc} setTipoDesc={setTipoDesc}
                valorDesc={valorDesc()} total={total()} fmt={fmt}
                showBuscaProduto={showBuscaProduto} setShowBuscaProduto={setShowBuscaProduto}
                buscaProduto={buscaProduto} setBuscaProduto={setBuscaProduto}
                resultadosProduto={resultadosProduto} loadingProduto={loadingProduto}
                adicionarProduto={adicionarProduto}
                showBuscaOutlet={showBuscaOutlet} setShowBuscaOutlet={setShowBuscaOutlet}
                buscaOutlet={buscaOutlet} setBuscaOutlet={setBuscaOutlet}
                resultadosOutlet={resultadosOutlet} loadingOutlet={loadingOutlet}
                adicionarOutlet={adicionarOutlet}
                clienteNome={cliente.nome || cliente.empresa || ''}
                styles={styles}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', margin: '8px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={modoProposta} onChange={e => setModoProposta(e.target.checked)} style={{ width: 18, height: 18 }} />
                  <FileText size={14} style={{ verticalAlign: 'middle' }} /> Proposta Comercial
                </label>
                {!modoProposta && <span style={{ fontSize: '0.78rem', color: '#94a3b8', flex: '1 1 100%' }}>Ative para adicionar seções de apresentação, escopo, cronograma e garantias</span>}
                {modoProposta && editandoId && (
                  <CompartilharProposta
                    orcamentoId={editandoId}
                    empresa={cliente.empresa || cliente.nome || cliente.empresa || ''}
                    cnpj={cliente.cnpj || ''}
                    contato={cliente.nome || ''}
                    email={cliente.email || ''}
                    usuario={nomeUsuario}
                  />
                )}
              </div>

              {modoProposta && (
                <PropostaSection
                  proposta={proposta} setProposta={setProposta}
                  clienteNome={cliente.empresa || cliente.nome || cliente.empresa || ''}
                  clienteSegmento={fromState?.prospect?.segmento || (/fixador|grampo|bucha prego|porcelanato|disco|broca|pu /i.test(itens.map(i => i.descricao).join(' ')) ? 'Construção Civil' : '')}
                  itensResumo={itens.filter(i => i.descricao.trim()).map(i => `${i.descricao} (${i.qtd} ${i.unidade})`).join(', ')}
                  styles={styles}
                />
              )}

              <EspecificacaoSection
                orcamentoId={editandoId}
                onItensAdded={novos => setItens(prev => [...prev.filter(i => i.descricao.trim()), ...novos])}
                prospectSegmento={fromState?.prospect?.segmento}
                styles={styles}
              />

              <CollapsibleSection title={<><Truck size={16} /> Frete &amp; Logística</>}>
                <FreteSection
                  orcamentoId={editandoId}
                  cepOrigem={empresaSel?.cep || '37550360'}
                  cepDestino={cliente.ent_diferente ? cliente.ent_cep : cliente.cep}
                  valorMercadoria={subtotal()}
                  parentStyles={styles}
                  onFreteChange={handleFreteChange}
                  usuario={nomeUsuario}
                />
              </CollapsibleSection>

              <CollapsibleSection title={<><Wrench size={16} /> Instalação / Montagem</>}>
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
                          <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}><Check size={13} style={{ verticalAlign: 'middle' }} /> Aparece na proposta como benefício — não soma no total</div>
                        )}
                      </div>
                    </div>
                    <div className={styles.fg}><label>Descrição</label><input className={styles.input} placeholder="Ex: Instalação e comissionamento incluso" value={instalacao.texto} onChange={e => setInstalacao(i => ({ ...i, texto: e.target.value }))} /></div>
                  </>
                )}
              </CollapsibleSection>

              <CondicoesSection
                condicoes={condicoes} setCondicoes={setCondicoes}
                dadosBancarios={dadosBancarios} dadosBancariosSel={dadosBancariosSel}
                setDadosBancariosSel={setDadosBancariosSel}
                dadosPagamento={dadosPagamento} setDadosPagamento={setDadosPagamento}
                prazoEntrega={prazoEntrega} setPrazoEntrega={setPrazoEntrega}
                validadeDias={validadeDias} setValidadeDias={setValidadeDias}
                dataEmissao={dataEmissao} observacoes={observacoes} setObservacoes={setObservacoes}
                onOpenConfig={() => setDrawerOpen(true)} styles={styles}
              />

              <CollapsibleSection title={<><Paperclip size={16} /> Anexos</>} count={anexos.length}>
                {anexos.length > 0 && (
                  <div className={styles.anexosList}>
                    {anexos.map(a => (
                      <div key={a.id ?? a.nome} className={styles.anexoItem}>
                        <a href={a.url} target="_blank" rel="noreferrer" className={styles.anexoLink}><Paperclip size={12} /> {a.nome}</a>
                        {a.tamanho && <span className={styles.anexoSize}>{(a.tamanho / 1024).toFixed(0)} KB</span>}
                        {a.id && <button className={styles.btnRemoveItem} onClick={() => removerAnexo(a.id!)}><X size={12} /></button>}
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" ref={anexoRef} style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadAnexo(e.target.files[0])} />
                <button className={styles.btnAddItem} onClick={() => anexoRef.current?.click()} disabled={uploadandoAnexo}>
                  {uploadandoAnexo ? 'Enviando...' : <><Paperclip size={14} /> Anexar arquivo</>}
                </button>
              </CollapsibleSection>
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL — Ações ═══ */}
        <div className={`${styles.actionsPanel} ${mobileTab !== 'acoes' ? styles.mobileHidden : ''}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Ações</span>
          </div>
          <div className={styles.actionsPanelBody}>
            {hasOrcamento ? (
              <>
                <ResumoSidebar
                  numero={numero} status={status}
                  empresaNome={empresaSel?.nome_fantasia ?? null}
                  clienteNome={cliente.empresa || cliente.nome}
                  subtotal={subtotal()} valorDesc={valorDesc()} tipoDesc={tipoDesc}
                  frete={freteSummaryRef.current} instalacao={instalacao}
                  total={total()} ocultarValores={ocultarValores}
                  salvando={salvando} onSalvar={(s) => salvar(s)} onImprimir={imprimir}
                  onCanva={gerarCanva} gerandoCanva={gerandoCanva}
                  finLancId={finLancId} gerandoRec={gerandoRec} onGerarReceivel={gerarReceivel}
                  etiquetaPreId={etiquetaPreId} gerandoEtiq={gerandoEtiq}
                  baixandoRotulo={baixandoRotulo} baixandoDace={baixandoDace} cancelandoEtiq={cancelandoEtiq}
                  onGerarEtiqueta={gerarEtiqueta} onBaixarRotulo={baixarRotulo}
                  onBaixarDace={baixarDace} onCancelarEtiqueta={cancelarEtiqueta}
                  clienteEmail={cliente.email || ''} enviandoEmail={enviandoEmail} onEnviarEmail={enviarEmail}
                  clienteWhatsapp={cliente.whatsapp || (cliente.telefone_is_whatsapp ? cliente.telefone : '') || ''} enviandoWa={enviandoWa} onEnviarWhatsApp={enviarWhatsApp}
                  editandoId={editandoId} isAdminUser={isAdminUser}
                  confirmExcluir={confirmExcluir} setConfirmExcluir={setConfirmExcluir}
                  onExcluir={excluirOrcamento}
                  styles={styles}
                />

                {editandoId && (
                  <CollapsibleSection title={`Links ${links.length ? `(${links.length})` : ''}`}>
                    <LinksSection
                      editandoId={editandoId} links={links} gerandoLink={gerandoLink}
                      novoLinkDest={novoLinkDest} setNovoLinkDest={setNovoLinkDest}
                      acessosLink={acessosLink} expandedLink={expandedLink}
                      carregarLinks={carregarLinks} toggleAcessos={toggleAcessos}
                      gerarLink={gerarLink} desativarLink={desativarLink} linkUrl={linkUrl}
                      showMsg={showMsg} vendedores={vendedores} vendedorId={vendedorId}
                      cliente={cliente} numero={numero} styles={styles}
                    />
                  </CollapsibleSection>
                )}

                <CollapsibleSection title={`Histórico ${historico.length ? `(${historico.length})` : ''}`}>
                  <HistoricoSection historico={historico} styles={styles} />
                </CollapsibleSection>
              </>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                Selecione um orçamento para ver ações.
              </div>
            )}
          </div>
        </div>

      </div>

      <ConfigDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        empresas={empresas} carregarEmpresas={carregarEmpresas}
        uploadandoLogo={uploadandoLogo} uploadLogo={uploadLogo} showMsg={showMsg}
        vendedores={vendedores} carregarVendedores={carregarVendedores}
        dadosBancarios={dadosBancarios} carregarDadosBancarios={carregarDadosBancarios}
        showControles={showControles} setShowControles={setShowControles}
        exibir={exibir} setExibir={setExibir}
        watermarkAtivo={watermarkAtivo} setWatermarkAtivo={setWatermarkAtivo}
        watermarkLogo={watermarkLogo} setWatermarkLogo={setWatermarkLogo}
        watermarkTexto={watermarkTexto} setWatermarkTexto={setWatermarkTexto}
        imagemUrl={imagemUrl} setImagemUrl={setImagemUrl}
        imagemRef={imagemRef} uploadandoImagem={uploadandoImagem} uploadImagem={uploadImagem}
        origemLead={origemLead} setOrigemLead={setOrigemLead}
        obsInternas={obsInternas} setObsInternas={setObsInternas}
        styles={styles}
      />
    </>
  )
}
