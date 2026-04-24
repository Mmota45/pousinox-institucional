import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'
import { useAdmin } from '../contexts/AdminContext'
import ClienteForm from '../components/ClienteForm/ClienteForm'
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from '../lib/masks'
import FreteSection from '../components/FreteSection/FreteSection'
import { useEtiqueta } from '../components/Orcamento/hooks/useEtiqueta'
import { useLinks } from '../components/Orcamento/hooks/useLinks'
import HistoricoSection from '../components/Orcamento/sections/HistoricoSection'
import LinksSection from '../components/Orcamento/sections/LinksSection'
import ConfigSection from '../components/Orcamento/sections/ConfigSection'

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
  const [showCadastroBanco, setShowCadastroBanco] = useState(false)
  const [formBanco, setFormBanco] = useState<Partial<DadoBancario>>({})
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

  const carregarDadosBancarios = useCallback(async () => {
    const { data } = await supabaseAdmin.from('dados_bancarios').select('*').eq('ativo', true).order('ordem')
    setDadosBancarios((data ?? []) as DadoBancario[])
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
    const { data: numData } = await supabaseAdmin.rpc('next_orcamento_numero')
    const novoNumero = (numData as string) ?? `${new Date().getFullYear()}/001`
    // Reset all state first
    setEditandoId(null); setNumero(novoNumero); setStatus('rascunho'); setFinLancId(null); setEtiquetaPreId(null)
    setCliente(CLIENTE_VAZIO); setItens([{ ...ITEM_VAZIO }])
    setDesconto(''); setTipoDesc('%'); setCondicoes([]); setPrazoEntrega(''); setDadosPagamento('')
    setValidadeDias('7'); setObservacoes(OBS_DEFAULT)
    setWatermarkAtivo(false); setWatermarkTexto('CONFIDENCIAL'); setWatermarkLogo(false)
    setImagemUrl(''); setAnexos([]); setHistorico([]); setLinks([])
    setInstalacao(INST_VAZIO)
    setObsInternas(''); setOrigemLead(''); setExibir(EXIBIR_DEFAULT); setDadosBancariosSel([])
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
    setEditandoId(id); setNumero(o.numero); setStatus(o.status); setFinLancId(o.fin_lancamento_id ?? null); setEtiquetaPreId(o.etiqueta_pre_id ?? null)
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
    setVista('editor')
  }

  async function salvarDadoBancario() {
    if (!formBanco.apelido?.trim()) { showMsg('erro', 'Apelido obrigatório'); return }
    const { error } = await supabaseAdmin.from('dados_bancarios').insert({
      apelido: formBanco.apelido, banco: formBanco.banco || null, agencia: formBanco.agencia || null,
      conta: formBanco.conta || null, tipo_conta: formBanco.tipo_conta || 'corrente',
      pix_chave: formBanco.pix_chave || null, pix_tipo: formBanco.pix_tipo || null,
      titular: formBanco.titular || null, cnpj_titular: formBanco.cnpj_titular || null,
      observacao: formBanco.observacao || null, ordem: dadosBancarios.length,
    })
    if (error) { showMsg('erro', 'Erro: ' + error.message); return }
    setFormBanco({}); setShowCadastroBanco(false)
    carregarDadosBancarios()
    showMsg('ok', 'Conta cadastrada!')
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
    // Salva antes de abrir o PDF para garantir dados atualizados
    await salvar()
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

  // buscarCEP movido para ClienteForm

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
              {status === 'aprovado' && !etiquetaPreId && <button className={styles.btnEnviar} onClick={gerarEtiqueta} disabled={gerandoEtiq}>{gerandoEtiq ? '⏳ Gerando...' : '📦 Etiqueta Correios'}</button>}
              {etiquetaPreId && <>
                <button className={styles.btnAprovar} onClick={baixarRotulo} disabled={baixandoRotulo}>{baixandoRotulo ? '⏳ Processando...' : '🏷 Baixar Rótulo'}</button>
                <button className={styles.btnImprimir} onClick={baixarDace} disabled={baixandoDace}>{baixandoDace ? '⏳ Gerando...' : '📄 DACE'}</button>
                <button className={styles.btnRecusar} onClick={cancelarEtiqueta} disabled={cancelandoEtiq}>{cancelandoEtiq ? '⏳...' : '✕ Cancelar Envio'}</button>
              </>}
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

              <ClienteForm cliente={cliente} setCliente={setCliente} styles={styles} />

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

              {/* Condições Comerciais */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Condições Comerciais</div>
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
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <button className={styles.btnAddItem} onClick={() => setShowCadastroBanco(v => !v)}>
                        {showCadastroBanco ? '▲ Fechar' : '+ Cadastrar nova conta'}
                      </button>
                    </div>
                    {showCadastroBanco && (
                      <div style={{ marginTop: 8, padding: 14, background: '#fafbfc', border: '1.5px dashed #cbd5e1', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className={styles.row2}>
                          <div className={styles.fg}><label>Apelido *</label><input className={styles.input} placeholder="Ex: Bradesco PJ" value={formBanco.apelido ?? ''} onChange={e => setFormBanco(f => ({ ...f, apelido: e.target.value }))} /></div>
                          <div className={styles.fg}><label>Banco</label><input className={styles.input} placeholder="Ex: Bradesco" value={formBanco.banco ?? ''} onChange={e => setFormBanco(f => ({ ...f, banco: e.target.value }))} /></div>
                        </div>
                        <div className={styles.row3}>
                          <div className={styles.fg}><label>Agência</label><input className={styles.input} placeholder="1234" value={formBanco.agencia ?? ''} onChange={e => setFormBanco(f => ({ ...f, agencia: e.target.value }))} /></div>
                          <div className={styles.fg}><label>Conta</label><input className={styles.input} placeholder="56789-0" value={formBanco.conta ?? ''} onChange={e => setFormBanco(f => ({ ...f, conta: e.target.value }))} /></div>
                          <div className={styles.fg}>
                            <label>Tipo</label>
                            <select className={styles.input} value={formBanco.tipo_conta ?? 'corrente'} onChange={e => setFormBanco(f => ({ ...f, tipo_conta: e.target.value }))}>
                              <option value="corrente">Corrente</option>
                              <option value="poupanca">Poupança</option>
                            </select>
                          </div>
                        </div>
                        <div className={styles.row2}>
                          <div className={styles.fg}><label>Chave PIX</label><input className={styles.input} placeholder="CNPJ, e-mail, telefone..." value={formBanco.pix_chave ?? ''} onChange={e => setFormBanco(f => ({ ...f, pix_chave: e.target.value }))} /></div>
                          <div className={styles.fg}>
                            <label>Tipo da chave</label>
                            <select className={styles.input} value={formBanco.pix_tipo ?? ''} onChange={e => setFormBanco(f => ({ ...f, pix_tipo: e.target.value }))}>
                              <option value="">—</option>
                              <option value="cnpj">CNPJ</option>
                              <option value="cpf">CPF</option>
                              <option value="email">E-mail</option>
                              <option value="telefone">Telefone</option>
                              <option value="aleatoria">Aleatória</option>
                            </select>
                          </div>
                        </div>
                        <div className={styles.row2}>
                          <div className={styles.fg}><label>Titular</label><input className={styles.input} placeholder="Pousinox Ind. Com. LTDA" value={formBanco.titular ?? ''} onChange={e => setFormBanco(f => ({ ...f, titular: e.target.value }))} /></div>
                          <div className={styles.fg}><label>CNPJ do titular</label><input className={styles.input} placeholder="12.115.379/0001-64" value={formBanco.cnpj_titular ?? ''} onChange={e => setFormBanco(f => ({ ...f, cnpj_titular: e.target.value }))} /></div>
                        </div>
                        <button className={styles.btnPrimary} style={{ alignSelf: 'flex-start' }} onClick={salvarDadoBancario}>Salvar conta</button>
                      </div>
                    )}

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
              </div>

              {/* Observações */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Observações</div>
                <div className={styles.fg}><textarea className={`${styles.input} ${styles.textarea}`} rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
              </div>

              {/* Anexos & Rastreamento */}

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

              {/* Configuração da Proposta */}
              <ConfigSection
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

              {/* Rastreabilidade */}
              <HistoricoSection historico={historico} styles={styles} />
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
