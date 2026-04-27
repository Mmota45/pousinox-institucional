import { useState, useEffect, useRef } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminOutlet.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiVision, fileToBase64 } from '../lib/aiHelper'

const BUCKET = 'outlet-fotos'
const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const GEMINI_KEY = 'AIzaSyAS1VsXE3zxU9KBj7wa4tkH9CBpYKaa2Rs'
const GEMINI_MODEL = 'gemini-2.5-flash'
const POR_PAGINA = 20

interface Sugestao { titulo?: string; categoria: string; descricao: string }

const MARCAS_FIXAS = ['POUSINOX®', 'CROYDON', 'FRILUX']

const BRAND_CATALOGS: Record<string, string> = {
  croydon: `Catálogo oficial Croydon — equipamentos para cozinhas profissionais:

ASSAR: Frangueiras a Gás
FRITAR: Fritadeiras a Gás | Fritadeiras Elétricas | Fritadeiras FH
GRELHAR: Chapas a Gás | Chapas Elétricas | Char Broilers a Gás | Char Broilers Elétricos
TOSTAR: Sanduicheiras a Gás | Sanduicheiras Elétricas
BEBER: Extratores de Suco | Liquidificador Basculante | Refresqueiras | Trituradores de Gelo
ESPECIAIS: Máquina de Casquinha de Sorvete | Crepe no Palito | Panquequeiras | Wafleiras
COZINHAR: Cozedor de Massas
FORNO COMBINADO: Fornos Combinados Elétricos | Fornos Combinados a Gás
CONSERVAR: Conservadores`,
}

async function sugerirPorImagem(file: File, titulo?: string, marca?: string): Promise<Sugestao | null> {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const catalogo = marca ? BRAND_CATALOGS[marca.toLowerCase()] : null
    if (marca && catalogo) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: file.type, data: base64 } }, { text: `Você é um especialista em equipamentos para cozinhas profissionais da marca ${marca}.\n\nAnalise a imagem e identifique o produto usando o catálogo oficial abaixo:\n\n${catalogo}\n\nResponda APENAS com JSON válido:\n{"titulo": "nome oficial do produto ${marca}", "categoria": "categoria do catálogo", "descricao": "descrição comercial profissional"}` }] }], generationConfig: { responseMimeType: 'application/json' } }) }
      )
      const data = await res.json()
      return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: file.type, data: base64 } }, { text: `Analise esta imagem de produto para uma loja de equipamentos profissionais.${titulo ? `\n\nNome: "${titulo}"` : ''}\n\nResponda APENAS com JSON válido:\n{"categoria": "categoria curta em português", "descricao": "descrição comercial de 1 a 2 frases em português"}` }] }], generationConfig: { responseMimeType: 'application/json' } }) }
    )
    const data = await res.json()
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
  } catch { return null }
}

const DICIONARIO: { palavras: string[]; categoria: string; descricao: (t: string) => string }[] = [
  { palavras: ['bancada'], categoria: 'Bancadas', descricao: t => `${t} fabricada em aço inox 304, estrutura robusta e resistente à corrosão.` },
  { palavras: ['cuba', 'pia', 'lavabo'], categoria: 'Cubas e Pias', descricao: t => `${t} em aço inox 304 com acabamento escovado, fácil higienização.` },
  { palavras: ['estante', 'prateleira', 'rack'], categoria: 'Estantes', descricao: t => `${t} em aço inox com prateleiras reguláveis.` },
  { palavras: ['armário', 'gabinete'], categoria: 'Armários', descricao: t => `${t} em aço inox com portas e fechamento seguro.` },
  { palavras: ['coifa', 'exaustor'], categoria: 'Coifas e Exaustores', descricao: t => `${t} em aço inox para extração de fumaça e vapores.` },
  { palavras: ['gôndola', 'gondola', 'expositor'], categoria: 'Gôndolas', descricao: t => `${t} em aço inox para exposição de produtos.` },
  { palavras: ['mesa', 'tampo'], categoria: 'Mesas', descricao: t => `${t} em aço inox 304 com acabamento escovado.` },
  { palavras: ['carrinho', 'carro'], categoria: 'Carrinhos', descricao: t => `${t} em aço inox com rodízios giratórios.` },
  { palavras: ['balcão', 'passa-prato'], categoria: 'Balcões', descricao: t => `${t} em aço inox fabricado sob medida.` },
  { palavras: ['tábua', 'tabua', 'corte', 'polietileno'], categoria: 'Utensílios de Corte', descricao: t => `${t} com superfície lisa e resistente para uso profissional.` },
  { palavras: ['forno', 'fritadeira', 'chapa', 'fogão'], categoria: 'Cocção', descricao: t => `${t} para uso profissional em cozinhas industriais.` },
  { palavras: ['freezer', 'refrigerador', 'geladeira', 'câmara'], categoria: 'Refrigeração', descricao: t => `${t} para conservação de alimentos em temperatura controlada.` },
]

