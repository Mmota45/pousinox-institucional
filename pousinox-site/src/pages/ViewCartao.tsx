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
  try {
    await supabase.from('cartoes_acessos').insert({
      cartao_id: cartaoId, tipo,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    })
  } catch { /* silencioso */ }
}

async function incrementarContador(cartaoId: string, campo: 'visualizacoes' | 'downloads_vcard') {
  try {
    await supabase.rpc('incrementar_cartao_contador', { p_id: cartaoId, p_campo: campo })
  } catch { /* RPC pode não existir */ }
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
    c.endereco && c.cidade ? `ADR;TYPE=WORK:;;${c.endereco};${c.cidade};${c.uf || ''};;Brasil` : '',
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
  const [imgErro, setImgErro] = useState(false)
  const [logoErro, setLogoErro] = useState(false)

  useEffect(() => {
    if (!slug) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('cartoes_digitais')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'publicado')
          .single()
        setLoading(false)
        if (error || !data) { setNotFound(true); return }
        setCartao(data as Cartao)
        registrarAcesso(data.id, 'visualizacao')
        incrementarContador(data.id, 'visualizacoes')
      } catch { setLoading(false); setNotFound(true) }
    })()
  }, [slug])

  if (loading) {
    return (
      <div style={ST.page}>
        <div style={ST.loading}>Carregando…</div>
      </div>
    )
  }

  if (notFound || !cartao) {
    return (
      <div style={ST.page}>
        <div style={ST.notFound}>
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
    const url = window.location.href
    const texto = `Confira o contato de ${cartao!.nome}: ${url}`
    if (navigator.share) {
      navigator.share({ title: cartao!.nome, text: texto, url })
      registrarAcesso(cartao!.id, 'compartilhamento')
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  function handleShareWhatsApp() {
    const url = window.location.href
    const texto = `Confira o contato de ${cartao!.nome}: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
    registrarAcesso(cartao!.id, 'compartilhamento_whatsapp')
  }

  return (
    <div style={{ ...ST.page, background: '#f0f4f8', minHeight: '100vh' }}>
      <div style={{ ...ST.card, background: fundo }}>
        {/* Banner + Avatar */}
        <div style={{ position: 'relative', height: 100, borderRadius: '16px 16px 0 0' }}>
          <div style={{ height: 68, background: cor, borderRadius: '16px 16px 0 0' }}>
            {cartao.logo_url && !logoErro && (
              <img
                src={cartao.logo_url}
                alt={`Logo ${cartao.empresa || ''}`}
                onError={() => setLogoErro(true)}
                style={{
                  position: 'absolute', top: 10, right: 16,
                  height: 30, objectFit: 'contain',
                  background: '#fff', borderRadius: 6, padding: '2px 6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 20 }}>
            {cartao.foto_url && !imgErro ? (
              <img
                src={cartao.foto_url}
                alt={cartao.nome}
                onError={() => setImgErro(true)}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${cor}`, background: '#f1f5f9', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#e2e8f0', border: `3px solid ${cor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', color: '#94a3b8',
              }}>👤</div>
            )}
          </div>
        </div>

        <div style={{ padding: '6px 20px 0' }}>
          <h1 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>{cartao.nome}</h1>
          {(cartao.cargo || cartao.empresa) && (
            <p style={{ margin: '0 0 2px', fontSize: '0.85rem', color: '#64748b' }}>
              {cartao.cargo}{cartao.cargo && cartao.empresa ? ' · ' : ''}{cartao.empresa}
            </p>
          )}
          {cartao.cidade && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              {cartao.cidade}{cartao.uf ? `/${cartao.uf}` : ''}
            </p>
          )}
        </div>

        {/* Especialidades */}
        {cartao.especialidades?.length > 0 && (
          <div style={{ padding: '8px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {cartao.especialidades.map(e => (
              <span key={e} style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: '#f0f4f8',
                border: `1px solid ${cor}33`,
                color: cor,
                fontSize: '0.72rem',
                fontWeight: 600,
              }}>{e}</span>
            ))}
          </div>
        )}

        {/* Produtos */}
        {cartao.produtos?.length > 0 && (
          <div style={{ padding: '8px 20px 0' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 6 }}>Produtos</div>
            {cartao.produtos_info?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cartao.produtos_info.map(p => (
                  <a key={p.titulo} href={p.link} target="_blank" rel="noopener noreferrer"
                    aria-label={`Ver produto ${p.titulo}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: '#f1f5f9', textDecoration: 'none', border: '1px solid #e2e8f0' }}>
                    {p.foto_url && (
                      <img src={p.foto_url} alt={p.titulo}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #e2e8f0' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e3f6e' }}>{p.titulo}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Ver na loja →</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {cartao.produtos.map(p => (
                  <span key={p} style={{ padding: '2px 8px', borderRadius: 999, background: '#1e3f6e', color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>{p}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divisor */}
        <div style={{ height: 1, background: '#e2e8f0', margin: '12px 0' }} />

        {/* Contatos */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wa && (
            <a href={`https://wa.me/55${wa}`} style={ST.contactRow(cor)}
              aria-label={`WhatsApp ${cartao.whatsapp}`}
              onClick={() => registrarAcesso(cartao.id, 'clique_whatsapp')}
              target="_blank" rel="noopener noreferrer">
              <span style={ST.contactIcon(cor)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.84L.057 23.428l5.753-1.507A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.859 0-3.593-.504-5.082-1.375l-.363-.215-3.416.895.91-3.325-.237-.381A9.928 9.928 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                </svg>
              </span>
              <span style={ST.contactText}>WhatsApp</span>
              <span style={ST.contactSub}>{cartao.whatsapp}</span>
            </a>
          )}

          {cartao.telefone && (
            <a href={`tel:${fmtTel(cartao.telefone)}`} style={ST.contactRow(cor)}
              aria-label={`Ligar para ${cartao.telefone}`}
              onClick={() => registrarAcesso(cartao.id, 'clique_telefone')}>
              <span style={ST.contactIcon(cor)}>📞</span>
              <span style={ST.contactText}>Telefone</span>
              <span style={ST.contactSub}>{cartao.telefone}</span>
            </a>
          )}

          {cartao.email && (
            <a href={`mailto:${cartao.email}`} style={ST.contactRow(cor)}
              aria-label={`Enviar email para ${cartao.email}`}
              onClick={() => registrarAcesso(cartao.id, 'clique_email')}>
              <span style={ST.contactIcon(cor)}>✉</span>
              <span style={ST.contactText}>E-mail</span>
              <span style={ST.contactSub}>{cartao.email}</span>
            </a>
          )}

          {cartao.site && (
            <a href={cartao.site} style={ST.contactRow(cor)}
              aria-label={`Visitar site ${cartao.site}`}
              onClick={() => registrarAcesso(cartao.id, 'clique_site')}
              target="_blank" rel="noopener noreferrer">
              <span style={ST.contactIcon(cor)}>🌐</span>
              <span style={ST.contactText}>Site</span>
              <span style={ST.contactSub}>{cartao.site.replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          {(cartao.cidade || cartao.endereco) && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent([cartao.endereco, cartao.cidade, cartao.uf].filter(Boolean).join(', '))}`}
              style={ST.contactRow(cor)}
              aria-label={`Ver localização no mapa`}
              onClick={() => registrarAcesso(cartao.id, 'clique_maps')}
              target="_blank" rel="noopener noreferrer">
              <span style={ST.contactIcon(cor)}>📍</span>
              <span style={ST.contactText}>Localização</span>
              <span style={ST.contactSub}>{[cartao.endereco, cartao.cidade].filter(Boolean).join(', ')}</span>
            </a>
          )}
        </div>

        {/* Redes Sociais */}
        {(cartao.linkedin || cartao.instagram) && (
          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8 }}>
            {cartao.linkedin && (
              <a href={cartao.linkedin} style={ST.socialBtn(cor)}
                aria-label="LinkedIn"
                onClick={() => registrarAcesso(cartao.id, 'clique_linkedin')}
                target="_blank" rel="noopener noreferrer">
                in
              </a>
            )}
            {cartao.instagram && (
              <a href={cartao.instagram} style={ST.socialBtn(cor)}
                aria-label="Instagram"
                onClick={() => registrarAcesso(cartao.id, 'clique_instagram')}
                target="_blank" rel="noopener noreferrer">
                IG
              </a>
            )}
          </div>
        )}

        {/* CTAs */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleDownloadVCard} style={{ ...ST.ctaPrimary, background: cor }}
            aria-label="Salvar contato no celular">
            Salvar Contato
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleShareWhatsApp}
              style={{ ...ST.ctaSecondary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              aria-label="Compartilhar via WhatsApp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.84L.057 23.428l5.753-1.507A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.859 0-3.593-.504-5.082-1.375l-.363-.215-3.416.895.91-3.325-.237-.381A9.928 9.928 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
              </svg>
              WhatsApp
            </button>
            <button onClick={handleShare} style={{ ...ST.ctaSecondary, flex: 1 }}
              aria-label="Compartilhar cartão">
              Compartilhar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#fafbfc',
          borderRadius: '0 0 16px 16px',
        }}>
          <span style={{ fontSize: '0.65rem', color: '#cbd5e1', letterSpacing: '0.03em' }}>Cartão digital por</span>
          <img src={logomarca} alt="Pousinox®" style={{ height: 16, opacity: 0.4, filter: 'grayscale(100%)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Inline styles ────────────────────────────────────────────────────────────
const ST = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '20px 12px 40px',
    fontFamily: 'Inter, system-ui, sans-serif',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: 400,
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
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    textDecoration: 'none',
    color: '#1a202c',
    border: '1px solid #e2e8f0',
    transition: 'background 0.15s',
  } as React.CSSProperties),
  contactIcon: (cor: string) => ({
    color: cor,
    fontSize: '0.9rem',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  } as React.CSSProperties),
  contactText: {
    fontWeight: 600,
    fontSize: '0.82rem',
    flex: 1,
  } as React.CSSProperties,
  contactSub: {
    fontSize: '0.72rem',
    color: '#94a3b8',
    maxWidth: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  socialBtn: (cor: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    background: cor,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.78rem',
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  } as React.CSSProperties),
  ctaPrimary: {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,
  ctaSecondary: {
    padding: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
  } as React.CSSProperties,
}
