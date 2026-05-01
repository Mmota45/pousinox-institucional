import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminBase.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'

interface Flag {
  flag: string
  habilitado: boolean
  descricao: string | null
  publica: boolean
}

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(1)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const { data } = await supabaseAdmin
      .from('feature_flags')
      .select('flag, habilitado, descricao, publica')
      .order('flag')
    setFlags(data ?? [])
    lp.step()
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(flag: string, habilitado: boolean) {
    setSaving(flag)
    await supabaseAdmin
      .from('feature_flags')
      .update({ habilitado })
      .eq('flag', flag)
    setFlags(prev => prev.map(f => f.flag === flag ? { ...f, habilitado } : f))
    setSaving(null)
  }

  if (loading) return <AdminLoading total={lp.total} current={lp.current} label="Carregando flags..." />

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Feature Flags</h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 24 }}>
        Controle quais funcionalidades estão ativas no site público. Alterações são imediatas.
      </p>

      <table className={styles.table} style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Flag</th>
            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Descrição</th>
            <th style={{ textAlign: 'center', padding: '10px 12px', width: 80 }}>Pública</th>
            <th style={{ textAlign: 'center', padding: '10px 12px', width: 100 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(f => (
            <tr key={f.flag}>
              <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '0.88rem', fontFamily: 'monospace' }}>
                {f.flag}
              </td>
              <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#4b5563' }}>
                {f.descricao || '—'}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.78rem' }}>
                {f.publica ? (
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Sim</span>
                ) : (
                  <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 4 }}>Não</span>
                )}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <button
                  onClick={() => toggle(f.flag, !f.habilitado)}
                  disabled={saving === f.flag}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 20,
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: f.habilitado ? '#dcfce7' : '#fee2e2',
                    color: f.habilitado ? '#15803d' : '#dc2626',
                  }}
                >
                  {saving === f.flag ? '...' : f.habilitado ? 'Ativo' : 'Inativo'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
