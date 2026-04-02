import { useState } from 'react'
import styles from './AdminConteudo.module.css'
import { supabaseAdmin } from '../lib/supabase'

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/gerar-conteudo'

const CATEGORIAS = [
  'Restaurantes e Food Service',
  'Hospitalar e Clínicas',
  'Arquitetura e Projetos Residenciais',
  'Construção Civil',
  'Nossa Fábrica',
  'Projetos Entregues',
  'Corte a Laser',
  'Panificação e Confeitaria',
  'Hotelaria',
  'Indústria',
]

function gerarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

const REDES = [
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'whatsapp',  label: 'WhatsApp' },
  { id: 'email',     label: 'E-mail' },
  { id: 'youtube',   label: 'YouTube' },
  { id: 'blog',      label: 'Blog' },
]

const TONS = [
  { id: 'informativo',  label: 'Informativo' },
  { id: 'promocional',  label: 'Promocional' },
  { id: 'urgente',      label: 'Urgência' },
  { id: 'educativo',    label: 'Educativo' },
]

const TAMANHOS = [
  { id: 'curto',  label: 'Curto',  desc: '~300 palavras' },
  { id: 'medio',  label: 'Médio',  desc: '~600 palavras' },
  { id: 'longo',  label: 'Longo',  desc: '~1000 palavras' },
]

interface Resultado {
  linkedin?: string
  instagram?: string
  facebook?: string
  whatsapp?: string
  email_assunto?: string
  email_corpo?: string
  youtube_titulo?: string
  youtube_desc?: string
  blog_titulo?: string
  blog_meta_desc?: string
  blog_palavras_chave?: string[]
  blog_intro?: string
  blog_corpo?: string
  blog_cta?: string
}

