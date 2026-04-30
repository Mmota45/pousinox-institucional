import { useEffect } from 'react'

interface Props {
  url: string
  titulo: string
  onClose: () => void
}

export default function ModalIframe({ url, titulo, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
          zIndex: 950, backdropFilter: 'blur(4px)',
        }}
      />
      <div style={{
        position: 'fixed', inset: '20px', zIndex: 951,
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>{titulo}</span>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', fontSize: '0.88rem',
              fontFamily: 'inherit', color: '#64748b',
            }}
          >
            ✕ Fechar
          </button>
        </div>
        <iframe src={url} style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </>
  )
}
