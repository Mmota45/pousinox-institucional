import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProjetos.module.css'

const EMBEDDING_WEBHOOK     = import.meta.env.VITE_EMBEDDING_WEBHOOK     ?? ''
const SUPABASE_SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY  ?? ''

// ── Hash SHA-256 truncado para consulta_hash do shadow log ───────────────────
async function hashConsulta(atributos: { chave: string; valor: string }[]): Promise<string> {
  const str = [...atributos].sort((a, b) => a.chave.localeCompare(b.chave)).map(a => `${a.chave}=${a.valor}`).join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

function dispararEmbedding(projeto_id: number) {
  if (!EMBEDDING_WEBHOOK) return
  fetch(EMBEDDING_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? ''}`,
    },
    body: JSON.stringify({ projeto_id }),
  }).catch(() => { /* silencioso — embedding é assíncrono, não bloqueia o fluxo */ })
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Projeto {
  id: number
  codigo: string
  titulo: string
  cliente_nome: string | null
  cliente_cnpj: string | null
  segmento: string | null
  status: string
  data_inicio: string | null
  data_conclusao: string | null
  valor_total: number | null
  observacoes: string | null
  produto_padrao_id: number | null
  created_at: string
  updated_at: string
  qtd_atributos?: number
  qtd_anexos?: number
}

interface AtributoCatalogo {
  chave: string
  label_pt: string
  tipo_valor: string
  unidade_padrao: string | null
  valores_enum: string[] | null
  frequencia_uso: number
}

interface ProjetoAtributo {
  id: number
  chave: string
  valor: string
  valor_num: number | null
  unidade: string | null
  origem: string
}

interface ProjetoAnexo {
  id: number
  tipo: string
  nome_original: string
  storage_path: string
  descricao: string | null
  tamanho_bytes: number | null
  uploaded_at: string
}

interface AtributoLocal {
  id?: number       // undefined = novo (não salvo ainda)
  chave: string
  valor: string
  unidade: string
}

interface Recorrencia {
  id: number
  hash_atributos: string
  atributos_chave: Record<string, string>
  contagem: number
  status: string
  sugerido_em: string
  analisado_em: string | null
  analisado_por: string | null
  projeto_ids: number[]
  projeto_codigos: string[]
  projeto_titulos: string[]
}

interface ProdutoPadrao {
  id: number
  codigo: string
  nome: string
  descricao: string | null
  segmento: string | null
  atributos: Record<string, string>
  status: string
  aprovado_por: string | null
  aprovado_em: string | null
  created_at: string
  updated_at: string
  qtd_projetos: number
}

interface ProjetoSimilar {
  projeto_id: number
  codigo: string
  titulo: string
  cliente_nome: string | null
  segmento: string | null
  status: string
  score: number
  atributos_comuns: number
}

const SEGMENTOS = ['hospitalar', 'alimenticio', 'hotelaria', 'comercio', 'industrial', 'residencial', 'outro']
const BUCKET = 'projetos-anexos'

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizarChave(s: string): string {
  const sem_acento = s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  let chave = sem_acento.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (/^\d/.test(chave)) chave = '_' + chave
  return chave || 'atributo'
}

function iconeAnexo(tipo: string): string {
  if (tipo === 'pdf') return '📄'
  if (tipo === 'imagem') return '🖼'
  if (tipo === 'dwg') return '📐'
  return '📎'
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelStatus(s: string): string {
  return { em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' }[s] ?? s
}

function classeStatus(s: string): string {
  return { em_andamento: styles.statusAndamento, concluido: styles.statusConcluido, cancelado: styles.statusCancelado }[s] ?? ''
}

// ── Componente principal ──────────────────────────────────────────────────────

type Vista = 'lista' | 'form' | 'detalhe' | 'recorrencias' | 'produtos_padrao'
type AbaForm = 'dados' | 'atributos' | 'anexos'

const FORM_VAZIO = {
  titulo: '', cliente_nome: '', cliente_cnpj: '', segmento: '',
  status: 'em_andamento', data_inicio: '', data_conclusao: '',
  valor_total: '', observacoes: '',
}

export default function AdminProjetos() {
  // ── Vista ──────────────────────────────────────────────────────────────────
  const [vista, setVista] = useState<Vista>('lista')
  const [abaForm, setAbaForm] = useState<AbaForm>('dados')

  // ── Lista ──────────────────────────────────────────────────────────────────
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState('')

  // ── Projeto selecionado (detalhe / editar) ─────────────────────────────────
  const [projetoAtual, setProjetoAtual] = useState<Projeto | null>(null)
  const [atributosDetalhe, setAtributosDetalhe] = useState<ProjetoAtributo[]>([])
  const [anexosDetalhe, setAnexosDetalhe] = useState<ProjetoAnexo[]>([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)

  // ── Formulário ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ ...FORM_VAZIO })
  const [atributos, setAtributos] = useState<AtributoLocal[]>([])
  const [catalogo, setCatalogo] = useState<AtributoCatalogo[]>([])
  const [novoAtrib, setNovoAtrib] = useState({ chave: '', valor: '', unidade: '' })
  const [atribNovo, setAtribNovo] = useState(false)        // mostra input de novo atrib

  // ── Anexos (form) ──────────────────────────────────────────────────────────
  const [anexosForm, setAnexosForm] = useState<ProjetoAnexo[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadErro, setUploadErro] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Similares ──────────────────────────────────────────────────────────────
  const [similares, setSimilares] = useState<ProjetoSimilar[]>([])
  const [loadingSimilares, setLoadingSimilares] = useState(false)
  const similaresTiRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Shadow mode (feature flag) ─────────────────────────────────────────────
  const [shadowEnabled, setShadowEnabled] = useState(false)
  useEffect(() => {
    supabaseAdmin
      .from('feature_flags')
      .select('habilitado')
      .eq('flag', 'vector_similarity_shadow')
      .single()
      .then(({ data }) => setShadowEnabled(data?.habilitado === true))
  }, [])

  // ── Produtos Padrão ────────────────────────────────────────────────────────
  const [produtosPadrao, setProdutosPadrao] = useState<ProdutoPadrao[]>([])
  const [loadingPP, setLoadingPP] = useState(false)
  const [ppExpandido, setPpExpandido] = useState<number | null>(null)

  // ── Modal conversão ────────────────────────────────────────────────────────
  const [modalConv, setModalConv] = useState<Recorrencia | null>(null)
  const [formConv, setFormConv] = useState({ nome: '', descricao: '', segmento: '' })
  const [convertendo, setConvertendo] = useState(false)
  const [erroConv, setErroConv] = useState<string | null>(null)

  // ── Recorrências ───────────────────────────────────────────────────────────
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([])
  const [loadingRec, setLoadingRec] = useState(false)
  const [detectando, setDetectando] = useState(false)
  const [filtroRec, setFiltroRec] = useState<string>('detectada')
  const [recExpandida, setRecExpandida] = useState<number | null>(null)

  // ── Estado geral ───────────────────────────────────────────────────────────
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // ── Carregar lista ─────────────────────────────────────────────────────────
  const carregarLista = useCallback(async () => {
    setLoadingLista(true)
    const { data } = await supabaseAdmin
      .from('vw_projetos_resumo')
      .select('*')
      .order('updated_at', { ascending: false })
    setProjetos((data ?? []) as Projeto[])
    setLoadingLista(false)
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])

  // ── Carregar catálogo de atributos ─────────────────────────────────────────
  useEffect(() => {
    supabaseAdmin
      .from('atributos_catalogo')
      .select('chave,label_pt,tipo_valor,unidade_padrao,valores_enum,frequencia_uso')
      .eq('status', 'ativo')
      .order('frequencia_uso', { ascending: false })
      .then(({ data }) => setCatalogo((data ?? []) as AtributoCatalogo[]))
  }, [])

  // ── Carregar detalhe (atributos + anexos) ──────────────────────────────────
  const carregarDetalhe = useCallback(async (projeto: Projeto) => {
    setLoadingDetalhe(true)
    const [resAtrib, resAnexos] = await Promise.all([
      supabaseAdmin.from('projeto_atributos').select('*').eq('projeto_id', projeto.id).order('chave'),
      supabaseAdmin.from('projeto_anexos').select('*').eq('projeto_id', projeto.id).order('uploaded_at'),
    ])
    setAtributosDetalhe((resAtrib.data ?? []) as ProjetoAtributo[])
    setAnexosDetalhe((resAnexos.data ?? []) as ProjetoAnexo[])
    setLoadingDetalhe(false)
  }, [])

  // ── Carregar recorrências ──────────────────────────────────────────────────
  const carregarRecorrencias = useCallback(async () => {
    setLoadingRec(true)
    const { data } = await supabaseAdmin
      .from('vw_recorrencias')
      .select('*')
      .order('contagem', { ascending: false })
    setRecorrencias((data ?? []) as Recorrencia[])
    setLoadingRec(false)
  }, [])

  async function detectarRecorrencias() {
    setDetectando(true)
    const { data, error } = await supabaseAdmin.rpc('detectar_recorrencias', { p_min_contagem: 3 })
    setDetectando(false)
    if (error) { alert(`Erro: ${error.message}`); return }
    await carregarRecorrencias()
    alert(`Detecção concluída. ${data ?? 0} recorrência(s) com status "detectada".`)
  }

  async function atualizarStatusRec(id: number, status: string) {
    await supabaseAdmin
      .from('recorrencias')
      .update({ status, analisado_em: new Date().toISOString() })
      .eq('id', id)
    setRecorrencias(prev => prev.map(r => r.id === id ? { ...r, status, analisado_em: new Date().toISOString() } : r))
  }

  useEffect(() => {
    if (vista === 'recorrencias') carregarRecorrencias()
  }, [vista, carregarRecorrencias])

  // ── Carregar produtos padrão ───────────────────────────────────────────────
  const carregarProdutosPadrao = useCallback(async () => {
    setLoadingPP(true)
    const { data } = await supabaseAdmin
      .from('vw_produtos_padrao')
      .select('*')
      .order('created_at', { ascending: false })
    setProdutosPadrao((data ?? []) as ProdutoPadrao[])
    setLoadingPP(false)
  }, [])

  useEffect(() => {
    if (vista === 'produtos_padrao') carregarProdutosPadrao()
  }, [vista, carregarProdutosPadrao])

  // ── Conversão: abre modal ──────────────────────────────────────────────────
  function abrirModalConversao(r: Recorrencia) {
    setModalConv(r)
    setFormConv({ nome: '', descricao: '', segmento: '' })
    setErroConv(null)
  }

  async function confirmarConversao() {
    if (!modalConv) return
    if (!formConv.nome.trim()) { setErroConv('Nome é obrigatório.'); return }
    setConvertendo(true)
    setErroConv(null)
    const { error } = await supabaseAdmin.rpc('converter_recorrencia', {
      p_recorrencia_id: modalConv.id,
      p_nome:           formConv.nome.trim(),
      p_descricao:      formConv.descricao.trim() || null,
      p_segmento:       formConv.segmento || null,
      p_aprovado_por:   null,
    })
    setConvertendo(false)
    if (error) { setErroConv(error.message); return }
    setModalConv(null)
    await Promise.all([carregarRecorrencias(), carregarLista()])
    setVista('produtos_padrao')
  }

  async function alterarStatusPP(id: number, status: string) {
    await supabaseAdmin.from('produtos_padrao').update({ status }).eq('id', id)
    setProdutosPadrao(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  // ── Buscar similares (debounced, ≥2 atributos) + shadow mode ─────────────
  useEffect(() => {
    if (vista !== 'form') return
    if (similaresTiRef.current) clearTimeout(similaresTiRef.current)
    if (atributos.length < 2) { setSimilares([]); return }

    similaresTiRef.current = setTimeout(async () => {
      setLoadingSimilares(true)
      const payload = atributos.filter(a => a.chave && a.valor).map(a => ({ chave: a.chave, valor: a.valor }))

      // ── Motor atual: Jaccard ───────────────────────────────────────────────
      const t0Jaccard = Date.now()
      const { data: jaccardData } = await supabaseAdmin.rpc('buscar_similares', {
        p_atributos:   JSON.stringify(payload),
        p_excluir_id:  projetoAtual?.id ?? null,
        p_limite:      5,
      })
      const jaccardMs = Date.now() - t0Jaccard
      const jaccardResults = (jaccardData ?? []) as ProjetoSimilar[]
      setSimilares(jaccardResults)
      setLoadingSimilares(false)

      // ── Shadow mode: motor vetorial (invisível ao usuário) ─────────────────
      if (!shadowEnabled || !EMBEDDING_WEBHOOK || !SUPABASE_SERVICE_KEY) return

      // Tudo abaixo roda em background sem afetar a UI
      ;(async () => {
        const hash = await hashConsulta(payload)
        let vectorSkip: string | null = null
        let vectorIds: number[] = []
        let vectorScores: number[] = []
        let vectorMs: number | null = null

        try {
          const t0Vector = Date.now()

          // 1. Gerar embedding da query via Edge Function
          const embRes = await fetch(EMBEDDING_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              mode:      'query',
              titulo:    form.titulo,
              segmento:  form.segmento || null,
              atributos: payload,
            }),
          })

          if (!embRes.ok) { vectorSkip = `embedding_error_${embRes.status}`; throw new Error(vectorSkip) }
          const { embedding } = await embRes.json()
          if (!embedding?.length) { vectorSkip = 'embedding_vazio'; throw new Error(vectorSkip) }

          // 2. Buscar similares vetoriais
          const { data: vectorData } = await supabaseAdmin.rpc('buscar_similares_vector', {
            p_embedding:  `[${embedding.join(',')}]`,
            p_excluir_id: projetoAtual?.id ?? null,
            p_limite:     5,
          })
          vectorMs = Date.now() - t0Vector
          vectorIds    = (vectorData ?? []).map((r: { projeto_id: number }) => r.projeto_id)
          vectorScores = (vectorData ?? []).map((r: { score: number }) => r.score)
        } catch {
          vectorSkip = vectorSkip ?? 'erro_desconhecido'
        }

        // 3. Registrar log comparativo
        await supabaseAdmin.rpc('registrar_shadow_log', {
          p_consulta_hash:    hash,
          p_projeto_id_query: projetoAtual?.id ?? null,
          p_atributos_json:   payload,
          p_jaccard_ids:      jaccardResults.map(r => r.projeto_id),
          p_jaccard_scores:   jaccardResults.map(r => r.score),
          p_jaccard_ms:       jaccardMs,
          p_vector_ids:       vectorIds,
          p_vector_scores:    vectorScores,
          p_vector_ms:        vectorMs,
          p_vector_skip:      vectorSkip,
          p_top_n:            5,
          p_modelo:           'gemini-embedding-001-3072',
        })
      })()
    }, 600)

    return () => { if (similaresTiRef.current) clearTimeout(similaresTiRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atributos, vista, shadowEnabled])

  // ── Abrir detalhe ──────────────────────────────────────────────────────────
  function abrirDetalhe(projeto: Projeto) {
    setProjetoAtual(projeto)
    carregarDetalhe(projeto)
    setVista('detalhe')
  }

  // ── Abrir form (novo ou editar) ────────────────────────────────────────────
  function abrirFormNovo() {
    setProjetoAtual(null)
    setForm({ ...FORM_VAZIO })
    setAtributos([])
    setAnexosForm([])
    setAbaForm('dados')
    setErro(null)
    setVista('form')
  }

  async function abrirFormEditar(projeto: Projeto) {
    setProjetoAtual(projeto)
    setForm({
      titulo:         projeto.titulo,
      cliente_nome:   projeto.cliente_nome ?? '',
      cliente_cnpj:   projeto.cliente_cnpj ?? '',
      segmento:       projeto.segmento ?? '',
      status:         projeto.status,
      data_inicio:    projeto.data_inicio ?? '',
      data_conclusao: projeto.data_conclusao ?? '',
      valor_total:    projeto.valor_total != null ? String(projeto.valor_total) : '',
      observacoes:    projeto.observacoes ?? '',
    })
    setAbaForm('dados')
    setErro(null)
    // Carrega atributos e anexos existentes
    const [resAtrib, resAnexos] = await Promise.all([
      supabaseAdmin.from('projeto_atributos').select('*').eq('projeto_id', projeto.id).order('chave'),
      supabaseAdmin.from('projeto_anexos').select('*').eq('projeto_id', projeto.id).order('uploaded_at'),
    ])
    setAtributos(((resAtrib.data ?? []) as ProjetoAtributo[]).map(a => ({
      id: a.id, chave: a.chave, valor: a.valor, unidade: a.unidade ?? '',
    })))
    setAnexosForm((resAnexos.data ?? []) as ProjetoAnexo[])
    setVista('form')
  }

  // ── Salvar projeto ─────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.titulo.trim()) { setErro('Título é obrigatório.'); return }
    setSalvando(true)
    setErro(null)

    const payload = {
      titulo:         form.titulo.trim(),
      cliente_nome:   form.cliente_nome.trim() || null,
      cliente_cnpj:   form.cliente_cnpj.replace(/\D/g, '') || null,
      segmento:       form.segmento || null,
      status:         form.status,
      data_inicio:    form.data_inicio || null,
      data_conclusao: form.data_conclusao || null,
      valor_total:    form.valor_total ? parseFloat(form.valor_total.replace(',', '.')) : null,
      observacoes:    form.observacoes.trim() || null,
    }

    let projetoId: number

    if (projetoAtual) {
      // Editar
      const { error } = await supabaseAdmin
        .from('projetos').update(payload).eq('id', projetoAtual.id)
      if (error) { setErro(error.message); setSalvando(false); return }
      projetoId = projetoAtual.id
    } else {
      // Novo
      const { data, error } = await supabaseAdmin
        .from('projetos').insert(payload).select('id').single()
      if (error || !data) { setErro(error?.message ?? 'Erro ao criar projeto.'); setSalvando(false); return }
      projetoId = data.id
    }

    // Salvar atributos: delete todos e reinsere (mais simples que diff)
    await supabaseAdmin.from('projeto_atributos').delete().eq('projeto_id', projetoId)
    if (atributos.length > 0) {
      const rows = atributos
        .filter(a => a.chave && a.valor)
        .map(a => ({
          projeto_id: projetoId,
          chave: normalizarChave(a.chave),
          valor: a.valor.trim(),
          unidade: a.unidade.trim() || null,
          origem: 'manual' as const,
        }))
      if (rows.length > 0) {
        const { error } = await supabaseAdmin.from('projeto_atributos').insert(rows)
        if (error) { setErro(error.message); setSalvando(false); return }
      }
    }

    setSalvando(false)
    await carregarLista()

    // Dispara geração de embedding em background (não bloqueia UX)
    dispararEmbedding(projetoId)

    // Após salvar, abre o detalhe do projeto
    const { data: proj } = await supabaseAdmin
      .from('vw_projetos_resumo').select('*').eq('id', projetoId).single()
    if (proj) abrirDetalhe(proj as Projeto)
    else setVista('lista')
  }

  // ── Upload de arquivo ──────────────────────────────────────────────────────
  async function uploadAnexo(file: File, projetoId: number) {
    setUploading(true)
    setUploadErro(null)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const tipoDetectado: ProjetoAnexo['tipo'] =
      ext === 'pdf' ? 'pdf'
      : ['jpg','jpeg','png','webp','gif'].includes(ext) ? 'imagem'
      : ['dwg','dxf'].includes(ext) ? 'dwg'
      : 'outro'

    const path = `${projetoId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: storageErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, file)
    if (storageErr) {
      setUploadErro(`Erro no upload: ${storageErr.message}`)
      setUploading(false)
      return
    }

    const { data: anexo, error: dbErr } = await supabaseAdmin
      .from('projeto_anexos')
      .insert({
        projeto_id: projetoId,
        tipo: tipoDetectado,
        nome_original: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
      })
      .select('*')
      .single()

    if (dbErr) {
      setUploadErro(`Erro ao salvar anexo: ${dbErr.message}`)
      // Tenta remover arquivo do storage para evitar órfão
      await supabaseAdmin.storage.from(BUCKET).remove([path])
    } else if (anexo) {
      setAnexosForm(prev => [...prev, anexo as ProjetoAnexo])
    }

    setUploading(false)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!projetoAtual) {
      setUploadErro('Salve o projeto antes de adicionar anexos.')
      return
    }
    for (const file of Array.from(files)) {
      await uploadAnexo(file, projetoAtual.id)
    }
  }

  async function removerAnexo(anexo: ProjetoAnexo) {
    if (!confirm(`Remover "${anexo.nome_original}"?`)) return
    // 1. Remove do Storage
    await supabaseAdmin.storage.from(BUCKET).remove([anexo.storage_path])
    // 2. Remove do banco
    await supabaseAdmin.from('projeto_anexos').delete().eq('id', anexo.id)
    setAnexosForm(prev => prev.filter(a => a.id !== anexo.id))
    // Atualiza também na view de detalhe
    setAnexosDetalhe(prev => prev.filter(a => a.id !== anexo.id))
  }

  async function abrirAnexo(anexo: ProjetoAnexo) {
    const { data } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(anexo.storage_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ── Adicionar atributo ─────────────────────────────────────────────────────
  function adicionarAtributo() {
    if (!novoAtrib.chave || !novoAtrib.valor) return
    const chave = normalizarChave(novoAtrib.chave)
    if (atributos.some(a => a.chave === chave)) {
      setErro(`Atributo "${chave}" já existe neste projeto.`)
      return
    }
    setAtributos(prev => [...prev, { chave, valor: novoAtrib.valor.trim(), unidade: novoAtrib.unidade.trim() }])
    setNovoAtrib({ chave: '', valor: '', unidade: '' })
    setAtribNovo(false)
    setErro(null)
  }

  function removerAtributo(idx: number) {
    setAtributos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Seleção de chave do catálogo ───────────────────────────────────────────
  function onSelecionarChaveCatalogo(chave: string) {
    const item = catalogo.find(c => c.chave === chave)
    setNovoAtrib(prev => ({
      ...prev,
      chave,
      unidade: item?.unidade_padrao ?? '',
    }))
  }

  // ── Lista filtrada ─────────────────────────────────────────────────────────
  const projetosFiltrados = projetos.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q || p.titulo.toLowerCase().includes(q) || (p.cliente_nome ?? '').toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    const matchStatus = !filtroStatus || p.status === filtroStatus
    const matchSegmento = !filtroSegmento || p.segmento === filtroSegmento
    return matchBusca && matchStatus && matchSegmento
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Navegação principal (Projetos / Recorrências) ─────────────────────────
  const navPrincipal = (
    <div className={styles.navPrincipal}>
      <button
        className={`${styles.navPrincipalBtn} ${(vista === 'lista' || vista === 'form' || vista === 'detalhe') ? styles.navPrincipalAtivo : ''}`}
        onClick={() => setVista('lista')}
      >📐 Projetos{projetos.length > 0 && <span className={styles.navCount}>{projetos.length}</span>}</button>
      <button
        className={`${styles.navPrincipalBtn} ${vista === 'recorrencias' ? styles.navPrincipalAtivo : ''}`}
        onClick={() => setVista('recorrencias')}
      >🔁 Recorrências{recorrencias.filter(r => r.status === 'detectada').length > 0 && <span className={styles.navCountAlert}>{recorrencias.filter(r => r.status === 'detectada').length}</span>}</button>
      <button
        className={`${styles.navPrincipalBtn} ${vista === 'produtos_padrao' ? styles.navPrincipalAtivo : ''}`}
        onClick={() => setVista('produtos_padrao')}
      >📦 Produtos Padrão{produtosPadrao.filter(p => p.status === 'ativo').length > 0 && <span className={styles.navCount}>{produtosPadrao.filter(p => p.status === 'ativo').length}</span>}</button>
    </div>
  )

  // VISTA: LISTA
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>📐 Projetos Sob Medida</div>
          <div className={styles.pageSubtitle}>Base de conhecimento de projetos executados</div>
        </div>
        <button className={styles.btnPrimary} onClick={abrirFormNovo}>+ Novo Projeto</button>
      </div>
      {navPrincipal}

      <div className={styles.toolbar}>
        <input
          className={styles.buscaInput}
          placeholder="Buscar por título, cliente ou código…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select className={styles.selectFiltro} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
          <option value="">Todos os segmentos</option>
          {SEGMENTOS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {loadingLista ? (
        <div className={styles.loading}>Carregando projetos…</div>
      ) : (
        <div className={styles.tableWrap}>
          {projetosFiltrados.length === 0 ? (
            <div className={styles.vazio}>
              {projetos.length === 0 ? 'Nenhum projeto cadastrado ainda.' : 'Nenhum projeto encontrado.'}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Segmento</th>
                  <th>Status</th>
                  <th>Atributos</th>
                  <th>Anexos</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {projetosFiltrados.map(p => (
                  <tr key={p.id} onClick={() => abrirDetalhe(p)}>
                    <td><span className={styles.codigo}>{p.codigo}</span></td>
                    <td><span className={styles.titulo}>{p.titulo}</span></td>
                    <td><span className={styles.cliente}>{p.cliente_nome ?? '—'}</span></td>
                    <td>
                      {p.segmento
                        ? <span className={styles.badgeSegmento}>{p.segmento}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td>
                      <span className={`${styles.badgeStatus} ${classeStatus(p.status)}`}>
                        {labelStatus(p.status)}
                      </span>
                    </td>
                    <td><span className={styles.numBadge}>{p.qtd_atributos ?? 0} atr.</span></td>
                    <td><span className={styles.numBadge}>{p.qtd_anexos ?? 0} arq.</span></td>
                    <td><span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fmtData(p.updated_at.split('T')[0])}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )

  // VISTA: DETALHE
  if (vista === 'detalhe' && projetoAtual) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>📐 Projetos Sob Medida</div>
          <div className={styles.pageSubtitle}>Detalhe do projeto</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Lista</button>
          <button className={styles.btnPrimary} onClick={() => abrirFormEditar(projetoAtual)}>✏️ Editar</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <span className={styles.cardCodigo}>{projetoAtual.codigo}</span>
            <span className={styles.cardTitulo}>{projetoAtual.titulo}</span>
          </div>
          <div className={styles.cardHeaderRight}>
            {projetoAtual.segmento && <span className={styles.badgeSegmento}>{projetoAtual.segmento}</span>}
            <span className={`${styles.badgeStatus} ${classeStatus(projetoAtual.status)}`}>
              {labelStatus(projetoAtual.status)}
            </span>
          </div>
        </div>

        {loadingDetalhe ? (
          <div className={styles.loading}>Carregando detalhes…</div>
        ) : (
          <div className={styles.detalheGrid}>
            {/* Coluna esquerda: dados básicos */}
            <div className={styles.detalheSection}>
              <div className={styles.detalheSectionTitle}>Dados do Projeto</div>
              {projetoAtual.cliente_nome && (
                <div className={styles.detalheField}>
                  <span className={styles.detalheFieldLabel}>Cliente</span>
                  <span className={styles.detalheFieldValue}>{projetoAtual.cliente_nome}</span>
                </div>
              )}
              {projetoAtual.cliente_cnpj && (
                <div className={styles.detalheField}>
                  <span className={styles.detalheFieldLabel}>CNPJ</span>
                  <span className={styles.detalheFieldValue} style={{ fontFamily: 'monospace' }}>
                    {projetoAtual.cliente_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                  </span>
                </div>
              )}
              {projetoAtual.data_inicio && (
                <div className={styles.detalheField}>
                  <span className={styles.detalheFieldLabel}>Período</span>
                  <span className={styles.detalheFieldValue}>
                    {fmtData(projetoAtual.data_inicio)}{projetoAtual.data_conclusao ? ` → ${fmtData(projetoAtual.data_conclusao)}` : ''}
                  </span>
                </div>
              )}
              {projetoAtual.valor_total != null && (
                <div className={styles.detalheField}>
                  <span className={styles.detalheFieldLabel}>Valor Total</span>
                  <span className={styles.detalheFieldValue} style={{ color: '#15803d' }}>{fmtBRL(projetoAtual.valor_total)}</span>
                </div>
              )}
              {projetoAtual.observacoes && (
                <div className={styles.detalheField}>
                  <span className={styles.detalheFieldLabel}>Observações</span>
                  <span className={styles.detalheFieldValue} style={{ whiteSpace: 'pre-wrap', fontSize: '0.84rem' }}>{projetoAtual.observacoes}</span>
                </div>
              )}

              {/* Anexos */}
              <div className={styles.detalheSectionTitle} style={{ marginTop: 8 }}>Anexos ({anexosDetalhe.length})</div>
              {anexosDetalhe.length === 0 ? (
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Nenhum anexo.</span>
              ) : (
                <div className={styles.anexoList}>
                  {anexosDetalhe.map(a => (
                    <div key={a.id} className={styles.anexoItem}>
                      <span className={styles.anexoIcon}>{iconeAnexo(a.tipo)}</span>
                      <div className={styles.anexoInfo}>
                        <div className={styles.anexoNome}>{a.nome_original}</div>
                        <div className={styles.anexoMeta}>
                          <span>{a.tipo.toUpperCase()}</span>
                          {a.tamanho_bytes && <span>{formatBytes(a.tamanho_bytes)}</span>}
                          {a.descricao && <span>{a.descricao}</span>}
                        </div>
                      </div>
                      <div className={styles.anexoActions}>
                        <button className={styles.btnAnexoLink} onClick={() => abrirAnexo(a)}>↗ Abrir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coluna direita: atributos */}
            <div className={styles.detalheSection}>
              <div className={styles.detalheSectionTitle}>Atributos ({atributosDetalhe.length})</div>
              {atributosDetalhe.length === 0 ? (
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Nenhum atributo cadastrado.</span>
              ) : (
                <div className={styles.atributosGrid}>
                  {atributosDetalhe.map(a => (
                    <div key={a.id} className={styles.atributoBadge}>
                      <span className={styles.atributoBadgeChave}>{a.chave}</span>
                      <span className={styles.atributoBadgeValor}>{a.valor}</span>
                      {a.unidade && <span className={styles.atributoBadgeUnidade}>{a.unidade}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // VISTA: RECORRÊNCIAS
  if (vista === 'recorrencias') {
    const recFiltradas = recorrencias.filter(r => !filtroRec || r.status === filtroRec)
    const labelStatusRec: Record<string, string> = {
      detectada: 'Detectada', em_analise: 'Em análise',
      aprovada: 'Aprovada', rejeitada: 'Rejeitada', convertida: 'Convertida',
    }
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>📐 Projetos Sob Medida</div>
            <div className={styles.pageSubtitle}>Padrões recorrentes detectados</div>
          </div>
          <button
            className={styles.btnPrimary}
            onClick={detectarRecorrencias}
            disabled={detectando}
          >
            {detectando ? '⏳ Detectando…' : '🔍 Detectar Recorrências'}
          </button>
        </div>
        {navPrincipal}

        <div className={styles.toolbar}>
          {(['detectada','em_analise','aprovada','rejeitada'] as const).map(s => (
            <button
              key={s}
              className={`${styles.btnSecondary} ${filtroRec === s ? styles.filtroAtivo : ''}`}
              onClick={() => setFiltroRec(s)}
            >
              {labelStatusRec[s]}
              <span className={styles.navCount}>
                {recorrencias.filter(r => r.status === s).length}
              </span>
            </button>
          ))}
          <button
            className={`${styles.btnSecondary} ${filtroRec === '' ? styles.filtroAtivo : ''}`}
            onClick={() => setFiltroRec('')}
          >Todas</button>
        </div>

        {loadingRec ? (
          <div className={styles.loading}>Carregando recorrências…</div>
        ) : recFiltradas.length === 0 ? (
          <div className={styles.vazio}>
            {recorrencias.length === 0
              ? 'Nenhuma recorrência detectada ainda. Clique em "Detectar Recorrências" (mínimo 3 projetos com mesmos atributos).'
              : 'Nenhuma recorrência com este status.'}
          </div>
        ) : (
          <div className={styles.recList}>
            {recFiltradas.map(r => {
              const expandida = recExpandida === r.id
              const atribs = Object.entries(r.atributos_chave ?? {})
              return (
                <div key={r.id} className={`${styles.recCard} ${styles['recCard_' + r.status] ?? ''}`}>
                  <div className={styles.recCardHeader} onClick={() => setRecExpandida(expandida ? null : r.id)}>
                    <div className={styles.recCardLeft}>
                      <span className={styles.recContagem}>{r.contagem}×</span>
                      <div className={styles.recAtribs}>
                        {atribs.slice(0, 4).map(([k, v]) => (
                          <span key={k} className={styles.recAtribTag}>
                            <span className={styles.recAtribChave}>{k}</span>
                            <span className={styles.recAtribValor}>{v}</span>
                          </span>
                        ))}
                        {atribs.length > 4 && <span className={styles.recAtribMais}>+{atribs.length - 4}</span>}
                      </div>
                    </div>
                    <div className={styles.recCardRight}>
                      <span className={`${styles.badgeStatus} ${
                        r.status === 'detectada' ? styles.statusAndamento :
                        r.status === 'em_analise' ? styles.statusAndamento :
                        r.status === 'aprovada' ? styles.statusConcluido :
                        styles.statusCancelado
                      }`}>{labelStatusRec[r.status]}</span>
                      <span className={styles.recChevron}>{expandida ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandida && (
                    <div className={styles.recCardBody}>
                      {/* Projetos envolvidos */}
                      <div className={styles.recSecao}>
                        <div className={styles.recSecaoTitulo}>Projetos ({r.contagem})</div>
                        <div className={styles.recProjetoList}>
                          {(r.projeto_ids ?? []).map((pid, i) => (
                            <div
                              key={pid}
                              className={styles.recProjetoItem}
                              onClick={() => {
                                const p = projetos.find(x => x.id === pid)
                                if (p) abrirDetalhe(p)
                              }}
                            >
                              <span className={styles.codigo}>{r.projeto_codigos?.[i]}</span>
                              <span className={styles.recProjetoTitulo}>{r.projeto_titulos?.[i]}</span>
                              <span className={styles.recProjetoLink}>→ Ver</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Todos os atributos */}
                      <div className={styles.recSecao}>
                        <div className={styles.recSecaoTitulo}>Atributos em comum</div>
                        <div className={styles.atributosGrid}>
                          {atribs.map(([k, v]) => (
                            <div key={k} className={styles.atributoBadge}>
                              <span className={styles.atributoBadgeChave}>{k}</span>
                              <span className={styles.atributoBadgeValor}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className={styles.recAcoes}>
                        {r.status === 'detectada' && (
                          <button className={styles.btnSecondary} onClick={() => atualizarStatusRec(r.id, 'em_analise')}>
                            🔎 Iniciar Análise
                          </button>
                        )}
                        {(r.status === 'detectada' || r.status === 'em_analise') && (
                          <button className={styles.btnDanger} onClick={() => atualizarStatusRec(r.id, 'rejeitada')}>
                            ✕ Rejeitar
                          </button>
                        )}
                        {r.status === 'em_analise' && (
                          <button
                            className={styles.btnPrimary}
                            onClick={() => abrirModalConversao(r)}
                          >
                            📦 Converter em Produto Padrão
                          </button>
                        )}
                        {r.status === 'rejeitada' && (
                          <button className={styles.btnSecondary} onClick={() => atualizarStatusRec(r.id, 'detectada')}>
                            ↩ Reabrir
                          </button>
                        )}
                        {r.analisado_em && (
                          <span className={styles.recDataAnalise}>
                            Analisado em {fmtData(r.analisado_em.split('T')[0])}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // VISTA: PRODUTOS PADRÃO
  if (vista === 'produtos_padrao') {
    const labelStatusPP: Record<string, string> = { rascunho: 'Rascunho', ativo: 'Ativo', descontinuado: 'Descontinuado' }
    const ativos   = produtosPadrao.filter(p => p.status === 'ativo').length
    const rascunho = produtosPadrao.filter(p => p.status === 'rascunho').length
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>📐 Projetos Sob Medida</div>
            <div className={styles.pageSubtitle}>Cadastro mestre progressivo</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#64748b' }}>
            <span>✅ {ativos} ativos</span>
            {rascunho > 0 && <span>📝 {rascunho} rascunhos</span>}
          </div>
        </div>
        {navPrincipal}

        {loadingPP ? (
          <div className={styles.loading}>Carregando produtos padrão…</div>
        ) : produtosPadrao.length === 0 ? (
          <div className={styles.vazio}>
            Nenhum produto padrão criado ainda.<br />
            <span style={{ fontSize: '0.8rem' }}>Converta uma recorrência na aba 🔁 Recorrências.</span>
          </div>
        ) : (
          <div className={styles.ppList}>
            {produtosPadrao.map(pp => {
              const expandido = ppExpandido === pp.id
              const atribs = Object.entries(pp.atributos ?? {})
              return (
                <div key={pp.id} className={styles.ppCard}>
                  <div className={styles.ppCardHeader} onClick={() => setPpExpandido(expandido ? null : pp.id)}>
                    <div className={styles.ppCardLeft}>
                      <span className={styles.ppCodigo}>{pp.codigo}</span>
                      <div className={styles.ppInfo}>
                        <span className={styles.ppNome}>{pp.nome}</span>
                        {pp.segmento && <span className={styles.badgeSegmento}>{pp.segmento}</span>}
                      </div>
                    </div>
                    <div className={styles.ppCardRight}>
                      <span className={styles.ppProjetos}>{pp.qtd_projetos} projeto{pp.qtd_projetos !== 1 ? 's' : ''}</span>
                      <span className={`${styles.badgeStatus} ${
                        pp.status === 'ativo' ? styles.statusConcluido :
                        pp.status === 'rascunho' ? styles.statusAndamento :
                        styles.statusCancelado
                      }`}>{labelStatusPP[pp.status]}</span>
                      <span className={styles.recChevron}>{expandido ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandido && (
                    <div className={styles.ppCardBody}>
                      {pp.descricao && (
                        <div className={styles.recSecao}>
                          <div className={styles.recSecaoTitulo}>Descrição</div>
                          <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.6 }}>{pp.descricao}</p>
                        </div>
                      )}

                      <div className={styles.recSecao}>
                        <div className={styles.recSecaoTitulo}>Atributos consolidados ({atribs.length})</div>
                        <div className={styles.atributosGrid}>
                          {atribs.map(([k, v]) => (
                            <div key={k} className={styles.atributoBadge}>
                              <span className={styles.atributoBadgeChave}>{k}</span>
                              <span className={styles.atributoBadgeValor}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.recSecao}>
                        <div className={styles.recSecaoTitulo}>Informações</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem', color: '#64748b' }}>
                          <span>Criado em {fmtData(pp.created_at.split('T')[0])}</span>
                          {pp.aprovado_por && <span>Aprovado por {pp.aprovado_por}</span>}
                          {pp.aprovado_em && <span>em {fmtData(pp.aprovado_em.split('T')[0])}</span>}
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{pp.qtd_projetos} projeto(s) vinculado(s)</span>
                        </div>
                      </div>

                      <div className={styles.recAcoes}>
                        {pp.status === 'rascunho' && (
                          <button className={styles.btnPrimary} onClick={() => alterarStatusPP(pp.id, 'ativo')}>
                            ✅ Ativar
                          </button>
                        )}
                        {pp.status === 'ativo' && (
                          <button className={styles.btnSecondary} onClick={() => alterarStatusPP(pp.id, 'descontinuado')}>
                            📦 Descontinuar
                          </button>
                        )}
                        {pp.status === 'descontinuado' && (
                          <button className={styles.btnSecondary} onClick={() => alterarStatusPP(pp.id, 'ativo')}>
                            ↩ Reativar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── MODAL: Converter em Produto Padrão ────────────────────────────────────
  const modalConversao = modalConv && (
    <div className={styles.modalOverlay} onClick={() => setModalConv(null)}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitulo}>📦 Converter em Produto Padrão</span>
          <button className={styles.modalFechar} onClick={() => setModalConv(null)}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* Preview dos atributos da recorrência */}
          <div className={styles.modalSecao}>
            <div className={styles.modalSecaoLabel}>Atributos detectados ({modalConv.contagem} projetos)</div>
            <div className={styles.recAtribs}>
              {Object.entries(modalConv.atributos_chave ?? {}).map(([k, v]) => (
                <span key={k} className={styles.recAtribTag}>
                  <span className={styles.recAtribChave}>{k}</span>
                  <span className={styles.recAtribValor}>{v}</span>
                </span>
              ))}
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Nome do Produto Padrão *</label>
              <input
                className={styles.formInput}
                value={formConv.nome}
                onChange={e => setFormConv(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Prateleira inox 304 escovada 600mm"
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Segmento</label>
              <select className={styles.formSelect} value={formConv.segmento} onChange={e => setFormConv(f => ({ ...f, segmento: e.target.value }))}>
                <option value="">Selecione…</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea
                className={styles.formTextarea}
                value={formConv.descricao}
                onChange={e => setFormConv(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Contexto, aplicações típicas, observações técnicas…"
                rows={3}
              />
            </div>
          </div>

          {erroConv && <div className={styles.erroMsg}>{erroConv}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={() => setModalConv(null)}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={confirmarConversao} disabled={convertendo}>
            {convertendo ? 'Criando…' : '✅ Criar Produto Padrão'}
          </button>
        </div>
      </div>
    </div>
  )

  // VISTA: FORM (novo ou editar)
  return (
    <>
    {modalConversao}
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>📐 Projetos Sob Medida</div>
          <div className={styles.pageSubtitle}>{projetoAtual ? `Editando ${projetoAtual.codigo}` : 'Novo Projeto'}</div>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista(projetoAtual ? 'detalhe' : 'lista')}>
          ← Cancelar
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.abas}>
          {(['dados', 'atributos', 'anexos'] as AbaForm[]).map(a => (
            <button
              key={a}
              className={`${styles.aba} ${abaForm === a ? styles.abaAtiva : ''}`}
              onClick={() => setAbaForm(a)}
            >
              {a === 'dados' ? '📋 Dados Básicos' : a === 'atributos' ? `🔧 Atributos (${atributos.length})` : `📎 Anexos (${anexosForm.length})`}
            </button>
          ))}
        </div>

        {erro && <div className={styles.erroMsg}>{erro}</div>}

        {/* ── ABA: DADOS BÁSICOS ── */}
        {abaForm === 'dados' && (
          <div className={styles.formBody}>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Título *</label>
                <input className={styles.formInput} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Prateleira sob medida — Hospital X" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cliente</label>
                <input className={styles.formInput} value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Razão social ou nome" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CNPJ do Cliente</label>
                <input className={styles.formInput} value={form.cliente_cnpj} onChange={e => setForm(f => ({ ...f, cliente_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" maxLength={18} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Segmento</label>
                <select className={styles.formSelect} value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))}>
                  <option value="">Selecione…</option>
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status</label>
                <select className={styles.formSelect} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Data de Início</label>
                <input type="date" className={styles.formInput} value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Data de Conclusão</label>
                <input type="date" className={styles.formInput} value={form.data_conclusao} onChange={e => setForm(f => ({ ...f, data_conclusao: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Valor Total (R$)</label>
                <input className={styles.formInput} value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} placeholder="0,00" />
              </div>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Observações</label>
                <textarea className={styles.formTextarea} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes técnicos, contexto, requisitos especiais…" rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: ATRIBUTOS ── */}
        {abaForm === 'atributos' && (
          <div className={styles.formBody}>
            <div className={styles.atributosLayout}>
            <div className={styles.atributosSection}>
              <div className={styles.atributosHeader}>
                <span className={styles.atributosTitle}>Atributos estruturados</span>
                <span className={styles.atributosHint}>Material, espessura, dimensões, acabamento…</span>
              </div>

              {atributos.length === 0 && !atribNovo && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                  Nenhum atributo adicionado.
                </div>
              )}

              {atributos.map((a, idx) => (
                <div key={idx} className={styles.atributoRow}>
                  <span className={styles.atributoChave}>{a.chave}</span>
                  <span className={styles.atributoValor}>{a.valor}</span>
                  <span className={styles.atributoUnidade}>{a.unidade || '—'}</span>
                  <button className={styles.btnIconRemove} onClick={() => removerAtributo(idx)} title="Remover">×</button>
                </div>
              ))}

              {/* Formulário de novo atributo */}
              {atribNovo ? (
                <div className={styles.novoAtributoRow}>
                  {/* Chave com datalist do catálogo */}
                  <div className={styles.atributoDatalist}>
                    <input
                      className={styles.formInput}
                      list="catalogo-chaves"
                      placeholder="Chave (ex: espessura_mm)"
                      value={novoAtrib.chave}
                      onChange={e => {
                        setNovoAtrib(n => ({ ...n, chave: e.target.value }))
                        onSelecionarChaveCatalogo(e.target.value)
                      }}
                      autoFocus
                    />
                    <datalist id="catalogo-chaves">
                      {catalogo.map(c => <option key={c.chave} value={c.chave}>{c.label_pt}</option>)}
                    </datalist>
                    {novoAtrib.chave && normalizarChave(novoAtrib.chave) !== novoAtrib.chave && (
                      <div className={styles.atributoNovo}>
                        → será salvo como: <strong>{normalizarChave(novoAtrib.chave)}</strong>
                      </div>
                    )}
                    {novoAtrib.chave && !catalogo.some(c => c.chave === normalizarChave(novoAtrib.chave)) && (
                      <div className={styles.atributoNovo}>✨ novo atributo</div>
                    )}
                  </div>

                  {/* Valor */}
                  {(() => {
                    const item = catalogo.find(c => c.chave === normalizarChave(novoAtrib.chave))
                    if (item?.tipo_valor === 'enum' && item.valores_enum) {
                      return (
                        <select className={styles.formSelect} value={novoAtrib.valor} onChange={e => setNovoAtrib(n => ({ ...n, valor: e.target.value }))}>
                          <option value="">Selecione…</option>
                          {item.valores_enum.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      )
                    }
                    return (
                      <input
                        className={styles.formInput}
                        placeholder="Valor"
                        value={novoAtrib.valor}
                        onChange={e => setNovoAtrib(n => ({ ...n, valor: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') adicionarAtributo() }}
                      />
                    )
                  })()}

                  {/* Unidade */}
                  <input
                    className={styles.formInput}
                    placeholder="Unidade"
                    value={novoAtrib.unidade}
                    onChange={e => setNovoAtrib(n => ({ ...n, unidade: e.target.value }))}
                  />

                  <button className={styles.btnIconAdd} onClick={adicionarAtributo} title="Adicionar atributo">+</button>
                </div>
              ) : (
                <button
                  className={styles.btnSecondary}
                  style={{ marginTop: 12 }}
                  onClick={() => { setAtribNovo(true); setNovoAtrib({ chave: '', valor: '', unidade: '' }) }}
                >
                  + Adicionar Atributo
                </button>
              )}
            </div>

            {/* ── Painel lateral: similares ── */}
            <div className={styles.similaresPanel}>
              <div className={styles.similaresTitulo}>
                🔍 Projetos Similares
              </div>
              {atributos.length < 2 ? (
                <div className={styles.similaresDica}>
                  Adicione pelo menos 2 atributos para ver projetos similares.
                </div>
              ) : loadingSimilares ? (
                <div className={styles.similaresDica}>Buscando…</div>
              ) : similares.length === 0 ? (
                <div className={styles.similaresDica}>Nenhum projeto similar encontrado.</div>
              ) : (
                <div className={styles.similaresList}>
                  {similares.map(s => (
                    <div
                      key={s.projeto_id}
                      className={styles.similarItem}
                      onClick={() => {
                        const p = projetos.find(x => x.id === s.projeto_id)
                        if (p) abrirDetalhe(p)
                      }}
                    >
                      <div className={styles.similarHeader}>
                        <span className={styles.similarCodigo}>{s.codigo}</span>
                        <span className={styles.similarScore} style={{
                          color: s.score >= 0.7 ? '#16a34a' : s.score >= 0.4 ? '#d97706' : '#64748b'
                        }}>
                          {Math.round(s.score * 100)}%
                        </span>
                      </div>
                      <div className={styles.similarTitulo}>{s.titulo}</div>
                      <div className={styles.similarMeta}>
                        {s.cliente_nome && <span>{s.cliente_nome}</span>}
                        <span>{s.atributos_comuns} atr. em comum</span>
                        <span className={`${styles.badgeStatus} ${classeStatus(s.status)}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {labelStatus(s.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>{/* fim atributosLayout */}
          </div>
        )}

        {/* ── ABA: ANEXOS ── */}
        {abaForm === 'anexos' && (
          <div className={styles.formBody}>
            <div className={styles.anexosSection}>
              {!projetoAtual ? (
                <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.86rem', color: '#92400e' }}>
                  ⚠️ Salve o projeto (aba Dados Básicos) antes de adicionar anexos.
                </div>
              ) : (
                <>
                  {/* Dropzone */}
                  <div
                    className={`${styles.dropzone} ${dragOver ? styles.dropzoneOver : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                  >
                    <div className={styles.dropzoneIcon}>📎</div>
                    <div className={styles.dropzoneText}>Clique ou arraste arquivos aqui</div>
                    <div className={styles.dropzoneSub}>PDF, imagem, DWG, DXF — qualquer tipo aceito</div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)}
                  />

                  {uploading && <div className={styles.uploadProgress}>⏳ Enviando arquivo…</div>}
                  {uploadErro && <div className={styles.erroMsg}>{uploadErro}</div>}

                  {/* Lista de anexos */}
                  {anexosForm.length > 0 && (
                    <div className={styles.anexoList}>
                      {anexosForm.map(a => (
                        <div key={a.id} className={styles.anexoItem}>
                          <span className={styles.anexoIcon}>{iconeAnexo(a.tipo)}</span>
                          <div className={styles.anexoInfo}>
                            <div className={styles.anexoNome}>{a.nome_original}</div>
                            <div className={styles.anexoMeta}>
                              <span>{a.tipo.toUpperCase()}</span>
                              {a.tamanho_bytes && <span>{formatBytes(a.tamanho_bytes)}</span>}
                            </div>
                          </div>
                          <div className={styles.anexoActions}>
                            <button className={styles.btnAnexoLink} onClick={() => abrirAnexo(a)}>↗ Abrir</button>
                            <button className={styles.btnDanger} onClick={() => removerAnexo(a)}>🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista(projetoAtual ? 'detalhe' : 'lista')}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : projetoAtual ? 'Salvar Alterações' : 'Criar Projeto'}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
