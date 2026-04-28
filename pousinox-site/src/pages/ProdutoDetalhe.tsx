import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { supabase } from '../lib/supabase'
import type { ProdutoPublico } from '../lib/supabase'
import { useCart } from '../contexts/CartContext'
import { usePublicFlag } from '../hooks/useFeatureFlags'
import styles from './ProdutoDetalhe.module.css'

interface OpcaoFrete {
  servico: string
  codigo: string
  preco: number
  prazo: number
  prazo_texto?: string
  erro: string | null
}

function normalizeSpecs(specs: { k: string; v: string }[] | Record<string, string> | null): { k: string; v: string }[] {
  if (!specs) return []
  if (Array.isArray(specs)) return specs
  return Object.entries(specs).map(([k, v]) => ({ k, v }))
}

const PLACEHOLDER = 'https://placehold.co/800x600/e5e7eb/9ca3af?text=Foto+em+breve'

export default function ProdutoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addItem, setDrawerOpen } = useCart()
  const checkoutAtivo = usePublicFlag('checkout')

  const [produto, setProduto] = useState<ProdutoPublico | null>(null)
  const [relacionados, setRelacionados] = useState<ProdutoPublico[]>([])

  const [loading, setLoading] = useState(true)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 })

  // Frete
  const [cep, setCep] = useState('')
  const [qtd, setQtd] = useState(1)
  const [freteLoading, setFreteLoading] = useState(false)
  const [freteOpcoes, setFreteOpcoes] = useState<OpcaoFrete[]>([])
  const [freteErro, setFreteErro] = useState<string | null>(null)
  const [freteSel, setFreteSel] = useState(0)
  const [cidadeFrete, setCidadeFrete] = useState('')

  // Interesse
  const [form, setForm] = useState({ nome: '', whatsapp: '' })
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<'sucesso' | 'duplicado' | 'erro' | null>(null)

  const [addedToCart, setAddedToCart] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [_abaAtiva, _setAbaAtiva] = useState<'descricao' | 'specs'>('descricao')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFotoIdx(0)
      const { data } = await supabase.from('produtos_publicos').select('*').eq('id', id).single()
      setProduto(data)
      setLoading(false)

      // Buscar relacionados (mesma categoria, excluir atual)
      if (data?.categoria) {
        const { data: rel } = await supabase
          .from('produtos_publicos')
          .select('*')
          .eq('categoria', data.categoria)
          .neq('id', data.id)
          .eq('disponivel', true)
          .limit(4)
        setRelacionados(rel ?? [])
      }
    }
    load()
    window.scrollTo(0, 0)
  }, [id])

  const calcularFrete = useCallback(async (cepLimpo: string, quantidade: number) => {
    if (!produto || cepLimpo.length !== 8 || !produto.peso_kg) return
    setFreteLoading(true)
    setFreteErro(null)
    setFreteOpcoes([])
    setFreteSel(0)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (!data.erro) setCidadeFrete(`${data.localidade} — ${data.uf}`)
    } catch { /* */ }

    try {
      const pesoTotal = (produto.peso_kg ?? 0) * quantidade
      const altTotal = Math.min((produto.altura_cm || 10) * quantidade, 100)
      const { data, error } = await supabase.functions.invoke('calcular-frete', {
        body: {
          cep_destino: cepLimpo,
          peso_kg: pesoTotal,
          comprimento_cm: produto.comprimento_cm || 20,
          largura_cm: produto.largura_cm || 15,
          altura_cm: altTotal,
        },
      })
      if (error) throw error
      const validas = (data?.opcoes || []).filter((o: OpcaoFrete) => !o.erro)
      if (validas.length === 0) { setFreteErro('Sem opções de frete para este CEP'); return }
      setFreteOpcoes(validas)
    } catch {
      setFreteErro('Não foi possível calcular o frete.')
    } finally {
      setFreteLoading(false)
    }
  }, [produto])

  async function handleInteresse(e: React.FormEvent) {
    e.preventDefault()
    if (!produto) return
    setEnviando(true)
    setResultado(null)

    const { error } = await supabase.from('interesses').insert({
      produto_id: produto.id,
      produto_titulo: produto.titulo,
      cliente_nome: form.nome.trim(),
      cliente_whatsapp: form.whatsapp.trim(),
    })

    if (!error) {
      setResultado('sucesso')
      supabase.functions.invoke('dynamic-action', {
        body: {
          type: 'INSERT', table: 'interesses',
          record: {
            produto_id: produto.id,
            cliente_nome: form.nome.trim(),
            cliente_whatsapp: form.whatsapp.trim(),
            foto_url: produto.fotos?.[0] ?? null,
            produto_titulo: produto.titulo,
            produto_disponivel: produto.disponivel,
            produto_marca: produto.marca ?? null,
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

  async function compartilhar() {
    if (!produto) return
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
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  function addToCart() {
    if (!produto) return
    addItem({
      produtoId: Number(produto.id),
      titulo: produto.titulo,
      preco: produto.preco,
      quantidade: qtd,
      imagem: produto.fotos?.[0] ?? '',
      peso_kg: produto.peso_kg || 0,
      altura_cm: produto.altura_cm || 0,
      comprimento_cm: produto.comprimento_cm || 0,
      largura_cm: produto.largura_cm || 0,
    })
    setAddedToCart(true)
    setDrawerOpen(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.loadingSkeleton}>
        <div className={styles.skeletonImg} />
        <div className={styles.skeletonInfo}>
          <div className={styles.skeletonLine} style={{ width: '60%', height: 24 }} />
          <div className={styles.skeletonLine} style={{ width: '40%', height: 18 }} />
          <div className={styles.skeletonLine} style={{ width: '30%', height: 32 }} />
          <div className={styles.skeletonLine} style={{ width: '100%', height: 120 }} />
        </div>
      </div>
    </div>
  )

  if (!produto) return (
    <div className={styles.notFound}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <h2>Produto não encontrado</h2>
      <p>O produto que você procura não está mais disponível ou o link está incorreto.</p>
      <Link to="/pronta-entrega" className={styles.notFoundBtn}>← Voltar ao catálogo</Link>
    </div>
  )

  const fotos = produto.fotos?.length ? produto.fotos : [PLACEHOLDER]
  const specs = normalizeSpecs(produto.specs)
  const isSobEncomenda = !produto.disponivel
  const temFrete = produto.peso_kg && produto.peso_kg > 0
  const freteSelObj = freteOpcoes[freteSel]
  const subtotal = produto.preco * qtd
  const total = freteSelObj ? subtotal + freteSelObj.preco : subtotal
  const desconto = produto.preco_original && produto.preco_original > produto.preco
    ? Math.round((1 - produto.preco / produto.preco_original) * 100)
    : null
  const parcela6x = produto.preco > 0 ? produto.preco / 6 : 0

  const whatsappMsg = encodeURIComponent(
    `Olá, tenho interesse no produto: ${produto.titulo} (${window.location.href})`
  )

  return (
    <>
      <SEO
        title={`${produto.titulo} | Pousinox`}
        description={produto.descricao || `${produto.titulo} em aço inox — Pousinox, Pouso Alegre, MG.`}
        path={`/produto/${produto.id}`}
      />

      <div className={styles.page}>
        <div className="container">
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <Link to="/">Início</Link>
            <span className={styles.breadSep}>/</span>
            <Link to="/pronta-entrega">Pronta Entrega</Link>
            <span className={styles.breadSep}>/</span>
            {produto.categoria && (
              <>
                <Link to={`/pronta-entrega?cat=${encodeURIComponent(produto.categoria)}`}>{produto.categoria}</Link>
                <span className={styles.breadSep}>/</span>
              </>
            )}
            <span className={styles.breadCurrent}>{produto.titulo}</span>
          </nav>

          <div className={styles.layout}>
            {/* ═══ COLUNA ESQUERDA — GALERIA ═══ */}
            <div className={styles.galeria}>
              {/* Thumbnails verticais */}
              {fotos.length > 1 && (
                <div className={styles.thumbsVertical}>
                  {fotos.map((f, i) => (
                    <button
                      key={i}
                      className={`${styles.thumbV} ${i === fotoIdx ? styles.thumbVActive : ''}`}
                      onClick={() => setFotoIdx(i)}
                    >
                      <img src={f} alt={`Foto ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
              <div
                className={styles.fotoMain}
                onMouseEnter={() => setZoom(true)}
                onMouseLeave={() => setZoom(false)}
                onMouseMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setZoomPos({
                    x: ((e.clientX - rect.left) / rect.width) * 100,
                    y: ((e.clientY - rect.top) / rect.height) * 100,
                  })
                }}
              >
                <img
                  src={fotos[fotoIdx]}
                  alt={produto.titulo}
                  className={zoom ? styles.fotoZoomed : ''}
                  style={zoom ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
                />
                {/* Badges na foto */}
                <div className={styles.fotoBadges}>
                  {produto.marca && <span className={styles.badgeMarca}>{produto.marca}</span>}
                  {produto.seminovo && <span className={styles.badgeSeminovo}>Seminovo</span>}
                  {desconto && <span className={styles.badgeDesconto}>-{desconto}%</span>}
                </div>
                <span className={isSobEncomenda ? styles.badgeSobEncomenda : styles.badgePronta}>
                  {isSobEncomenda ? 'Sob encomenda' : 'Pronta Entrega'}
                </span>
              </div>


            </div>

            {/* ═══ COLUNA DIREITA — INFO ═══ */}
            <div className={styles.info}>
              {/* Meta */}
              <div className={styles.metaRow}>
                {produto.categoria && <span className={styles.categoria}>{produto.categoria}</span>}
                {produto.marca && <span className={styles.marcaTag}>{produto.marca}</span>}
                <button className={styles.shareBtn} onClick={compartilhar} type="button" title="Compartilhar">
                  {copiado ? (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
                  ) : (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Compartilhar</>
                  )}
                </button>
              </div>

              {/* Título + Subtítulo */}
              <h1 className={styles.titulo}>{produto.titulo}</h1>
              {(produto.fabricante || produto.marca) && (
                <p className={styles.subtitulo}>
                  {produto.fabricante
                    ? `Fabricado por ${produto.fabricante}`
                    : `Vendido por POUSINOX® | Marca: ${produto.marca}`}
                </p>
              )}

              {/* Social proof */}
              {produto.total_interesses > 0 && (
                <div className={styles.socialProof}>
                  <span className={styles.socialIcon}>🔥</span>
                  <span>{produto.total_interesses} {produto.total_interesses === 1 ? 'pessoa interessada' : 'pessoas interessadas'}</span>
                </div>
              )}

              {/* Preço */}
              {produto.exibir_preco && produto.preco > 0 && (
                <div className={styles.precoBox}>
                  {produto.preco_original && produto.preco_original > produto.preco && (
                    <div className={styles.precoOriginalRow}>
                      <span className={styles.precoOriginal}>R$ {fmtBRL(produto.preco_original)}</span>
                      {desconto && <span className={styles.descontoBadge}>-{desconto}%</span>}
                    </div>
                  )}
                  <span className={styles.preco}>R$ {fmtBRL(produto.preco)}</span>
                  {produto.preco >= 100 && (
                    <span className={styles.parcelas}>
                      ou 6× de R$ {fmtBRL(parcela6x)} sem juros
                    </span>
                  )}
                  <span className={styles.pixDesconto}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    R$ {fmtBRL(produto.preco * 0.95)} no Pix (5% off)
                  </span>
                </div>
              )}

              {/* Quantidade + Botões */}
              {produto.exibir_preco && produto.preco > 0 && produto.disponivel && (
                <>
                  <div className={styles.qtdRow}>
                    <span className={styles.qtdLabel}>Quantidade:</span>
                    <div className={styles.qtdControls}>
                      <button className={styles.qtdBtn} onClick={() => setQtd(q => Math.max(1, q - 1))}>−</button>
                      <span className={styles.qtdVal}>{qtd}</span>
                      <button className={styles.qtdBtn} onClick={() => setQtd(q => Math.min(99, q + 1))}>+</button>
                    </div>
                    {produto.quantidade && produto.quantidade <= 3 && (
                      <span className={styles.estoqueAviso}>
                        {produto.quantidade === 1 ? 'Última unidade!' : `Apenas ${produto.quantidade} em estoque`}
                      </span>
                    )}
                  </div>
                  {checkoutAtivo && (
                    <div className={styles.botoesCompra}>
                      <button className={styles.btnComprar} onClick={() => { addToCart(); navigate('/checkout') }}>
                        Comprar agora
                      </button>
                      <button className={styles.btnCarrinho} onClick={addToCart}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                        </svg>
                        {addedToCart ? 'Adicionado!' : 'Adicionar ao carrinho'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Form interesse — sem preço ou sob encomenda */}
              {(!produto.exibir_preco || !produto.disponivel) && (
                <div className={styles.interesseBox}>
                  {resultado === 'sucesso' ? (
                    <div className={styles.sucesso}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <h3>Interesse registrado!</h3>
                      <p>Enviamos o preço e os detalhes para o seu WhatsApp em instantes.</p>
                    </div>
                  ) : (
                    <>
                      <h3 className={styles.interesseTitulo}>
                        {isSobEncomenda ? 'Solicitar encomenda' : 'Ver preço no WhatsApp'}
                      </h3>
                      <form onSubmit={handleInteresse} className={styles.interesseForm}>
                        <input type="text" placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                        <input type="tel" placeholder="(35) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} required />
                        {resultado === 'duplicado' && <p className={styles.erroMsg}>Você já demonstrou interesse neste produto.</p>}
                        {resultado === 'erro' && <p className={styles.erroMsg}>Erro ao registrar. Tente novamente.</p>}
                        <button type="submit" disabled={enviando} className={styles.interesseBtn}>
                          {enviando ? 'Enviando...' : isSobEncomenda ? 'Solicitar encomenda' : 'Ver preço no WhatsApp'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}

              {/* Frete */}
              {temFrete && (
                <div className={styles.freteBox}>
                  <div className={styles.freteHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    <span>Calcular frete e prazo</span>
                  </div>
                  <div className={styles.freteInputRow}>
                    <input
                      type="text" placeholder="Digite seu CEP" value={cep} maxLength={9}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                        const mask = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v
                        setCep(mask)
                        setCidadeFrete('')
                        setFreteOpcoes([])
                        setFreteErro(null)
                        if (v.length === 8) calcularFrete(v, qtd)
                      }}
                      className={styles.freteInput}
                    />
                    <button
                      className={styles.freteBtn}
                      onClick={() => calcularFrete(cep.replace(/\D/g, ''), qtd)}
                      disabled={freteLoading}
                    >
                      {freteLoading ? 'Calculando...' : 'Calcular'}
                    </button>
                  </div>
                  <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className={styles.freteLinkCep}>
                    Não sei meu CEP
                  </a>
                  {cidadeFrete && <span className={styles.freteCidade}>{cidadeFrete}</span>}
                  {freteErro && <span className={styles.freteErroMsg}>{freteErro}</span>}
                  {freteOpcoes.length > 0 && (
                    <div className={styles.freteOpcoes}>
                      {freteOpcoes.map((op, i) => (
                        <div key={op.codigo} className={`${styles.freteOpcao} ${i === freteSel ? styles.freteOpcaoSel : ''}`}
                          onClick={() => setFreteSel(i)} style={{ cursor: 'pointer' }}>
                          <div className={styles.freteOpcaoInfo}>
                            <span className={styles.freteServico}>{op.servico}</span>
                            <span className={styles.fretePrazo}>{op.prazo_texto ?? `${op.prazo} ${op.prazo !== 1 ? 'dias úteis' : 'dia útil'}`}</span>
                          </div>
                          <span className={styles.fretePreco}>
                            {op.preco === 0 ? 'Grátis' : `R$ ${fmtBRL(op.preco)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {produto.exibir_preco && produto.preco > 0 && freteOpcoes.length > 0 && (
                    <div className={styles.resumo}>
                      <div className={styles.resumoLine}>
                        <span>Produtos ({qtd}×)</span>
                        <span>R$ {fmtBRL(subtotal)}</span>
                      </div>
                      <div className={styles.resumoLine}>
                        <span>Frete ({freteOpcoes[freteSel]?.servico})</span>
                        <span>{freteSelObj?.preco === 0 ? 'Grátis' : `R$ ${fmtBRL(freteSelObj?.preco ?? 0)}`}</span>
                      </div>
                      <div className={`${styles.resumoLine} ${styles.resumoTotal}`}>
                        <span>Total</span>
                        <span>R$ {fmtBRL(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Retire na loja */}
              <div className={styles.retiradaBox}>
                <div className={styles.retiradaHeader}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div>
                    <strong>Retire na fábrica — Grátis</strong>
                    <span className={styles.retiradaEnd}>Av. Antonio Mariosa, 4545 — Pouso Alegre, MG</span>
                  </div>
                </div>
                <div className={styles.retiradaHorarios}>
                  <span>Seg–Qui: 7h30–11h30 / 13h15–18h</span>
                  <span>Sex: 7h30–11h30 / 13h15–17h</span>
                </div>
                <iframe
                  className={styles.mapaEmbed}
                  src="https://maps.google.com/maps?q=Av.+Antonio+Mariosa,+4545+Pouso+Alegre+MG+Brasil&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização Pousinox"
                />
              </div>

              {/* Trust badges */}
              <div className={styles.trustBadges}>
                <div className={styles.trustBadge}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <div>
                    <strong>Compra segura</strong>
                    <span>Pix ou transferência</span>
                  </div>
                </div>
                <div className={styles.trustBadge}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <div>
                    <strong>Aço inox profissional</strong>
                    <span>Qualidade garantida</span>
                  </div>
                </div>
                <div className={styles.trustBadge}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <div>
                    <strong>Envio nacional</strong>
                    <span>Correios e transportadora</span>
                  </div>
                </div>
                <div className={styles.trustBadge}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
                  <div>
                    <strong>Padrão e sob medida</strong>
                    <span>Projetos personalizados</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ═══ DESCRIÇÃO — FULL WIDTH ═══ */}
          <section className={styles.descricaoSection}>
            <h2 className={styles.sectionTitulo}>Descrição</h2>
            <div className={styles.descricaoContent}>
              {produto.descricao ? (
                <p>{produto.descricao}</p>
              ) : (
                <p className={styles.descVazia}>Descrição detalhada em breve.</p>
              )}
              {produto.marca && (
                <p className={styles.descMarca}>Produto {produto.fabricante ? `fabricado por ${produto.fabricante}` : `da marca ${produto.marca}`}, comercializado pela POUSINOX®.</p>
              )}
            </div>
          </section>

          {/* ═══ ESPECIFICAÇÕES — FULL WIDTH ═══ */}
          {specs.length > 0 && (
            <section className={styles.specsSection}>
              <h2 className={styles.sectionTitulo}>Especificações técnicas</h2>
              <div className={styles.specsTable}>
                {specs.map(({ k, v }) => (
                  <div key={k} className={styles.specRow}>
                    <span className={styles.specKey}>{k}</span>
                    <span className={styles.specVal}>{v}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ PRODUTOS RELACIONADOS ═══ */}
          {relacionados.length > 0 && (
            <section className={styles.relacionados}>
              <h2 className={styles.relacionadosTitulo}>Produtos relacionados</h2>
              <div className={styles.relacionadosGrid}>
                {relacionados.map(r => (
                  <Link key={r.id} to={`/produto/${r.id}`} className={styles.relCard}>
                    <div className={styles.relFoto}>
                      <img src={r.fotos?.[0] ?? PLACEHOLDER} alt={r.titulo} onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER }} />
                    </div>
                    <div className={styles.relInfo}>
                      <span className={styles.relTitulo}>{r.titulo}</span>
                      {r.exibir_preco && r.preco > 0 && (
                        <span className={styles.relPreco}>R$ {fmtBRL(r.preco)}</span>
                      )}
                      <span className={styles.relCta}>Ver produto →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* WhatsApp flutuante */}
      <a
        href={`https://wa.me/553534238994?text=${whatsappMsg}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.whatsappFloat}
        title="Falar no WhatsApp"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      </a>
    </>
  )
}
