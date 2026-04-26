import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabaseAdmin } from '../../lib/supabase'
import s from './UsageDashboard.module.css'

interface UsageRow {
  dia: string
  function_name: string
  model: string
  requests: number
  input_tokens: number
  output_tokens: number
  custo_usd: number
}

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

const MODULE_COLORS: Record<string, string> = {
  'assistente-chat': '#2563eb',
  'extrair-memorial': '#7c3aed',
  'extrair-orcamento': '#0d9488',
  'gerar-artigo': '#ea580c',
  'gerar-conteudo': '#d946ef',
  'gerar-embeddings': '#6b7280',
}

const USD_BRL = 5.70

function fmtBrl(v: number) { return `R$ ${(v * USD_BRL).toFixed(2).replace('.', ',')}` }
function fmtUsd(v: number) { return `US$ ${v.toFixed(4)}` }

export default function UsageDashboard() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - period)
    const { data } = await supabaseAdmin
      .from('vw_ai_usage_diario')
      .select('*')
      .gte('dia', since.toISOString().slice(0, 10))
      .order('dia', { ascending: false })
      .limit(500)
    setRows((data as UsageRow[]) ?? [])
    setLoading(false)
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className={s.emptyMsg}>Carregando...</div>
  if (!rows.length) return <div className={s.emptyMsg}>Sem dados de uso</div>

  // Totais
  const totalUsd = rows.reduce((a, r) => a + Number(r.custo_usd), 0)
  const totalReqs = rows.reduce((a, r) => a + r.requests, 0)
  const totalTokens = rows.reduce((a, r) => a + r.input_tokens + r.output_tokens, 0)

  // Por módulo
  const byModule: Record<string, number> = {}
  rows.forEach(r => { byModule[r.function_name] = (byModule[r.function_name] || 0) + Number(r.custo_usd) })
  const modules = Object.entries(byModule).sort((a, b) => b[1] - a[1])

  // Chart: custo por dia
  const byDay: Record<string, number> = {}
  rows.forEach(r => { byDay[r.dia] = (byDay[r.dia] || 0) + Number(r.custo_usd) })
  const chartData = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([dia, custo]) => ({ dia: dia.slice(5), custo: +(custo * USD_BRL).toFixed(2) }))

  return (
    <div className={s.panel}>
      <div className={s.periodRow}>
        {PERIODS.map(p => (
          <button
            key={p.days}
            className={`${s.periodBtn} ${period === p.days ? s.periodActive : ''}`}
            onClick={() => setPeriod(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={s.summaryGrid}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Custo</div>
          <div className={s.summaryVal}>{fmtBrl(totalUsd)}</div>
          <div className={s.summarySub}>{fmtUsd(totalUsd)}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Requests</div>
          <div className={s.summaryVal}>{totalReqs}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Tokens</div>
          <div className={s.summaryVal}>{totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens}</div>
        </div>
      </div>

      {chartData.length > 1 && (
        <>
          <div className={s.sectionTitle}>Custo diário (R$)</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: -20 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: unknown) => [`R$ ${Number(v).toFixed(2)}`, 'Custo']} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="custo" radius={[3, 3, 0, 0]} maxBarSize={16}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? '#2563eb' : '#d1d5db'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className={s.sectionTitle}>Por módulo</div>
      <div className={s.moduleList}>
        {modules.map(([name, custo]) => (
          <div key={name} className={s.moduleRow}>
            <div className={s.moduleDot} style={{ background: MODULE_COLORS[name] || '#9ca3af' }} />
            <span className={s.moduleName}>{name}</span>
            <span className={s.moduleVal}>{fmtBrl(custo)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
