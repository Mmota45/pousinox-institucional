import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'
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
import ConfigDrawer from '../components/Orcamento/ConfigDrawer'

import type {
  EmpresaEmissora, Vendedor, OrcamentoResumo, Item, Instalacao, OrcLink,
  ExibirProposta, DadoBancario, Anexo, HistoricoItem, ProdutoResult,
  OutletResult, Status, Vista, ClienteInfo, FreteSummary,
} from '../components/Orcamento/types'

import {
  UNIDADES, EXIBIR_DEFAULT, COND_PAGAMENTO, STATUS_CFG, EVENTO_LABEL,
  ITEM_VAZIO, CLIENTE_VAZIO, INST_VAZIO, OBS_DEFAULT,
  fmtBRL, hoje, fmtDataISO, formatarDadoBancario,
} from '../components/Orcamento/types'
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
  const [ordenCol, setOrdenCol] = useState<string>('criado_em')
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('desc')
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
    } catch (err) { console.error('Erro ao carregar empresas:', err) }
  }, [])

  const carregarVendedores = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from('vendedores').select('*').eq('ativo', true).order('nome')
      if (error) throw error
      setVendedores((data ?? []) as Vendedor[])
    } catch (err) { console.error('Erro ao carregar vendedores:', err) }
  }, [])

  const carregarDadosBancarios = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from('dados_bancarios').select('*').eq('ativo', true).order('ordem')
      if (error) throw error
      setDadosBancarios((data ?? []) as DadoBancario[])
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
      setVista('editor')
      carregarLista()
    } catch (err) {
      console.error('Erro ao criar orçamento:', err)
      showMsg('erro', 'Erro ao criar orçamento.')
    }
  }

  async function carregarOrcamento(id: number, destino: Vista = 'editor') {
    try {
    const [{ data: orc, error: errOrc }, { data: itensD }, { data: anexosD }, { data: histD }] = await Promise.all([
      supabaseAdmin.from('orcamentos').select('*').eq('id', id).single(),
      supabaseAdmin.from('itens_orcamento').select('*').eq('orcamento_id', id).order('ordem'),
      supabaseAdmin.from('orcamentos_anexos').select('*').eq('orcamento_id', id).order('criado_em'),
      supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', id).order('criado_em', { ascending: false }),
    ])
    if (errOrc) throw errOrc
    if (!orc) return
    const o = orc as Record<string, unknown>
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
      whatsapp: o.cliente_whatsapp ?? '', cargo: o.cliente_cargo ?? '',
      cargo_outro: '', inscricao_estadual: o.cliente_inscricao_est ?? '',
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
      ? (itensD as Record<string, unknown>[]).map(i => ({
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
    setVista(destino)
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
        `Doc: ${cliente.cnpj || cliente.cpf || ''}`,
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
      if (vista === 'editor') setVista('lista')
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
        <nav className={styles.breadcrumb}>
          <button className={styles.breadcrumbLink} onClick={() => setVista('lista')}>Orçamentos</button>
          {vista === 'detalhe' && <>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Detalhe</span>
          </>}
          {vista === 'editor' && <>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{editandoId ? 'Editando' : 'Novo'}</span>
          </>}
        </nav>
        <div className={styles.navActions}>
          <button className={styles.navLink} onClick={() => setDrawerOpen(true)}>⚙️ Config</button>
          <button className={styles.btnNovo} onClick={abrirNovo}>+ Novo Orçamento</button>
        </div>
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
            {lista.length > 0 && (
              <button className={styles.filtroBtn} onClick={() => {
                const rows = [['Número','Empresa','Cliente','Vendedor','Total','Status','Data']]
                lista.forEach(o => rows.push([o.numero, o.empresa_nome ?? '', o.cliente_empresa || o.cliente_nome || '', o.vendedor_nome ?? '', String(o.total), STATUS_CFG[o.status as Status]?.label ?? o.status, fmtDataISO(o.criado_em)]))
                const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orcamentos-${filtroStatus}.csv`; a.click()
              }}>📥 CSV</button>
            )}
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
                    <div key={o.id} className={styles.listaCard} onClick={() => carregarOrcamento(o.id, 'detalhe')} style={{ cursor: 'pointer' }}>
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
                        <div className={styles.listaCardAcoes} onClick={e => e.stopPropagation()}>
                          <button className={styles.btnMini} onClick={() => carregarOrcamento(o.id)} title="Editar">✏️</button>
                          {isAdminUser && (
                            <button className={`${styles.btnMini} ${styles.btnMiniDanger}`} title="Excluir"
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
                <thead><tr>
                  {[
                    { key: 'numero', label: 'Número' }, { key: 'empresa_nome', label: 'Empresa' },
                    { key: 'cliente_empresa', label: 'Cliente' }, { key: 'vendedor_nome', label: 'Vendedor' },
                    { key: 'total', label: 'Total' }, { key: 'status', label: 'Status' },
                    { key: 'criado_em', label: 'Data' },
                  ].map(col => (
                    <th key={col.key} onClick={() => { setOrdenDir(ordenCol === col.key && ordenDir === 'asc' ? 'desc' : 'asc'); setOrdenCol(col.key) }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}>
                      {col.label} {ordenCol === col.key ? (ordenDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                  <th></th>
                </tr></thead>
                <tbody>
                  {[...lista].sort((a, b) => {
                    const ak = (a as Record<string, unknown>)[ordenCol], bk = (b as Record<string, unknown>)[ordenCol]
                    const av = typeof ak === 'number' ? ak : String(ak ?? '').toLowerCase()
                    const bv = typeof bk === 'number' ? bk : String(bk ?? '').toLowerCase()
                    if (av < bv) return ordenDir === 'asc' ? -1 : 1
                    if (av > bv) return ordenDir === 'asc' ? 1 : -1
                    return 0
                  }).map(o => (
                    <tr key={o.id} onClick={() => carregarOrcamento(o.id, 'detalhe')}>
                      <td><strong style={{ color: '#1a5fa8' }}>{o.numero}</strong></td>
                      <td>{o.empresa_nome ?? '—'}</td>
                      <td className={styles.tdCliente} title={o.cliente_empresa || o.cliente_nome || ''}>{o.cliente_empresa || o.cliente_nome || '—'}</td>
                      <td>{o.vendedor_nome ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>{ocultarValores ? '••••' : fmtBRL(Number(o.total))}</td>
                      <td><span className={styles.statusBadge} style={{ background: STATUS_CFG[o.status as Status]?.cor + '22', color: STATUS_CFG[o.status as Status]?.cor }}>{STATUS_CFG[o.status as Status]?.label}</span></td>
                      <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{fmtDataISO(o.criado_em)}</td>
                      <td className={styles.tdAcoes} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className={styles.btnMini} onClick={() => carregarOrcamento(o.id)} title="Editar">✏️</button>
                          {isAdminUser && (
                            <button className={`${styles.btnMini} ${styles.btnMiniDanger}`} title="Excluir"
                              onClick={() => { if (window.confirm(`Excluir orçamento ${o.numero}? Esta ação não pode ser desfeita.`)) excluirOrcamento(o.id) }}>🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ DETALHE (read-only) ═══ */}
      {vista === 'detalhe' && editandoId && (() => {
        const cfg = STATUS_CFG[status]
        const vend = vendedores.find(v => v.id === vendedorId)
        const freteS = freteSummaryRef.current
        return (
          <div className={styles.detalheWrap}>
            {/* Header */}
            <div className={styles.detalheHeader}>
              <div className={styles.detalheHeaderLeft}>
                <span className={styles.detalheNumero}>{numero}</span>
                <span className={styles.statusBadge} style={{ background: cfg?.cor + '22', color: cfg?.cor }}>{cfg?.label}</span>
              </div>
              <div className={styles.detalheActions}>
                <button className={styles.btnPrimary} onClick={() => setVista('editor')}>✏️ Editar</button>
                <button className={styles.btnImprimir} onClick={imprimir}>🖨 PDF</button>
              </div>
            </div>

            <div className={styles.detalheGrid}>
              {/* Empresa emissora */}
              <div className={styles.detalheCard}>
                <div className={styles.detalheCardTitle}>Empresa Emissora</div>
                <div className={styles.detalheCampo}><strong>Empresa:</strong> <span>{empresaSel?.nome_fantasia ?? '—'}</span></div>
                {empresaSel?.razao_social && <div className={styles.detalheCampo}><strong>Razão social:</strong> <span>{empresaSel.razao_social}</span></div>}
                {empresaSel?.cnpj && <div className={styles.detalheCampo}><strong>CNPJ:</strong> <span>{empresaSel.cnpj}</span></div>}
                {empresaSel?.telefone && <div className={styles.detalheCampo}><strong>Telefone:</strong> <span>{empresaSel.telefone}</span></div>}
                {empresaSel?.email && <div className={styles.detalheCampo}><strong>E-mail:</strong> <span>{empresaSel.email}</span></div>}
                {vend && <div className={styles.detalheCampo}><strong>Vendedor:</strong> <span>{vend.nome}</span></div>}
              </div>

              {/* Cliente */}
              <div className={styles.detalheCard}>
                <div className={styles.detalheCardTitle}>Cliente</div>
                {cliente.empresa && <div className={styles.detalheCampo}><strong>Empresa:</strong> <span>{cliente.empresa}</span></div>}
                {cliente.nome_fantasia && <div className={styles.detalheCampo}><strong>Nome fantasia:</strong> <span>{cliente.nome_fantasia}</span></div>}
                {cliente.nome && <div className={styles.detalheCampo}><strong>Contato:</strong> <span>{cliente.nome}</span></div>}
                {cliente.cargo && <div className={styles.detalheCampo}><strong>Cargo:</strong> <span>{cliente.cargo}</span></div>}
                {cliente.cnpj && <div className={styles.detalheCampo}><strong>{cliente.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}:</strong> <span>{cliente.cnpj}</span></div>}
                {cliente.telefone && <div className={styles.detalheCampo}><strong>Telefone:</strong> <span>{cliente.telefone}</span></div>}
                {cliente.email && <div className={styles.detalheCampo}><strong>E-mail:</strong> <span>{cliente.email}</span></div>}
                {cliente.cep && <div className={styles.detalheCampo}><strong>Endereço:</strong> <span>{[cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(', ')} — CEP {cliente.cep}</span></div>}
                {cliente.perfil_comprador && <div className={styles.detalheCampo}><strong>Perfil:</strong> <span>{cliente.perfil_comprador}</span></div>}
              </div>

              {/* Itens */}
              <div className={`${styles.detalheCard} ${styles.detalheCardFull}`}>
                <div className={styles.detalheCardTitle}>Itens</div>
                <table className={styles.detalheItensTable}>
                  <thead><tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Vl. Unit.</th><th>Total</th></tr></thead>
                  <tbody>
                    {itens.filter(i => i.descricao.trim()).map((item, idx) => {
                      const q = parseFloat(item.qtd.replace(',', '.')) || 0
                      const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{item.descricao}{item.obs_tecnica ? <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{item.obs_tecnica}</div> : null}</td>
                          <td>{item.qtd}</td>
                          <td>{item.unidade}</td>
                          <td>{fmt(v)}</td>
                          <td>{fmt(q * v)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className={styles.detalheTotais}>
                  <div className={styles.detalheTotaisRow}><span>Subtotal</span><span>{fmt(subtotal())}</span></div>
                  {valorDesc() > 0 && <div className={styles.detalheTotaisRow}><span>Desconto ({tipoDesc === '%' ? `${desconto}%` : 'R$'})</span><span>−{fmt(valorDesc())}</span></div>}
                  {valorFrete() > 0 && <div className={styles.detalheTotaisRow}><span>Frete</span><span>{fmt(valorFrete())}</span></div>}
                  {valorInst() > 0 && <div className={styles.detalheTotaisRow}><span>Instalação</span><span>{fmt(valorInst())}</span></div>}
                  <div className={`${styles.detalheTotaisRow} ${styles.detalheTotaisTotal}`}><span>Total</span><span>{fmt(total())}</span></div>
                </div>
              </div>

              {/* Frete & Logística */}
              {freteS.tipo && (
                <div className={styles.detalheCard}>
                  <div className={styles.detalheCardTitle}>Frete & Logística</div>
                  <div className={styles.detalheCampo}><strong>Tipo:</strong> <span>{freteS.tipo}</span></div>
                  <div className={styles.detalheCampo}><strong>Modalidade:</strong> <span>{freteS.modalidade === 'cobrar' ? 'Cobrar do cliente' : 'Bonificado'}</span></div>
                  {freteS.provedor && <div className={styles.detalheCampo}><strong>Provedor:</strong> <span>{freteS.provedor} {freteS.servico ? `— ${freteS.servico}` : ''}</span></div>}
                  {freteS.valor > 0 && <div className={styles.detalheCampo}><strong>Valor:</strong> <span>{fmtBRL(freteS.valor)}</span></div>}
                  {freteS.prazo && <div className={styles.detalheCampo}><strong>Prazo:</strong> <span>{freteS.prazo}</span></div>}
                  {freteS.peso_total_kg > 0 && <div className={styles.detalheCampo}><strong>Peso:</strong> <span>{freteS.peso_total_kg} kg</span></div>}
                </div>
              )}

              {/* Condições */}
              <div className={styles.detalheCard}>
                <div className={styles.detalheCardTitle}>Condições Comerciais</div>
                {condicoes.length > 0 && <div className={styles.detalheCampo}><strong>Pagamento:</strong> <span>{condicoes.join(', ')}</span></div>}
                {dadosBancariosSel.length > 0 && <div className={styles.detalheCampo}><strong>Dados bancários:</strong> <span>{dadosBancarios.filter(d => dadosBancariosSel.includes(d.id)).map(d => d.apelido).join(', ')}</span></div>}
                {prazoEntrega && <div className={styles.detalheCampo}><strong>Prazo entrega:</strong> <span>{prazoEntrega}</span></div>}
                <div className={styles.detalheCampo}><strong>Validade:</strong> <span>{validadeDias} dias</span></div>
                <div className={styles.detalheCampo}><strong>Emissão:</strong> <span>{dataEmissao}</span></div>
              </div>

              {/* Instalação */}
              {instalacao.inclui && (
                <div className={styles.detalheCard}>
                  <div className={styles.detalheCardTitle}>Instalação / Montagem</div>
                  <div className={styles.detalheCampo}><strong>Modalidade:</strong> <span>{instalacao.modalidade === 'cobrar' ? 'Cobrar do cliente' : 'Bonificada'}</span></div>
                  {instalacao.valor && <div className={styles.detalheCampo}><strong>Valor:</strong> <span>{fmtBRL(parseFloat(instalacao.valor.replace(',', '.')) || 0)}</span></div>}
                  {instalacao.texto && <div className={styles.detalheCampo}><strong>Descrição:</strong> <span>{instalacao.texto}</span></div>}
                </div>
              )}

              {/* Observações */}
              {observacoes && observacoes !== OBS_DEFAULT && (
                <div className={`${styles.detalheCard} ${styles.detalheCardFull}`}>
                  <div className={styles.detalheCardTitle}>Observações</div>
                  <div style={{ fontSize: '0.84rem', color: '#374151', whiteSpace: 'pre-line' }}>{observacoes}</div>
                </div>
              )}

              {/* Anexos */}
              {anexos.length > 0 && (
                <div className={styles.detalheCard}>
                  <div className={styles.detalheCardTitle}>Anexos ({anexos.length})</div>
                  {anexos.map(a => (
                    <div key={a.id ?? a.nome} className={styles.detalheCampo}>
                      <a href={a.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📎 {a.nome}</a>
                      {a.tamanho && <span style={{ color: '#94a3b8', fontSize: '0.76rem', marginLeft: 6 }}>{(a.tamanho / 1024).toFixed(0)} KB</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Recebível */}
              {finLancId && (
                <div className={styles.detalheCard}>
                  <div className={styles.detalheCardTitle}>Financeiro</div>
                  <div className={styles.detalheCampo} style={{ color: '#16a34a', fontWeight: 600 }}>✓ Recebível #{finLancId} vinculado</div>
                </div>
              )}

              {/* Histórico */}
              {historico.length > 0 && (
                <div className={`${styles.detalheCard} ${styles.detalheCardFull}`}>
                  <div className={styles.detalheCardTitle}>Histórico</div>
                  {historico.slice(0, 10).map((h, i) => (
                    <div key={i} className={styles.detalheCampo} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem', minWidth: 100 }}>{fmtDataISO(h.criado_em)}</span>
                      <span>{EVENTO_LABEL[h.evento] ?? h.evento}{h.descricao ? ` — ${h.descricao}` : ''}</span>
                      {h.usuario && <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>por {h.usuario}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

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

          <div className={styles.layout}>
            <div className={styles.layoutMain}>
              {/* Empresa & Vendedor */}
              <CollapsibleSection title="📋 Emissão" defaultOpen>
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

              <ClienteForm cliente={cliente} setCliente={setCliente} styles={styles} />

              {/* Itens */}
              <CollapsibleSection title="📦 Itens" defaultOpen>
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
              </CollapsibleSection>

              {/* Frete & Logística */}
              <FreteSection
                orcamentoId={editandoId}
                cepOrigem={empresaSel?.cep || '37550360'}
                cepDestino={cliente.ent_diferente ? cliente.ent_cep : cliente.cep}
                valorMercadoria={subtotal()}
                parentStyles={styles}
                onFreteChange={handleFreteChange}
                usuario={nomeUsuario}
              />

              {/* Instalação/Montagem */}
              <CollapsibleSection title="🔧 Instalação / Montagem">
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
              </CollapsibleSection>

              {/* Condições Comerciais */}
              <CollapsibleSection title="💰 Condições Comerciais">
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
                </div>

                {/* Dados bancários pré-cadastrados */}
                {(condicoes.includes('PIX') || condicoes.includes('Depósito/Transferência') || condicoes.includes('Boleto bancário')) && (
                  <div className={styles.fg}>
                    <label>Dados bancários para pagamento</label>
                    {dadosBancarios.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {dadosBancarios.map(d => (
                          <label key={d.id} style={{
                            display: 'flex', gap: 10, padding: '10px 12px', cursor: 'pointer',
                            background: dadosBancariosSel.includes(d.id) ? '#f0f7ff' : '#f8fafc',
                            border: `1.5px solid ${dadosBancariosSel.includes(d.id) ? '#1a5fa8' : '#e2e8f0'}`,
                            borderRadius: 8, transition: 'border-color 0.15s',
                          }}>
                            <input type="checkbox" checked={dadosBancariosSel.includes(d.id)}
                              onChange={e => setDadosBancariosSel(prev =>
                                e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id)
                              )}
                              style={{ marginTop: 2, accentColor: '#1a5fa8' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>{d.apelido}</div>
                              <div style={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-line', marginTop: 2 }}>
                                {formatarDadoBancario(d)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
                        Nenhuma conta cadastrada.
                      </div>
                    )}
                    <button className={styles.btnAddItem} style={{ marginTop: 6, fontSize: '0.75rem' }} onClick={() => setDrawerOpen(true)}>
                      + Gerenciar contas (⚙️ Config)
                    </button>

                    {/* Dados livres (fallback/complemento) */}
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Informações adicionais de pagamento (texto livre)</label>
                      <textarea className={`${styles.input} ${styles.textarea}`} rows={2}
                        placeholder="Ex: observações sobre pagamento, condições especiais..."
                        value={dadosPagamento} onChange={e => setDadosPagamento(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className={styles.row2}>
                  <div className={styles.fg}><label>Prazo de entrega</label><input className={styles.input} placeholder="Ex: 10 dias úteis" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} /></div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.fg}><label>Validade (dias)</label><input className={styles.input} type="number" min="1" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} /></div>
                  <div className={styles.fg}><label>Emissão</label><input className={styles.input} value={dataEmissao} readOnly style={{ background: '#f8fafc' }} /></div>
                </div>
              </CollapsibleSection>

              {/* Observações */}
              <CollapsibleSection title="📝 Observações">
                <div className={styles.fg}><textarea className={`${styles.input} ${styles.textarea}`} rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
              </CollapsibleSection>

              {/* Anexos & Rastreamento */}

              {/* Anexos */}
              <CollapsibleSection title="📎 Anexos" count={anexos.length}>
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
              </CollapsibleSection>

              {/* Links de rastreamento */}
              {editandoId && (
                <LinksSection
                  editandoId={editandoId} links={links} gerandoLink={gerandoLink}
                  novoLinkDest={novoLinkDest} setNovoLinkDest={setNovoLinkDest}
                  acessosLink={acessosLink} expandedLink={expandedLink}
                  carregarLinks={carregarLinks} toggleAcessos={toggleAcessos}
                  gerarLink={gerarLink} desativarLink={desativarLink} linkUrl={linkUrl}
                  showMsg={showMsg} vendedores={vendedores} vendedorId={vendedorId}
                  cliente={cliente} numero={numero} styles={styles}
                />
              )}

              {/* Rastreabilidade */}
              <HistoricoSection historico={historico} styles={styles} />
            </div>

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
              editandoId={editandoId} isAdminUser={isAdminUser}
              confirmExcluir={confirmExcluir} setConfirmExcluir={setConfirmExcluir}
              onExcluir={excluirOrcamento}
              styles={styles}
            />
          </div>
        </>
      )}

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
    </div>
  )
}
