import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'

export default function RedirectShortLink() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!code) { setErro(true); return }
    supabaseAdmin
      .from('orcamento_links')
      .select('token, ativo')
      .eq('short_code', code)
      .single()
      .then(({ data }) => {
        if (!data || !data.ativo) { setErro(true); return }
        navigate(`/view/orcamento/${data.token}`, { replace: true })
      })
  }, [code])

  if (erro) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 12, color: '#64748b' }}>
      <span style={{ fontSize: '2rem' }}>🔗</span>
      <strong>Link inválido ou expirado.</strong>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#64748b' }}>
      Redirecionando…
    </div>
  )
}
