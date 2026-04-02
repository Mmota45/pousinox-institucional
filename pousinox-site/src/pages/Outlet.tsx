import { useState, useEffect } from 'react'
import SEO from '../components/SEO/SEO'
import { supabase } from '../lib/supabase'
import type { ProdutoPublico } from '../lib/supabase'
import styles from './Outlet.module.css'
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
  const [form, setForm] = useState({ nome: '', whatsapp: '' })
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<'sucesso' | 'duplicado' | 'erro' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')

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

  const catalogoFiltrado = catalogo.filter(p =>
    categoriaFiltro === 'Todos' || p.categoria === categoriaFiltro
  )

  // Destaques para o hero — todos os produtos disponíveis marcados como destaque (inclui representação)
  const heroDestaques = [...produtos.filter(p => p.destaque && p.disponivel)].sort(byPrecoDesc)


  async function handleInteresse(e: React.FormEvent) {
    e.preventDefault()
    if (!selecionado) return
    setEnviando(true)
    setResultado(null)

    const { error } = await supabase.from('interesses').insert({
      produto_id: selecionado.id,
      cliente_nome: form.nome.trim(),
      cliente_whatsapp: form.whatsapp.trim(),
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

  function abrirModal(p: ProdutoPublico) {
    setSelecionado(p)
    setForm({ nome: '', whatsapp: '' })
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
              <h1 className={styles.heroTitle}>Equipamentos Inox — Pronta Entrega</h1>
              <a href="#catalogo" className={styles.heroCta}>
                Ver todos os produtos
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
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
          <h2 className={styles.catalogoH2}>Catálogo</h2>

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
                  {cat === 'Todos' ? 'Todos' : cat.replace(/^Equipamentos\s+(de\s+)?/i, '')}
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
                      <h3 className={styles.formTitle}>{isSobEncomenda ? 'Solicitar encomenda' : 'Tenho Interesse'}</h3>
                      <form onSubmit={handleInteresse} className={styles.form}>
                        <div className={styles.formRow}>
                          <input id="nome" type="text" placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                          <input id="whatsapp" type="tel" placeholder="(35) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} required />
                        </div>
                        {resultado === 'duplicado' && <p className={styles.erroMsg}>Você já demonstrou interesse neste produto. Verifique seu WhatsApp!</p>}
                        {resultado === 'erro' && <p className={styles.erroMsg}>Erro ao registrar. Tente novamente.</p>}
                        <button type="submit" className={styles.submitBtn} disabled={enviando}>
                          {enviando ? 'Enviando...' : isSobEncomenda ? 'Solicitar encomenda' : 'Ver preço no WhatsApp'}
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
  const badgeEstoque = isVendido
    ? { label: 'Sob encomenda', className: styles.badgeSobEncomenda }
    : p.quantidade === 1
      ? { label: 'Última unidade', className: styles.badgeUltima }
      : { label: 'Em estoque', className: styles.badgeEstoque }

  return (
    <div className={styles.card}>
      <div className={styles.cardFoto}>
        <img
          src={foto}
          alt={p.titulo}
          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
        />
        <span className={`${styles.badgeEstoqueLabel} ${badgeEstoque.className}`}>
          {badgeEstoque.label}
        </span>
      </div>
      <div className={styles.cardBadgesBar}>
        {(p.marca || !p.seminovo) && (
          <span className={styles.badgeMarca} style={getBrandColors(p.marca)}>{p.marca ?? 'Pousinox®'}</span>
        )}
        {p.seminovo && !isVendido && <span className={styles.badgeSeminovo}>Seminovo</span>}
      </div>
      <div className={styles.cardBody}>
        {p.categoria && (
          <div>
            <span className={styles.cardCategoria}>{p.categoria.replace(/^Equipamentos\s+(de\s+)?/i, '')}</span>
          </div>
        )}
        <h3 className={styles.cardTitulo}>{p.titulo}</h3>
        {p.total_interesses > 0 && !isVendido && (
          <p className={styles.cardInteresse}>
            🔥 {p.total_interesses} {p.total_interesses === 1 ? 'pessoa interessada' : 'pessoas interessadas'}
          </p>
        )}
        <div className={styles.cardFooter}>
          <button className={styles.cardShareBtn} onClick={onCompartilhar} type="button" title="Compartilhar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartilhar
          </button>
          <button className={styles.cardBtn} onClick={onInteresse}>
            {isVendido && p.marca ? 'Consultar →' : isVendido ? 'Solicitar encomenda →' : 'Ver preço →'}
          </button>
        </div>
      </div>
    </div>
  )
}
