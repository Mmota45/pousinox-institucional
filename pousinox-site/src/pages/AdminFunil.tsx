import { useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFunil.module.css'

interface Funil {
  mercado: number
  contatados: number
  interessados: number
  orcamentos: number
  vendas: number
  receita: number
  ticket_medio: number
}

const SEGMENTOS = [
  'Revestimentos', 'Construtoras', 'Arquitetura', 'Hotelaria', 'Hospitalar',
  'Restaurantes', 'Panificação', 'Supermercados', 'Açougues', 'Peixarias', 'Veterinária', 'Laboratórios',
]

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

function fmt(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function taxa(parte: number, total: number) {
  if (!total) return '—'
  return (parte * 100 / total).toFixed(1) + '%'
}

const ESTAGIOS = [
  { key: 'mercado',      label: '🌐 Mercado total',       cor: '#94a3b8' },
  { key: 'contatados',   label: '📞 Contatados',           cor: '#3b82f6' },
  { key: 'interessados', label: '🟢 Interessados',         cor: '#16a34a' },
  { key: 'orcamentos',   label: '📄 Orçamento enviado',    cor: '#d97706' },
  { key: 'vendas',       label: '🏆 Venda fechada',        cor: '#7c3aed' },
]

export default function AdminFunil() {
  const [segmentosSel, setSegmentosSel] = useState<string[]>(['Revestimentos', 'Construtoras'])
  const [ufSel, setUfSel]               = useState('')
  const [raioKm, setRaioKm]             = useState('')
  const [funil, setFunil]               = useState<Funil | null>(null)
  const [loading, setLoading]           = useState(false)
  const [buscado, setBuscado]           = useState(false)

  function toggleSeg(s: string) {
    setSegmentosSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function calcular() {
    setLoading(true)
    setBuscado(true)
    const raio = parseFloat(raioKm)
    const { data } = await supabaseAdmin.rpc('get_funil_prospects', {
      p_segmentos: segmentosSel.length > 0 ? segmentosSel : null,
      p_ufs:       ufSel ? [ufSel] : null,
      p_raio:      !isNaN(raio) && raio > 0 ? raio : null,
    })
    setFunil(data?.[0] ?? null)
    setLoading(false)
  }

  const maxVal = funil?.mercado ?? 1

  return (
    <div className={styles.wrap}>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Segmentos</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 500 }}>
            {SEGMENTOS.map(s => (
              <label key={s} style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem',
                cursor: 'pointer', padding: '3px 10px', borderRadius: 20,
                border: '1px solid var(--color-border)',
                background: segmentosSel.includes(s) ? 'var(--color-primary)' : '#f8fafc',
                color: segmentosSel.includes(s) ? '#fff' : 'var(--color-text)',
                fontWeight: segmentosSel.includes(s) ? 600 : 400,
              }}>
                <input type="checkbox" checked={segmentosSel.includes(s)}
                  onChange={() => toggleSeg(s)} style={{ display: 'none' }} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>UF</span>
          <select className={styles.filtroSelect} style={{ minWidth: 80 }}
            value={ufSel} onChange={e => setUfSel(e.target.value)}>
            <option value="">Todas</option>
            {UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Raio de Pouso Alegre</span>
          <input className={styles.filtroInput} type="number" min="0" step="50"
            placeholder="km (vazio = Brasil)" value={raioKm}
            onChange={e => setRaioKm(e.target.value)} style={{ minWidth: 180 }} />
        </div>

        <button className={styles.buscarBtn} onClick={calcular} disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular Funil'}
        </button>
      </div>

      {buscado && loading && <div className={styles.loading}>Calculando funil...</div>}

      {buscado && !loading && funil && (
        <>
          {/* ── Cards de receita ── */}
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Receita fechada</span>
              <span className={styles.cardVal} style={{ color: '#7c3aed' }}>{fmt(funil.receita)}</span>
              <span className={styles.cardSub}>{funil.vendas} venda{funil.vendas !== 1 ? 's' : ''} fechada{funil.vendas !== 1 ? 's' : ''}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Ticket médio</span>
              <span className={styles.cardVal}>{funil.ticket_medio > 0 ? fmt(funil.ticket_medio) : '—'}</span>
              <span className={styles.cardSub}>por venda fechada</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Taxa de conversão geral</span>
              <span className={styles.cardVal} style={{ color: '#16a34a' }}>
                {taxa(funil.vendas, funil.mercado)}
              </span>
              <span className={styles.cardSub}>mercado → venda</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Interessados → Venda</span>
              <span className={styles.cardVal} style={{ color: '#d97706' }}>
                {taxa(funil.vendas, funil.interessados)}
              </span>
              <span className={styles.cardSub}>taxa de fechamento</span>
            </div>
          </div>

          {/* ── Funil visual ── */}
          <div className={styles.funilWrap}>
            <div className={styles.funilTitulo}>Funil de conversão</div>
            <div className={styles.estagios}>
              {ESTAGIOS.map((est, i) => {
                const val = funil[est.key as keyof Funil] as number
                const pct = maxVal > 0 ? Math.max(2, Math.round(val * 100 / maxVal)) : 0
                const anterior = i > 0 ? funil[ESTAGIOS[i-1].key as keyof Funil] as number : null

                return (
                  <div key={est.key}>
                    {i > 0 && anterior !== null && (
                      <div className={styles.seta}>
                        <span>↓ conversão: {taxa(val, anterior)}</span>
                      </div>
                    )}
                    <div className={styles.estagio}>
                      <div className={styles.estagioInfo}>
                        <div className={styles.estagioLabel}>{est.label}</div>
                        <div className={styles.estagioCount}>{val.toLocaleString('pt-BR')} empresas</div>
                      </div>
                      <div className={styles.barraWrap}>
                        <div className={styles.barra}>
                          <div
                            className={styles.barraFill}
                            style={{ width: `${pct}%`, background: est.cor }}
                          >
                            {pct > 10 && `${pct}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
