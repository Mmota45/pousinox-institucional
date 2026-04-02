import { useState, useEffect, useRef } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminOutlet.module.css'

const BUCKET = 'outlet-fotos'
const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const GEMINI_KEY = 'AIzaSyAS1VsXE3zxU9KBj7wa4tkH9CBpYKaa2Rs'
const GEMINI_MODEL = 'gemini-2.5-flash'

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
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: file.type, data: base64 } },
                { text: `Você é um especialista em equipamentos para cozinhas profissionais da marca ${marca}.

Analise a imagem e identifique o produto usando o catálogo oficial abaixo como referência:

${catalogo}

Com base na imagem e no catálogo acima:
1. Identifique qual produto ${marca} aparece na foto
2. Use o nome exato como consta no catálogo
3. Escreva uma descrição comercial profissional em português (1 a 2 frases) no estilo da marca

Responda APENAS com JSON válido, sem markdown:
{"titulo": "nome oficial do produto ${marca}", "categoria": "categoria do catálogo", "descricao": "descrição comercial profissional"}` }
              ]
            }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
        }
      )
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      return JSON.parse(text.trim())
    }

    // Sem marca conhecida: análise genérica por imagem
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: file.type, data: base64 } },
              { text: `Analise esta imagem de produto para uma loja de equipamentos para cozinhas profissionais.${titulo ? `\n\nNome do produto: "${titulo}"` : ''}\n\nUse o nome do produto e a imagem juntos para gerar a sugestão. Descreva o material real que você vê.\n\nResponda APENAS com JSON válido, sem markdown:\n{"categoria": "categoria curta em português", "descricao": "descrição comercial de 1 a 2 frases em português mencionando o material real"}` }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return JSON.parse(text.trim())
  } catch {
    return null
  }
}

const DICIONARIO: { palavras: string[]; categoria: string; descricao: (t: string) => string }[] = [
  {
    palavras: ['bancada'],
    categoria: 'Bancadas',
    descricao: t => `${t} fabricada em aço inox 304, estrutura robusta e resistente à corrosão, ideal para cozinhas profissionais e indústrias.`,
  },
  {
    palavras: ['cuba', 'pia', 'lavabo', 'lavatório'],
    categoria: 'Cubas e Pias',
    descricao: t => `${t} em aço inox 304 com acabamento escovado, fácil higienização e durabilidade para uso intenso.`,
  },
  {
    palavras: ['estante', 'prateleira', 'rack'],
    categoria: 'Estantes',
    descricao: t => `${t} em aço inox com prateleiras reguláveis, ideal para armazenamento em ambientes que exigem higiene e resistência.`,
  },
  {
    palavras: ['armário', 'gabinete', 'guarda'],
    categoria: 'Armários',
    descricao: t => `${t} em aço inox com portas e fechamento seguro, perfeito para armazenamento em cozinhas industriais e hospitais.`,
  },
  {
    palavras: ['coifa', 'exaustor', 'capô', 'capa'],
    categoria: 'Coifas e Exaustores',
    descricao: t => `${t} em aço inox para extração de fumaça e vapores, garantindo ventilação eficiente em cozinhas profissionais.`,
  },
  {
    palavras: ['gôndola', 'gondola', 'expositor'],
    categoria: 'Gôndolas',
    descricao: t => `${t} em aço inox para exposição de produtos, resistente e com visual moderno para padarias, restaurantes e varejo.`,
  },
  {
    palavras: ['mesa', 'tampo'],
    categoria: 'Mesas',
    descricao: t => `${t} em aço inox 304 com acabamento escovado, resistente e fácil de higienizar para uso em cozinhas e indústrias.`,
  },
  {
    palavras: ['carrinho', 'carro', 'trolley'],
    categoria: 'Carrinhos',
    descricao: t => `${t} em aço inox com rodízios giratórios, facilitando o transporte de materiais em ambientes que exigem higiene.`,
  },
  {
    palavras: ['marmita', 'container', 'gastronorm', 'cuba gastronômica'],
    categoria: 'Utensílios',
    descricao: t => `${t} em aço inox 304 para conservação e transporte de alimentos, atendendo normas sanitárias.`,
  },
  {
    palavras: ['pia', 'tanque', 'lava'],
    categoria: 'Pias e Tanques',
    descricao: t => `${t} em aço inox com acabamento sanitário, ideal para higienização em cozinhas profissionais e indústrias.`,
  },
  {
    palavras: ['balcão', 'passa-prato', 'passa prato'],
    categoria: 'Balcões',
    descricao: t => `${t} em aço inox fabricado sob medida, robusto e de fácil higienização para restaurantes e cozinhas industriais.`,
  },
  {
    palavras: ['suporte', 'apoio', 'bracket'],
    categoria: 'Suportes',
    descricao: t => `${t} em aço inox para fixação e organização de equipamentos, resistente à umidade e fácil de limpar.`,
  },
  {
    palavras: ['tábua', 'tabua', 'corte', 'polietileno'],
    categoria: 'Utensílios de Corte',
    descricao: t => `${t} com superfície lisa e resistente, indicada para uso profissional em cozinhas industriais e restaurantes.`,
  },
  {
    palavras: ['forno', 'estufa', 'fritadeira', 'chapa', 'grelha', 'fogão', 'fogao'],
    categoria: 'Cocção',
    descricao: t => `${t} para uso profissional em cozinhas industriais, com alta durabilidade e desempenho.`,
  },
  {
    palavras: ['freezer', 'refrigerador', 'geladeira', 'câmara', 'camara', 'resfriador'],
    categoria: 'Refrigeração',
    descricao: t => `${t} para conservação de alimentos em temperatura controlada, ideal para uso profissional.`,
  },
  {
    palavras: ['lixeira', 'coletor', 'recipiente', 'balde'],
    categoria: 'Lixeiras e Coletores',
    descricao: t => `${t} em aço inox com tampa, resistente e higiênico para uso em cozinhas e ambientes industriais.`,
  },
  {
    palavras: ['escorredor', 'grelha', 'grade', 'ralo'],
    categoria: 'Acessórios',
    descricao: t => `${t} em aço inox com acabamento escovado, prático e resistente para uso profissional.`,
  },
]

