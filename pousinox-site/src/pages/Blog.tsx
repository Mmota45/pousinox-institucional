import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import styles from './Blog.module.css'
import { supabase } from '../lib/supabase'
import CTABlog from '../components/CTABlog/CTABlog'
import { renderArticleContent, renderResumo } from '../lib/articleParser'

interface Artigo {
  id: number
  slug: string
  titulo: string
  subtitulo?: string | null
  categoria: string
  resumo: string
  conteudo: string
  tempo_leitura: string
  data_publicacao: string
  meta_descricao: string
  palavras_chave: string[]
  imagem_destaque: string
  video_url: string
  tipo_post?: string | null
  origem_oferta?: string | null
  cta_tipo?: string | null
  fabricante_parceiro?: string | null
  produto_relacionado_id?: string | null
}

const TIPO_POST_LABEL: Record<string, string> = {
  solucao: 'Solução',
  guia: 'Guia',
  aplicacao: 'Aplicação',
  institucional: 'Institucional',
}


export default function Blog() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const [artigos, setArtigos] = useState<Artigo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [email, setEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    supabase
      .from('artigos')
      .select('*')
      .eq('publicado', true)
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        setArtigos(data ?? [])
        setCarregando(false)
      })
  }, [])

  const allCategories = ['Todos', ...Array.from(new Set(artigos.map(a => a.categoria)))]

  async function compartilharPost(artigo: Artigo) {
    const url = `https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/og-artigo?slug=${artigo.slug}`
    const text = `${artigo.titulo} — ${artigo.resumo}`
    if (navigator.share) {
      await navigator.share({ title: artigo.titulo, text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
    }
  }

  const selectedPost = slug ? (artigos.find(a => a.slug === slug) ?? null) : null

  const filtered = activeCategory === 'Todos'
    ? artigos
    : artigos.filter(a => a.categoria === activeCategory)

  async function handleNewsletter(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setNewsletterStatus('sending')
    try {
      const resp = await fetch('https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/notificar-contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: 'Newsletter',
          email,
          mensagem: 'Cadastro na newsletter do blog',
          origem: 'newsletter',
        }),
      })
      if (!resp.ok) throw new Error('Erro ao cadastrar')
      setNewsletterStatus('sent')
      setEmail('')
    } catch {
      setNewsletterStatus('error')
    }
  }

  if (carregando) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className="container">
            <h1 className={styles.pageTitle}>Blog POUSINOX®</h1>
            <p className={styles.pageSubtitle}>Projetos entregues, bastidores da fábrica e conteúdo técnico por segmento.</p>
          </div>
        </div>
        <div className="container" style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b' }}>
          <p>Carregando artigos…</p>
        </div>
      </div>
    )
  }

  if (selectedPost) {
    return (
      <div className={styles.page}>
        <SEO
          title={selectedPost.titulo}
          description={selectedPost.meta_descricao || selectedPost.resumo}
          path={`/blog/${selectedPost.slug}`}
        />
        <div className={styles.pageHeader}>
          <div className="container">
            <h1 className={styles.pageTitle}>Blog POUSINOX®</h1>
            <p className={styles.pageSubtitle}>
              Projetos entregues, bastidores da fábrica e conteúdo técnico por segmento.
            </p>
          </div>
        </div>

        <div className="container">
          <div className={styles.articleWrapper}>
            <Link to="/blog" className={styles.backBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 5 5 12 12 19"/>
              </svg>
              Voltar ao blog
            </Link>

            <div className={styles.articleMeta}>
              <span className={styles.postCategory}>{selectedPost.categoria}</span>
              <span className={styles.postDate}>{selectedPost.data_publicacao}</span>
              <span className={styles.postReadTime}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {selectedPost.tempo_leitura} de leitura
              </span>
            </div>

            <h1 className={styles.articleTitle}>{selectedPost.titulo}</h1>

            {selectedPost.subtitulo && (
              <p className={styles.articleSubtitulo}>{selectedPost.subtitulo}</p>
            )}

            <div className={styles.shareRow}>
              {selectedPost.tipo_post && TIPO_POST_LABEL[selectedPost.tipo_post] && (
                <span className={styles.tipoPostBadge}>{TIPO_POST_LABEL[selectedPost.tipo_post]}</span>
              )}
              <button
                className={styles.shareBtn}
                onClick={() => compartilharPost(selectedPost)}
                type="button"
                title="Compartilhar artigo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Compartilhar
              </button>
            </div>

            {selectedPost.imagem_destaque && (
              <div className={styles.articleHeroImage}>
                <img
                  src={selectedPost.imagem_destaque}
                  alt={selectedPost.titulo}
                />
              </div>
            )}

            {selectedPost.resumo && (
              <div className={styles.resumoBox}>
                <div className={styles.resumoLabel}>✦ Resumo rápido</div>
                {renderResumo(selectedPost.resumo)}
              </div>
            )}

            <div className={styles.articleBody}>
              {renderArticleContent(selectedPost.conteudo)}
            </div>

            <CTABlog
              ctaTipo={(selectedPost.cta_tipo as 'pronta_entrega'|'orcamento'|'parceiro'|'nenhum') ?? 'orcamento'}
              origemOferta={selectedPost.origem_oferta}
              produtoRelacionadoId={selectedPost.produto_relacionado_id}
              fabricanteParceiro={selectedPost.fabricante_parceiro}
              tituloPost={selectedPost.titulo}
            />

            {selectedPost.video_url && (
              <div style={{ margin: '2rem 0', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' }}>
                <iframe
                  src={selectedPost.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                  title={selectedPost.titulo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            )}
          </div>

          <div className={styles.ctaBlock}>
            <div className={styles.newsletterContent}>
              <h3>Receba novidades da POUSINOX®</h3>
              <p>Dicas de manutenção, tendências do setor e informações sobre nossos produtos no seu e-mail.</p>
            </div>
            <form className={styles.newsletterForm} onSubmit={handleNewsletter}>
              <input
                type="email"
                placeholder="seu@email.com.br"
                className={styles.newsletterInput}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={newsletterStatus === 'sending' || newsletterStatus === 'sent'}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={newsletterStatus === 'sending' || newsletterStatus === 'sent'}
              >
                {newsletterStatus === 'sending' ? 'Enviando…' : newsletterStatus === 'sent' ? 'Cadastrado!' : 'Cadastrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SEO
        title="Blog — Equipamentos em Inox | POUSINOX® Pouso Alegre, MG"
        description="Artigos técnicos sobre equipamentos em inox, corte a laser e projetos sob medida em Pouso Alegre e Sul de Minas Gerais. Conteúdo para restaurantes, hospitais, arquitetura e indústria."
        path="/blog"
      />
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>Blog POUSINOX®</h1>
          <p className={styles.pageSubtitle}>
            Projetos entregues, bastidores da fábrica e conteúdo técnico por segmento.
          </p>
        </div>
      </div>

      <div className="container">
        <div className={styles.filters}>
          {allCategories.map(cat => (
            <button
              key={cat}
              className={`${styles.filterBtn} ${activeCategory === cat ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.postsGrid}>
          {filtered.map(artigo => (
            <article key={artigo.id} className={styles.postCard}>
              <div className={styles.postMeta}>
                <span className={styles.postCategory}>{artigo.categoria}</span>
                <span className={styles.postDate}>{artigo.data_publicacao}</span>
              </div>
              <h2 className={styles.postTitle}>{artigo.titulo}</h2>
              <p className={styles.postExcerpt}>{artigo.resumo}</p>
              <div className={styles.postFooter}>
                <span className={styles.postReadTime}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {artigo.tempo_leitura} de leitura
                </span>
                <div className={styles.postActions}>
                  <button className={styles.shareBtn} onClick={() => compartilharPost(artigo)} type="button" title="Compartilhar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  </button>
                  <button className={styles.postLink} onClick={() => navigate(`/blog/${artigo.slug}`)}>
                    Ler artigo
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.newsletter}>
          <div className={styles.newsletterContent}>
            <h3>Receba novidades da POUSINOX®</h3>
            <p>Dicas de manutenção, tendências do setor e informações sobre nossos produtos no seu e-mail.</p>
          </div>
          <form className={styles.newsletterForm} onSubmit={handleNewsletter}>
            <input
              type="email"
              placeholder="seu@email.com.br"
              className={styles.newsletterInput}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={newsletterStatus === 'sending' || newsletterStatus === 'sent'}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={newsletterStatus === 'sending' || newsletterStatus === 'sent'}
            >
              {newsletterStatus === 'sending' ? 'Enviando…' : newsletterStatus === 'sent' ? 'Cadastrado!' : 'Cadastrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
