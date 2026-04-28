import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'

export default function AdminCanvaCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')
    if (error) { setStatus('error'); setErrMsg(`${error}: ${errorDesc || 'sem detalhes'}`); return }

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) { setStatus('error'); setErrMsg('Parâmetros ausentes'); return }

    const stored_state = localStorage.getItem('canva_state')
    if (state !== stored_state) { setStatus('error'); setErrMsg('State mismatch'); return }

    const code_verifier = localStorage.getItem('canva_code_verifier') ?? ''
    const origin = window.location.origin
    const redirect_uri = `${origin}/admin/canva-callback`

    supabaseAdmin.functions.invoke('canva-api', {
      body: { acao: 'callback', code, redirect_uri, code_verifier },
    }).then(({ data, error: fnErr }) => {
      if (fnErr || data?.error) {
        setStatus('error')
        setErrMsg(data?.error ?? data?.detail ?? fnErr?.message ?? 'Erro ao conectar')
        return
      }
      localStorage.removeItem('canva_code_verifier')
      localStorage.removeItem('canva_state')
      setStatus('ok')
      setTimeout(() => {
        window.location.href = `${origin}/admin`
      }, 1500)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      {status === 'loading' && <p>Conectando ao Canva...</p>}
      {status === 'ok' && <p style={{ color: '#059669', fontWeight: 700 }}>Canva conectado com sucesso! Redirecionando...</p>}
      {status === 'error' && <p style={{ color: '#dc2626', fontWeight: 700 }}>Erro: {errMsg}</p>}
    </div>
  )
}
