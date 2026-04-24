import { useState, useEffect, useCallback } from 'react'
import SEO from '../components/SEO/SEO'
import { supabase } from '../lib/supabase'
import type { ProdutoPublico } from '../lib/supabase'
import styles from './Outlet.module.css'

interface OpcaoFrete {
  servico: string
  codigo: string
  preco: number
  prazo: number
  erro: string | null
}

interface FreteResult {
  opcoes: OpcaoFrete[]
  correios_elegivel: boolean
}

function FreteCalculator({ produto }: { produto: ProdutoPublico }) {
  const [cep, setCep] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<FreteResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [cidadeFrete, setCidadeFrete] = useState('')

  const temDados = produto.peso_kg && produto.peso_kg > 0

  const calcular = useCallback(async (cepLimpo: string) => {
    if (cepLimpo.length !== 8 || !temDados) return
    setLoading(true)
    setErro(null)
    setResultado(null)

    // Busca cidade
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (!data.erro) setCidadeFrete(`${data.localidade} — ${data.uf}`)
    } catch { /* ignora */ }

    try {
      const { data, error } = await supabase.functions.invoke('calcular-frete', {
        body: {
          cep_destino: cepLimpo,
          peso_kg: produto.peso_kg,
          comprimento_cm: produto.comprimento_cm || 20,
          largura_cm: produto.largura_cm || 15,
          altura_cm: produto.altura_cm || 10,
        },
      })
      if (error) throw error
      setResultado(data as FreteResult)
    } catch (e) {
      setErro('Não foi possível calcular o frete. Tente novamente.')
      console.error(e)
    }
    setLoading(false)
  }, [produto, temDados])

  if (!temDados) return null

  return (
    <div className={styles.freteBox}>
      <div className={styles.freteHeader}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span>Calcular frete</span>
      </div>
      <div className={styles.freteInputRow}>
        <input
          type="text"
          placeholder="Digite seu CEP"
          value={cep}
          maxLength={9}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 8)
            const mask = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v
            setCep(mask)
            setCidadeFrete('')
            setResultado(null)
            setErro(null)
            if (v.length === 8) calcular(v)
          }}
          className={styles.freteInput}
        />
        {loading && <span className={styles.freteSpinner} />}
      </div>

      {cidadeFrete && <span className={styles.freteCidade}>{cidadeFrete}</span>}

      {erro && <span className={styles.freteErro}>{erro}</span>}

      {resultado && resultado.opcoes.length > 0 && (
        <div className={styles.freteOpcoes}>
          {resultado.opcoes.map(op => (
            <div key={op.codigo} className={styles.freteOpcao}>
              <div className={styles.freteOpcaoInfo}>
                <span className={styles.freteServico}>{op.servico}</span>
                <span className={styles.fretePrazo}>{op.prazo} dia{op.prazo !== 1 ? 's' : ''} útei{op.prazo !== 1 ? 's' : ''}</span>
              </div>
              <span className={styles.fretePreco}>
                R$ {op.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}

      {resultado && resultado.opcoes.length === 0 && (
        <span className={styles.freteErro}>Nenhuma opção de frete disponível para este CEP.</span>
      )}
    </div>
  )
}
import clienteAlvorada from '../assets/cliente-alvorada.png'
import clienteCimed from '../assets/cliente-cimed.svg'
import clienteMonreale from '../assets/cliente-monreale.svg'
import clienteHcsl from '../assets/cliente-hcsl.png'
import clienteUnimed from '../assets/cliente-unimed.png'
import clienteUnivas from '../assets/cliente-univas.svg'
import clienteGilsan from '../assets/cliente-gilsan.png'
import clienteBimbo from '../assets/cliente-bimbo.png'
import clienteUniaoquimica from '../assets/cliente-uniaoquimica.svg'
import clienteBiolab from '../assets/cliente-biolab.webp'
import clienteMonreve from '../assets/cliente-monreve.svg'

const clients = [
  { src: clienteAlvorada, alt: 'Supermercados Alvorada' },
  { src: clienteUnimed, alt: 'Unimed' },
  { src: clienteMonreale, alt: 'Monreale Resort' },
  { src: clienteCimed, alt: 'Cimed' },
  { src: clienteHcsl, alt: 'Hospital e Clínica São Lucas' },
  { src: clienteUnivas, alt: 'Univás' },
  { src: clienteGilsan, alt: 'Grupo Gilsan', invert: true },
  { src: clienteBimbo, alt: 'Bimbo QSR Brasil' },
  { src: clienteUniaoquimica, alt: 'União Química' },
  { src: clienteBiolab, alt: 'Biolab Eco' },
  { src: clienteMonreve, alt: 'Monreve' },
]

const PLACEHOLDER = 'https://placehold.co/800x600/e5e7eb/9ca3af?text=Foto+em+breve'

const BRAND_COLORS: Record<string, { background: string; color: string }> = {
  croydon: { background: '#111', color: '#fff' },
}

function getBrandColors(marca: string | null): { background: string; color: string } {
  if (!marca) return { background: '#1a5fa8', color: '#fff' }
  return BRAND_COLORS[marca.toLowerCase()] ?? { background: '#1e3a5f', color: '#fff' }
}

function normalizeSpecs(specs: { k: string; v: string }[] | Record<string, string> | null): { k: string; v: string }[] {
  if (!specs) return []
  if (Array.isArray(specs)) return specs
  return Object.entries(specs).map(([k, v]) => ({ k, v }))
}


export default function Outlet() {
  const [produtos, setProdutos] = useState<ProdutoPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<ProdutoPublico | null>(null)
  const [form, setForm] = useState({ nome: '', whatsapp: '', cep: '', cidade: '', uf: '' })
  const [enviando, setEnviando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [resultado, setResultado] = useState<'sucesso' | 'duplicado' | 'erro' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')

  async function compartilhar(produto: ProdutoPublico) {
    const url = `https://pousinox.com.br/produto/${produto.id}`
    const text = produto.fabricante
      ? `${produto.titulo} — fabricado por ${produto.fabricante}, vendido pela POUSINOX®, Pouso Alegre, MG.`
      : produto.marca
      ? `${produto.titulo} — vendido pela POUSINOX®, Pouso Alegre, MG.`
      : `${produto.titulo} — POUSINOX®, Pouso Alegre, MG.`
    if (navigator.share) {
      await navigator.share({ title: produto.titulo, text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopiado(true)
      const t = setTimeout(() => setCopiado(false), 2500)
      return () => clearTimeout(t)
    }
  }

  async function fetchProdutos() {
    const { data } = await supabase.from('produtos_publicos').select('*')
    setProdutos(data ?? [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProdutos() }, [])

  const byPrecoDesc = (a: ProdutoPublico, b: ProdutoPublico) =>
    (b.preco ?? 0) - (a.preco ?? 0)

  const catalogo = [...produtos].sort((a, b) => {
    if (a.disponivel && !b.disponivel) return -1
    if (!a.disponivel && b.disponivel) return 1
    return byPrecoDesc(a, b)
  })

  const categorias = ['Todos', ...Array.from(new Set(
    catalogo.filter(p => p.categoria).map(p => p.categoria!)
  ))]

  const catalogoFiltrado = catalogo.filter(p => {
    if (categoriaFiltro !== 'Todos' && p.categoria !== categoriaFiltro) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      if (
        !p.titulo.toLowerCase().includes(q) &&
        !(p.categoria ?? '').toLowerCase().includes(q) &&
        !(p.marca ?? '').toLowerCase().includes(q) &&
        !(p.descricao ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // Destaques para o hero — todos os produtos disponíveis marcados como destaque (inclui representação)
  const heroDestaques = [...produtos.filter(p => p.destaque && p.disponivel)].sort(byPrecoDesc)


  async function handleInteresse(e: React.FormEvent) {
    e.preventDefault()
    if (!selecionado) return
    setEnviando(true)
    setResultado(null)

    const { error } = await supabase.from('interesses').insert({
      produto_id:      selecionado.id,
      produto_titulo:  selecionado.titulo,
      cliente_nome:    form.nome.trim(),
      cliente_whatsapp: form.whatsapp.trim(),
      cep:             form.cep.replace(/\D/g, '') || null,
      cidade:          form.cidade || null,
      uf:              form.uf || null,
    })

    if (!error) {
      setResultado('sucesso')
      await fetchProdutos()
      supabase.functions.invoke('dynamic-action', {
        body: {
          type: 'INSERT',
          table: 'interesses',
          record: {
            produto_id: selecionado.id,
            cliente_nome: form.nome.trim(),
            cliente_whatsapp: form.whatsapp.trim(),
            foto_url: selecionado.fotos?.[0] ?? null,
            produto_titulo: selecionado.titulo,
            produto_disponivel: selecionado.disponivel,
            produto_marca: selecionado.marca ?? null,
          },
        },
      }).catch(() => {})
    } else if (error.code === '23505') {
      setResultado('duplicado')
    } else {
      setResultado('erro')
    }
    setEnviando(false)
  }

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => ({ ...f, cidade: data.localidade, uf: data.uf }))
      }
    } catch { /* sem internet: deixa em branco */ }
    setBuscandoCep(false)
  }

  function abrirModal(p: ProdutoPublico) {
    setSelecionado(p)
    setForm({ nome: '', whatsapp: '', cep: '', cidade: '', uf: '' })
    setResultado(null)
  }

  function fecharModal() {
    setSelecionado(null)
    setResultado(null)
  }

  const isSobEncomenda = selecionado ? !selecionado.disponivel : false

  return (
    <>
      <SEO
        title="Pronta Entrega Inox | Mesas, Bancadas, Coifas em Estoque | Pousinox Pouso Alegre"
        description="Equipamentos em aço inox com pronta entrega em Pouso Alegre, MG. Mesas, bancadas com cuba, coifas, estantes e pias — estoque disponível para retirada imediata ou fabricamos sob encomenda. Atendemos restaurantes, hospitais e indústrias do Sul de Minas."
        path="/pronta-entrega"
      />

      {/* Hero */}
      <section className={`${styles.hero} ${!loading && heroDestaques.length === 0 ? styles.heroFallback : ''}`}>
        <div className={styles.heroFaixa}>
          <div className={`container ${styles.heroFaixaInner}`}>
            <div className={styles.heroLeft}>
              <span className={styles.heroEyebrow}>Pouso Alegre, MG</span>
              <h1 className={styles.heroTitle}>Produtos inox à pronta entrega para operação profissional</h1>
              <p className={styles.heroSubtitle}>
                Equipamentos e acessórios com disponibilidade imediata, aplicação profissional e opção de personalização sob demanda. Solicite um orçamento rápido com a equipe da Pousinox.
              </p>
              <div className={styles.heroCtas}>
                <a href="#catalogo" className={styles.heroCta} onClick={e => { e.preventDefault(); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  Solicitar orçamento
                </a>
                <a href="https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento%20de%20produtos%20pronta%20entrega." target="_blank" rel="noopener noreferrer" className={styles.heroCtaWa}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  Falar no WhatsApp
                </a>
                <a href="#catalogo" className={styles.heroCtaScroll} onClick={e => { e.preventDefault(); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  Ver produtos disponíveis ↓
                </a>
              </div>
            </div>
            {heroDestaques[0] && !loading && (
              <div className={styles.heroRightWrapper}>
                <span className={styles.heroDestaquLabel}>Em destaque</span>
                <button className={styles.heroRight} onClick={() => abrirModal(heroDestaques[0])} type="button">
                  <div className={styles.heroFeaturedBadges}>
                    {heroDestaques[0].seminovo && <span className={styles.badgeSeminovo}>Seminovo</span>}
                    {heroDestaques[0].marca && <span className={styles.badgeMarca}>{heroDestaques[0].marca}</span>}
                    {!heroDestaques[0].marca && !heroDestaques[0].seminovo && <span className={styles.badgePronta}>Pousinox®</span>}
                  </div>
                  {heroDestaques[0].fotos?.[0] && (
                    <img src={heroDestaques[0].fotos[0]} alt={heroDestaques[0].titulo} className={styles.heroFeaturedImg} />
                  )}
                  <div className={styles.heroFeaturedInfo}>
                    {heroDestaques[0].categoria && (
                      <span className={styles.heroFeaturedCategoria}>{heroDestaques[0].categoria}</span>
                    )}
                    <span className={styles.heroFeaturedTitulo}>{heroDestaques[0].titulo}</span>
                    <span className={styles.heroFeaturedCta}>Ver preço →</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Trust strip — rodapé da hero */}
        <div className={styles.trustStrip}>
          <div className={styles.trustStripInner}>
            <span className={styles.trustChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Aço inox profissional
            </span>
            <span className={styles.trustChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              Pronta entrega
            </span>
            <span className={styles.trustChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Atendimento técnico
            </span>
            <span className={styles.trustChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
              Padrão e sob medida
            </span>
          </div>
        </div>

      </section>

      {/* Ticker de clientes */}
      <section className={styles.clients}>
        <div className={styles.clientsTicker}>
          <div className={styles.clientsTrack}>
            {[...clients, ...clients].map((c, i) => (
              <div key={i} className={styles.clientLogoWrap}>
                <img src={c.src} alt={c.alt} className={styles.clientLogo}
                  style={c.invert ? { filter: 'invert(1) brightness(0.25)' } : undefined} />
              </div>
            ))}
          </div>
        </div>
        <div className="container">
          <p className={styles.clientsLabel}>Empresas que confiam na POUSINOX®</p>
        </div>
      </section>

      {/* Catálogo unificado */}
      <section id="catalogo" className={`section ${styles.catalogo}`}>
        <div className="container">
          <div className={styles.catalogoToolbar}>
            <div className={styles.catalogoTitleRow}>
              <h2 className={styles.catalogoH2}>Produtos disponíveis</h2>
              {!loading && (
                <span className={styles.catalogoCount}>{catalogoFiltrado.length} produto{catalogoFiltrado.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Busca por texto */}
            <div className={styles.catalogoBusca}>
              <span className={styles.catalogoBuscaIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                className={styles.catalogoBuscaInput}
                type="text"
                placeholder="Buscar por produto, aplicação ou segmento…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button className={styles.catalogoBuscaClear} onClick={() => setBusca('')} type="button">×</button>
              )}
            </div>
          </div>

          {/* Pills de categoria */}
          {!loading && categorias.length > 1 && (
            <div className={styles.categoriasFiltro}>
              {categorias.map(cat => (
                <button
                  key={cat}
                  className={`${styles.filtroBtn} ${categoriaFiltro === cat ? styles.filtroBtnActive : ''}`}
                  onClick={() => setCategoriaFiltro(cat)}
                  type="button"
                >
                  {cat === 'Todos' ? 'Todos os produtos' : cat.replace(/^Equipamentos\s+(de\s+)?/i, '')}
                </button>
              ))}
            </div>
          )}


          {loading ? (
            <div className={styles.loadingGrid}>
              {[...Array(3)].map((_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : catalogoFiltrado.length === 0 ? (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <p>Nenhum produto encontrado nessa categoria.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {catalogoFiltrado.map(p => (
                <ProdutoCard key={p.id} produto={p} onInteresse={() => abrirModal(p)} onCompartilhar={() => compartilhar(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Faixa sob medida */}
      <section className={styles.sobMedidaFaixa}>
        <div className="container">
          <div className={styles.sobMedidaContent}>
            <div className={styles.sobMedidaText}>
              <span className={styles.sobMedidaEyebrow}>Projetos sob medida</span>
              <h3 className={styles.sobMedidaTitulo}>Não encontrou exatamente o que precisa?</h3>
              <p className={styles.sobMedidaDesc}>Nós também atendemos projetos sob medida. Dimensões, acabamento e configuração adaptados à sua operação.</p>
            </div>
            <a
              href="https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20projeto%20sob%20medida%20em%20aço%20inox."
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sobMedidaBtn}
            >
              Falar com a equipe →
            </a>
          </div>
        </div>
      </section>

      {/* Bloco de atendimento consultivo */}
      <section className={styles.atendimento}>
        <div className="container">
          <div className={styles.atendimentoInner}>
            <div className={styles.atendimentoText}>
              <span className={styles.atendimentoEyebrow}>Atendimento Pousinox®</span>
              <h3 className={styles.atendimentoTitulo}>Precisa de orientação técnica ou comercial?</h3>
              <p className={styles.atendimentoDesc}>Nossa equipe atende projetos de todos os portes — desde peças de estoque até soluções fabricadas sob medida para indústrias, hospitais e redes de alimentação.</p>
              <div className={styles.atendimentoPilares}>
                <div className={styles.pilar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Equipe técnica especializada</span>
                </div>
                <div className={styles.pilar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Resposta rápida via WhatsApp</span>
                </div>
                <div className={styles.pilar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
                  <span>Projetos padrão e sob medida</span>
                </div>
              </div>
            </div>
            <div className={styles.atendimentoCtas}>
              <a
                href="https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento."
                target="_blank"
                rel="noopener noreferrer"
                className={styles.atendimentoBtnWa}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Falar no WhatsApp
              </a>
              <a href="/contato" className={styles.atendimentoBtnContato}>
                Formulário de contato →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Modal */}
      {selecionado && (
        <div className={styles.modalBackdrop} onClick={fecharModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={fecharModal} aria-label="Fechar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className={styles.modalBody}>
              {/* Coluna esquerda — imagem + specs */}
              {(() => {
                const specs = normalizeSpecs(selecionado.specs)
                const specsTable = specs.length > 0 && (
                  <div className={styles.specsTable}>
                    {specs.map(({ k, v }) => (
                      <div key={k} className={styles.specRow}>
                        <span className={styles.specKey}>{k}</span>
                        <span className={styles.specVal}>{v}</span>
                      </div>
                    ))}
                  </div>
                )
                return (
                  <>
                    <div className={styles.modalLeft}>
                      <div className={styles.modalFoto}>
                        <img
                          src={selecionado.fotos?.[0] ?? PLACEHOLDER}
                          alt={selecionado.titulo}
                          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
                        />
                        <div className={styles.modalImageBadges}>
                          {selecionado.marca ? (
                            <span className={styles.badgeMarca} style={getBrandColors(selecionado.marca)}>{selecionado.marca}</span>
                          ) : (
                            <span className={isSobEncomenda ? styles.badgeSobEncomenda : styles.badgePronta}>
                              {isSobEncomenda ? 'Sob encomenda' : 'Pronta Entrega'}
                            </span>
                          )}
                        </div>
                      </div>
                      {specsTable && (
                        <div className={styles.modalSpecsPanel}>
                          <span className={styles.modalSpecsLabel}>Especificações</span>
                          {specsTable}
                        </div>
                      )}
                    </div>

                    {/* Coluna direita — info + form + infobox */}
                    <div className={styles.modalRight}>
                      {/* Specs visíveis apenas no mobile */}
                      {specsTable && (
                        <div className={styles.modalSpecsMobile}>
                          <span className={styles.modalSpecsLabel}>Especificações</span>
                          {specsTable}
                        </div>
                      )}

                <div className={styles.modalBadges}>
                  {selecionado.categoria && (
                    <span className={styles.badgeCategoria}>{selecionado.categoria}</span>
                  )}
                  <button className={styles.shareBtn} onClick={() => compartilhar(selecionado)} title={copiado ? 'Copiado!' : 'Compartilhar'} type="button">
                    {copiado ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    )}
                  </button>
                </div>

                <h2 className={styles.modalTitulo}>{selecionado.titulo}</h2>

                {selecionado.descricao && <p className={styles.modalDesc}>{selecionado.descricao}</p>}

                {selecionado.exibir_preco && selecionado.preco > 0 && (
                  <div className={styles.modalPreco}>
                    {selecionado.preco_original && selecionado.preco_original > selecionado.preco && (
                      <span className={styles.modalPrecoOriginal}>
                        R$ {selecionado.preco_original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={styles.modalPrecoValor}>
                      R$ {selecionado.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <FreteCalculator produto={selecionado} />

                {selecionado.total_interesses > 0 && (
                  <p className={styles.modalInteresse}>
                    🔥 {selecionado.total_interesses} {selecionado.total_interesses === 1 ? 'pessoa interessada' : 'pessoas interessadas'}
                  </p>
                )}

                <div className={styles.modalForm}>
                  {resultado === 'sucesso' ? (
                    <div className={styles.sucesso}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <h3>Interesse registrado!</h3>
                      <p>Enviamos o preço e os detalhes para o seu WhatsApp em instantes.</p>
                      {!isSobEncomenda && !selecionado.marca && (
                        <p className={styles.sucessoInfo}>Estoque limitado — garanta o seu antes que acabe.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <h3 className={styles.formTitle}>{isSobEncomenda ? 'Solicitar encomenda' : selecionado.exibir_preco ? 'Tenho interesse' : 'Ver preço no WhatsApp'}</h3>
                      <form onSubmit={handleInteresse} className={styles.form}>
                        <div className={styles.formRow}>
                          <input id="nome" type="text" placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                          <input id="whatsapp" type="tel" placeholder="(35) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} required />
                        </div>
                        <div className={styles.formRow}>
                          <input
                            id="cep"
                            type="text"
                            placeholder="CEP (opcional)"
                            value={form.cep}
                            maxLength={9}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                              const mask = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v
                              setForm(f => ({ ...f, cep: mask, cidade: '', uf: '' }))
                              if (v.length === 8) buscarCep(v)
                            }}
                          />
                          <input
                            id="cidade"
                            type="text"
                            placeholder={buscandoCep ? 'Buscando...' : 'Cidade/UF (auto)'}
                            value={form.cidade ? `${form.cidade}${form.uf ? ` — ${form.uf}` : ''}` : ''}
                            readOnly
                            style={{ background: '#f8fafc', color: '#64748b' }}
                          />
                        </div>
                        {resultado === 'duplicado' && <p className={styles.erroMsg}>Você já demonstrou interesse neste produto. Verifique seu WhatsApp!</p>}
                        {resultado === 'erro' && <p className={styles.erroMsg}>Erro ao registrar. Tente novamente.</p>}
                        <button type="submit" className={styles.submitBtn} disabled={enviando}>
                          {enviando ? 'Enviando...' : isSobEncomenda ? 'Solicitar encomenda' : selecionado.exibir_preco ? 'Confirmar interesse' : 'Ver preço no WhatsApp'}
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <div className={styles.modalInfoBox}>
                  <div className={styles.modalInfoItem}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div>
                      <strong>{selecionado.marca ? 'Atendimento pela Pousinox®' : isSobEncomenda ? 'Fabricação e retirada na fábrica' : 'Retirada na fábrica'}</strong>
                      <span>Av. Antonio Mariosa, 4545 — Pouso Alegre, MG</span>
                      <iframe
                        className={styles.mapaEmbed}
                        src="https://maps.google.com/maps?q=Av.+Antonio+Mariosa,+4545+Pouso+Alegre+MG+Brasil&output=embed"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Localização Pousinox"
                      />
                      <a href="https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8" target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>Ver no Google Maps ↗</a>
                    </div>
                  </div>
                  <div className={styles.modalInfoItem}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div>
                      <strong>Horário de atendimento</strong>
                      <span>Seg–Qui: 7h30–11h30 / 13h15–18h</span>
                      <span>Sex: 7h30–11h30 / 13h15–17h</span>
                      <span>Sáb, Dom e feriados: fechado</span>
                    </div>
                  </div>
                  <div className={styles.modalInfoItem}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <div>
                      <span>
                        {selecionado.marca
                          ? 'Produto de representação — disponibilidade e prazo a confirmar'
                          : isSobEncomenda
                            ? 'Fabricado sob encomenda — prazo a combinar no atendimento'
                            : 'Estoque limitado — garanta o seu antes que acabe'}
                      </span>
                    </div>
                  </div>
                </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProdutoCard({ produto: p, onInteresse, onCompartilhar }: {
  produto: ProdutoPublico
  onInteresse: () => void
  onCompartilhar: () => void
}) {
  const foto = p.fotos?.[0] ?? PLACEHOLDER
  const isVendido = !p.disponivel
  const specs = normalizeSpecs(p.specs).slice(0, 2)

  const stockBadge = isVendido
    ? { label: 'Sob encomenda', cls: styles.badgeSobEncomenda }
    : p.quantidade === 1
      ? { label: 'Última unidade', cls: styles.badgeUltima }
      : { label: 'Pronta entrega', cls: styles.badgeEstoque }

  const ctaLabel = isVendido && p.marca
    ? 'Consultar disponibilidade'
    : isVendido
      ? 'Solicitar encomenda'
      : p.exibir_preco && p.preco > 0
        ? 'Tenho interesse'
        : 'Solicitar orçamento'

  return (
    <div className={`${styles.card} ${isVendido ? styles.cardVendido : ''}`}>

      {/* Foto */}
      <div className={styles.cardFoto}>
        <img
          src={foto}
          alt={p.titulo}
          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
        />
        {/* Badge disponibilidade — topo esquerdo */}
        <span className={`${styles.badgeEstoqueLabel} ${stockBadge.cls}`}>
          {stockBadge.label}
        </span>
        {/* Badge marca — topo direito (só se tiver marca cadastrada) */}
        {p.marca && (
          <span className={styles.cardFotoMarca} style={getBrandColors(p.marca)}>
            {p.marca}
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className={styles.cardBody}>
        {/* Categoria + Seminovo */}
        <div className={styles.cardMetaRow}>
          {p.categoria && (
            <span className={styles.cardCategoria}>
              {p.categoria.replace(/^Equipamentos\s+(de\s+)?/i, '')}
            </span>
          )}
          {p.seminovo && <span className={styles.badgeSeminovo}>Seminovo</span>}
        </div>

        {/* Nome */}
        <h3 className={styles.cardTitulo}>{p.titulo}</h3>

        {/* Benefício / descrição curta */}
        {p.descricao && (
          <p className={styles.cardDesc}>{p.descricao}</p>
        )}

        {/* Preço */}
        {p.exibir_preco && p.preco > 0 && (
          <div className={styles.cardPreco}>
            {p.preco_original && p.preco_original > p.preco && (
              <span className={styles.cardPrecoOriginal}>
                R$ {p.preco_original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
            <span className={styles.cardPrecoValor}>
              R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Specs rápidos */}
        {specs.length > 0 && (
          <div className={styles.cardSpecs}>
            {specs.map(s => (
              <span key={s.k} className={styles.cardSpec}>
                <span className={styles.cardSpecKey}>{s.k}</span>
                <span className={styles.cardSpecVal}>{s.v}</span>
              </span>
            ))}
          </div>
        )}

        {/* Social proof */}
        {p.total_interesses > 0 && !isVendido && (
          <p className={styles.cardInteresse}>
            🔥 {p.total_interesses} {p.total_interesses === 1 ? 'pessoa interessada' : 'pessoas interessadas'}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className={styles.cardFooter}>
        <button className={styles.cardBtnPrimary} onClick={onInteresse}>
          {ctaLabel}
        </button>
        <button className={styles.cardBtnSecondary} onClick={onInteresse}>
          Ver detalhes
        </button>
        <button className={styles.cardShareBtn} onClick={onCompartilhar} type="button" title="Compartilhar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    </div>
  )
}