function sugerirLocal(titulo: string): Sugestao | null {
  const t = titulo.toLowerCase()
  for (const item of DICIONARIO) {
    if (item.palavras.some(p => t.includes(p))) {
      return { categoria: item.categoria, descricao: item.descricao(titulo) }
    }
  }
  return null
}

interface Produto {
  id: string
  titulo: string
  tipo: 'outlet' | 'pronta-entrega'
  marca: string | null
  fabricante: string | null
  categoria: string | null
  descricao: string | null
  preco: number
  preco_original: number | null
  quantidade: number
  fotos: string[] | null
  specs: Record<string, string> | null
  destaque: boolean
  disponivel: boolean
  seminovo: boolean
}

const FORM_VAZIO = {
  titulo: '',
  tipo: 'pronta-entrega' as 'outlet' | 'pronta-entrega',
  marca: '',
  fabricante: '',
  categoria: '',
  descricao: '',
  preco: '',
  preco_original: '',
  quantidade: '1',
  destaque: false,
  disponivel: true,
  seminovo: false,
  specs: [] as { k: string; v: string }[],
  fotos: [] as string[],
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
  const [uploadando, setUploadando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const { data } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .order('created_at', { ascending: false })
    setProdutos(data ?? [])
    setLoading(false)
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const nome = `${Date.now()}.${ext}`
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(nome, file, { upsert: true })
    if (!error) {
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`
      setForm(f => ({ ...f, fotos: [...f.fotos, url] }))
      const s = await sugerirPorImagem(file, form.titulo.trim() || undefined, form.marca.trim() || undefined)
      if (s) setSugestao(s)
    } else {
      setMsg({ tipo: 'erro', texto: 'Erro ao fazer upload da foto.' })
    }
    setUploadando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removerFoto(url: string) {
    setForm(f => ({ ...f, fotos: f.fotos.filter(u => u !== url) }))
  }

  function adicionarSpec() {
    setForm(f => ({ ...f, specs: [...f.specs, { k: '', v: '' }] }))
  }

  function atualizarSpec(i: number, campo: 'k' | 'v', valor: string) {
    setForm(f => {
      const specs = [...f.specs]
      specs[i] = { ...specs[i], [campo]: valor }
      return { ...f, specs }
    })
  }

  function removerSpec(i: number) {
    setForm(f => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) }))
  }

  const dragIndex = useRef<number | null>(null)

  function moverSpec(de: number, para: number) {
    setForm(f => {
      const specs = [...f.specs]
      const [item] = specs.splice(de, 1)
      specs.splice(para, 0, item)
      return { ...f, specs }
    })
  }

  function editarProduto(p: Produto) {
    setEditandoId(p.id)
    setForm({
      titulo: p.titulo,
      tipo: p.tipo,
      marca: p.marca ?? '',
      fabricante: p.fabricante ?? '',
      categoria: p.categoria ?? '',
      descricao: p.descricao ?? '',
      preco: String(p.preco),
      preco_original: p.preco_original ? String(p.preco_original) : '',
      quantidade: String(p.quantidade),
      destaque: p.destaque,
      disponivel: p.disponivel,
      seminovo: p.seminovo,
      specs: p.specs
        ? Array.isArray(p.specs)
          ? p.specs
          : Object.entries(p.specs as Record<string, string>).map(([k, v]) => ({ k, v }))
        : [],
      fotos: p.fotos ?? [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ ...FORM_VAZIO })
    setNovaMarca('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)

    const specsObj = form.specs.length > 0
      ? form.specs.filter(s => s.k).map(s => ({ k: s.k, v: s.v }))
      : null

    const payload = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      marca: form.marca === '__nova__' ? (novaMarca.trim() || null) : (form.marca.trim() || null),
      fabricante: form.fabricante.trim() || null,
      categoria: form.categoria.trim() || null,
      descricao: form.descricao.trim() || null,
      preco: parseFloat(form.preco),
      preco_original: form.preco_original ? parseFloat(form.preco_original) : null,
      quantidade: parseInt(form.quantidade) || 1,
      destaque: form.destaque,
      disponivel: form.disponivel,
      seminovo: form.seminovo,
      specs: specsObj,
      fotos: form.fotos.length > 0 ? form.fotos : null,
    }

    const { error } = editandoId
      ? await supabaseAdmin.from('produtos').update(payload).eq('id', editandoId)
      : await supabaseAdmin.from('produtos').insert(payload)

    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar produto.' })
    } else {
      setMsg({ tipo: 'ok', texto: editandoId ? 'Produto atualizado!' : 'Produto cadastrado!' })
      cancelarEdicao()
      fetchProdutos()
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

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [msg])

  useEffect(() => {
    setSugestao(null)
    if (form.titulo.trim().length < 4) return
    const s = sugerirLocal(form.titulo.trim())
    setSugestao(s)
  }, [form.titulo])

  return (
    <div className={styles.wrap}>
      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {/* Formulário */}
      <form className={styles.form} onSubmit={salvar}>
        <h2 className={styles.formTitle}>{editandoId ? 'Editar produto' : 'Novo produto'}</h2>

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
              {[...MARCAS_FIXAS, ...marcasExtras].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="__nova__">＋ Nova marca…</option>
            </select>
            {form.marca === '__nova__' && (
              <input
                className={styles.input}
                style={{ marginTop: 6 }}
                placeholder="Nome da nova marca"
                value={novaMarca}
                onChange={e => setNovaMarca(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <div className={styles.fieldSm}>
            <label>Fabricante <span style={{ fontWeight: 400, color: '#6b7280' }}>(opcional — para produtos de terceiros sem marca de representação)</span></label>
            <input className={styles.input} placeholder="ex: Metalúrgica São Paulo" value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} />
          </div>
        </div>

        {sugestao && (
          <div className={styles.sugestaoBox}>
            <span className={styles.sugestaoLabel}>{form.marca.trim() ? `Sugestão IA — ${form.marca.trim()}` : 'Sugestão IA'}</span>
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
              <button type="button" className={styles.btnAplicarTudo} onClick={() => setForm(f => ({
                ...f,
                ...(sugestao.titulo ? { titulo: sugestao.titulo } : {}),
                categoria: sugestao.categoria,
                descricao: sugestao.descricao,
              }))}>Aplicar tudo</button>
            </div>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label>Categoria</label>
            <input className={styles.input} placeholder="ex: Bancadas" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} />
          </div>
          <div className={styles.fieldSm}>
            <label>Quantidade *</label>
            <input className={styles.input} type="number" min="0" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.fieldSm}>
            <label>Preço (R$) *</label>
            <input className={styles.input} type="number" step="0.01" min="0" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} required />
          </div>
          <div className={styles.fieldSm}>
            <label>Preço original (R$)</label>
            <input className={styles.input} type="number" step="0.01" min="0" placeholder="Para calcular % OFF" value={form.preco_original} onChange={e => setForm(f => ({ ...f, preco_original: e.target.value }))} />
          </div>
        </div>

        <div className={styles.field}>
          <label>Descrição</label>
          <textarea className={styles.textarea} rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>

        {/* Specs */}
        <div className={styles.field}>
          <label>Especificações técnicas</label>
          <div className={styles.specPresets}>
            {[
              { k: 'Dimensões', v: 'L × P × A cm' },
              { k: 'Potência', v: 'W' },
              { k: 'Tensão', v: 'V' },
              { k: 'Peso', v: 'kg' },
              { k: 'Capacidade', v: 'L' },
              { k: 'Combustível', v: 'Gás / Elétrico' },
            ].map(preset => (
              <button
                key={preset.k}
                type="button"
                className={styles.btnPreset}
                onClick={() => {
                  if (!form.specs.some(s => s.k === preset.k)) {
                    setForm(f => ({ ...f, specs: [...f.specs, { k: preset.k, v: '' }] }))
                  }
                }}
              >
                + {preset.k}
              </button>
            ))}
          </div>
          {form.specs.map((s, i) => (
            <div
              key={i}
              className={styles.specRow}
              draggable
              onDragStart={() => { dragIndex.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null && dragIndex.current !== i) {
                  moverSpec(dragIndex.current, i)
                  dragIndex.current = null
                }
              }}
            >
              <span className={styles.dragHandle}>⠿</span>
              <input className={styles.input} placeholder="Campo" value={s.k} onChange={e => atualizarSpec(i, 'k', e.target.value)} />
              <input className={styles.input} placeholder="Valor com unidade (ex: 220V · 5000W · 23kg)" value={s.v} onChange={e => atualizarSpec(i, 'v', e.target.value)} />
              <button type="button" className={styles.btnRemove} onClick={() => removerSpec(i)}>✕</button>
            </div>
          ))}
          <button type="button" className={styles.btnSecondary} onClick={adicionarSpec}>+ Campo personalizado</button>
        </div>

        {/* Fotos */}
        <div className={styles.field}>
          <label>Fotos</label>
          <div className={styles.fotosWrap}>
            {form.fotos.map(url => (
              <div key={url} className={styles.fotoThumb}>
                <img src={url} alt="" />
                <button type="button" className={styles.fotoRemove} onClick={() => removerFoto(url)}>✕</button>
              </div>
            ))}
            <label className={styles.uploadBtn}>
              {uploadando ? 'Enviando...' : '+ Foto'}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUploadFoto} disabled={uploadando} hidden />
            </label>
          </div>
        </div>

        {/* Checkboxes */}
        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.destaque} onChange={e => setForm(f => ({ ...f, destaque: e.target.checked }))} />
            Destaque
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.disponivel} onChange={e => setForm(f => ({ ...f, disponivel: e.target.checked }))} />
            Disponível
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.seminovo} onChange={e => setForm(f => ({ ...f, seminovo: e.target.checked }))} />
            Seminovo
          </label>
        </div>

        <div className={styles.formActions}>
          {editandoId && (
            <button type="button" className={styles.btnSecondary} onClick={cancelarEdicao}>Cancelar</button>
          )}
          <button type="submit" className={styles.btnPrimary} disabled={salvando}>
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className={styles.lista}>
        <h2 className={styles.formTitle}>Produtos cadastrados</h2>
        {loading ? (
          <p className={styles.loadingMsg}>Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className={styles.loadingMsg}>Nenhum produto cadastrado.</p>
        ) : (
          produtos.map(p => (
            <div key={p.id} className={`${styles.item} ${!p.disponivel ? styles.itemVendido : ''}`}>
              <div className={styles.itemFoto}>
                {p.fotos?.[0]
                  ? <img src={p.fotos[0]} alt={p.titulo} />
                  : <div className={styles.itemSemFoto}>Sem foto</div>
                }
              </div>
              <div className={styles.itemInfo}>
                <strong>{p.titulo}</strong>
                <span className={styles.itemMeta}>
                  {p.marca ? `Representação · ${p.marca}` : p.tipo === 'outlet' ? 'Outlet' : 'Pronta Entrega'}
                  {p.categoria ? ` · ${p.categoria}` : ''}
                  {' · '}R$ {p.preco.toFixed(2).replace('.', ',')}
                  {' · '}Qtd: {p.quantidade}
                  {p.destaque ? ' · Destaque' : ''}
                </span>
                <span className={`${styles.itemStatus} ${p.disponivel ? styles.itemStatusOk : styles.itemStatusVendido}`}>
                  {p.disponivel ? 'Em estoque' : 'Sob encomenda'}
                </span>
              </div>
              <div className={styles.itemAcoes}>
                <button className={styles.btnSecondary} onClick={() => editarProduto(p)}>Editar</button>
                <button className={styles.btnToggle} onClick={() => toggleDisponivel(p)}>
                  {p.disponivel ? 'Marcar como esgotado' : 'Reativar estoque'}
                </button>
                <button className={styles.btnDanger} onClick={() => excluir(p.id)}>Excluir</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
