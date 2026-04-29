/**
 * LaudoAcesso — Página pública para visualização de laudo protegido
 * Rota: /laudo/:id
 *
 * Proteções:
 * - Sem botão de download
 * - Print bloqueado (CSS + Ctrl+P interceptado)
 * - Clique direito bloqueado
 * - Seleção de texto bloqueada
 * - Toolbar do PDF viewer oculta (#toolbar=0)
 * - Watermark rastreável (aplicado no PDF server-side)
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'

export default function LaudoAcesso() {
  const { id } = useParams<{ id: string }>()
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<{ url: string; empresa: string; restantes: number } | null>(null)

  // Bloquear print e atalhos
  useEffect(() => {
    if (!sucesso) return

    function blockPrint(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopPropagation()
      }
      // Bloquear PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault()
      }
    }

    function blockContext(e: MouseEvent) {
      e.preventDefault()
    }

    window.addEventListener('keydown', blockPrint, true)
    window.addEventListener('contextmenu', blockContext, true)
    // Injetar CSS para bloquear print
    const style = document.createElement('style')
    style.id = 'laudo-print-block'
    style.textContent = '@media print { body * { display: none !important; } body::after { content: "Impressão não permitida — Documento protegido POUSINOX"; display: block !important; font-size: 24pt; text-align: center; padding: 100px; color: #c00; } }'
    document.head.appendChild(style)

    return () => {
      window.removeEventListener('keydown', blockPrint, true)
      window.removeEventListener('contextmenu', blockContext, true)
      document.getElementById('laudo-print-block')?.remove()
    }
  }, [sucesso])

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (!senha.trim()) { setErro('Digite a senha.'); return }

    setLoading(true)
    setErro(null)

    try {
      const res = await supabaseAdmin.functions.invoke('proteger-pdf', {
        body: { action: 'verificar', watermark_id: id, senha: senha.trim() },
      })

      if (res.error || !res.data?.ok) {
        setErro(res.data?.error || 'Erro ao verificar')
        return
      }

      setSucesso({
        url: res.data.url,
        empresa: res.data.empresa,
        restantes: res.data.downloads_restantes,
      })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de visualização protegida ──
  if (sucesso) {
    return (
      <div style={viewerPage} onContextMenu={e => e.preventDefault()}>
        {/* Banner superior */}
        <div style={viewerBanner}>
          <span style={{ fontWeight: 700 }}>POUSINOX</span>
          <span>🔒 Documento protegido — Destinatário: <strong>{sucesso.empresa}</strong></span>
          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>ID: {id?.slice(0, 8)}… · Acessos restantes: {sucesso.restantes}</span>
        </div>

        {/* Aviso de proteção */}
        <div style={protecaoAviso}>
          🛡️ Este documento é protegido. Download, impressão e cópia estão desabilitados. O acesso é rastreável.
        </div>

        {/* PDF viewer sem toolbar */}
        <div style={viewerContainer}>
          <iframe
            src={`${sucesso.url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            style={viewerIframe}
            title="Laudo Protegido"
            sandbox="allow-same-origin"
          />
        </div>

        {/* Overlay anti-seleção sobre o iframe */}
        <div style={antiSelectOverlay} />
      </div>
    )
  }

  // ── Tela de senha ──
  return (
    <div style={page}>
      <div style={card}>
        <div style={logoArea}>
          <div style={logoTxt}>POUSINOX</div>
          <div style={subtitle}>Documento Protegido</div>
        </div>

        <p style={desc}>
          Este documento é protegido e rastreável.<br />
          Digite a senha fornecida para acessar.
        </p>

        <form onSubmit={verificar} style={formStyle}>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Senha de acesso"
            style={inputStyle}
            autoFocus
            disabled={loading}
          />

          {erro && <p style={erroStyle}>{erro}</p>}

          <button type="submit" style={btnStyle} disabled={loading}>
            {loading ? 'Verificando…' : '🔓 Acessar Documento'}
          </button>
        </form>

        <p style={footerText}>
          🔒 Documento confidencial com marca d'água rastreável.
          <br />O acesso é registrado e auditável.
        </p>

        <div style={footer}>
          <span>pousinox.com.br</span>
          <span>ID: {id?.slice(0, 8)}…</span>
        </div>
      </div>
    </div>
  )
}

/* ── Styles — Tela de senha ── */
const page: React.CSSProperties = {
  minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', sans-serif",
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '40px 36px', width: 420, maxWidth: '95vw',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 20,
}
const logoArea: React.CSSProperties = { textAlign: 'center', borderBottom: '2px solid #1a3a5c', paddingBottom: 16 }
const logoTxt: React.CSSProperties = { fontSize: '1.6rem', fontWeight: 900, color: '#1a3a5c', letterSpacing: '-0.02em' }
const subtitle: React.CSSProperties = { fontSize: '0.82rem', color: '#64748b', marginTop: 4 }
const desc: React.CSSProperties = { fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, textAlign: 'center' }
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const inputStyle: React.CSSProperties = { padding: '12px 14px', border: '1px solid #d0d7de', borderRadius: 10, fontSize: '1rem', fontFamily: 'inherit', outline: 'none', textAlign: 'center', letterSpacing: '0.1em' }
const erroStyle: React.CSSProperties = { fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }
const btnStyle: React.CSSProperties = { background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }
const footerText: React.CSSProperties = { fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#cbd5e1', borderTop: '1px solid #f1f5f9', paddingTop: 10 }

/* ── Styles — Viewer protegido ── */
const viewerPage: React.CSSProperties = {
  minHeight: '100vh', background: '#1a1a2e', fontFamily: "'Inter', sans-serif",
  display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none',
}
const viewerBanner: React.CSSProperties = {
  background: '#1B3A5C', color: '#fff', padding: '10px 24px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  fontSize: '0.8rem', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 100,
}
const protecaoAviso: React.CSSProperties = {
  background: '#fef3c7', color: '#92400e', textAlign: 'center', padding: '8px 16px',
  fontSize: '0.75rem', fontWeight: 500,
}
const viewerContainer: React.CSSProperties = {
  flex: 1, display: 'flex', justifyContent: 'center', padding: '16px 0',
  position: 'relative',
}
const viewerIframe: React.CSSProperties = {
  width: '100%', maxWidth: 900, height: 'calc(100vh - 100px)',
  border: 'none', borderRadius: 4, background: '#fff',
}
const antiSelectOverlay: React.CSSProperties = {
  position: 'fixed', top: 90, left: 0, right: 0, bottom: 0,
  zIndex: 10, background: 'transparent', pointerEvents: 'none',
}
