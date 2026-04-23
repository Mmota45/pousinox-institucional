import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logomarca from '../assets/logomarca.png'

interface Cartao {
  id: string
  slug: string
  nome: string
  cargo: string | null
  empresa: string | null
  segmento: string | null
  especialidades: string[]
  produtos: string[]
  produtos_info: { titulo: string; foto_url: string; link: string }[] | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  foto_url: string | null
  logo_url: string | null
  cor_primaria: string
  cor_fundo: string
  linkedin: string | null
  instagram: string | null
  status: string
}

function fmtTel(t: string): string {
  return t.replace(/\D/g, '')
}

async function registrarAcesso(cartaoId: string, tipo: string) {
  await supabase.from('cartoes_acessos').insert({
    cartao_id: cartaoId, tipo,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
  })
}

async function incrementarContador(cartaoId: string, campo: 'visualizacoes' | 'downloads_vcard') {
  try {
    await supabase.rpc('incrementar_cartao_contador', { p_id: cartaoId, p_campo: campo })
  } catch {
    // RPC não existe ainda — ignora silenciosamente
  }
}

function gerarVCard(c: Cartao): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${c.nome}`,
    c.cargo ? `TITLE:${c.cargo}` : '',
    c.empresa ? `ORG:${c.empresa}` : '',
    c.telefone ? `TEL;TYPE=WORK,VOICE:${c.telefone}` : '',
    c.whatsapp ? `TEL;TYPE=CELL:${c.whatsapp}` : '',
    c.email ? `EMAIL:${c.email}` : '',
    c.site ? `URL:${c.site}` : '',
    c.endereco && c.cidade ? `ADR;TYPE=WORK:;;${c.endereco};${c.cidade};${c.uf || ''};${(c as unknown as Record<string, unknown>).cep || ''};Brasil` : '',
    c.linkedin ? `X-SOCIALPROFILE;type=linkedin:${c.linkedin}` : '',
    c.instagram ? `X-SOCIALPROFILE;type=instagram:${c.instagram}` : '',
    c.foto_url ? `PHOTO;VALUE=URI:${c.foto_url}` : '',
    'END:VCARD',
  ]
  return lines.filter(Boolean).join('\r\n')
}

export default function ViewCartao() {
  const { slug } = useParams<{ slug: string }>()
  const [cartao, setCartao] = useState<Cartao | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('cartoes_digitais')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'publicado')
      .single()
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) { setNotFound(true); return }
        setCartao(data as Cartao)
        // Registrar visualização
        registrarAcesso(data.id, 'visualizacao')
        incrementarContador(data.id, 'visualizacoes')
      })
  }, [slug])

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.loading}>Carregando…</div>
      </div>
    )
  }

  if (notFound || !cartao) {
    return (
      <div style={S.page}>
        <div style={S.notFound}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>404</div>
          <div style={{ fontSize: '1rem', color: '#64748b' }}>Cartão não encontrado ou indisponível.</div>
        </div>
      </div>
    )
  }

  const cor = cartao.cor_primaria || '#1e3f6e'
  const fundo = cartao.cor_fundo || '#ffffff'
  const wa = cartao.whatsapp ? fmtTel(cartao.whatsapp) : null

  function handleDownloadVCard() {
    const vcf = gerarVCard(cartao!)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS) {
      // iOS não suporta download via blob — abre data URI diretamente
      const encoded = encodeURIComponent(vcf)
      window.location.href = `data:text/vcard;charset=utf-8,${encoded}`
    } else {
      const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${cartao!.slug}.vcf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    registrarAcesso(cartao!.id, 'download_vcard')
    incrementarContador(cartao!.id, 'downloads_vcard')
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: cartao!.nome, url: window.location.href })
      registrarAcesso(cartao!.id, 'compartilhamento')
    } else {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div style={{ ...S.page, background: '#f0f4f8', minHeight: '100vh' }}>
      <div style={{ ...S.card, background: fundo }}>
        {/* Banner + Avatar (wrapper relativo para posicionamento sem clipping) */}
        <div style={{ position: 'relative', height: 124, borderRadius: '16px 16px 0 0' }}>
          {/* Banner */}
          <div style={{ height: 88, background: cor, borderRadius: '16px 16px 0 0' }}>
            {cartao.logo_url && (
              <img
                src={cartao.logo_url}
                alt="logo"
                style={{
                  position: 'absolute', top: 12, right: 20,
                  height: 36, objectFit: 'contain',
                  background: '#fff', borderRadius: 8, padding: '3px 8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                }}
              />
            )}
          </div>
          {/* Avatar */}
          <div style={{ position: 'absolute', bottom: 0, left: 20 }}>
            {cartao.foto_url ? (
              <img
                src={cartao.foto_url}
                alt={cartao.nome}
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${cor}`, background: '#f1f5f9', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#e2e8f0', border: `3px solid ${cor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.8rem', color: '#94a3b8',
              }}>👤</div>
          )}
          </div>
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          <h1 style={{ margin: '0 0 2px', fontSize: '1.2rem', fontWeight: 700, color: '#1a202c' }}>{cartao.nome}</h1>
          {(cartao.cargo || cartao.empresa) && (
            <p style={{ margin: '0 0 4px', fontSize: '0.88rem', color: '#64748b' }}>
              {cartao.cargo}{cartao.cargo && cartao.empresa ? ' · ' : ''}{cartao.empresa}
            </p>
          )}
          {cartao.cidade && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
              {cartao.cidade}{cartao.uf ? `/${cartao.uf}` : ''}
            </p>
          )}
        </div>

        {/* Especialidades */}
        {cartao.especialidades?.length > 0 && (
          <div style={{ padding: '10px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cartao.especialidades.map(e => (
              <span key={e} style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: '#f0f4f8',
                border: `1px solid ${cor}33`,
                color: cor,
                fontSize: '0.78rem',
                fontWeight: 600,
              }}>{e}</span>
            ))}
          </div>
        )}

        {/* Produtos */}
        {cartao.produtos?.length > 0 && (
          <div style={{ padding: '10px 20px 0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 8 }}>Produtos</div>
            {cartao.produtos_info?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cartao.produtos_info.map(p => (
                  <a key={p.titulo} href={p.link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#f1f5f9', textDecoration: 'none', border: '1px solid #e2e8f0', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}>
                    {p.foto_url && (
                      <img src={p.foto_url} alt={p.titulo}
                        style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #e2e8f0' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e3f6e' }}>{p.titulo}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Ver na loja →</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cartao.produtos.map(p => (
                  <span key={p} style={{ padding: '3px 10px', borderRadius: 999, background: '#1e3f6e', color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>{p}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divisor */}
        <div style={{ height: 1, background: '#e2e8f0', margin: '16px 0' }} />

        {/* Contatos */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wa && (
            <a
              href={`https://wa.me/55${wa}`}
              style={S.contactRow(cor)}
              onClick={() => registrarAcesso(cartao.id, 'clique_whatsapp')}
              target="_blank" rel="noopener noreferrer"
            >
              <span style={S.contactIcon(cor)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.84L.057 23.428l5.753-1.507A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.859 0-3.593-.504-5.082-1.375l-.363-.215-3.416.895.91-3.325-.237-.381A9.928 9.928 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                </svg>
              </span>
              <span style={S.contactText}>WhatsApp</span>
              <span style={S.contactSub}>{cartao.whatsapp}</span>
            </a>
          )}

          {cartao.telefone && (
            <a
              href={`tel:${fmtTel(cartao.telefone)}`}
              style={S.contactRow(cor)}
              onClick={() => registrarAcesso(cartao.id, 'clique_telefone')}
            >
              <span style={S.contactIcon(cor)}>📞</span>
              <span style={S.contactText}>Telefone</span>
              <span style={S.contactSub}>{cartao.telefone}</span>
            </a>
          )}

          {cartao.email && (
            <a
              href={`mailto:${cartao.email}`}
              style={S.contactRow(cor)}
              onClick={() => registrarAcesso(cartao.id, 'clique_email')}
            >
              <span style={S.contactIcon(cor)}>✉</span>
              <span style={S.contactText}>E-mail</span>
              <span style={S.contactSub}>{cartao.email}</span>
            </a>
          )}

          {cartao.site && (
            <a
              href={cartao.site}
              style={S.contactRow(cor)}
              onClick={() => registrarAcesso(cartao.id, 'clique_site')}
              target="_blank" rel="noopener noreferrer"
            >
              <span style={S.contactIcon(cor)}>🌐</span>
              <span style={S.contactText}>Site</span>
              <span style={S.contactSub}>{cartao.site.replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          {(cartao.cidade || cartao.endereco) && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent([cartao.endereco, cartao.cidade, cartao.uf].filter(Boolean).join(', '))}`}
              style={S.contactRow(cor)}
              onClick={() => registrarAcesso(cartao.id, 'clique_maps')}
              target="_blank" rel="noopener noreferrer"
            >
              <span style={S.contactIcon(cor)}>📍</span>
              <span style={S.contactText}>Localização</span>
              <span style={S.contactSub}>{[cartao.endereco, cartao.cidade].filter(Boolean).join(', ')}</span>
            </a>
          )}
        </div>

        {/* Redes Sociais */}
        {(cartao.linkedin || cartao.instagram) && (
          <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
            {cartao.linkedin && (
              <a
                href={cartao.linkedin}
                style={S.socialBtn(cor)}
                onClick={() => registrarAcesso(cartao.id, 'clique_linkedin')}
                target="_blank" rel="noopener noreferrer"
              >
                in
              </a>
            )}
            {cartao.instagram && (
              <a
                href={cartao.instagram}
                style={S.socialBtn(cor)}
                onClick={() => registrarAcesso(cartao.id, 'clique_instagram')}
                target="_blank" rel="noopener noreferrer"
              >
                IG
              </a>
            )}
          </div>
        )}

        {/* CTAs */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleDownloadVCard}
            style={{ ...S.ctaPrimary, background: cor }}
          >
            Salvar Contato
          </button>
          <button
            onClick={handleShare}
            style={S.ctaSecondary}
          >
            Compartilhar
          </button>
        </div>

        {/* Footer — Marca Pousinox® */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: '#fafbfc',
          borderRadius: '0 0 16px 16px',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#cbd5e1', letterSpacing: '0.03em' }}>Cartão digital por</span>
          <img
            src={logomarca}
            alt="Pousinox®"
            style={{ height: 20, opacity: 0.45, filter: 'grayscale(100%)' }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Inline styles (sem CSS Module para isolamento total) ───────────────────
const S = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '24px 16px 48px',
    fontFamily: 'Inter, system-ui, sans-serif',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    padding: '80px 20px',
    fontSize: '0.95rem',
  },
  notFound: {
    textAlign: 'center' as const,
    padding: '80px 20px',
  },
  contactRow: (_cor: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 10,
    background: '#f8fafc',
    textDecoration: 'none',
    color: '#1a202c',
    border: `1px solid #e2e8f0`,
    transition: 'background 0.15s',
  } as React.CSSProperties),
  contactIcon: (cor: string) => ({
    color: cor,
    fontSize: '1rem',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  } as React.CSSProperties),
  contactText: {
    fontWeight: 600,
    fontSize: '0.88rem',
    flex: 1,
  } as React.CSSProperties,
  contactSub: {
    fontSize: '0.78rem',
    color: '#94a3b8',
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  socialBtn: (cor: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    background: cor,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.82rem',
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  } as React.CSSProperties),
  ctaPrimary: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,
  ctaSecondary: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#fff',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  } as React.CSSProperties,
}
