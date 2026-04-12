import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import styles from './MetaSemanal.module.css'

interface StatusCount {
  status_contato: string | null
  count: number
}

const META_KEY = 'pousinox_meta_semanal'
const DEFAULT_META = 50

function inicioSemana(): string {
  const hoje = new Date()
  const dia = hoje.getDay() // 0=dom, 1=seg...
  const diffSegunda = (dia === 0 ? -6 : 1 - dia)
  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() + diffSegunda)
  segunda.setHours(0, 0, 0, 0)
  return segunda.toISOString()
}

export default function MetaSemanal() {
  const [meta, setMeta]         = useState(() => parseInt(localStorage.getItem(META_KEY) ?? String(DEFAULT_META)))
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState(String(meta))
  const [total, setTotal]       = useState(0)
  const [porStatus, setPorStatus] = useState<StatusCount[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const inicio = inicioSemana()

    const { data } = await supabaseAdmin
      .from('prospeccao')
      .select('status_contato')
      .not('contato_em', 'is', null)
      .gte('contato_em', inicio)

    const rows = data ?? []
    setTotal(rows.length)

    const contagem: Record<string, number> = {}
    rows.forEach(r => {
      const s = r.status_contato ?? 'Sem status'
      contagem[s] = (contagem[s] ?? 0) + 1
    })
    setPorStatus(Object.entries(contagem).map(([status_contato, count]) => ({ status_contato, count }))
      .sort((a, b) => b.count - a.count))
    setLoading(false)
  }

  function salvarMeta() {
    const v = parseInt(metaInput)
    if (!isNaN(v) && v > 0) {
      setMeta(v)
      localStorage.setItem(META_KEY, String(v))
    }
    setEditandoMeta(false)
  }

  const pct     = Math.min(100, Math.round(total * 100 / meta))
  const faltam  = Math.max(0, meta - total)
  const cor     = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#3b82f6'

  const STATUS_COR: Record<string, string> = {
    'Interessado':   '#15803d',
    'Aguardando':    '#92400e',
    'Retornar':      '#1d4ed8',
    'Sem interesse': '#94a3b8',
    'Sem status':    '#cbd5e1',
  }

  // Dias restantes na semana (seg–sex)
  const hoje = new Date().getDay()
  const diasRestantes = hoje === 0 ? 0 : Math.max(0, 5 - hoje)
  const porDia = diasRestantes > 0 ? Math.ceil(faltam / diasRestantes) : faltam

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <span className={styles.titulo}>Meta semanal de prospecção</span>
          <span className={styles.semana}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
        {editandoMeta ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min="1" value={metaInput}
              onChange={e => setMetaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && salvarMeta()}
              className={styles.metaInput}
              autoFocus
            />
            <button className={styles.metaBtn} onClick={salvarMeta}>✓</button>
            <button className={styles.metaBtnCancel} onClick={() => setEditandoMeta(false)}>✕</button>
          </div>
        ) : (
          <button className={styles.editarMeta} onClick={() => { setMetaInput(String(meta)); setEditandoMeta(true) }}>
            Meta: {meta} contatos ✎
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : (
        <>
          {/* Progresso principal */}
          <div className={styles.progressoWrap}>
            <div className={styles.progressoNums}>
              <span className={styles.atual} style={{ color: cor }}>{total}</span>
              <span className={styles.de}>de {meta} contatos</span>
              {pct >= 100
                ? <span className={styles.badge} style={{ background: '#dcfce7', color: '#15803d' }}>🎉 Meta atingida!</span>
                : <span className={styles.badge} style={{ background: '#f1f5f9', color: '#64748b' }}>
                    {faltam} restantes · {diasRestantes > 0 ? `~${porDia}/dia` : 'último dia'}
                  </span>
              }
            </div>
            <div className={styles.barra}>
              <div className={styles.barraFill} style={{ width: `${pct}%`, background: cor }} />
            </div>
            <div className={styles.pct} style={{ color: cor }}>{pct}%</div>
          </div>

          {/* Breakdown por status */}
          {porStatus.length > 0 && (
            <div className={styles.breakdown}>
              {porStatus.map(s => (
                <div key={s.status_contato} className={styles.statusItem}>
                  <span className={styles.statusDot} style={{ background: STATUS_COR[s.status_contato ?? 'Sem status'] ?? '#cbd5e1' }} />
                  <span className={styles.statusLabel}>{s.status_contato ?? 'Sem status'}</span>
                  <span className={styles.statusCount}>{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {total === 0 && (
            <div className={styles.vazio}>Nenhum contato registrado esta semana. Bora prospectar! 🚀</div>
          )}
        </>
      )}
    </div>
  )
}
