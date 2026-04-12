import { useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCobertura.module.css'

interface Cobertura {
  mesorregiao: string
  uf: string
  total: number
  contatados: number
  interessados: number
  aguardando: number
  cobertura_pct: number
}

const SEGMENTOS = [
  'Revestimentos', 'Construtoras', 'Arquitetura', 'Hotelaria', 'Hospitalar',
  'Restaurantes', 'Panificação', 'Supermercados', 'Açougues', 'Peixarias', 'Veterinária', 'Laboratórios',
]

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

function barColor(pct: number) {
  if (pct >= 50) return '#16a34a'
  if (pct >= 20) return '#d97706'
  return '#3b82f6'
}

export default function AdminCobertura() {
  const [segmentosSel, setSegmentosSel] = useState<string[]>(['Revestimentos', 'Construtoras'])
  const [ufsSel, setUfsSel]             = useState<string[]>([])
  const [raioKm, setRaioKm]             = useState('')
  const [dados, setDados]               = useState<Cobertura[]>([])
  const [loading, setLoading]           = useState(false)
  const [buscado, setBuscado]           = useState(false)

  async function buscar() {
    setLoading(true)
    setBuscado(true)
    const raio = parseFloat(raioKm)
    const { data } = await supabaseAdmin.rpc('get_cobertura_regional', {
      p_segmentos: segmentosSel.length > 0 ? segmentosSel : null,
      p_ufs:       ufsSel.length > 0 ? ufsSel : null,
      p_raio:      !isNaN(raio) && raio > 0 ? raio : null,
    })
    setDados((data ?? []) as Cobertura[])
    setLoading(false)
  }

  const totalMercado   = dados.reduce((s, d) => s + d.total, 0)
  const totalContatados = dados.reduce((s, d) => s + d.contatados, 0)
  const totalInteressados = dados.reduce((s, d) => s + d.interessados, 0)
  const totalAguardando = dados.reduce((s, d) => s + d.aguardando, 0)
  const coberturaGeral = totalMercado > 0 ? Math.round(totalContatados * 100 / totalMercado) : 0

  function toggleSeg(s: string) {
    setSegmentosSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleUf(u: string) {
    setUfsSel(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])
  }

  return (
    <div className={styles.wrap}>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>

        {/* Segmentos */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Segmentos</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 480 }}>
            {SEGMENTOS.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', cursor: 'pointer',
                padding: '3px 8px', borderRadius: 20, border: '1px solid var(--color-border)',
                background: segmentosSel.includes(s) ? 'var(--color-primary)' : '#f8fafc',
                color: segmentosSel.includes(s) ? '#fff' : 'var(--color-text)',
                fontWeight: segmentosSel.includes(s) ? 600 : 400,
              }}>
                <input type="checkbox" checked={segmentosSel.includes(s)} onChange={() => toggleSeg(s)}
                  style={{ display: 'none' }} />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* UF */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>UF (vazio = todas)</span>
          <select className={styles.filtroSelect} style={{ minWidth: 80 }}
            onChange={e => { if (e.target.value) toggleUf(e.target.value) }}>
            <option value="">+ Adicionar UF</option>
            {UFS.filter(u => !ufsSel.includes(u)).map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {ufsSel.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {ufsSel.map(u => (
                <span key={u} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 20,
                  padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => toggleUf(u)}>
                  {u} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Raio */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Raio de Pouso Alegre</span>
          <input className={styles.filtroInput} type="number" min="0" step="50"
            placeholder="km (vazio = Brasil todo)"
            value={raioKm} onChange={e => setRaioKm(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>

        <button className={styles.buscarBtn} onClick={buscar} disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular Cobertura'}
        </button>
      </div>

      {/* ── Cards de resumo ── */}
      {buscado && !loading && dados.length > 0 && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Mercado total</span>
            <span className={styles.cardVal}>{totalMercado.toLocaleString('pt-BR')}</span>
            <span className={styles.cardSub}>{dados.length} mesorregiões</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Cobertura geral</span>
            <span className={styles.cardVal} style={{ color: coberturaGeral >= 20 ? '#16a34a' : '#d97706' }}>
              {coberturaGeral}%
            </span>
            <span className={styles.cardSub}>{totalContatados.toLocaleString('pt-BR')} contatados</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Interessados</span>
            <span className={styles.cardVal} style={{ color: '#15803d' }}>{totalInteressados.toLocaleString('pt-BR')}</span>
            <span className={styles.cardSub}>
              {totalMercado > 0 ? ((totalInteressados / totalMercado) * 100).toFixed(1) : 0}% do mercado
            </span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Aguardando retorno</span>
            <span className={styles.cardVal} style={{ color: '#92400e' }}>{totalAguardando.toLocaleString('pt-BR')}</span>
            <span className={styles.cardSub}>follow-up pendente</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Mercado virgem</span>
            <span className={styles.cardVal} style={{ color: '#1d4ed8' }}>
              {(totalMercado - totalContatados).toLocaleString('pt-BR')}
            </span>
            <span className={styles.cardSub}>{100 - coberturaGeral}% ainda não contatado</span>
          </div>
        </div>
      )}

      {/* ── Tabela ── */}
      {buscado && (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              {loading ? 'Calculando...' : `Cobertura por mesorregião — ${dados.length} regiões`}
            </span>
          </div>

          {loading ? (
            <div className={styles.loading}>Calculando cobertura...</div>
          ) : dados.length === 0 ? (
            <div className={styles.vazio}>Nenhuma região encontrada com os filtros selecionados.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mesorregião</th>
                    <th>UF</th>
                    <th>Total de prospects</th>
                    <th>Cobertura</th>
                    <th>Interessados</th>
                    <th>Aguardando</th>
                    <th>Mercado virgem</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{d.mesorregiao}</td>
                      <td>{d.uf}</td>
                      <td>{d.total.toLocaleString('pt-BR')}</td>
                      <td>
                        <div className={styles.barWrap}>
                          <div className={styles.bar}>
                            <div className={styles.barFill} style={{
                              width: `${d.cobertura_pct}%`,
                              background: barColor(d.cobertura_pct),
                            }} />
                          </div>
                          <span className={styles.barPct} style={{ color: barColor(d.cobertura_pct) }}>
                            {d.cobertura_pct}%
                          </span>
                        </div>
                      </td>
                      <td>
                        {d.interessados > 0
                          ? <span className={`${styles.pill} ${styles.pillVerde}`}>{d.interessados.toLocaleString('pt-BR')}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td>
                        {d.aguardando > 0
                          ? <span className={`${styles.pill} ${styles.pillAmarelo}`}>{d.aguardando.toLocaleString('pt-BR')}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ color: '#1d4ed8', fontWeight: 500 }}>
                        {(d.total - d.contatados).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
