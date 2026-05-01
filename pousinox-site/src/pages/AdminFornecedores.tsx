import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFornecedores.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import type { Fornecedor, ContatoFornecedor, Material, FornecedorMaterial } from '../types/fornecedores'
import {
  FORNECEDOR_VAZIO, CONTATO_VAZIO,
  SEGMENTOS_FORNECEDOR, CATEGORIAS_FORNECEDOR, ESTADOS_BR,
} from '../types/fornecedores'

type Vista = 'lista' | 'form' | 'detalhe' | 'materiais' | 'material_form' | 'pedidos' | 'pedido_detalhe'
type AbaForm = 'dados' | 'contatos'

const LIGAS_INOX = ['AISI 304', 'AISI 304L', 'AISI 316', 'AISI 316L', 'AISI 430', 'AISI 201', 'Outra']
const UNIDADES_MAT = ['kg', 'm', 'm²', 'pc', 'un', 'barra']

// ── Compras ───────────────────────────────────────────────────────────────────

type StatusPedido = 'rascunho' | 'enviado' | 'recebido' | 'cancelado'

const STATUS_CONFIG: Record<StatusPedido, { label: string; cor: string; bg: string }> = {
  rascunho:  { label: 'Rascunho',  cor: '#64748b', bg: '#f1f5f9' },
  enviado:   { label: 'Enviado',   cor: '#1d4ed8', bg: '#eff6ff' },
  recebido:  { label: 'Recebido',  cor: '#16a34a', bg: '#dcfce7' },
  cancelado: { label: 'Cancelado', cor: '#9ca3af', bg: '#f3f4f6' },
}

const PROXIMO_STATUS: Partial<Record<StatusPedido, StatusPedido>> = {
  rascunho: 'enviado',
  enviado:  'recebido',
}

interface PedidoCompra {
  id: number
  fornecedor_id: number | null
  status: StatusPedido
  data_pedido: string
  previsao_entrega: string | null
  valor_total: number | null
  observacao: string | null
  created_at: string
  updated_at: string
  fornecedores?: { razao_social: string; nome_fantasia: string | null } | null
}

interface PedidoItem {
  id?: number
  material_id: number | null
  descricao: string
  unidade: string
  quantidade: string
  preco_unit: string
  observacao: string
}

const ITEM_VAZIO: PedidoItem = { material_id: null, descricao: '', unidade: 'kg', quantidade: '', preco_unit: '', observacao: '' }

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type MaterialForm = {
  codigo: string; descricao: string; categoria: string; unidade: string
  liga: string; espessura_mm: string; largura_mm: string; comprimento_mm: string
  peso_kg_m: string; observacoes: string; ativo: boolean
}
const MAT_VAZIO: MaterialForm = {
  codigo: '', descricao: '', categoria: '', unidade: 'kg',
  liga: '', espessura_mm: '', largura_mm: '', comprimento_mm: '',
  peso_kg_m: '', observacoes: '', ativo: true,
}

type FornMatLocal = { material_id: number; preco_unit: string; unidade: string; prazo_entrega: string; preferencial: boolean; id?: number }
const FORNMAT_VAZIO: FornMatLocal = { material_id: 0, preco_unit: '', unidade: 'kg', prazo_entrega: '', preferencial: false }

function fmtData(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}

function labelSegmento(s: string) {
  const map: Record<string, string> = {
    distribuidor: 'Distribuidor', fabricante: 'Fabricante',
    servico: 'Serviço', representante: 'Representante', outro: 'Outro',
  }
  return map[s] ?? s
}

function labelCategoria(s: string) {
  const map: Record<string, string> = {
    aco_inox: 'Aço Inox', fixadores: 'Fixadores', corte_laser: 'Corte Laser',
    dobramento: 'Dobramento', solda: 'Solda', acabamento: 'Acabamento',
    embalagem: 'Embalagem', logistica: 'Logística', outros: 'Outros',
  }
  return map[s] ?? s
}

type FormState = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at' | 'importado_csv' | 'qtd_contatos'> & {
  razao_social: string
}

const FORM_VAZIO: FormState = {
  ...FORNECEDOR_VAZIO,
  razao_social: '',
  codigo: null, nome_fantasia: null, cnpj: null,
  segmento: null, categoria: null, cidade: null, estado: null,
  cep: null, endereco: null, telefone: null, email: null,
  site: null, whatsapp: null, observacoes: null,
  prazo_entrega_padrao: null, condicao_pagamento: null,
  ativo: true, preferencial: false,
}

type ContatoLocal = Omit<ContatoFornecedor, 'id' | 'fornecedor_id' | 'created_at'> & { id?: number }

