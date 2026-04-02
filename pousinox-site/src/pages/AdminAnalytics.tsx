import { useState, useEffect } from 'react'
import styles from './AdminAnalytics.module.css'

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/ga4-metrics'

interface GA4Data {
  ultimos30dias: { sessoes: number; usuarios: number; taxaRejeicao: number; duracaoMedia: number }
  ultimos7dias: { sessoes: number; usuarios: number }
  topPaginas: { titulo: string; visualizacoes: number }[]
  canais: { canal: string; sessoes: number }[]
  cidades: { cidade: string; estado: string; usuarios: number }[]
}

const canalLabel: Record<string, string> = {
  'Organic Search': 'Busca orgânica',
  'Direct': 'Direto',
  'Referral': 'Referência',
  'Organic Social': 'Redes sociais',
  'Paid Search': 'Busca paga',
  'Email': 'E-mail',
  'Unassigned': 'Não classificado',
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function subtractDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISO(d)
}

const PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

export default function AdminAnalytics() {
  const today = toISO(new Date())
  const [startDate, setStartDate] = useState(subtractDays(30))
  const [endDate, setEndDate] = useState(today)
  const [presetAtivo, setPresetAtivo] = useState(30)
  const [ga4, setGa4] = useState<GA4Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => { fetchGA4(startDate, endDate) }, [])

  async function fetchGA4(start: string, end: string) {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`${EDGE_URL}?startDate=${start}&endDate=${end}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setGa4(json)
    } catch (e) {
      setErro(String(e))
    }
    setLoading(false)
  }

  function aplicarPreset(days: number) {
    const start = subtractDays(days)
    setStartDate(start)
    setEndDate(today)
    setPresetAtivo(days)
    fetchGA4(start, today)
  }

  function aplicarDatas() {
    setPresetAtivo(0)
    fetchGA4(startDate, endDate)
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`

  const periodoLabel = presetAtivo
    ? `Últimos ${presetAtivo} dias`
    : `${startDate} → ${endDate}`

  return (
    <div className={styles.wrap}>

      {/* ── Filtro de período ── */}
      <div className={styles.filtroBar}>
        <div className={styles.presets}>
          {PRESETS.map(p => (
            <button
              key={p.days}
              className={`${styles.presetBtn} ${presetAtivo === p.days ? styles.presetBtnAtivo : ''}`}
              onClick={() => aplicarPreset(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={styles.dataPicker}>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => { setStartDate(e.target.value); setPresetAtivo(0) }}
            className={styles.dateInput}
          />
          <span className={styles.dataSep}>até</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={e => { setEndDate(e.target.value); setPresetAtivo(0) }}
            className={styles.dateInput}
          />
          <button className={styles.aplicarBtn} onClick={aplicarDatas}>
            Aplicar
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando dados do Google Analytics…</div>
      ) : erro ? (
        <div className={styles.erroBox}>
          Erro ao carregar Analytics: {erro}
          <button onClick={() => fetchGA4(startDate, endDate)} className={styles.retryBtn}>
            Tentar novamente
          </button>
        </div>
      ) : ga4 ? (
        <>
          {/* ── Cards resumo ── */}
          <div className={styles.sectionLabel}>{periodoLabel}</div>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardIcon}>👥</span>
              <strong className={styles.cardValue}>{ga4.ultimos30dias.sessoes.toLocaleString('pt-BR')}</strong>
              <span className={styles.cardLabel}>Sessões</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardIcon}>👤</span>
              <strong className={styles.cardValue}>{ga4.ultimos30dias.usuarios.toLocaleString('pt-BR')}</strong>
              <span className={styles.cardLabel}>Usuários únicos</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardIcon}>↩️</span>
              <strong className={styles.cardValue}>{(ga4.ultimos30dias.taxaRejeicao * 100).toFixed(1)}%</strong>
              <span className={styles.cardLabel}>Taxa de rejeição</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardIcon}>⏱</span>
              <strong className={styles.cardValue}>{fmtDur(ga4.ultimos30dias.duracaoMedia)}</strong>
              <span className={styles.cardLabel}>Duração média</span>
            </div>
          </div>

          {/* ── Grid de detalhes ── */}
          <div className={styles.grid3}>

            <div className={styles.box}>
              <h3 className={styles.boxTitle}>📄 Páginas mais visitadas</h3>
              {ga4.topPaginas.length === 0 ? (
                <p className={styles.vazio}>Aguardando dados…</p>
              ) : ga4.topPaginas.map((p, i) => (
                <div key={i} className={styles.rankItem}>
                  <span className={styles.rankPos}>{i + 1}</span>
                  <span className={styles.rankLabel}>{p.titulo.replace(' | POUSINOX®', '').replace('Pousinox — ', '')}</span>
                  <span className={styles.rankVal}>{p.visualizacoes.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>

            <div className={styles.box}>
              <h3 className={styles.boxTitle}>📊 Origem do tráfego</h3>
              {ga4.canais.length === 0 ? (
                <p className={styles.vazio}>Aguardando dados…</p>
              ) : ga4.canais.map((c, i) => {
                const total = ga4.canais.reduce((s, x) => s + x.sessoes, 0)
                const pct = total > 0 ? Math.round((c.sessoes / total) * 100) : 0
                return (
                  <div key={i} className={styles.barItem}>
                    <span className={styles.barLabel}>{canalLabel[c.canal] ?? c.canal}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.barPct}>{pct}%</span>
                    <span className={styles.barNum}>{c.sessoes}</span>
                  </div>
                )
              })}
            </div>

            <div className={styles.box}>
              <h3 className={styles.boxTitle}>📍 Top cidades</h3>
              {ga4.cidades.length === 0 ? (
                <p className={styles.vazio}>Aguardando dados…</p>
              ) : ga4.cidades.map((c, i) => {
                const total = ga4.cidades.reduce((s, x) => s + x.usuarios, 0)
                const pct = total > 0 ? Math.round((c.usuarios / total) * 100) : 0
                return (
                  <div key={i} className={styles.barItem}>
                    <span className={styles.barLabel}>{c.cidade}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.barPct}>{pct}%</span>
                    <span className={styles.barNum}>{c.usuarios}</span>
                  </div>
                )
              })}
            </div>

          </div>
        </>
      ) : null}
    </div>
  )
}