export default function AdminConteudo() {
  const [tema, setTema] = useState('')
  const [redes, setRedes] = useState<string[]>(['linkedin', 'whatsapp'])
  const [tom, setTom] = useState('informativo')
  const [tamanho, setTamanho] = useState('medio')
  const [gerando, setGerando] = useState(false)
  const [fase, setFase] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [publicando, setPublicando] = useState(false)
  const [publicado, setPublicado] = useState(false)
  const [erroPublicar, setErroPublicar] = useState('')
  const [categoriaArtigo, setCategoriaArtigo] = useState('Restaurantes e Food Service')
  const [imagemDestaque, setImagemDestaque] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [preview, setPreview] = useState(false)

  function toggleRede(id: string) {
    setRedes(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id])
  }

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function gerar() {
    if (!tema.trim() || redes.length === 0) return
    setGerando(true)
    setResultado(null)
    setErro('')
    setFase('Gerando conteúdo para as redes selecionadas…')

    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tema, redes, tom, tamanho }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = errBody?.error ?? `HTTP ${res.status}`
        throw new Error(msg)
      }

      const resultado = await res.json()
      setResultado(resultado)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      console.error(e)
      setErro(`Erro ao gerar conteúdo: ${msg}`)
    }

    setGerando(false)
    setFase('')
    setPublicado(false)
    setErroPublicar('')
  }

  async function publicarNoBlog() {
    if (!resultado?.blog_titulo || !resultado?.blog_corpo) return
    setPublicando(true)
    setErroPublicar('')

    const hoje = new Date()
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const dataFormatada = `${hoje.getDate()} ${meses[hoje.getMonth()]} ${hoje.getFullYear()}`
    const conteudo = [resultado.blog_intro, resultado.blog_corpo, resultado.blog_cta].filter(Boolean).join('\n\n')
    const palavras = conteudo.split(/\s+/).length
    const minutos = Math.max(1, Math.round(palavras / 200))

    const { error } = await supabaseAdmin.from('artigos').insert({
      slug: gerarSlug(resultado.blog_titulo),
      titulo: resultado.blog_titulo,
      categoria: categoriaArtigo,
      resumo: resultado.blog_meta_desc || resultado.blog_intro || '',
      conteudo,
      tempo_leitura: `${minutos} min`,
      meta_descricao: resultado.blog_meta_desc || '',
      palavras_chave: resultado.blog_palavras_chave || [],
      data_publicacao: dataFormatada,
      publicado: true,
      imagem_destaque: imagemDestaque.trim(),
      video_url: videoUrl.trim(),
    })

    if (error) {
      setErroPublicar(error.message.includes('duplicate') ? 'Já existe um artigo com esse título.' : error.message)
    } else {
      setPublicado(true)
    }
    setPublicando(false)
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.titulo}>Gerador de Conteúdo</h1>
      <p className={styles.sub}>A IA pesquisa tendências em tempo real e cria textos prontos para cada rede.</p>

      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>Tema ou produto</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="Ex: Balcão refrigerado novo em estoque, dicas de higienização de inox, lançamento do CleanBoot Pro…"
            value={tema}
            onChange={e => setTema(e.target.value)}
          />
        </div>

        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>Redes sociais</label>
            <div className={styles.chips}>
              {REDES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={`${styles.chip} ${redes.includes(r.id) ? styles.chipAtivo : ''}`}
                  onClick={() => toggleRede(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tom</label>
            <div className={styles.chips}>
              {TONS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.chip} ${tom === t.id ? styles.chipAtivo : ''}`}
                  onClick={() => setTom(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Tamanho do artigo (Blog)</label>
          <div className={styles.chips}>
            {TAMANHOS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`${styles.chip} ${tamanho === t.id ? styles.chipAtivo : ''}`}
                onClick={() => setTamanho(t.id)}
              >
                {t.label} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className={styles.btnGerar}
          onClick={gerar}
          disabled={gerando || !tema.trim() || redes.length === 0}
        >
          {gerando ? (
            <><span className={styles.spinner} />{fase || 'Gerando…'}</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Gerar conteúdo
            </>
          )}
        </button>

        {erro && <p className={styles.erro}>{erro}</p>}
      </div>

      {resultado && (
        <div className={styles.resultados}>
          {resultado.linkedin && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>LinkedIn</span>
                <button className={styles.btnCopiar} onClick={() => copiar(resultado.linkedin!, 'linkedin')}>
                  {copiado === 'linkedin' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className={styles.texto}>{resultado.linkedin}</pre>
            </div>
          )}

          {resultado.instagram && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>Instagram</span>
                <button className={styles.btnCopiar} onClick={() => copiar(resultado.instagram!, 'instagram')}>
                  {copiado === 'instagram' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className={styles.texto}>{resultado.instagram}</pre>
            </div>
          )}

          {resultado.facebook && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>Facebook</span>
                <button className={styles.btnCopiar} onClick={() => copiar(resultado.facebook!, 'facebook')}>
                  {copiado === 'facebook' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className={styles.texto}>{resultado.facebook}</pre>
            </div>
          )}

          {resultado.whatsapp && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>WhatsApp</span>
                <button className={styles.btnCopiar} onClick={() => copiar(resultado.whatsapp!, 'whatsapp')}>
                  {copiado === 'whatsapp' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className={styles.texto}>{resultado.whatsapp}</pre>
            </div>
          )}

          {(resultado.email_assunto || resultado.email_corpo) && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>E-mail</span>
                <button className={styles.btnCopiar} onClick={() => copiar(`Assunto: ${resultado.email_assunto}\n\n${resultado.email_corpo}`, 'email')}>
                  {copiado === 'email' ? '✓ Copiado' : 'Copiar tudo'}
                </button>
              </div>
              {resultado.email_assunto && (
                <div className={styles.emailAssunto}>
                  <span className={styles.emailLabel}>Assunto:</span> {resultado.email_assunto}
                </div>
              )}
              {resultado.email_corpo && <pre className={styles.texto}>{resultado.email_corpo}</pre>}
            </div>
          )}

          {(resultado.youtube_titulo || resultado.youtube_desc) && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>YouTube</span>
                <button className={styles.btnCopiar} onClick={() => copiar(`Título: ${resultado.youtube_titulo}\n\n${resultado.youtube_desc}`, 'youtube')}>
                  {copiado === 'youtube' ? '✓ Copiado' : 'Copiar tudo'}
                </button>
              </div>
              {resultado.youtube_titulo && (
                <div className={styles.emailAssunto}>
                  <span className={styles.emailLabel}>Título:</span> {resultado.youtube_titulo}
                </div>
              )}
              {resultado.youtube_desc && <pre className={styles.texto}>{resultado.youtube_desc}</pre>}
            </div>
          )}

          {(resultado.blog_titulo || resultado.blog_corpo) && (
            <div className={styles.bloco}>
              <div className={styles.blocoHeader}>
                <span className={styles.blocoLabel}>Blog</span>
                <button className={styles.btnCopiar} onClick={() => copiar(
                  `# ${resultado.blog_titulo}\n\nMeta description: ${resultado.blog_meta_desc}\n\nPalavras-chave: ${(resultado.blog_palavras_chave ?? []).join(', ')}\n\n${resultado.blog_intro}\n\n${resultado.blog_corpo}\n\n${resultado.blog_cta}`,
                  'blog'
                )}>
                  {copiado === 'blog' ? '✓ Copiado' : 'Copiar artigo'}
                </button>
              </div>
              {resultado.blog_titulo && (
                <div className={styles.emailAssunto}>
                  <span className={styles.emailLabel}>Título SEO:</span> {resultado.blog_titulo}
                </div>
              )}
              <div className={styles.emailAssunto} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={styles.emailLabel}>Categoria:</span>
                <select
                  value={categoriaArtigo}
                  onChange={e => setCategoriaArtigo(e.target.value)}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.875rem', color: '#334155' }}
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {resultado.blog_meta_desc && (
                <div className={styles.emailAssunto}>
                  <span className={styles.emailLabel}>Meta description:</span> {resultado.blog_meta_desc}
                </div>
              )}
              {resultado.blog_palavras_chave && resultado.blog_palavras_chave.length > 0 && (
                <div className={styles.emailAssunto}>
                  <span className={styles.emailLabel}>Palavras-chave:</span>{' '}
                  {resultado.blog_palavras_chave.join(' · ')}
                </div>
              )}
              {resultado.blog_intro && (
                <div className={styles.emailAssunto} style={{ borderBottom: 'none' }}>
                  <span className={styles.emailLabel}>Intro:</span> {resultado.blog_intro}
                </div>
              )}
              {resultado.blog_corpo && <pre className={styles.texto}>{resultado.blog_corpo}</pre>}
              {resultado.blog_cta && (
                <div className={styles.emailAssunto} style={{ borderTop: '1px solid #f1f5f9', borderBottom: 'none' }}>
                  <span className={styles.emailLabel}>CTA:</span> {resultado.blog_cta}
                </div>
              )}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Imagem de destaque (URL) — opcional
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (foto da fábrica ou projeto entregue)"
                    value={imagemDestaque}
                    onChange={e => setImagemDestaque(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }}
                  />
                  {imagemDestaque.trim() && (
                    <img
                      src={imagemDestaque.trim()}
                      alt="Pré-visualização"
                      onError={e => (e.currentTarget.style.display = 'none')}
                      onLoad={e => (e.currentTarget.style.display = 'block')}
                      style={{ display: 'none', width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginTop: '0.5rem', border: '1px solid #e2e8f0' }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Vídeo YouTube (URL) — opcional
                  </label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }}
                  />
                  {videoUrl.trim() && (() => {
                    const embedUrl = videoUrl.trim().replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')
                    return (
                      <div style={{ marginTop: '0.5rem', borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/9' }}>
                        <iframe
                          src={embedUrl}
                          title="Pré-visualização do vídeo"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setPreview(true)}
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', color: '#334155', cursor: 'pointer', fontWeight: 500 }}
                  >
                    👁 Pré-visualizar artigo
                  </button>
                  {publicado ? (
                    <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>✓ Artigo publicado no blog com sucesso!</p>
                  ) : (
                    <button
                      className={styles.btnGerar}
                      onClick={publicarNoBlog}
                      disabled={publicando}
                      style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      {publicando ? 'Publicando…' : 'Publicar no Blog'}
                    </button>
                  )}
                </div>
                {erroPublicar && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{erroPublicar}</p>}
              </div>
            </div>
          )}

          <button className={styles.btnRegerar} onClick={gerar} disabled={gerando}>
            Gerar novamente
          </button>
        </div>
      )}

      {/* Modal de pré-visualização */}
      {preview && resultado && (
        <div
          onClick={() => setPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '760px', margin: '0 auto', background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          >
            {/* Barra do modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>Pré-visualização — como vai aparecer no blog</span>
              <button onClick={() => setPreview(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
            </div>

            {/* Conteúdo do artigo */}
            <div style={{ padding: '2rem 2.5rem' }}>
              {/* Meta */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#0f172a', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{categoriaArtigo}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>

              {/* Título */}
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25, marginBottom: '1rem' }}>
                {resultado.blog_titulo || 'Título do artigo'}
              </h1>

              {/* Resumo */}
              {resultado.blog_meta_desc && (
                <p style={{ fontSize: '1.05rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem', borderLeft: '3px solid #e2e8f0', paddingLeft: '1rem' }}>
                  {resultado.blog_meta_desc}
                </p>
              )}

              {/* Imagem de destaque */}
              {imagemDestaque.trim() && (
                <img
                  src={imagemDestaque.trim()}
                  alt={resultado.blog_titulo || ''}
                  style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', borderRadius: '12px', marginBottom: '2rem' }}
                />
              )}

              {/* Corpo do artigo */}
              <div style={{ fontSize: '1rem', color: '#334155', lineHeight: 1.8 }}>
                {[resultado.blog_intro, resultado.blog_corpo, resultado.blog_cta].filter(Boolean).join('\n\n').split('\n\n').map((block, i) => {
                  if (block.startsWith('**') && block.endsWith('**')) {
                    return <h3 key={i} style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '1.75rem 0 0.5rem' }}>{block.replace(/\*\*/g, '')}</h3>
                  }
                  if (block.includes('\n- ')) {
                    const [intro, ...items] = block.split('\n- ')
                    return (
                      <div key={i}>
                        {intro && <p style={{ margin: '0.75rem 0' }}>{intro.replace(/\*\*/g, '')}</p>}
                        <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
                          {items.map((item, j) => {
                            const parts = item.split('**: ')
                            return (
                              <li key={j} style={{ marginBottom: '0.4rem' }}>
                                {parts.length > 1 ? <><strong>{parts[0].replace('**', '')}</strong>: {parts[1]}</> : item}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  }
                  return <p key={i} style={{ margin: '0.75rem 0' }}>{block.replace(/\*\*/g, '')}</p>
                })}
              </div>

              {/* Vídeo */}
              {videoUrl.trim() && (
                <div style={{ marginTop: '2rem', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' }}>
                  <iframe
                    src={videoUrl.trim().replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                    title="Vídeo do artigo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}

              {/* Palavras-chave */}
              {resultado.blog_palavras_chave && resultado.blog_palavras_chave.length > 0 && (
                <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Palavras-chave SEO</p>
                  <p style={{ fontSize: '0.85rem', color: '#475569' }}>{resultado.blog_palavras_chave.join(' · ')}</p>
                </div>
              )}

              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                <button onClick={() => setPreview(false)} style={{ padding: '0.6rem 2rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>
                  Fechar pré-visualização
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