export default function AdminFornecedores() {
  const [vista, setVista] = useState<Vista>('lista')
  const [abaForm, setAbaForm] = useState<AbaForm>('dados')

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(1)
  const [atual, setAtual] = useState<Fornecedor | null>(null)
  const [contatos, setContatos] = useState<ContatoFornecedor[]>([])

  const [form, setForm] = useState<FormState>({ ...FORM_VAZIO })
  const [contatosForm, setContatosForm] = useState<ContatoLocal[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  // ── Materiais ──────────────────────────────────────────────────────────────
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loadingMat, setLoadingMat] = useState(false)
  const [matAtual, setMatAtual] = useState<Material | null>(null)
  const [matForm, setMatForm] = useState<MaterialForm>({ ...MAT_VAZIO })
  const [salvandoMat, setSalvandoMat] = useState(false)
  const [erroMat, setErroMat] = useState<string | null>(null)
  const [filtroLiga, setFiltroLiga] = useState('')

  // Materiais do fornecedor selecionado (detalhe)
  const [fornMats, setFornMats] = useState<(FornecedorMaterial & { material?: Pick<Material,'id'|'descricao'|'unidade'|'liga'> })[]>([])
  const [fornMatForm, setFornMatForm] = useState<FornMatLocal>({ ...FORNMAT_VAZIO })
  const [fornMatEditId, setFornMatEditId] = useState<number | null>(null)
  const [showFornMatForm, setShowFornMatForm] = useState(false)

  const carregarMateriais = useCallback(async () => {
    setLoadingMat(true)
    const { data } = await supabaseAdmin.from('materiais').select('*').order('descricao')
    setMateriais((data ?? []) as Material[])
    setLoadingMat(false)
  }, [])

  // ── Pedidos de compra ──────────────────────────────────────────────────────
  const [pedidos,         setPedidos]         = useState<PedidoCompra[]>([])
  const [loadingPedidos,  setLoadingPedidos]  = useState(false)
  const [pedidoAtual,     setPedidoAtual]     = useState<PedidoCompra | null>(null)
  const [itensPedidoAtual, setItensPedidoAtual] = useState<(PedidoItem & { id: number })[]>([])
  const [formPedidoAberto, setFormPedidoAberto] = useState(false)
  const [salvandoPedido,  setSalvandoPedido]  = useState(false)
  const [pedidoMsg, setPedidoMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [pedidoForm, setPedidoForm] = useState({
    fornecedor_id:    '',
    data_pedido:      new Date().toISOString().slice(0, 10),
    previsao_entrega: '',
    observacao:       '',
  })
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([{ ...ITEM_VAZIO }])

  const carregarPedidos = useCallback(async () => {
    setLoadingPedidos(true)
    const { data } = await supabaseAdmin
      .from('pedidos_compra')
      .select('*, fornecedores(razao_social, nome_fantasia)')
      .order('created_at', { ascending: false })
      .limit(200)
    setPedidos((data ?? []) as PedidoCompra[])
    setLoadingPedidos(false)
  }, [])

  async function carregarItensPedido(pedidoId: number) {
    const { data } = await supabaseAdmin
      .from('pedidos_compra_itens')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('id')
    setItensPedidoAtual((data ?? []) as (PedidoItem & { id: number })[])
  }

  async function criarPedido() {
    if (!pedidoForm.fornecedor_id) { setPedidoMsg({ tipo: 'erro', texto: 'Selecione um fornecedor.' }); return }
    const itensValidos = pedidoItens.filter(i => i.descricao.trim() && parseFloat(i.quantidade) > 0)
    if (itensValidos.length === 0) { setPedidoMsg({ tipo: 'erro', texto: 'Adicione ao menos um item com descrição e quantidade.' }); return }
    setSalvandoPedido(true)

    const valorTotal = itensValidos.reduce((s, i) => {
      const q = parseFloat(i.quantidade) || 0
      const p = parseFloat(i.preco_unit) || 0
      return s + q * p
    }, 0)

    const { data: pedData, error } = await supabaseAdmin
      .from('pedidos_compra')
      .insert({
        fornecedor_id:    parseInt(pedidoForm.fornecedor_id),
        data_pedido:      pedidoForm.data_pedido,
        previsao_entrega: pedidoForm.previsao_entrega || null,
        observacao:       pedidoForm.observacao.trim() || null,
        valor_total:      valorTotal > 0 ? valorTotal : null,
      })
      .select('id')
      .single()

    if (error || !pedData) {
      setPedidoMsg({ tipo: 'erro', texto: 'Erro ao criar pedido: ' + (error?.message ?? '') })
      setSalvandoPedido(false)
      return
    }

    await supabaseAdmin.from('pedidos_compra_itens').insert(
      itensValidos.map(i => ({
        pedido_id:   pedData.id,
        material_id: i.material_id,
        descricao:   i.descricao.trim(),
        unidade:     i.unidade,
        quantidade:  parseFloat(i.quantidade),
        preco_unit:  parseFloat(i.preco_unit) || null,
        observacao:  i.observacao.trim() || null,
      }))
    )

    setPedidoMsg({ tipo: 'ok', texto: 'Pedido criado com sucesso.' })
    setPedidoForm({ fornecedor_id: '', data_pedido: new Date().toISOString().slice(0, 10), previsao_entrega: '', observacao: '' })
    setPedidoItens([{ ...ITEM_VAZIO }])
    setFormPedidoAberto(false)
    carregarPedidos()
    setSalvandoPedido(false)
  }

  async function atualizarStatusPedido(pedido: PedidoCompra, novoStatus: StatusPedido) {
    await supabaseAdmin.from('pedidos_compra').update({ status: novoStatus }).eq('id', pedido.id)
    setPedidos(ps => ps.map(p => p.id === pedido.id ? { ...p, status: novoStatus } : p))
    if (pedidoAtual?.id === pedido.id) setPedidoAtual(pa => pa ? { ...pa, status: novoStatus } : pa)
  }

  async function excluirPedido(pedido: PedidoCompra) {
    if (!confirm(`Excluir pedido #${pedido.id}?`)) return
    await supabaseAdmin.from('pedidos_compra').delete().eq('id', pedido.id)
    setPedidos(ps => ps.filter(p => p.id !== pedido.id))
    if (pedidoAtual?.id === pedido.id) { setPedidoAtual(null); setVista('pedidos') }
  }

  const carregarFornMats = useCallback(async (fornecedorId: number) => {
    const { data } = await supabaseAdmin
      .from('fornecedor_material')
      .select('*, material:materiais(id,descricao,unidade,liga)')
      .eq('fornecedor_id', fornecedorId)
      .order('updated_at', { ascending: false })
    setFornMats((data ?? []) as (FornecedorMaterial & { material?: Pick<Material,'id'|'descricao'|'unidade'|'liga'> })[])
  }, [])

  async function salvarMaterial() {
    if (!matForm.descricao.trim()) { setErroMat('Descrição é obrigatória.'); return }
    setSalvandoMat(true); setErroMat(null)
    const payload = {
      codigo:         matForm.codigo.trim() || null,
      descricao:      matForm.descricao.trim(),
      categoria:      matForm.categoria || null,
      unidade:        matForm.unidade,
      liga:           matForm.liga || null,
      espessura_mm:   matForm.espessura_mm ? parseFloat(matForm.espessura_mm) : null,
      largura_mm:     matForm.largura_mm   ? parseFloat(matForm.largura_mm)   : null,
      comprimento_mm: matForm.comprimento_mm ? parseFloat(matForm.comprimento_mm) : null,
      peso_kg_m:      matForm.peso_kg_m    ? parseFloat(matForm.peso_kg_m)    : null,
      observacoes:    matForm.observacoes.trim() || null,
      ativo:          matForm.ativo,
    }
    if (matAtual) {
      const { error } = await supabaseAdmin.from('materiais').update(payload).eq('id', matAtual.id)
      if (error) { setErroMat(error.message); setSalvandoMat(false); return }
    } else {
      const { error } = await supabaseAdmin.from('materiais').insert(payload)
      if (error) { setErroMat(error.message); setSalvandoMat(false); return }
    }
    setSalvandoMat(false)
    await carregarMateriais()
    setVista('materiais')
  }

  async function excluirMaterial(m: Material, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir "${m.descricao}"?`)) return
    await supabaseAdmin.from('materiais').delete().eq('id', m.id)
    await carregarMateriais()
  }

  async function salvarFornMat() {
    if (!fornMatForm.material_id) return
    if (!atual) return
    const payload = {
      fornecedor_id: atual.id,
      material_id:   fornMatForm.material_id,
      preco_unit:    fornMatForm.preco_unit ? parseFloat(fornMatForm.preco_unit) : null,
      unidade:       fornMatForm.unidade || null,
      prazo_entrega: fornMatForm.prazo_entrega ? parseInt(fornMatForm.prazo_entrega) : null,
      preferencial:  fornMatForm.preferencial,
    }
    if (fornMatEditId) {
      await supabaseAdmin.from('fornecedor_material').update(payload).eq('id', fornMatEditId)
    } else {
      await supabaseAdmin.from('fornecedor_material').upsert(payload, { onConflict: 'fornecedor_id,material_id' })
    }
    setFornMatForm({ ...FORNMAT_VAZIO })
    setFornMatEditId(null)
    setShowFornMatForm(false)
    await carregarFornMats(atual.id)
  }

  async function excluirFornMat(id: number) {
    if (!confirm('Remover vínculo com este material?')) return
    await supabaseAdmin.from('fornecedor_material').delete().eq('id', id)
    if (atual) await carregarFornMats(atual.id)
  }

  // ── Carregar lista ─────────────────────────────────────────────────────────
  const carregarLista = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('fornecedores')
      .select('*, qtd_contatos:contatos_fornecedor(count)')
      .order('razao_social')
    setFornecedores((data ?? []).map((f: Fornecedor & { qtd_contatos: { count: number }[] }) => ({
      ...f,
      qtd_contatos: f.qtd_contatos?.[0]?.count ?? 0,
    })))
    lp.step()
    setLoading(false)
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])
  useEffect(() => { if (vista === 'materiais' || vista === 'material_form') carregarMateriais() }, [vista, carregarMateriais])
  useEffect(() => { if (vista === 'pedidos') carregarPedidos() }, [vista, carregarPedidos])

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const lista = fornecedores.filter(f => {
    const q = busca.toLowerCase()
    const matchBusca = !q ||
      f.razao_social.toLowerCase().includes(q) ||
      (f.nome_fantasia ?? '').toLowerCase().includes(q) ||
      (f.cnpj ?? '').includes(q) ||
      (f.cidade ?? '').toLowerCase().includes(q)
    const matchSeg  = !filtroSegmento  || f.segmento  === filtroSegmento
    const matchCat  = !filtroCategoria || f.categoria === filtroCategoria
    const matchAtivo = filtroAtivo === 'todos' || (filtroAtivo === 'ativo' ? f.ativo : !f.ativo)
    return matchBusca && matchSeg && matchCat && matchAtivo
  })

  // ── Abrir form ─────────────────────────────────────────────────────────────
  function abrirNovo() {
    setAtual(null)
    setForm({ ...FORM_VAZIO })
    setContatosForm([])
    setAbaForm('dados')
    setErro(null)
    setVista('form')
  }

  async function abrirEditar(f: Fornecedor) {
    setAtual(f)
    setForm({
      codigo: f.codigo, razao_social: f.razao_social, nome_fantasia: f.nome_fantasia,
      cnpj: f.cnpj, segmento: f.segmento, categoria: f.categoria,
      cidade: f.cidade, estado: f.estado, cep: f.cep, endereco: f.endereco,
      telefone: f.telefone, email: f.email, site: f.site, whatsapp: f.whatsapp,
      ativo: f.ativo, preferencial: f.preferencial, observacoes: f.observacoes,
      prazo_entrega_padrao: f.prazo_entrega_padrao, condicao_pagamento: f.condicao_pagamento,
    })
    const { data } = await supabaseAdmin
      .from('contatos_fornecedor').select('*').eq('fornecedor_id', f.id).order('principal', { ascending: false })
    setContatosForm((data ?? []).map((c: ContatoFornecedor) => ({
      id: c.id, nome: c.nome, cargo: c.cargo, telefone: c.telefone,
      whatsapp: c.whatsapp, email: c.email, principal: c.principal,
    })))
    setAbaForm('dados')
    setErro(null)
    setVista('form')
  }

  async function abrirDetalhe(f: Fornecedor) {
    setAtual(f)
    const { data } = await supabaseAdmin
      .from('contatos_fornecedor').select('*').eq('fornecedor_id', f.id).order('principal', { ascending: false })
    setContatos((data ?? []) as ContatoFornecedor[])
    await Promise.all([carregarFornMats(f.id), carregarMateriais()])
    setShowFornMatForm(false)
    setFornMatForm({ ...FORNMAT_VAZIO })
    setVista('detalhe')
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.razao_social.trim()) { setErro('Razão social é obrigatória.'); return }
    setSalvando(true); setErro(null)

    const payload = {
      codigo:               form.codigo?.trim() || null,
      razao_social:         form.razao_social.trim(),
      nome_fantasia:        form.nome_fantasia?.trim() || null,
      cnpj:                 form.cnpj?.replace(/\D/g, '') || null,
      segmento:             form.segmento || null,
      categoria:            form.categoria || null,
      cidade:               form.cidade?.trim() || null,
      estado:               form.estado || null,
      cep:                  form.cep?.replace(/\D/g, '') || null,
      endereco:             form.endereco?.trim() || null,
      telefone:             form.telefone?.trim() || null,
      email:                form.email?.trim() || null,
      site:                 form.site?.trim() || null,
      whatsapp:             form.whatsapp?.trim() || null,
      ativo:                form.ativo,
      preferencial:         form.preferencial,
      observacoes:          form.observacoes?.trim() || null,
      prazo_entrega_padrao: form.prazo_entrega_padrao || null,
      condicao_pagamento:   form.condicao_pagamento?.trim() || null,
    }

    let fornecedorId: number

    if (atual) {
      const { error } = await supabaseAdmin.from('fornecedores').update(payload).eq('id', atual.id)
      if (error) { setErro(error.message); setSalvando(false); return }
      fornecedorId = atual.id
    } else {
      const { data, error } = await supabaseAdmin.from('fornecedores').insert(payload).select('id').single()
      if (error || !data) { setErro(error?.message ?? 'Erro ao criar.'); setSalvando(false); return }
      fornecedorId = data.id
    }

    // Salvar contatos: remove todos e reinsere
    await supabaseAdmin.from('contatos_fornecedor').delete().eq('fornecedor_id', fornecedorId)
    const contRows = contatosForm
      .filter(c => c.nome.trim())
      .map(c => ({
        fornecedor_id: fornecedorId,
        nome:      c.nome.trim(),
        cargo:     c.cargo?.trim() || null,
        telefone:  c.telefone?.trim() || null,
        whatsapp:  c.whatsapp?.trim() || null,
        email:     c.email?.trim() || null,
        principal: c.principal,
      }))
    if (contRows.length > 0) {
      await supabaseAdmin.from('contatos_fornecedor').insert(contRows)
    }

    setSalvando(false)
    await carregarLista()
    const { data: fAtual } = await supabaseAdmin.from('fornecedores').select('*').eq('id', fornecedorId).single()
    if (fAtual) abrirDetalhe(fAtual as Fornecedor)
    else setVista('lista')
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function excluir(f: Fornecedor, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir "${f.razao_social}"?\nTodos os contatos vinculados serão removidos.`)) return
    await supabaseAdmin.from('fornecedores').delete().eq('id', f.id)
    await carregarLista()
  }

  // ── Contatos helpers ───────────────────────────────────────────────────────
  function addContato() {
    setContatosForm(prev => [...prev, { ...CONTATO_VAZIO }])
  }
  function updateContato(idx: number, field: keyof ContatoLocal, val: string | boolean) {
    setContatosForm(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }
  function removeContato(idx: number) {
    setContatosForm(prev => prev.filter((_, i) => i !== idx))
  }
  function setPrincipal(idx: number) {
    setContatosForm(prev => prev.map((c, i) => ({ ...c, principal: i === idx })))
  }

  // ── Nav principal ──────────────────────────────────────────────────────────
  const navPrincipal = (
    <div className={styles.navPrincipal}>
      <button
        className={`${styles.navBtn} ${(vista === 'lista' || vista === 'form' || vista === 'detalhe') ? styles.navAtivo : ''}`}
        onClick={() => setVista('lista')}>🏭 Fornecedores ({fornecedores.length})</button>
      <button
        className={`${styles.navBtn} ${(vista === 'materiais' || vista === 'material_form') ? styles.navAtivo : ''}`}
        onClick={() => setVista('materiais')}>🔩 Materiais ({materiais.length})</button>
      <button
        className={`${styles.navBtn} ${(vista === 'pedidos' || vista === 'pedido_detalhe') ? styles.navAtivo : ''}`}
        onClick={() => setVista('pedidos')}>📦 Pedidos ({pedidos.length})</button>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: MATERIAIS
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'materiais') {
    const listaMat = materiais.filter(m => {
      const matchLiga = !filtroLiga || m.liga === filtroLiga
      return matchLiga
    })
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🔩 Materiais</div>
            <div className={styles.pageSubtitle}>Catálogo de matérias-primas e insumos</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => {
            setMatAtual(null); setMatForm({ ...MAT_VAZIO }); setErroMat(null); setVista('material_form')
          }}>+ Novo Material</button>
        </div>
        {navPrincipal}
        <div className={styles.toolbar}>
          <select className={styles.selectFiltro} value={filtroLiga} onChange={e => setFiltroLiga(e.target.value)}>
            <option value="">Todas as ligas</option>
            {LIGAS_INOX.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className={styles.card}>
          {loadingMat ? (
            <div className={styles.loading}>Carregando…</div>
          ) : listaMat.length === 0 ? (
            <div className={styles.vazio}>Nenhum material cadastrado.</div>
          ) : (
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Liga</th>
                  <th>Unidade</th>
                  <th>Espessura (mm)</th>
                  <th>Peso kg/m</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaMat.map(m => (
                  <tr key={m.id} onClick={() => {
                    setMatAtual(m)
                    setMatForm({
                      codigo: m.codigo ?? '', descricao: m.descricao, categoria: m.categoria ?? '',
                      unidade: m.unidade, liga: m.liga ?? '', espessura_mm: m.espessura_mm?.toString() ?? '',
                      largura_mm: m.largura_mm?.toString() ?? '', comprimento_mm: m.comprimento_mm?.toString() ?? '',
                      peso_kg_m: m.peso_kg_m?.toString() ?? '', observacoes: m.observacoes ?? '', ativo: m.ativo,
                    })
                    setErroMat(null)
                    setVista('material_form')
                  }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.descricao}</div>
                      {m.codigo && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{m.codigo}</div>}
                    </td>
                    <td>{m.liga ? <span className={styles.badge}>{m.liga}</span> : '—'}</td>
                    <td>{m.unidade}</td>
                    <td>{m.espessura_mm ?? '—'}</td>
                    <td>{m.peso_kg_m ?? '—'}</td>
                    <td><span className={m.ativo ? styles.badgeAtivo : styles.badgeInativo}>{m.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                        onClick={e => excluirMaterial(m, e)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: MATERIAL FORM
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'material_form') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🔩 Materiais</div>
          <div className={styles.pageSubtitle}>{matAtual ? `Editando: ${matAtual.descricao}` : 'Novo Material'}</div>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista('materiais')}>← Cancelar</button>
      </div>
      {navPrincipal}
      <div className={styles.card}>
        {erroMat && <div className={styles.erroMsg}>{erroMat}</div>}
        <div className={styles.formBody}>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição *</label>
              <input className={styles.formInput} value={matForm.descricao}
                onChange={e => setMatForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Chapa inox AISI 304 2mm" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código interno</label>
              <input className={styles.formInput} value={matForm.codigo}
                onChange={e => setMatForm(f => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Liga</label>
              <select className={styles.formSelect} value={matForm.liga}
                onChange={e => setMatForm(f => ({ ...f, liga: e.target.value }))}>
                <option value="">Selecione…</option>
                {LIGAS_INOX.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Unidade</label>
              <select className={styles.formSelect} value={matForm.unidade}
                onChange={e => setMatForm(f => ({ ...f, unidade: e.target.value }))}>
                {UNIDADES_MAT.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Espessura (mm)</label>
              <input className={styles.formInput} type="number" step="0.01" value={matForm.espessura_mm}
                onChange={e => setMatForm(f => ({ ...f, espessura_mm: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Largura (mm)</label>
              <input className={styles.formInput} type="number" step="0.1" value={matForm.largura_mm}
                onChange={e => setMatForm(f => ({ ...f, largura_mm: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Comprimento (mm)</label>
              <input className={styles.formInput} type="number" step="1" value={matForm.comprimento_mm}
                onChange={e => setMatForm(f => ({ ...f, comprimento_mm: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Peso kg/m</label>
              <input className={styles.formInput} type="number" step="0.001" value={matForm.peso_kg_m}
                onChange={e => setMatForm(f => ({ ...f, peso_kg_m: e.target.value }))}
                placeholder="Para barras e perfis" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Observações</label>
              <textarea className={styles.formTextarea} rows={2} value={matForm.observacoes}
                onChange={e => setMatForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={matForm.ativo}
                  onChange={e => setMatForm(f => ({ ...f, ativo: e.target.checked }))} />
                Material ativo
              </label>
            </div>
          </div>
        </div>
        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista('materiais')}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={salvarMaterial} disabled={salvandoMat}>
            {salvandoMat ? 'Salvando…' : matAtual ? 'Salvar Alterações' : 'Criar Material'}
          </button>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: LISTA
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>Cadastro central de fornecedores e contatos</div>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNovo}>+ Novo Fornecedor</button>
      </div>
      {navPrincipal}

      <div className={styles.toolbar}>
        <input
          className={styles.buscaInput}
          placeholder="Buscar por nome, CNPJ ou cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className={styles.selectFiltro} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
          <option value="">Todos os segmentos</option>
          {SEGMENTOS_FORNECEDOR.map(s => <option key={s} value={s}>{labelSegmento(s)}</option>)}
        </select>
        <select className={styles.selectFiltro} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{labelCategoria(c)}</option>)}
        </select>
        <select className={styles.selectFiltro} value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value as typeof filtroAtivo)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <AdminLoading total={lp.total} current={lp.current} label="Carregando fornecedores..." />
        ) : lista.length === 0 ? (
          <div className={styles.vazio}>Nenhum fornecedor encontrado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Razão Social</th>
                <th>Segmento</th>
                <th>Categoria</th>
                <th>Cidade/UF</th>
                <th>Contatos</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(f => (
                <tr key={f.id} onClick={() => abrirDetalhe(f)}>
                  <td>
                    <div className={styles.nomeCell}>
                      <span className={styles.razaoSocial}>{f.razao_social}</span>
                      {f.nome_fantasia && <span className={styles.nomeFantasia}>{f.nome_fantasia}</span>}
                      {f.preferencial && <span className={styles.badgePreferencial}>⭐ Preferencial</span>}
                    </div>
                  </td>
                  <td>{f.segmento ? <span className={styles.badge}>{labelSegmento(f.segmento)}</span> : <span className={styles.vazio}>—</span>}</td>
                  <td>{f.categoria ? <span className={styles.badgeCat}>{labelCategoria(f.categoria)}</span> : <span className={styles.vazio}>—</span>}</td>
                  <td><span className={styles.cidade}>{[f.cidade, f.estado].filter(Boolean).join('/') || '—'}</span></td>
                  <td><span className={styles.numBadge}>{f.qtd_contatos ?? 0} contato{(f.qtd_contatos ?? 0) !== 1 ? 's' : ''}</span></td>
                  <td>
                    <span className={f.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td><span className={styles.data}>{fmtData(f.created_at)}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                      onClick={e => excluir(f, e)} title="Excluir">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: DETALHE
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'detalhe' && atual) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>Detalhe do fornecedor</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Lista</button>
          <button className={styles.btnPrimary} onClick={() => abrirEditar(atual)}>✏️ Editar</button>
        </div>
      </div>
      {navPrincipal}

      <div className={styles.card}>
        <div className={styles.detalheHeader}>
          <div>
            <div className={styles.detalheTitulo}>{atual.razao_social}</div>
            {atual.nome_fantasia && <div className={styles.detalheSubtitulo}>{atual.nome_fantasia}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {atual.preferencial && <span className={styles.badgePreferencial}>⭐ Preferencial</span>}
            {atual.segmento && <span className={styles.badge}>{labelSegmento(atual.segmento)}</span>}
            {atual.categoria && <span className={styles.badgeCat}>{labelCategoria(atual.categoria)}</span>}
            <span className={atual.ativo ? styles.badgeAtivo : styles.badgeInativo}>
              {atual.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        <div className={styles.detalheGrid}>
          <div className={styles.detalheSection}>
            <div className={styles.detalheSectionTitle}>Dados Cadastrais</div>
            {atual.cnpj && <div className={styles.detalheField}><span>CNPJ</span><span>{atual.cnpj}</span></div>}
            {atual.telefone && <div className={styles.detalheField}><span>Telefone</span><span>{atual.telefone}</span></div>}
            {atual.whatsapp && <div className={styles.detalheField}><span>WhatsApp</span><span>{atual.whatsapp}</span></div>}
            {atual.email && <div className={styles.detalheField}><span>E-mail</span><span>{atual.email}</span></div>}
            {atual.site && <div className={styles.detalheField}><span>Site</span><a href={atual.site} target="_blank" rel="noreferrer">{atual.site}</a></div>}
            {(atual.cidade || atual.estado) && <div className={styles.detalheField}><span>Cidade</span><span>{[atual.cidade, atual.estado].filter(Boolean).join(' — ')}</span></div>}
            {atual.endereco && <div className={styles.detalheField}><span>Endereço</span><span>{atual.endereco}</span></div>}
          </div>

          <div className={styles.detalheSection}>
            <div className={styles.detalheSectionTitle}>Condições Comerciais</div>
            {atual.prazo_entrega_padrao != null && <div className={styles.detalheField}><span>Prazo padrão</span><span>{atual.prazo_entrega_padrao} dias</span></div>}
            {atual.condicao_pagamento && <div className={styles.detalheField}><span>Pagamento</span><span>{atual.condicao_pagamento}</span></div>}
            {atual.observacoes && <div className={styles.detalheField} style={{ alignItems: 'flex-start' }}><span>Obs.</span><span style={{ whiteSpace: 'pre-wrap' }}>{atual.observacoes}</span></div>}
          </div>
        </div>

        {/* Contatos */}
        <div className={styles.contatosSection}>
          <div className={styles.detalheSectionTitle}>Contatos</div>
          {contatos.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.86rem' }}>Nenhum contato cadastrado.</div>
          ) : (
            <div className={styles.contatosGrid}>
              {contatos.map(c => (
                <div key={c.id} className={`${styles.contatoCard} ${c.principal ? styles.contatoPrincipal : ''}`}>
                  {c.principal && <span className={styles.contatoTag}>Principal</span>}
                  <div className={styles.contatoNome}>{c.nome}</div>
                  {c.cargo && <div className={styles.contatoCargo}>{c.cargo}</div>}
                  <div className={styles.contatoInfo}>
                    {c.telefone && <span>📞 {c.telefone}</span>}
                    {c.whatsapp && <span>💬 {c.whatsapp}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Materiais vinculados */}
        <div className={styles.contatosSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className={styles.detalheSectionTitle} style={{ marginBottom: 0 }}>🔩 Materiais e Preços</div>
            <button className={styles.btnSecondary} style={{ fontSize: '0.82rem', padding: '4px 10px' }}
              onClick={() => { setShowFornMatForm(true); setFornMatForm({ ...FORNMAT_VAZIO }); setFornMatEditId(null) }}>
              + Vincular Material
            </button>
          </div>

          {showFornMatForm && (
            <div className={styles.fornMatFormBox}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                  <label className={styles.formLabel}>Material *</label>
                  <select className={styles.formSelect} value={fornMatForm.material_id || ''}
                    onChange={e => setFornMatForm(f => ({ ...f, material_id: parseInt(e.target.value) }))}>
                    <option value="">Selecione…</option>
                    {materiais.filter(m => m.ativo).map(m => (
                      <option key={m.id} value={m.id}>{m.descricao}{m.liga ? ` — ${m.liga}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Preço unit. (R$)</label>
                  <input className={styles.formInput} type="number" step="0.01" value={fornMatForm.preco_unit}
                    onChange={e => setFornMatForm(f => ({ ...f, preco_unit: e.target.value }))}
                    placeholder="0,00" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Unidade</label>
                  <select className={styles.formSelect} value={fornMatForm.unidade}
                    onChange={e => setFornMatForm(f => ({ ...f, unidade: e.target.value }))}>
                    {UNIDADES_MAT.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Prazo (dias)</label>
                  <input className={styles.formInput} type="number" value={fornMatForm.prazo_entrega}
                    onChange={e => setFornMatForm(f => ({ ...f, prazo_entrega: e.target.value }))} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={fornMatForm.preferencial}
                      onChange={e => setFornMatForm(f => ({ ...f, preferencial: e.target.checked }))} />
                    Fornecedor preferencial para este material
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className={styles.btnSecondary} onClick={() => { setShowFornMatForm(false); setFornMatEditId(null) }}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={salvarFornMat}>Salvar</button>
              </div>
            </div>
          )}

          {fornMats.length === 0 && !showFornMatForm ? (
            <div style={{ color: '#94a3b8', fontSize: '0.86rem' }}>Nenhum material vinculado.</div>
          ) : fornMats.length > 0 && (
            <table className={styles.tabela} style={{ marginTop: showFornMatForm ? 12 : 0 }}>
              <thead>
                <tr><th>Material</th><th>Liga</th><th>Preço unit.</th><th>Unidade</th><th>Prazo</th><th></th></tr>
              </thead>
              <tbody>
                {fornMats.map(fm => (
                  <tr key={fm.id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{fm.material?.descricao ?? `#${fm.material_id}`}</span>
                      {fm.preferencial && <span className={styles.badgePreferencial} style={{ marginLeft: 6, fontSize: '0.72rem' }}>⭐</span>}
                    </td>
                    <td>{fm.material?.liga ?? '—'}</td>
                    <td>{fm.preco_unit != null ? fm.preco_unit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                    <td>{fm.unidade ?? fm.material?.unidade ?? '—'}</td>
                    <td>{fm.prazo_entrega != null ? `${fm.prazo_entrega}d` : '—'}</td>
                    <td>
                      <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                        onClick={() => excluirFornMat(fm.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: FORM
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>{atual ? `Editando ${atual.razao_social}` : 'Novo Fornecedor'}</div>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista(atual ? 'detalhe' : 'lista')}>← Cancelar</button>
      </div>

      <div className={styles.card}>
        <div className={styles.abas}>
          {(['dados', 'contatos'] as AbaForm[]).map(a => (
            <button key={a} className={`${styles.aba} ${abaForm === a ? styles.abaAtiva : ''}`}
              onClick={() => setAbaForm(a)}>
              {a === 'dados' ? '🏭 Dados do Fornecedor' : `👤 Contatos (${contatosForm.length})`}
            </button>
          ))}
        </div>

        {erro && <div className={styles.erroMsg}>{erro}</div>}

        {/* ── ABA: DADOS ── */}
        {abaForm === 'dados' && (
          <div className={styles.formBody}>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Razão Social *</label>
                <input className={styles.formInput} value={form.razao_social}
                  onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
                  placeholder="Nome completo da empresa" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome Fantasia</label>
                <input className={styles.formInput} value={form.nome_fantasia ?? ''}
                  onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))}
                  placeholder="Como é conhecido no mercado" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CNPJ</label>
                <input className={styles.formInput} value={form.cnpj ?? ''}
                  onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00" maxLength={18} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Código interno</label>
                <input className={styles.formInput} value={form.codigo ?? ''}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="Ref. para importação CSV" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Segmento</label>
                <select className={styles.formSelect} value={form.segmento ?? ''}
                  onChange={e => setForm(f => ({ ...f, segmento: e.target.value || null }))}>
                  <option value="">Selecione…</option>
                  {SEGMENTOS_FORNECEDOR.map(s => <option key={s} value={s}>{labelSegmento(s)}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Categoria de Material</label>
                <select className={styles.formSelect} value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}>
                  <option value="">Selecione…</option>
                  {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{labelCategoria(c)}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Telefone</label>
                <input className={styles.formInput} value={form.telefone ?? ''}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(00) 0000-0000" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>WhatsApp</label>
                <input className={styles.formInput} value={form.whatsapp ?? ''}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="(00) 90000-0000" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>E-mail</label>
                <input className={styles.formInput} type="email" value={form.email ?? ''}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contato@empresa.com.br" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Site</label>
                <input className={styles.formInput} value={form.site ?? ''}
                  onChange={e => setForm(f => ({ ...f, site: e.target.value }))}
                  placeholder="https://..." />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cidade</label>
                <input className={styles.formInput} value={form.cidade ?? ''}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estado</label>
                <select className={styles.formSelect} value={form.estado ?? ''}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value || null }))}>
                  <option value="">UF…</option>
                  {ESTADOS_BR.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CEP</label>
                <input className={styles.formInput} value={form.cep ?? ''}
                  onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                  placeholder="00000-000" maxLength={9} />
              </div>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Endereço</label>
                <input className={styles.formInput} value={form.endereco ?? ''}
                  onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                  placeholder="Rua, número, bairro" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Prazo de entrega padrão (dias)</label>
                <input className={styles.formInput} type="number" min="0"
                  value={form.prazo_entrega_padrao ?? ''}
                  onChange={e => setForm(f => ({ ...f, prazo_entrega_padrao: e.target.value ? parseInt(e.target.value) : null }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Condição de pagamento</label>
                <input className={styles.formInput} value={form.condicao_pagamento ?? ''}
                  onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
                  placeholder="Ex: 30 dias, à vista" />
              </div>

              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Observações</label>
                <textarea className={styles.formTextarea} rows={3} value={form.observacoes ?? ''}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Notas internas, condições especiais…" />
              </div>

              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={form.ativo}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    Fornecedor ativo
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={form.preferencial}
                      onChange={e => setForm(f => ({ ...f, preferencial: e.target.checked }))} />
                    ⭐ Marcar como preferencial
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: CONTATOS ── */}
        {abaForm === 'contatos' && (
          <div className={styles.formBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contatosForm.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.86rem', padding: '12px 0' }}>
                  Nenhum contato adicionado.
                </div>
              )}
              {contatosForm.map((c, idx) => (
                <div key={idx} className={`${styles.contatoFormCard} ${c.principal ? styles.contatoPrincipalForm : ''}`}>
                  <div className={styles.contatoFormHeader}>
                    <span className={styles.contatoFormNum}>Contato {idx + 1}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label className={styles.checkboxLabel} style={{ fontSize: '0.82rem' }}>
                        <input type="checkbox" checked={c.principal}
                          onChange={() => setPrincipal(idx)} />
                        Principal
                      </label>
                      <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                        onClick={() => removeContato(idx)}>✕</button>
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Nome *</label>
                      <input className={styles.formInput} value={c.nome}
                        onChange={e => updateContato(idx, 'nome', e.target.value)}
                        placeholder="Nome completo" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Cargo</label>
                      <input className={styles.formInput} value={c.cargo ?? ''}
                        onChange={e => updateContato(idx, 'cargo', e.target.value)}
                        placeholder="Ex: Vendedor, Gerente" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Telefone</label>
                      <input className={styles.formInput} value={c.telefone ?? ''}
                        onChange={e => updateContato(idx, 'telefone', e.target.value)}
                        placeholder="(00) 0000-0000" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>WhatsApp</label>
                      <input className={styles.formInput} value={c.whatsapp ?? ''}
                        onChange={e => updateContato(idx, 'whatsapp', e.target.value)}
                        placeholder="(00) 90000-0000" />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                      <label className={styles.formLabel}>E-mail</label>
                      <input className={styles.formInput} type="email" value={c.email ?? ''}
                        onChange={e => updateContato(idx, 'email', e.target.value)}
                        placeholder="contato@empresa.com.br" />
                    </div>
                  </div>
                </div>
              ))}
              <button className={styles.btnSecondary} style={{ alignSelf: 'flex-start' }}
                onClick={addContato}>
                + Adicionar Contato
              </button>
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista(atual ? 'detalhe' : 'lista')}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : atual ? 'Salvar Alterações' : 'Criar Fornecedor'}
          </button>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: PEDIDOS DE COMPRA
  // ══════════════════════════════════════════════════════════════════════════

  if (vista === 'pedidos') {
    const fmtDate = (d: string | null) => {
      if (!d) return '—'
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    }

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🏭 Fornecedores</div>
            <div className={styles.pageSubtitle}>Pedidos de Compra</div>
          </div>
          {navPrincipal}
        </div>

        {pedidoMsg && (
          <div className={`${styles.msg} ${pedidoMsg!.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
            {pedidoMsg!.texto}
          </div>
        )}

        {/* Botão novo pedido */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className={styles.btnPrimary}
            onClick={() => { setFormPedidoAberto(f => !f); setPedidoMsg(null) }}>
            {formPedidoAberto ? '✕ Fechar' : '+ Novo Pedido'}
          </button>
        </div>

        {/* Formulário de novo pedido */}
        {formPedidoAberto && (
          <div className={styles.pedidoForm}>
            <div className={styles.pedidoFormGrid}>
              <div className={styles.pedidoField}>
                <label>Fornecedor *</label>
                <select className={styles.pedidoInput}
                  value={pedidoForm.fornecedor_id}
                  onChange={e => setPedidoForm(f => ({ ...f, fornecedor_id: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {fornecedores.filter(f => f.ativo).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.razao_social}{f.nome_fantasia ? ` (${f.nome_fantasia})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.pedidoField}>
                <label>Data do pedido</label>
                <input type="date" className={styles.pedidoInput}
                  value={pedidoForm.data_pedido}
                  onChange={e => setPedidoForm(f => ({ ...f, data_pedido: e.target.value }))} />
              </div>
              <div className={styles.pedidoField}>
                <label>Previsão de entrega</label>
                <input type="date" className={styles.pedidoInput}
                  value={pedidoForm.previsao_entrega}
                  onChange={e => setPedidoForm(f => ({ ...f, previsao_entrega: e.target.value }))} />
              </div>
              <div className={styles.pedidoFieldFull}>
                <label>Observação</label>
                <input className={styles.pedidoInput}
                  value={pedidoForm.observacao}
                  onChange={e => setPedidoForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Condições, referências, urgência..." />
              </div>
            </div>

            {/* Itens */}
            <div className={styles.pedidoItensWrap}>
              <div className={styles.pedidoItensTitulo}>Itens do pedido</div>
              {pedidoItens.map((item, idx) => (
                <div key={idx} className={styles.pedidoItemRow}>
                  <div className={styles.pedidoField} style={{ flex: 3 }}>
                    <label>Descrição *</label>
                    <input className={styles.pedidoInput}
                      value={item.descricao}
                      onChange={e => setPedidoItens(its => its.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                      placeholder="Ex: Chapa Inox 304 2mm" />
                  </div>
                  <div className={styles.pedidoField} style={{ flex: 1 }}>
                    <label>Unidade</label>
                    <select className={styles.pedidoInput}
                      value={item.unidade}
                      onChange={e => setPedidoItens(its => its.map((it, i) => i === idx ? { ...it, unidade: e.target.value } : it))}>
                      {UNIDADES_MAT.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className={styles.pedidoField} style={{ flex: 1 }}>
                    <label>Qtd *</label>
                    <input type="number" step="0.001" min="0" className={styles.pedidoInput}
                      value={item.quantidade}
                      onChange={e => setPedidoItens(its => its.map((it, i) => i === idx ? { ...it, quantidade: e.target.value } : it))}
                      placeholder="0" />
                  </div>
                  <div className={styles.pedidoField} style={{ flex: 1 }}>
                    <label>Preço unit.</label>
                    <input type="number" step="0.01" min="0" className={styles.pedidoInput}
                      value={item.preco_unit}
                      onChange={e => setPedidoItens(its => its.map((it, i) => i === idx ? { ...it, preco_unit: e.target.value } : it))}
                      placeholder="0,00" />
                  </div>
                  <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
                    {pedidoItens.length > 1 && (
                      <button className={styles.btnIconRemove}
                        onClick={() => setPedidoItens(its => its.filter((_, i) => i !== idx))}>✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button className={styles.btnAddItem}
                onClick={() => setPedidoItens(its => [...its, { ...ITEM_VAZIO }])}>
                + Adicionar item
              </button>
            </div>

            {/* Total estimado */}
            {(() => {
              const total = pedidoItens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.preco_unit) || 0), 0)
              return total > 0 ? (
                <div className={styles.pedidoTotal}>Total estimado: <strong>{fmtBRL(total)}</strong></div>
              ) : null
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className={styles.btnPrimary} onClick={criarPedido} disabled={salvandoPedido}>
                {salvandoPedido ? 'Criando...' : 'Criar Pedido'}
              </button>
              <button className={styles.btnSecondary} onClick={() => setFormPedidoAberto(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista de pedidos */}
        {loadingPedidos ? (
          <div className={styles.loading}>Carregando...</div>
        ) : pedidos.length === 0 ? (
          <div className={styles.vazio}>Nenhum pedido de compra. Clique em "+ Novo Pedido" para começar.</div>
        ) : (
          <div className={styles.pedidosLista}>
            {pedidos.map(p => {
              const cfg = STATUS_CONFIG[p.status]
              const nomeForn = p.fornecedores?.razao_social ?? '—'
              return (
                <div key={p.id} className={styles.pedidoCard}
                  onClick={async () => {
                    setPedidoAtual(p)
                    await carregarItensPedido(p.id)
                    setVista('pedido_detalhe')
                  }}>
                  <div className={styles.pedidoCardTop}>
                    <div>
                      <div className={styles.pedidoCardForn}>{nomeForn}</div>
                      <div className={styles.pedidoCardId}>Pedido #{p.id} · {fmtDate(p.data_pedido)}</div>
                      {p.observacao && <div className={styles.pedidoCardObs}>{p.observacao}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span className={styles.pedidoBadgeStatus}
                        style={{ background: cfg.bg, color: cfg.cor }}>
                        {cfg.label}
                      </span>
                      {p.valor_total != null && (
                        <span className={styles.pedidoCardValor}>{fmtBRL(p.valor_total)}</span>
                      )}
                      {p.previsao_entrega && (
                        <span className={styles.pedidoCardPrevisao}>entrega: {fmtDate(p.previsao_entrega)}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.pedidoCardAcoes} onClick={e => e.stopPropagation()}>
                    {PROXIMO_STATUS[p.status] && (
                      <button className={styles.btnAvancarPedido}
                        onClick={() => atualizarStatusPedido(p, PROXIMO_STATUS[p.status]!)}>
                        → {STATUS_CONFIG[PROXIMO_STATUS[p.status]!].label}
                      </button>
                    )}
                    {p.status !== 'cancelado' && p.status !== 'recebido' && (
                      <button className={styles.btnCancelarPedido}
                        onClick={() => atualizarStatusPedido(p, 'cancelado')}>
                        Cancelar
                      </button>
                    )}
                    <button className={styles.btnExcluirPedido}
                      onClick={() => excluirPedido(p)}>Excluir</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Detalhe do pedido ──────────────────────────────────────────────────────
  if (vista === 'pedido_detalhe' && pedidoAtual) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const pa = pedidoAtual as NonNullable<typeof pedidoAtual>
    const cfg = STATUS_CONFIG[pa.status]
    const nomeForn = pa.fornecedores?.razao_social ?? '—'
    const fmtDate = (d: string | null) => {
      if (!d) return '—'
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    }
    const totalItens = itensPedidoAtual.reduce((s, i) => {
      return s + Number(i.quantidade) * (Number(i.preco_unit) || 0)
    }, 0)

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🏭 Fornecedores</div>
            <div className={styles.pageSubtitle}>Pedido #{pa.id}</div>
          </div>
          {navPrincipal}
        </div>

        <button className={styles.btnSecondary}
          style={{ marginBottom: 16, alignSelf: 'flex-start' }}
          onClick={() => { setVista('pedidos'); setPedidoAtual(null) }}>
          ← Voltar
        </button>

        <div className={styles.pedidoDetalheCard}>
          <div className={styles.pedidoDetalheHeader}>
            <div>
              <div className={styles.pedidoCardForn}>{nomeForn}</div>
              <div className={styles.pedidoCardId}>
                Pedido #{pa.id} · {fmtDate(pa.data_pedido)}
                {pa.previsao_entrega && ` · entrega prevista: ${fmtDate(pa.previsao_entrega)}`}
              </div>
              {pa.observacao && (
                <div className={styles.pedidoCardObs} style={{ marginTop: 4 }}>{pa.observacao}</div>
              )}
            </div>
            <span className={styles.pedidoBadgeStatus}
              style={{ background: cfg.bg, color: cfg.cor, fontSize: '0.9rem', padding: '5px 14px' }}>
              {cfg.label}
            </span>
          </div>

          {/* Itens */}
          <table className={styles.pedidoItensTable}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Unidade</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Preço unit.</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Obs</th>
              </tr>
            </thead>
            <tbody>
              {itensPedidoAtual.map(it => {
                const q = Number(it.quantidade)
                const p = Number(it.preco_unit ?? 0)
                return (
                  <tr key={it.id}>
                    <td>{it.descricao}</td>
                    <td>{it.unidade}</td>
                    <td style={{ textAlign: 'right' }}>{q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                    <td style={{ textAlign: 'right' }}>{p > 0 ? fmtBRL(p) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p > 0 ? fmtBRL(q * p) : '—'}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{it.observacao ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
            {totalItens > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, paddingTop: 8 }}>Total:</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmtBRL(totalItens)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>

          {/* Ações de status */}
          <div className={styles.pedidoDetalheAcoes}>
            {PROXIMO_STATUS[pa.status] && (
              <button className={styles.btnAvancarPedido}
                onClick={() => atualizarStatusPedido(pa, PROXIMO_STATUS[pa.status]!)}>
                → Marcar como {STATUS_CONFIG[PROXIMO_STATUS[pa.status]!].label}
              </button>
            )}
            {pa.status !== 'cancelado' && pa.status !== 'recebido' && (
              <button className={styles.btnCancelarPedido}
                onClick={() => atualizarStatusPedido(pa, 'cancelado')}>
                Cancelar pedido
              </button>
            )}
            <button className={styles.btnExcluirPedido}
              style={{ marginLeft: 'auto' }}
              onClick={() => excluirPedido(pa)}>Excluir</button>
          </div>
        </div>
      </div>
    )
  }
}