function sugerirLocal(titulo: string): Sugestao | null {
  const t = titulo.toLowerCase()
  for (const item of DICIONARIO) {
    if (item.palavras.some(p => t.includes(p))) return { categoria: item.categoria, descricao: item.descricao(titulo) }
  }
  return null
}

interface Produto {
  id: string; titulo: string; tipo: 'outlet' | 'pronta-entrega'
  marca: string | null; fabricante: string | null; categoria: string | null
  descricao: string | null; preco: number; preco_original: number | null
  quantidade: number; fotos: string[] | null; specs: Record<string, string> | null
  destaque: boolean; disponivel: boolean; seminovo: boolean; exibir_preco: boolean
  peso_kg: number | null; comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null
}

const FORM_VAZIO = {
  titulo: '', tipo: 'pronta-entrega' as 'outlet' | 'pronta-entrega',
  marca: '', fabricante: '', categoria: '', descricao: '',
  preco: '', preco_original: '', quantidade: '1',
  destaque: false, disponivel: true, seminovo: false, exibir_preco: false,
  specs: [] as { k: string; v: string }[], fotos: [] as string[],
  peso_kg: '', comprimento_cm: '', largura_cm: '', altura_cm: '',
}

export default function AdminOutlet() {
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcasExtras, setMarcasExtras] = useState<string[]>([])
  const [novaMarca, setNovaMarca] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ ...FORM_VAZIO })
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Busca e filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'disponivel' | 'esgotado' | 'destaque'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [pagina, setPagina] = useState(1)

  // Picker de mídia
  const [pickerAberto, setPickerAberto] = useState(false)
  const [pickerArquivos, setPickerArquivos] = useState<{ name: string; url: string }[]>([])
  const [pickerCarregando, setPickerCarregando] = useState(false)
  const [pickerUploadando, setPickerUploadando] = useState(false)

  const dragIndex = useRef<number | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  async function listarBucket() {
    const { data } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    setPickerArquivos((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
      name: f.name, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.name}`,
    })))
  }

  async function abrirPicker() {
    setPickerAberto(true); setPickerCarregando(true)
    await listarBucket(); setPickerCarregando(false)
  }

  async function comprimirFoto(file: File, maxWidth = 1200, qualidade = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale); const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha')), 'image/webp', qualidade)
      }
      img.onerror = reject; img.src = url
    })
  }

  async function uploadPicker(file: File) {
    setPickerUploadando(true)
    try {
      const blob = await comprimirFoto(file)
      const nome = `${Date.now()}.webp`
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(nome, blob, { contentType: 'image/webp' })
      if (!error) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`
        setForm(f => ({ ...f, fotos: [...f.fotos, url] }))
        const s = await sugerirPorImagem(file, form.titulo.trim() || undefined, form.marca.trim() || undefined)
        if (s) setSugestao(s)
        await listarBucket(); setPickerAberto(false)
      }
    } catch {
      const nome = `${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(nome, file, { contentType: file.type })
      if (!error) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`
        setForm(f => ({ ...f, fotos: [...f.fotos, url] }))
        await listarBucket(); setPickerAberto(false)
      }
    }
    setPickerUploadando(false)
  }

  async function excluirDoBucket(nome: string) {
    await supabaseAdmin.storage.from(BUCKET).remove([nome])
    setForm(f => ({ ...f, fotos: f.fotos.filter(u => !u.includes(nome)) }))
    await listarBucket()
  }

  function selecionarDoPicke(url: string) {
    if (!form.fotos.includes(url)) setForm(f => ({ ...f, fotos: [...f.fotos, url] }))
    setPickerAberto(false)
  }

  useEffect(() => { fetchProdutos(); fetchMarcasExtras() }, [])

  async function fetchMarcasExtras() {
    const { data } = await supabaseAdmin.from('produtos').select('marca')
    const fixasLower = MARCAS_FIXAS.map(m => m.toLowerCase())
    const extras = Array.from(new Set(
      (data ?? []).map(p => p.marca).filter((m): m is string => !!m && !fixasLower.includes(m.toLowerCase()))
    ))
    setMarcasExtras(extras)
  }

  async function fetchProdutos() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('produtos').select('*').order('created_at', { ascending: false })
    setProdutos(data ?? []); setLoading(false)
  }

  function removerFoto(url: string) { setForm(f => ({ ...f, fotos: f.fotos.filter(u => u !== url) })) }
  function adicionarSpec() { setForm(f => ({ ...f, specs: [...f.specs, { k: '', v: '' }] })) }
  function atualizarSpec(i: number, campo: 'k' | 'v', valor: string) {
    setForm(f => { const specs = [...f.specs]; specs[i] = { ...specs[i], [campo]: valor }; return { ...f, specs } })
  }
  function removerSpec(i: number) { setForm(f => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) })) }
  function moverSpec(de: number, para: number) {
    setForm(f => { const specs = [...f.specs]; const [item] = specs.splice(de, 1); specs.splice(para, 0, item); return { ...f, specs } })
  }

  function abrirNovo() {
    setEditandoId(null); setForm({ ...FORM_VAZIO }); setNovaMarca(''); setSugestao(null)
    setFormAberto(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function editarProduto(p: Produto) {
    setEditandoId(p.id)
    setForm({
      titulo: p.titulo, tipo: p.tipo, marca: p.marca ?? '', fabricante: p.fabricante ?? '',
      categoria: p.categoria ?? '', descricao: p.descricao ?? '', preco: String(p.preco),
      preco_original: p.preco_original ? String(p.preco_original) : '', quantidade: String(p.quantidade),
      destaque: p.destaque, disponivel: p.disponivel, seminovo: p.seminovo, exibir_preco: p.exibir_preco,
      specs: p.specs ? Array.isArray(p.specs) ? p.specs : Object.entries(p.specs as Record<string, string>).map(([k, v]) => ({ k, v })) : [],
      fotos: p.fotos ?? [],
      peso_kg: p.peso_kg ? String(p.peso_kg) : '', comprimento_cm: p.comprimento_cm ? String(p.comprimento_cm) : '',
      largura_cm: p.largura_cm ? String(p.largura_cm) : '', altura_cm: p.altura_cm ? String(p.altura_cm) : '',
    })
    setSugestao(null); setFormAberto(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function clonarProduto(p: Produto) {
    setEditandoId(null)
    setForm({
      titulo: `${p.titulo} (cópia)`, tipo: p.tipo, marca: p.marca ?? '', fabricante: p.fabricante ?? '',
      categoria: p.categoria ?? '', descricao: p.descricao ?? '', preco: String(p.preco),
      preco_original: p.preco_original ? String(p.preco_original) : '', quantidade: String(p.quantidade),
      destaque: p.destaque, disponivel: p.disponivel, seminovo: p.seminovo, exibir_preco: p.exibir_preco,
      specs: p.specs ? Array.isArray(p.specs) ? p.specs : Object.entries(p.specs as Record<string, string>).map(([k, v]) => ({ k, v })) : [],
      fotos: p.fotos ?? [],
      peso_kg: p.peso_kg ? String(p.peso_kg) : '', comprimento_cm: p.comprimento_cm ? String(p.comprimento_cm) : '',
      largura_cm: p.largura_cm ? String(p.largura_cm) : '', altura_cm: p.altura_cm ? String(p.altura_cm) : '',
    })
    setSugestao(null); setFormAberto(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function fecharForm() { setFormAberto(false); setEditandoId(null); setForm({ ...FORM_VAZIO }); setNovaMarca(''); setSugestao(null) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setMsg(null)
    const specsObj = form.specs.length > 0 ? form.specs.filter(s => s.k).map(s => ({ k: s.k, v: s.v })) : null
    const payload = {
      titulo: form.titulo.trim(), tipo: form.tipo,
      marca: form.marca === '__nova__' ? (novaMarca.trim() || null) : (form.marca.trim() || null),
      fabricante: form.fabricante.trim() || null, categoria: form.categoria.trim() || null,
      descricao: form.descricao.trim() || null, preco: parseFloat(form.preco),
      preco_original: form.preco_original ? parseFloat(form.preco_original) : null,
      quantidade: parseInt(form.quantidade) || 1, destaque: form.destaque,
      disponivel: form.disponivel, seminovo: form.seminovo, exibir_preco: form.exibir_preco,
      specs: specsObj, fotos: form.fotos.length > 0 ? form.fotos : null,
      peso_kg: parseFloat(form.peso_kg) || null,
      comprimento_cm: parseFloat(form.comprimento_cm) || null,
      largura_cm: parseFloat(form.largura_cm) || null,
      altura_cm: parseFloat(form.altura_cm) || null,
    }
    const { error } = editandoId
      ? await supabaseAdmin.from('produtos').update(payload).eq('id', editandoId)
      : await supabaseAdmin.from('produtos').insert(payload)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar produto.' })
    } else {
      setMsg({ tipo: 'ok', texto: editandoId ? 'Produto atualizado!' : 'Produto cadastrado!' })
      fecharForm(); fetchProdutos(); fetchMarcasExtras()
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este produto?')) return
    await supabaseAdmin.from('produtos').delete().eq('id', id)
    fetchProdutos()
  }

  async function toggleDisponivel(p: Produto) {
    const vendido_em = !p.disponivel ? null : new Date().toISOString()
    await supabaseAdmin.from('produtos').update({ disponivel: !p.disponivel, vendido_em }).eq('id', p.id)
    fetchProdutos()
  }

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t) } }, [msg])
  useEffect(() => {
    setSugestao(null); if (form.titulo.trim().length < 4) return
    const s = sugerirLocal(form.titulo.trim()); setSugestao(s)
  }, [form.titulo])

  // Filtragem e paginação
  const categorias = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))) as string[]

  const produtosFiltrados = produtos.filter(p => {
    if (busca && !p.titulo.toLowerCase().includes(busca.toLowerCase()) && !(p.categoria ?? '').toLowerCase().includes(busca.toLowerCase()) && !(p.marca ?? '').toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus === 'disponivel' && !p.disponivel) return false
    if (filtroStatus === 'esgotado' && p.disponivel) return false
    if (filtroStatus === 'destaque' && !p.destaque) return false
    if (filtroCategoria && p.categoria !== filtroCategoria) return false
    return true
  })

  const totalPaginas = Math.ceil(produtosFiltrados.length / POR_PAGINA)
  const produtosPagina = produtosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  useEffect(() => { setPagina(1) }, [busca, filtroStatus, filtroCategoria])

  return (
    <div className={styles.wrap}>
      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.pageTitle}>Pronta Entrega</h1>
          <span className={styles.pageCount}>
            <span className={styles.countDot} />
            {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AiActionButton label="Descrever por foto" icon="📸" modelName="Gemini" acceptImage
            actionWithFile={async (file) => {
              const base64 = await fileToBase64(file)
              const r = await aiVision({ imageBase64: base64, mimeType: file.type, filename: file.name })
              if (r.error) return `Erro: ${r.error}`
              return `Sugestão de cadastro baseada na foto:\n\n${r.content}\n\nCopie os campos relevantes para o formulário.`
            }}
            action={async () => ''} />
          <button className={styles.btnPrimary} onClick={formAberto ? fecharForm : abrirNovo}>
            {formAberto ? '✕ Fechar' : '＋ Novo produto'}
          </button>
        </div>
      </div>

      {/* Formulário colapsável */}
      {formAberto && (
        <div ref={formRef} className={styles.formCard}>
          <form onSubmit={salvar}>
            <div className={styles.formCardHeader}>
              <span className={styles.formCardTitle}>{editandoId ? '✏️ Editando produto' : '＋ Novo produto'}</span>
              <button type="button" className={styles.btnFechar} onClick={fecharForm}>✕</button>
            </div>

            {/* Strip de fotos */}
            <div className={styles.formFotoStrip}>
              {form.fotos.length === 0
                ? <div className={styles.formFotoPlaceholder}>Sem foto</div>
                : form.fotos.map(url => (
                  <div key={url} className={styles.formFotoThumb}>
                    <img src={url} alt="" />
                    <button type="button" className={styles.fotoRemove} onClick={() => removerFoto(url)}>✕</button>
                  </div>
                ))
              }
              <button type="button" onClick={abrirPicker} className={styles.btnFoto}>🖼 Foto</button>
            </div>

            <div className={styles.formCampos}>
              {/* Identificação */}
              <div className={styles.secao}>
                <span className={styles.secaoLabel}>Identificação</span>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Título *</label>
                    <input className={styles.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
                  </div>
                  <div className={styles.fieldSm}>
                    <label>Tipo *</label>
                    <select className={styles.input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'outlet' | 'pronta-entrega' }))}>
                      <option value="pronta-entrega">Pronta Entrega</option>
                      <option value="outlet">Outlet</option>
                    </select>
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.fieldSm}>
                    <label>Marca</label>
                    <select className={styles.input} value={form.marca} onChange={e => { setForm(f => ({ ...f, marca: e.target.value })); setNovaMarca('') }}>
                      <option value="">Sem marca</option>
                      {[...MARCAS_FIXAS, ...marcasExtras].map(m => <option key={m} value={m}>{m}</option>)}
                      <option value="__nova__">＋ Nova marca…</option>
                    </select>
                    {form.marca === '__nova__' && (
                      <input className={styles.input} style={{ marginTop: 6 }} placeholder="Nome da nova marca" value={novaMarca} onChange={e => setNovaMarca(e.target.value)} autoFocus />
                    )}
                  </div>
                  <div className={styles.fieldSm}>
                    <label>Categoria</label>
                    <input className={styles.input} placeholder="ex: Bancadas" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} list="categorias-list" />
                    <datalist id="categorias-list">{categorias.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>
              </div>

              {/* Sugestão IA */}
              {sugestao && (
                <div className={styles.sugestaoBox}>
                  <span className={styles.sugestaoLabel}>{form.marca.trim() ? `IA — ${form.marca.trim()}` : 'Sugestão IA'}</span>
                  <div className={styles.sugestaoItens}>
                    {sugestao.titulo && (
                      <div className={styles.sugestaoItem}>
                        <span>Título: <strong>{sugestao.titulo}</strong></span>
                        <button type="button" className={styles.btnAplicar} onClick={() => setForm(f => ({ ...f, titulo: sugestao.titulo! }))}>Aplicar</button>
                      </div>
                    )}
                    <div className={styles.sugestaoItem}>
                      <span>Categoria: <strong>{sugestao.categoria}</strong></span>
                      <button type="button" className={styles.btnAplicar} onClick={() => setForm(f => ({ ...f, categoria: sugestao.categoria }))}>Aplicar</button>
                    </div>
                    <div className={styles.sugestaoItem}>
                      <span>Descrição: <em>{sugestao.descricao}</em></span>
                      <button type="button" className={styles.btnAplicar} onClick={() => setForm(f => ({ ...f, descricao: sugestao.descricao }))}>Aplicar</button>
                    </div>
                    <button type="button" className={styles.btnAplicarTudo} onClick={() => setForm(f => ({ ...f, ...(sugestao.titulo ? { titulo: sugestao.titulo } : {}), categoria: sugestao.categoria, descricao: sugestao.descricao }))}>Aplicar tudo</button>
                  </div>
                </div>
              )}

              {/* Preço */}
              <div className={styles.secao}>
                <span className={styles.secaoLabel}>Preço & Estoque</span>
                <div className={styles.row3}>
                  <div className={styles.fieldSm}>
                    <label>Preço (R$) *</label>
                    <input className={styles.input} type="number" step="0.01" min="0" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} required />
                  </div>
                  <div className={styles.fieldSm}>
                    <label>Preço original</label>
                    <input className={styles.input} type="number" step="0.01" min="0" placeholder="% OFF" value={form.preco_original} onChange={e => setForm(f => ({ ...f, preco_original: e.target.value }))} />
                  </div>
                  <div className={styles.fieldSm}>
                    <label>Qtd *</label>
                    <input className={styles.input} type="number" min="0" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div className={styles.field}>
                <label>Descrição</label>
                <textarea className={styles.textarea} rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>

              {/* Specs */}
              <div className={styles.field}>
                <label>Especificações técnicas</label>
                <div className={styles.specPresets}>
                  {['Dimensões', 'Potência', 'Tensão', 'Peso', 'Capacidade', 'Combustível'].map(k => (
                    <button key={k} type="button" className={styles.btnPreset}
                      onClick={() => { if (!form.specs.some(s => s.k === k)) setForm(f => ({ ...f, specs: [...f.specs, { k, v: '' }] })) }}>
                      + {k}
                    </button>
                  ))}
                </div>
                {form.specs.map((s, i) => (
                  <div key={i} className={styles.specRow} draggable
                    onDragStart={() => { dragIndex.current = i }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragIndex.current !== null && dragIndex.current !== i) { moverSpec(dragIndex.current, i); dragIndex.current = null } }}>
                    <span className={styles.dragHandle}>⠿</span>
                    <input className={styles.input} placeholder="Campo" value={s.k} onChange={e => atualizarSpec(i, 'k', e.target.value)} />
                    <input className={styles.input} placeholder="Valor" value={s.v} onChange={e => atualizarSpec(i, 'v', e.target.value)} />
                    <button type="button" className={styles.btnRemove} onClick={() => removerSpec(i)}>✕</button>
                  </div>
                ))}
                <button type="button" className={styles.btnSecondary} onClick={adicionarSpec}>+ Campo personalizado</button>
              </div>

              {/* Frete — peso e dimensões */}
              <div className={styles.field}>
                <label>Frete — peso e dimensões</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 100px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Peso (kg)</span>
                    <input className={styles.input} type="number" step="0.01" min="0" placeholder="ex: 2.5"
                      value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} />
                  </div>
                  <div style={{ flex: '1 1 80px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Comp. (cm)</span>
                    <input className={styles.input} type="number" step="0.1" min="0" placeholder="cm"
                      value={form.comprimento_cm} onChange={e => setForm(f => ({ ...f, comprimento_cm: e.target.value }))} />
                  </div>
                  <div style={{ flex: '1 1 80px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Larg. (cm)</span>
                    <input className={styles.input} type="number" step="0.1" min="0" placeholder="cm"
                      value={form.largura_cm} onChange={e => setForm(f => ({ ...f, largura_cm: e.target.value }))} />
                  </div>
                  <div style={{ flex: '1 1 80px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Alt. (cm)</span>
                    <input className={styles.input} type="number" step="0.1" min="0" placeholder="cm"
                      value={form.altura_cm} onChange={e => setForm(f => ({ ...f, altura_cm: e.target.value }))} />
                  </div>
                </div>
                {form.peso_kg && parseFloat(form.peso_kg) > 0 && (() => {
                  const peso = parseFloat(form.peso_kg)
                  const comp = parseFloat(form.comprimento_cm) || 0
                  const larg = parseFloat(form.largura_cm) || 0
                  const alt = parseFloat(form.altura_cm) || 0
                  const soma = comp + larg + alt
                  const maxDim = Math.max(comp, larg, alt)
                  const correioOk = peso <= 30 && maxDim <= 100 && soma <= 200 && comp > 0 && larg > 0 && alt > 0
                  return (
                    <div style={{ marginTop: 6, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6,
                      background: correioOk ? '#dcfce7' : '#fef9c3',
                      color: correioOk ? '#15803d' : '#92400e' }}>
                      {correioOk
                        ? `✓ Elegível para Correios (${peso}kg, ${soma.toFixed(0)}cm soma)`
                        : `⚠ Apenas Braspress — ${peso > 30 ? 'peso > 30kg' : maxDim > 100 ? 'dimensão > 100cm' : soma > 200 ? 'soma > 200cm' : 'preencha dimensões'}`}
                    </div>
                  )
                })()}
              </div>

              {/* Flags */}
              <div className={styles.checkRow}>
                <label className={styles.checkLabel}><input type="checkbox" checked={form.destaque} onChange={e => setForm(f => ({ ...f, destaque: e.target.checked }))} /> Destaque</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={form.disponivel} onChange={e => setForm(f => ({ ...f, disponivel: e.target.checked }))} /> Disponível</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={form.seminovo} onChange={e => setForm(f => ({ ...f, seminovo: e.target.checked }))} /> Seminovo</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={form.exibir_preco} onChange={e => setForm(f => ({ ...f, exibir_preco: e.target.checked }))} /> Exibir preço</label>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.btnSecondary} onClick={fecharForm}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar produto'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Busca + filtros */}
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            placeholder="Buscar por produto, categoria ou marca…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className={styles.filtersRow}>
          <select className={styles.filterSelect} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
            <option value="todos">Todos</option>
            <option value="disponivel">Em estoque</option>
            <option value="esgotado">Esgotados</option>
            <option value="destaque">Destaque</option>
          </select>
          <select className={styles.filterSelect} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Contagem filtrada */}
      {(busca || filtroStatus !== 'todos' || filtroCategoria) && (
        <p className={styles.resultsInfo}>{produtosFiltrados.length} resultado{produtosFiltrados.length !== 1 ? 's' : ''}</p>
      )}

      {/* Lista */}
      {loading ? (
        <p className={styles.loadingMsg}>Carregando...</p>
      ) : produtosPagina.length === 0 ? (
        <p className={styles.loadingMsg}>{produtos.length === 0 ? 'Nenhum produto cadastrado.' : 'Nenhum produto encontrado.'}</p>
      ) : (
        <>
          <div className={styles.lista}>
            {produtosPagina.map(p => (
              <div key={p.id} className={`${styles.card} ${!p.disponivel ? styles.cardDimmed : ''}`}>

                {/* Foto */}
                <div className={styles.cardPhoto}>
                  {p.fotos?.[0]
                    ? <img src={p.fotos[0]} alt={p.titulo} />
                    : <div className={styles.cardPhotoEmpty}>📷</div>
                  }
                </div>

                {/* Conteúdo */}
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>{p.titulo}</p>
                  {(p.marca || p.categoria) && (
                    <span className={styles.cardMeta}>
                      {[p.marca, p.categoria].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <div className={styles.cardPriceRow}>
                    <span className={styles.cardPrice}>
                      R$ {p.preco.toFixed(2).replace('.', ',')}
                    </span>
                    {p.preco_original && (
                      <span className={styles.cardPriceOld}>
                        R$ {p.preco_original.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    <span className={styles.cardQty}>{p.quantidade} un</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <span className={`${styles.badge} ${p.disponivel ? styles.badgeAvailable : styles.badgeSoldOut}`}>
                      {p.disponivel ? 'Em estoque' : 'Esgotado'}
                    </span>
                    {p.destaque && <span className={styles.badgeFeatured}>⭐</span>}
                    {p.seminovo && <span className={`${styles.badge} ${styles.badgeSeminovo}`}>Seminovo</span>}
                  </div>
                </div>

                {/* Ações */}
                <div className={styles.cardActions}>
                  <button className={styles.btnEdit} onClick={() => editarProduto(p)}>
                    ✏ Editar
                  </button>
                  <button
                    className={styles.btnIcon}
                    title="Clonar produto"
                    onClick={() => clonarProduto(p)}
                  >⧉</button>
                  <button
                    className={`${styles.btnIcon} ${p.disponivel ? styles.btnIconToggle : styles.btnIconOk}`}
                    title={p.disponivel ? 'Marcar como esgotado' : 'Reativar produto'}
                    onClick={() => toggleDisponivel(p)}
                  >{p.disponivel ? '✕' : '✓'}</button>
                  <button
                    className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                    title="Excluir produto"
                    onClick={() => excluir(p.id)}
                  >🗑</button>
                </div>

              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className={styles.pagination}>
              <button className={styles.btnPage} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹ Anterior</button>
              <span className={styles.paginationInfo}>{pagina} / {totalPaginas}</span>
              <button className={styles.btnPage} disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>Próximo ›</button>
            </div>
          )}
        </>
      )}

      {/* Modal picker de mídia */}
      {pickerAberto && (
        <div onClick={() => setPickerAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Imagens — outlet-fotos</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ padding: '0.4rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', color: '#1e3f6e', cursor: 'pointer' }}>
                  {pickerUploadando ? 'Enviando…' : '⬆ Upload'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPicker(f) }} />
                </label>
                <button onClick={() => setPickerAberto(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
              </div>
            </div>
            <div style={{ padding: '0.5rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#64748b' }}>
              ✅ Upload comprime automaticamente para WebP 82%
            </div>
            <div style={{ overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {pickerCarregando ? (
                <p style={{ gridColumn: '1/-1', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>Carregando…</p>
              ) : pickerArquivos.length === 0 ? (
                <p style={{ gridColumn: '1/-1', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>Nenhuma imagem. Faça upload acima.</p>
              ) : pickerArquivos.map(img => (
                <div key={img.name} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: form.fotos.includes(img.url) ? '3px solid #1e3f6e' : '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                  <img src={img.url} alt={img.name} onClick={() => selecionarDoPicke(img.url)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                    <a href={img.url} download={img.name} onClick={e => e.stopPropagation()} style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="Download">⬇</a>
                    <button type="button" onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${img.name}"?`)) excluirDoBucket(img.name) }} style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Excluir">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
