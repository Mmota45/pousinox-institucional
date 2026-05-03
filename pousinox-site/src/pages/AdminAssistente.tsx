import { useState, useRef, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { aiHubChat } from '../lib/aiHelper'
import UsageDashboard from '../components/assistente/UsageDashboard'
import ModelSelector, { ModelBadge, type ModelKey } from '../components/assistente/ModelSelector'
import ActionConfirm from '../components/assistente/ActionConfirm'
import FileUpload from '../components/assistente/FileUpload'
import KnowledgeBase from '../components/assistente/KnowledgeBase'
import StudioPanel from '../components/assistente/StudioPanel'
import type { ToolCall, ActionResult } from '../components/assistente/actions/executeAction'
import ChartRenderer, { type ChartConfig } from '../components/assistente/ChartRenderer'
import s from './AdminAssistente.module.css'

interface RAGSource { file: string; excerpt: string; similarity: number; chunks: number }
interface Msg { role: 'user' | 'assistant'; content: string; model?: string; rag_sources?: RAGSource[]; badges?: string[] }

/* ════════════════════════════════════════════════════════════
   Icons (inline SVG — no deps)
   ════════════════════════════════════════════════════════════ */
const ico = {
  chart:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  users:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  trophy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20v2h10v-2c0-.76-.85-1.25-2.03-1.79C14.47 17.98 14 17.55 14 17v-2.34"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/></svg>,
  tag:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M12.586 2.586A2 2 0 0011.172 2H4a2 2 0 00-2 2v7.172a2 2 0 00.586 1.414l8.704 8.704a2.426 2.426 0 003.42 0l6.58-6.58a2.426 2.426 0 000-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>,
  bulb:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 006 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg>,
  alert:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.hlIcon}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>,
  bot:    <svg className={s.avatarSvg} viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 110 2h-1.17A7.002 7.002 0 0113 22h-2a7.002 7.002 0 01-6.83-6H3a1 1 0 110-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm0 7a5 5 0 00-5 5 5 5 0 005 5h0a5 5 0 005-5 5 5 0 00-5-5zm-2 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm4 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>,
}

/* ════════════════════════════════════════════════════════════
   Markdown → Structured Blocks parser
   ════════════════════════════════════════════════════════════ */
interface Block {
  type: 'title' | 'table' | 'bullets' | 'text' | 'chart' | 'highlights'
  content: string
  rows?: string[][]
  align?: string[]
  chart?: ChartConfig
  items?: string[]
}

function parseBlocks(text: string): Block[] {
  // Pré-processar: extrair blocos ```chart``` antes do parse linha a linha
  const chartPlaceholders: Record<string, ChartConfig> = {}
  let processedText = text.replace(/```chart\s*\n([\s\S]*?)```/g, (_, json) => {
    try {
      const config = JSON.parse(json.trim()) as ChartConfig
      const id = `__CHART_${Object.keys(chartPlaceholders).length}__`
      chartPlaceholders[id] = config
      return id
    } catch { return '' }
  })

  const lines = processedText.split('\n')
  const blocks: Block[] = []
  let tRows: string[][] = [], tAlign: string[] = []
  let bLines: string[] = [], tLines: string[] = [], hLines: string[] = []

  const flushB = () => { if (bLines.length) { blocks.push({ type: 'bullets', content: bLines.join('\n') }); bLines = [] } }
  const flushT = () => { if (tLines.length) { blocks.push({ type: 'text', content: tLines.join('\n') }); tLines = [] } }
  const flushTbl = () => { if (tRows.length) { blocks.push({ type: 'table', content: '', rows: tRows, align: tAlign }); tRows = []; tAlign = [] } }
  const flushH = () => { if (hLines.length) { blocks.push({ type: 'highlights', content: '', items: [...hLines] }); hLines = [] } }

  for (const line of lines) {
    const t = line.trim()
    // Detectar chart placeholder
    if (t.startsWith('__CHART_') && t.endsWith('__') && chartPlaceholders[t]) {
      flushB(); flushT(); flushTbl()
      blocks.push({ type: 'chart', content: '', chart: chartPlaceholders[t] })
      continue
    }
    if (t.startsWith('|') && t.endsWith('|')) {
      flushB(); flushT()
      const cells = t.slice(1, -1).split('|').map(c => c.trim())
      if (cells.every(c => /^[-:]+$/.test(c))) { tAlign = cells.map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'); continue }
      tRows.push(cells); continue
    }
    if (tRows.length) flushTbl()
    if (t.startsWith('#')) { flushB(); flushT(); blocks.push({ type: 'title', content: t.replace(/^#+\s*/, '') }); continue }
    if (t.startsWith('- ') || t.startsWith('* ')) { flushT(); bLines.push(t.slice(2)); continue }
    const nm = t.match(/^\d+\.\s(.+)/); if (nm) { flushT(); bLines.push(nm[1]); continue }
    if (t.startsWith('>')) { flushB(); flushT(); flushTbl(); hLines.push(t.replace(/^>\s*/, '')); continue }
    if (hLines.length) flushH()
    if (!t) { flushB(); flushT(); continue }
    flushB(); tLines.push(t)
  }
  flushB(); flushT(); flushTbl(); flushH()
  return blocks
}

/* ── Inline formatter (bold + code) ── */
function fmt(t: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|`(.+?)`)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) parts.push(t.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<code key={m.index}>{m[3]}</code>)
    last = m.index + m[0].length
  }
  if (last < t.length) parts.push(t.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

/* ── Is money value? ── */
function isMoney(v: string) { return /R\$/.test(v) }

/* ── Extract KPIs from table ── */
function extractKPIs(rows: string[][], hdr: string[]) {
  const kpis: { label: string; value: string; icon: React.ReactNode }[] = []
  if (rows.length < 2) return kpis
  const mc = hdr.findIndex(h => /fatura|valor|total|receita/i.test(h))
  if (mc >= 0) {
    const vals = rows.map(r => parseFloat((r[mc] || '').replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0)
    const total = vals.reduce((a, b) => a + b, 0)
    kpis.push({ label: 'Receita Total', value: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: ico.chart })
    const max = Math.max(...vals)
    if (total > 0) kpis.push({ label: 'Top Cliente', value: `${Math.round((max / total) * 100)}%`, icon: ico.trophy })
  }
  kpis.push({ label: 'Registros', value: `${rows.length}`, icon: ico.users })
  const sc = hdr.findIndex(h => /segm|categ|tipo/i.test(h))
  if (sc >= 0) {
    const cnt: Record<string, number> = {}
    rows.forEach(r => { const v = r[sc]?.trim(); if (v) cnt[v] = (cnt[v] || 0) + 1 })
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]
    if (top) kpis.push({ label: 'Segmento Líder', value: top[0], icon: ico.tag })
  }
  return kpis
}

/* ── Auto-generate highlights from table data ── */
function autoHighlights(rows: string[][], rawHdr: string[]): string[] {
  const hl: string[] = []
  if (rows.length < 2) return hl
  const hdr = rawHdr.map(h => h.replace(/\*\*/g, '').trim())
  const mc = hdr.findIndex(h => /fatura|valor|total|receita|gasto/i.test(h))
  const nc = hdr.findIndex(h => /client|empresa|nome|razao|social/i.test(h))
  const cc = hdr.findIndex(h => /cidade|local|uf/i.test(h))
  const sc = hdr.findIndex(h => /segm|categ|tipo/i.test(h))

  if (mc >= 0) {
    const parse = (v: string) => parseFloat((v || '').replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0
    const vals = rows.map(r => parse(r[mc]))
    const total = vals.reduce((a, b) => a + b, 0)
    const maxIdx = vals.indexOf(Math.max(...vals))
    if (nc >= 0 && total > 0) {
      const pct = Math.round((vals[maxIdx] / total) * 100)
      hl.push(`🏆 **${rows[maxIdx][nc]}** é o maior cliente, com ${pct}% do faturamento total`)
    }
    // Concentração top 3
    if (rows.length >= 3 && total > 0) {
      const top3 = vals.slice(0, 3).reduce((a, b) => a + b, 0)
      hl.push(`📊 Top 3 concentram ${Math.round((top3 / total) * 100)}% do faturamento total`)
    }
  }

  if (cc >= 0) {
    const cidades: Record<string, number> = {}
    rows.forEach(r => { const c = r[cc]?.trim(); if (c && c !== '-') cidades[c] = (cidades[c] || 0) + 1 })
    const topCidade = Object.entries(cidades).sort((a, b) => b[1] - a[1])[0]
    if (topCidade && topCidade[1] > 1) hl.push(`📍 **${topCidade[0]}** concentra ${topCidade[1]} dos ${rows.length} maiores clientes`)
  }

  if (sc >= 0) {
    const segs: Record<string, number> = {}
    rows.forEach(r => { const v = r[sc]?.trim(); if (v && v !== '-') segs[v] = (segs[v] || 0) + 1 })
    const topSeg = Object.entries(segs).sort((a, b) => b[1] - a[1])[0]
    if (topSeg && topSeg[1] > 1) hl.push(`💡 Segmento **${topSeg[0]}** aparece ${topSeg[1]} vezes no top ${rows.length}`)
  }

  return hl.slice(0, 4)
}

/* ── Detect column semantic type for alignment ── */
function colClass(hdr: string, idx: number, totalCols: number): string {
  const h = hdr.toLowerCase()
  if (/posi[cç]|#|rank|nº|pos\b/.test(h) || (idx === 0 && totalCols > 3)) return s.colPos
  if (/client|empresa|nome|razao/.test(h)) return s.colCliente
  if (/fatura|valor|total|receita|custo|preço|preco/.test(h)) return s.colFat
  if (/segm|categ|tipo/.test(h)) return s.colSeg
  if (/cidade|local|uf|estado|munic/.test(h)) return s.colCidade
  return ''
}

function cellAlign(hdr: string): string {
  const h = hdr.toLowerCase()
  if (/posi[cç]|#|rank|nº|pos\b/.test(h)) return s.center
  if (/fatura|valor|total|receita|custo|preço|preco/.test(h)) return s.right
  return ''
}

function cellStyle(hdr: string): string {
  const h = hdr.toLowerCase()
  if (/client|empresa|nome|razao/.test(h)) return s.bold
  if (/fatura|valor|total|receita|custo/.test(h)) return s.mono
  return ''
}

/* ════════════════════════════════════════════════════════════
   Render response — structured card or plain fallback
   ════════════════════════════════════════════════════════════ */
function RenderResponse({ text, onFollowUp }: { text: string; onFollowUp?: (q: string) => void }) {
  const blocks = parseBlocks(text)
  const hasTable = blocks.some(b => b.type === 'table')
  const hasTitle = blocks.some(b => b.type === 'title')
  const hasChart = blocks.some(b => b.type === 'chart')

  if ((!hasTable && !hasChart) || !hasTitle) return <PlainResponse blocks={blocks} onFollowUp={onFollowUp} />

  const titleBlock = blocks.find(b => b.type === 'title')!
  const tableBlock = blocks.find(b => b.type === 'table')!
  const hdr = (tableBlock.rows?.[0] || []).map(h => h.replace(/\*\*/g, '').trim())
  const rows = tableBlock.rows?.slice(1) || []
  const kpis = extractKPIs(rows, hdr)
  const bullets = blocks.filter(b => b.type === 'bullets')
  const texts = blocks.filter(b => b.type === 'text')
  const subTitles = blocks.filter(b => b.type === 'title').slice(1)

  // % column
  const moneyCol = hdr.findIndex(h => /fatura|valor|total|receita|gasto/i.test(h))
  const parseVal = (v: string) => parseFloat((v || '').replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0
  const moneyVals = moneyCol >= 0 ? rows.map(r => parseVal(r[moneyCol])) : []
  const moneyTotal = moneyVals.reduce((a, b) => a + b, 0)
  const showPct = moneyCol >= 0 && moneyTotal > 0

  // Auto highlights
  const hasModelHighlights = blocks.some(b => b.type === 'highlights')
  const generatedHighlights = hasModelHighlights ? [] : autoHighlights(rows, hdr)

  // Export functions
  const exportCSV = () => {
    const allHdr = showPct ? [...hdr, '%'] : hdr
    const csvRows = [allHdr.join(';'), ...rows.map((r, i) => {
      const row = showPct ? [...r, (moneyVals[i] / moneyTotal * 100).toFixed(2) + '%'] : r
      return row.join(';')
    })]
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${titleBlock.content.replace(/[^a-zA-Z0-9]/g, '_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const copyTable = () => {
    const allHdr = showPct ? [...hdr, '%'] : hdr
    const txt = [allHdr.join('\t'), ...rows.map((r, i) => {
      const row = showPct ? [...r, (moneyVals[i] / moneyTotal * 100).toFixed(2) + '%'] : r
      return row.join('\t')
    })].join('\n')
    navigator.clipboard.writeText(txt)
  }

  return (
    <div className={s.reportCard}>
      <div className={s.reportHeader}>
        <h3 className={s.reportTitle}>{fmt(titleBlock.content)}</h3>
      </div>

      {kpis.length > 0 && (
        <div className={s.kpiStrip}>
          {kpis.map((k, i) => (
            <div key={i} className={s.kpi}>
              <div className={s.kpiLabel}>{k.icon} {k.label}</div>
              <div className={s.kpiVal}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className={s.tableActions}>
          <button className={s.tableActionBtn} onClick={exportCSV} title="Baixar CSV">📥 CSV</button>
          <button className={s.tableActionBtn} onClick={copyTable} title="Copiar tabela">📋 Copiar</button>
        </div>
      )}
      {rows.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <colgroup>
              {hdr.map((h, i) => <col key={i} className={colClass(h, i, hdr.length)} />)}
              {showPct && <col />}
            </colgroup>
            <thead>
              <tr>
                {hdr.map((h, i) => <th key={i} className={cellAlign(h)}>{h}</th>)}
                {showPct && <th className={s.right}>%</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? s.rowTop : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`${cellAlign(hdr[ci])} ${cellStyle(hdr[ci])}`}>
                      {fmt(cell)}
                    </td>
                  ))}
                  {showPct && <td className={`${s.right} ${s.mono}`}>{(moneyVals[ri] / moneyTotal * 100).toFixed(2)}%</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {blocks.filter(b => b.type === 'chart' && b.chart).map((b, i) => (
        <ChartRenderer key={`chart-${i}`} config={b.chart!} />
      ))}

      {(bullets.length > 0 || texts.length > 0) && (
        <div className={s.highlights}>
          {subTitles.map((b, i) => (
            <h4 key={i} className={s.highlightsTitle}>{fmt(b.content)}</h4>
          ))}
          <div className={s.highlightsGrid}>
            {bullets.flatMap(b => b.content.split('\n')).map((line, i) => {
              const warn = /⚠|urgente|atenção|crítico|alerta|recomend/i.test(line)
              const plainLine = line.replace(/\*\*/g, '')
              return (
                <div
                  key={i}
                  className={`${s.hlItem} ${s.hlClickable} ${warn ? s.hlWarn : ''}`}
                  onClick={() => onFollowUp?.(`Aprofunde: ${plainLine}`)}
                  role="button"
                  title="Clique para aprofundar"
                >
                  {warn ? ico.alert : ico.bulb}
                  <span>{fmt(line)}</span>
                </div>
              )
            })}
          </div>
          {texts.map((b, i) => (
            <p key={i} className={s.highlightsTitle} style={{ fontWeight: 400, marginTop: 6 }}>{fmt(b.content)}</p>
          ))}
        </div>
      )}

      {generatedHighlights.length > 0 && (
        <div className={s.hlCards}>
          {generatedHighlights.map((item, j) => (
            <div key={j} className={`${s.hlCard} ${s.hlCardClickable}`}
              onClick={() => onFollowUp?.(`Aprofunde: ${item.replace(/\*\*/g, '').replace(/^[^\w\s]*\s*/, '')}`)}
              role="button" title="Clique para aprofundar">
              {fmt(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlainAutoHighlights({ blocks, onFollowUp }: { blocks: Block[]; onFollowUp?: (q: string) => void }) {
  if (blocks.some(b => b.type === 'highlights')) return null
  const tb = blocks.find(b => b.type === 'table' && b.rows && b.rows.length > 2)
  if (!tb) return null
  const ah = autoHighlights(tb.rows!.slice(1), tb.rows![0])
  if (!ah.length) return null
  return (
    <div className={s.hlCards}>
      {ah.map((item, j) => (
        <div key={j} className={`${s.hlCard} ${s.hlCardClickable}`}
          onClick={() => onFollowUp?.(`Aprofunde: ${item.replace(/\*\*/g, '').replace(/^[^\w\s]*\s*/, '')}`)}
          role="button" title="Clique para aprofundar">
          {fmt(item)}
        </div>
      ))}
    </div>
  )
}

/* ── Plain fallback ── */
function PlainResponse({ blocks, onFollowUp }: { blocks: Block[]; onFollowUp?: (q: string) => void }) {
  return (
    <div className={s.plain}>
      {blocks.map((b, i) => {
        if (b.type === 'title') return <h3 key={i}>{fmt(b.content)}</h3>
        if (b.type === 'bullets') return (
          <div key={i}>
            {b.content.split('\n').map((l, j) => (
              <div key={j} style={{ paddingLeft: 16, position: 'relative', margin: '3px 0' }}>
                <span style={{ position: 'absolute', left: 4, color: '#9ca3af' }}>•</span>{fmt(l)}
              </div>
            ))}
          </div>
        )
        if (b.type === 'chart' && b.chart) return <ChartRenderer key={i} config={b.chart} />
        if (b.type === 'highlights' && b.items?.length) return (
          <div key={i} className={s.hlCards}>
            {b.items.map((item, j) => {
              const warn = /⚠|urgente|atenção|crítico|alerta/i.test(item)
              const plainItem = item.replace(/\*\*/g, '').replace(/^[^\w\s]*\s*/, '')
              return (
                <div
                  key={j}
                  className={`${s.hlCard} ${s.hlCardClickable} ${warn ? s.hlCardWarn : ''}`}
                  onClick={() => onFollowUp?.(plainItem)}
                  role="button"
                  title="Clique para perguntar"
                >
                  {fmt(item)}
                </div>
              )
            })}
          </div>
        )
        if (b.type === 'table') {
          const hdr = b.rows?.[0] || [], body = b.rows?.slice(1) || []
          return (
            <div key={i} className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr>{hdr.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={isMoney(c) ? s.right : ''}>{fmt(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )
        }
        return <p key={i}>{fmt(b.content)}</p>
      })}

      {<PlainAutoHighlights blocks={blocks} onFollowUp={onFollowUp} />}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Config
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   Intelligent model routing (from AdminIA)
   ════════════════════════════════════════════════════════════ */
function escolherProviderModelo(texto: string): { provider: string; modelo: string; motivo: string } {
  const t = texto.toLowerCase()
  if (/\b(código|code|programa|function|sql|api|bug|html|css|javascript|typescript|react|python|script|deploy|docker|git)\b/.test(t))
    return { provider: 'openrouter', modelo: 'qwen/qwen3-coder-480b:free', motivo: 'Código → Qwen3 Coder 480B' }
  if (/\b(raciocín|lógic[ao]|matemátic|calcul[aeo]|demonstr|prov[ae]r?\b|equação|fórmula|resolver)\b/.test(t))
    return { provider: 'openrouter', modelo: 'deepseek/deepseek-r1:free', motivo: 'Raciocínio → DeepSeek R1' }
  if (/\b(analis[ea]|estratégia|relatório|report|planeja|mercado|comparar|pesquis[ea]|estud[oa]|dados|dashboard)\b/.test(t))
    return { provider: 'gemini', modelo: 'gemini-2.5-flash', motivo: 'Análise/estratégia → Gemini 2.5 Flash' }
  if (/\b(pitch|vend[ae]|comercial|marketing|post|instagram|facebook|cliente|proposta|email|campanha|texto|redação)\b/.test(t))
    return { provider: 'cohere', modelo: 'command-a-03-2025', motivo: 'Comercial/marketing → Cohere Command A' }
  if (/\b(traduz|translate|resum[oa]|summarize|sintetiz)\b/.test(t))
    return { provider: 'openrouter', modelo: 'google/gemini-2.5-flash-exp:free', motivo: 'Tradução/resumo → Gemini Flash (free)' }
  if (/\b(cri[ea]|ideia|brainstorm|sugir[ae]|inov[ae]|imagin[ea]|banner|design|inspiração)\b/.test(t))
    return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Criativo → Llama 3.3 70B' }
  return { provider: 'groq', modelo: 'llama-3.3-70b-versatile', motivo: 'Geral → Llama 3.3 70B' }
}

const SEARCH_SOURCES = [
  { id: 'auto', label: '🔍 Auto' },
  { id: 'brave', label: '🦁 Brave' },
  { id: 'serper', label: '🔎 Google' },
  { id: 'none', label: '❌ Sem busca' },
] as const

const PRESETS = [
  { label: '📊 Resumo financeiro', prompt: 'Faça um resumo financeiro do mês atual: receitas, despesas, saldo, principais categorias.' },
  { label: '🏭 Status produção', prompt: 'Qual o status atual das ordens de produção? Quantas estão em andamento, planejadas e concluídas este mês?' },
  { label: '📦 Estoque crítico', prompt: 'Quais itens de estoque estão abaixo do estoque mínimo? Liste com saldo atual e mínimo.' },
  { label: '🔍 Top clientes', prompt: 'Quais são os 10 maiores clientes por faturamento? Inclua segmento e cidade.' },
  { label: '📈 Pipeline', prompt: 'Resuma o pipeline comercial: quantos deals por estágio, valor total previsto, deals mais antigos.' },
  { label: '🧾 Orçamentos', prompt: 'Quantos orçamentos estão com status "enviado" aguardando resposta? Liste os mais antigos.' },
  { label: '⚠️ NCs abertas', prompt: 'Existem não-conformidades abertas na qualidade? Liste com severidade e status.' },
  { label: '📋 Manutenções', prompt: 'Quais ordens de manutenção estão abertas ou em execução? Prioridades altas primeiro.' },
  { label: '🎯 Prospecção', prompt: 'Analise a base de prospecção: quantos prospects por UF, segmentos com mais empresas, score médio e oportunidades.' },
  { label: '🌍 Estudo mercado', prompt: 'Analise as keywords de mercado: volume total de busca, UFs com mais demanda, segmentos com oportunidade e gaps.' },
  { label: '📢 Campanhas', prompt: 'Resuma as campanhas de marketing: quais estão ativas, ROI, investimento total e conversões.' },
  { label: '📝 Conteúdo site', prompt: 'Qual o status dos conteúdos do site? Quantos posts publicados, rascunhos pendentes e temas cobertos.' },
]

const SYSTEM_PROMPT = `Você é o assistente inteligente da **Pousinox** — indústria metalúrgica especializada em aço inoxidável, fundada em 2001 em Pouso Alegre/MG.

IDENTIDADE DA EMPRESA (use naturalmente, NÃO liste como ficha cadastral):
- **Pousinox** é especializada na **fabricação de produtos** em aço inoxidável: equipamentos, mobiliário e peças sob medida — bancadas, fogões industriais, coifas, corrimãos, lava-botas, tanques, prateleiras, carrinhos e centenas de outros itens
- **Fixador de porcelanato** (produto recente, um dos centenas): insert metálico em aço inox (modelos 304 e 430) parafusado na parede, que impede a queda do revestimento cerâmico. Segurança mecânica complementar à argamassa. Para detalhes sobre laudos e ensaios, consulte os documentos da base de conhecimento
- **Corte a laser** em aço inox para peças e projetos sob medida
- Atende 14+ segmentos: construção civil, restaurantes/food service, hospitais, hotéis, supermercados, açougues/frigoríficos, indústria alimentícia, condomínios, laboratórios, entre outros
- Abrangência: desde projetos unitários sob medida até demandas industriais em série
- Sites: pousinox.com.br | fixadorporcelanato.com.br

DADOS CADASTRAIS (citar APENAS quando perguntado diretamente):
- CNPJ: 12.115.379/0001-64 | Empresa de Pequeno Porte
- Endereço: Av. Antonio Mariosa, 4545 — Santa Angelina, Pouso Alegre/MG
- NÃO misture dados cadastrais (CNPJ, porte) com descrições de atuação ou produtos

TOM E ESTILO:
- Fale como um consultor interno experiente — direto, útil, com personalidade
- Seja conciso mas completo. Não repita dados óbvios. Não peça desculpas
- Quando falar da Pousinox, fale com propriedade e orgulho (é a SUA empresa)
- Use dados reais do sistema quando disponíveis — números, nomes, datas concretas
- NUNCA invente dados. Se não tiver, diga "não tenho essa informação no sistema"

CAPACIDADES:
- Analisar dados do ERP: financeiro, estoque, produção, vendas, pipeline, qualidade, manutenção, prospecção, mercado
- Gerar insights acionáveis e resumos executivos
- Responder sobre produtos, segmentos, processos e estratégia

FORMATAÇÃO:
- Markdown: **negrito**, bullets, tabelas com pipes |
- Valores: R$ 1.234,56
- GRÁFICOS: quando dados numéricos se beneficiariam, inclua \`\`\`chart com JSON: {"type":"bar|line|pie|area","title":"Título","data":[{"name":"A","value":10}],"xKey":"name","yKeys":["value"],"colors":["#2563eb"]}
- SUGESTÕES: ao final, inclua 2-4 PERGUNTAS de follow-up usando blockquote (>). TODAS devem terminar com "?". SEM emojis. Máximo 8 palavras cada.
  ERRADO (NÃO faça assim): > Faturamento crescente  |  > Equipamentos de alta qualidade
  CERTO (faça assim): > Qual o faturamento deste mês?  |  > Quais produtos mais vendem?  |  > Como está o estoque atual?`

/* ════════════════════════════════════════════════════════════
   Data fetching — context from Supabase
   ════════════════════════════════════════════════════════════ */
async function buscarContexto(prompt: string): Promise<string> {
  const lower = prompt.toLowerCase()
  const partes: string[] = []

  async function q(table: string, label: string, opts?: { filter?: (query: ReturnType<typeof supabaseAdmin.from>) => ReturnType<typeof supabaseAdmin.from>; limit?: number }) {
    try {
      let query = supabaseAdmin.from(table).select('*')
      if (opts?.filter) query = opts.filter(query) as typeof query
      const { data, error } = await query.limit(opts?.limit ?? 30)
      if (error) { console.warn(`[Assistente] Erro ${table}:`, error.message); return }
      if (data?.length) partes.push(`${label} (${data.length} registros):\n${JSON.stringify(data)}`)
    } catch (e) { console.warn(`[Assistente] Falha ${table}:`, e) }
  }

  const queries: Promise<void>[] = []
  if (lower.match(/financ|receita|despesa|saldo|dre|caixa/)) queries.push(q('fin_lancamentos', 'LANÇAMENTOS FINANCEIROS', { limit: 50 }))
  if (lower.match(/pipeline|deal|comercial|funil|negoci/)) queries.push(q('pipeline_deals', 'PIPELINE DEALS'))
  if (lower.match(/produ[cç]|ordem|op-/i)) queries.push(q('ordens_producao', 'ORDENS DE PRODUÇÃO'))
  if (lower.match(/estoqu|saldo|m[ií]nimo|mp|pa|invent/)) queries.push(q('estoque_itens', 'ESTOQUE', { limit: 50 }))
  if (lower.match(/client|rfm|faturamento|top.*client/)) {
    queries.push(q('clientes', 'CLIENTES (total_gasto=faturamento acumulado total)', { limit: 30, filter: (qr) => qr.order('total_gasto', { ascending: false }) }))
    // Buscar NFs apenas para perguntas sobre período específico (não para ranking geral)
    if (lower.match(/2026|2025|2024|mês|mes|este ano|último|periodo|período|trimestre|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/)) {
      queries.push(q('nf_cabecalho', 'NOTAS FISCAIS INDIVIDUAIS (use para filtrar por período, agrupe por destinatario)', { limit: 50, filter: (qr) => qr.select('destinatario,emissao,total,cnpj').order('emissao', { ascending: false }) }))
    }
  }
  if (lower.match(/or[cç]amento|proposta|enviado/)) queries.push(q('orcamentos', 'ORÇAMENTOS'))
  if (lower.match(/qualidade|nc|n[aã]o.conform|inspe[cç]/)) { queries.push(q('nao_conformidades', 'NÃO-CONFORMIDADES', { limit: 20 })); queries.push(q('inspecoes', 'INSPEÇÕES', { limit: 20 })) }
  if (lower.match(/manuten|om-|corretiva|preventiva/)) queries.push(q('ordens_manutencao', 'ORDENS DE MANUTENÇÃO', { limit: 20 }))
  if (lower.match(/compra|fornecedor|pedido.*compra|solicita/)) queries.push(q('pedidos_compra', 'PEDIDOS DE COMPRA', { limit: 20 }))
  if (lower.match(/venda|nf.*venda/)) {
    queries.push(q('vendas', 'VENDAS'))
    queries.push(q('nf_cabecalho', 'NOTAS FISCAIS EMITIDAS', { limit: 50, filter: (qr) => qr.select('destinatario,emissao,total,cnpj').order('emissao', { ascending: false }) }))
  }

  // Prospecção
  if (lower.match(/prospec|prospect|cnpj|empresa.*busca|lead.*frio|base.*empresa|score|ativo.*prospect/))
    queries.push(q('prospeccao', 'PROSPECÇÃO', { limit: 30 }))

  // Estudo de Mercado
  if (lower.match(/mercado|keyword|volume.*busca|demand|oportunidade|concorr|segmento.*uf|uf.*segmento|gkp|google.*keyword|cruzamento/))
    queries.push(q('market_keywords', 'KEYWORDS DE MERCADO', { limit: 40 }))

  // Analytics / Campanhas
  if (lower.match(/analytics|visita|tráfego|trafego|sessão|sessao|pagina.*vista|conversão|conversao|campanha|meta.*ads|google.*ads|roi|ctr|cpc/))
    queries.push(q('campanhas', 'CAMPANHAS MARKETING', { limit: 20 }))

  // Conteúdo do site
  if (lower.match(/conte[uú]do|blog|post|artigo|seo|página|pagina.*site|publicação|publicacao/))
    queries.push(q('conteudos', 'CONTEÚDOS DO SITE', { limit: 20 }))

  await Promise.all(queries)

  console.log(`[Assistente] Contexto: ${partes.length} blocos carregados`, partes.map(p => p.split('\n')[0]))
  return partes.length
    ? `\n\n--- DADOS DO SISTEMA (use SOMENTE estes dados para responder) ---\nIMPORTANTE: Use APENAS os nomes, valores e informações abaixo. NÃO invente nenhum dado que não esteja listado aqui.\n\n${partes.join('\n\n')}\n--- FIM DOS DADOS ---`
    : '\n\n[NOTA: Nenhum dado do sistema foi encontrado para esta pergunta. Diga claramente que não há dados disponíveis. NÃO invente exemplos ou dados fictícios.]'
}

/* ════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'pousinox_assistente_msgs'
const THREADS_KEY = 'pousinox_assistente_threads'
interface Thread { id: string; title: string; msgs: Msg[]; date: string }

function loadMsgs(): Msg[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : [] }
  catch { return [] }
}

function loadThreads(): Thread[] {
  try { const raw = localStorage.getItem(THREADS_KEY); return raw ? JSON.parse(raw) : [] }
  catch { return [] }
}

function saveThreads(threads: Thread[]) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads))
}


function RAGSources({ sources }: { sources: RAGSource[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className={s.ragSources}>
      <div className={s.ragSourcesTitle}>📎 Fontes ({sources.length} documentos)</div>
      {sources.map(src => (
        <div key={src.file}>
          <button className={s.ragSourceBtn} onClick={() => setOpen(open === src.file ? null : src.file)}>
            📄 {src.file.replace(/\.[^.]+$/, '').slice(0, 50)}
            <span className={s.ragChunkCount}>{src.chunks} trecho{src.chunks > 1 ? 's' : ''}</span>
          </button>
          {open === src.file && (
            <div className={s.ragSourceExcerpt}>{src.excerpt}</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function AdminAssistente() {
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs)
  const [threads, setThreads] = useState<Thread[]>(loadThreads)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showUsage, setShowUsage] = useState(false)
  const [modelo, setModelo] = useState<ModelKey>(() => (localStorage.getItem('assistente_modelo') as ModelKey) || 'auto')
  const [pendingTools, setPendingTools] = useState<{ tools: ToolCall[]; historico: { role: string; content: string }[] } | null>(null)
  const [ragEnabled, setRagEnabled] = useState(() => localStorage.getItem('assistente_rag') === '1')
  const [revisorAtivo, setRevisorAtivo] = useState(false)
  const [showKb, setShowKb] = useState(false)
  const [showGuias, setShowGuias] = useState(false)
  const [guias, setGuias] = useState<{ id: string; titulo: string; categoria: string; nivel: string }[]>([])
  const [guiaExpandido, setGuiaExpandido] = useState<string | null>(null)
  const [guiaDetalhe, setGuiaDetalhe] = useState<Record<string, unknown> | null>(null)
  const [searchSource, setSearchSource] = useState<string>(() => localStorage.getItem('assistente_search') || 'auto')
  const [webQuery, setWebQuery] = useState('')
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem('assistente_custom_prompt') || '')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function salvarConversa() {
    if (msgs.length === 0) return
    const firstUser = msgs.find(m => m.role === 'user')
    const title = firstUser ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '…' : '') : 'Conversa'
    const thread: Thread = { id: Date.now().toString(), title, msgs, date: new Date().toLocaleDateString('pt-BR') }
    const updated = [thread, ...threads].slice(0, 20)
    setThreads(updated)
    saveThreads(updated)
    setMsgs([])
  }

  function carregarConversa(t: Thread) {
    setMsgs(t.msgs)
  }

  function excluirConversa(id: string) {
    const updated = threads.filter(t => t.id !== id)
    setThreads(updated)
    saveThreads(updated)
  }

  // Persistir mensagens no localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
  }, [msgs])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  // Carregar guias do knowledge
  useEffect(() => {
    supabaseAdmin.from('knowledge_guias').select('id, titulo, categoria, nivel').eq('ativo', true).order('categoria').order('titulo')
      .then(({ data }) => { if (data) setGuias(data) })
  }, [])

  const carregarGuia = useCallback(async (id: string) => {
    if (guiaExpandido === id) { setGuiaExpandido(null); setGuiaDetalhe(null); return }
    setGuiaExpandido(id)
    const { data } = await supabaseAdmin.from('knowledge_guias').select('*').eq('id', id).single()
    if (data) setGuiaDetalhe(data)
  }, [guiaExpandido])

  const enviar = useCallback(async (texto?: string, forceSearchSource?: string) => {
    const msg = (texto || input).trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Msg = { role: 'user', content: msg }
    setMsgs(prev => [...prev, userMsg])
    setLoading(true)
    try {
      // Quando RAG ativo: não buscar contexto ERP e enviar só a última mensagem (sem histórico contaminante)
      let historico: { role: string; content: string }[]
      if (ragEnabled) {
        historico = [{ role: 'user', content: msg + '\n\n**SAÍDA OBRIGATÓRIA**: Ao final, 2-4 linhas de destaque começando com > e emoji (ex: > 📌 Insight). NUNCA omita.' }]
      } else {
        const contexto = await buscarContexto(msg)
        historico = [...msgs, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }))
        const outputHint = '\n\n**SAÍDA OBRIGATÓRIA**: 1) Tabela ordenada DESC pelo valor principal. 2) Ao final, 2-4 linhas de destaque começando com > e emoji (ex: > 📌 Insight). NUNCA omita os destaques.'
        if (contexto) historico[historico.length - 1] = { ...historico[historico.length - 1], content: historico[historico.length - 1].content + outputHint + contexto }
        else historico[historico.length - 1] = { ...historico[historico.length - 1], content: historico[historico.length - 1].content + outputHint }
      }
      // Roteamento inteligente quando modelo=auto
      // Mapear para modelos válidos do assistente-chat: haiku, sonnet, gemini, groq, cerebras, mistral
      let usarModelo: string | undefined
      let motivo = ''
      if (modelo === 'auto') {
        const escolha = escolherProviderModelo(msg)
        motivo = escolha.motivo
        // Mapear provider→modelo válido no edge function
        const providerMap: Record<string, string> = {
          groq: 'groq',
          gemini: 'gemini',
          cohere: 'groq', // fallback
          openrouter: 'cerebras', // fallback para modelos grandes
        }
        usarModelo = providerMap[escolha.provider] || 'groq'
      }

      const systemFinal = SYSTEM_PROMPT + (customPrompt ? `\n\nInstruções do usuário: ${customPrompt}` : '')
      console.log('[Assistente] ragEnabled:', ragEnabled, 'modelo:', modelo, 'search:', searchSource, 'roteamento:', motivo || 'manual', 'msgs:', historico.length)

      let data: Record<string, unknown>, error: unknown
      const effectiveSearch = forceSearchSource || searchSource

      if (ragEnabled && !forceSearchSource) {
        // RAG ativo — rotear via assistente-chat (suporta embeddings)
        // Groq funciona bem para RAG e tem API key configurada
        const ragModel = (modelo !== 'auto') ? modelo : 'groq'
        const res = await supabaseAdmin.functions.invoke('assistente-chat', {
          body: {
            messages: historico,
            system: systemFinal,
            model: ragModel,
            rag: true,
          },
        })
        data = res.data ? (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) : {}
        error = res.error
      } else {
        // Sempre via ai-hub — tem contexto rico (banco + site + busca web)
        const providerModel = usarModelo || modelo
        const provMap: Record<string, { provider: string; model: string }> = {
          groq: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
          gemini: { provider: 'gemini', model: 'gemini-2.0-flash' },
          cerebras: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
          auto: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        }
        const target = provMap[providerModel] || provMap.groq
        const res = await supabaseAdmin.functions.invoke('ai-hub', {
          body: {
            action: 'chat',
            provider: target.provider,
            model: target.model,
            messages: historico,
            search_source: effectiveSearch === 'none' ? 'auto' : effectiveSearch,
            ...(systemFinal ? { system: systemFinal } : {}),
          },
        })
        data = res.data ? (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) : {}
        error = res.error
        // Normalizar resposta ai-hub → formato assistente-chat
        if (data?.ok && data?.response) {
          data = { content: data.response as string, model: `${target.provider}/${target.model}`, web_search: data?.web_search || false }
        }
      }
      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = data as any
      // Se tem tool_calls, mostrar modal de confirmação
      if (parsed?.tool_calls?.length) {
        if (parsed.content) setMsgs(prev => [...prev, { role: 'assistant', content: parsed.content, model: parsed.model }])
        setPendingTools({ tools: parsed.tool_calls, historico })
        setLoading(false)
        return
      }
      const mainContent = parsed?.content || parsed?.message || parsed?.error || 'Sem resposta.'
      const msgBadges: string[] = []
      if (parsed?.rag_used) msgBadges.push('📚 RAG')
      if (parsed?.web_search) msgBadges.push('🌐 Web')
      if (motivo) msgBadges.push(`🤖 ${motivo}`)
      setMsgs(prev => [...prev, { role: 'assistant', content: mainContent, model: parsed?.model, rag_sources: parsed?.rag_sources, badges: msgBadges.length ? msgBadges : undefined }])

      // Modo Revisor: segunda IA valida a resposta
      if (revisorAtivo && mainContent && !parsed?.error) {
        try {
          const review = await aiHubChat(
            mainContent,
            { provider: 'groq', model: 'llama-3.3-70b-versatile' },
            'Você é um revisor crítico. Analise a resposta abaixo e:\n1. Aponte erros factuais ou lógicos\n2. Identifique omissões importantes\n3. Sugira melhorias\n4. Dê uma nota de 0-10\nSeja direto e objetivo. Português brasileiro.',
          )
          if (review.response) {
            setMsgs(prev => [...prev, { role: 'assistant', content: `🔍 **Revisão IA** _(${review.model}, ${((review.tempo || 0) / 1000).toFixed(1)}s)_\n\n${review.response}` }])
          }
        } catch { /* revisor falhou silenciosamente */ }
      }
    } catch (err: unknown) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Erro: ${err instanceof Error ? err.message : 'desconhecido'}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, msgs, modelo, ragEnabled, revisorAtivo, searchSource])

  // Após confirmação das ações, enviar tool_results de volta ao Claude
  const handleActionComplete = useCallback(async (results: { tool_id: string; result: ActionResult }[]) => {
    setPendingTools(null)
    setLoading(true)
    try {
      const hist = pendingTools?.historico ?? []
      // Adicionar assistant tool_use + user tool_result no histórico
      const toolUseContent = pendingTools?.tools.map(t => ({ type: 'tool_use', id: t.id, name: t.name, input: t.input })) ?? []
      const toolResultContent = results.map(r => ({ type: 'tool_result', tool_use_id: r.tool_id, content: JSON.stringify(r.result) }))
      const updatedHist = [
        ...hist,
        { role: 'assistant', content: toolUseContent },
        { role: 'user', content: toolResultContent },
      ]
      const { data, error } = await supabaseAdmin.functions.invoke('assistente-chat', { body: { messages: updatedHist, system: SYSTEM_PROMPT, model: modelo } })
      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      const summary = results.map(r => r.result.success ? `✅ ${r.result.message}` : `❌ ${r.result.message}`).join('\n')
      setMsgs(prev => [...prev,
        { role: 'assistant', content: summary },
        { role: 'assistant', content: parsed?.content || 'Ação concluída.', model: parsed?.model },
      ])
    } catch (err: unknown) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Erro após ação: ${err instanceof Error ? err.message : 'desconhecido'}` }])
    } finally {
      setLoading(false)
    }
  }, [pendingTools, modelo])

  const handleActionCancel = useCallback(() => {
    setPendingTools(null)
    setMsgs(prev => [...prev, { role: 'assistant', content: 'Ação cancelada pelo usuário.' }])
  }, [])

  const handleFileResult = useCallback((content: string, filename: string) => {
    setMsgs(prev => [
      ...prev,
      { role: 'user', content: `📎 Arquivo enviado: ${filename}` },
      { role: 'assistant', content },
    ])
  }, [])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const [metaAberto, setMetaAberto] = useState(false)
  const [mobileTab, setMobileTab] = useState<'fontes' | 'chat' | 'studio'>('chat')
  const [docCount, setDocCount] = useState(0)

  // Studio: generate output using RAG context
  const handleStudioGenerate = useCallback(async (_tipo: string, prompt: string) => {
    const historico = [{ role: 'user', content: prompt + '\n\nUse as fontes da base de conhecimento para gerar o conteúdo.' }]
    const { data, error } = await supabaseAdmin.functions.invoke('assistente-chat', {
      body: { messages: historico, system: SYSTEM_PROMPT, model: modelo, rag: true },
    })
    if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return parsed?.content || parsed?.message || 'Sem resultado.'
  }, [modelo])

  return (
    <div className={s.wrap}>
      {/* Mobile tabs */}
      <div className={s.mobileTabs}>
        <button className={`${s.mobileTab} ${mobileTab === 'fontes' ? s.mobileTabActive : ''}`} onClick={() => setMobileTab('fontes')}>📎 Fontes</button>
        <button className={`${s.mobileTab} ${mobileTab === 'chat' ? s.mobileTabActive : ''}`} onClick={() => setMobileTab('chat')}>💬 Conversa</button>
        <button className={`${s.mobileTab} ${mobileTab === 'studio' ? s.mobileTabActive : ''}`} onClick={() => setMobileTab('studio')}>✨ Estúdio</button>
      </div>

      {/* LEFT — Fontes */}
      <div className={`${s.fontePanel} ${mobileTab === 'fontes' ? s.fontePanelMobileVisible : ''}`}>
        <div className={s.fonteHeader}>
          <span className={s.fonteTitle}>Fontes</span>
        </div>
        <div className={s.fonteBody}>
          <KnowledgeBase
            ragEnabled={ragEnabled}
            onRagToggle={v => { setRagEnabled(v); localStorage.setItem('assistente_rag', v ? '1' : '0') }}
            onAskQuestion={q => { setInput(q); setMobileTab('chat'); setTimeout(() => inputRef.current?.focus(), 50) }}
            onDocCountChange={setDocCount}
          />

          {/* Busca web */}
          <div className={s.webSearchBox}>
            <div className={s.webSearchInputRow}>
              <input
                className={s.webSearchInput}
                placeholder="Pesquise novas fontes na web"
                value={webQuery}
                onChange={e => setWebQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && webQuery.trim()) { const src = searchSource !== 'none' ? searchSource : 'auto'; enviar(webQuery.trim(), src); setWebQuery(''); setMobileTab('chat') } }}
              />
              <button className={s.webSearchBtn} disabled={!webQuery.trim()} onClick={() => { if (webQuery.trim()) { const src = searchSource !== 'none' ? searchSource : 'auto'; enviar(webQuery.trim(), src); setWebQuery(''); setMobileTab('chat') } }}>→</button>
            </div>
            <div className={s.webSearchRow}>
              <select className={s.webSearchSelect} value={searchSource} onChange={e => { setSearchSource(e.target.value); localStorage.setItem('assistente_search', e.target.value) }}>
                <option value="none">Sem busca</option>
                <option value="auto">Auto</option>
                <option value="brave">Brave</option>
                <option value="google">Google</option>
              </select>
            </div>
          </div>

          {/* Histórico de conversas */}
          <div className={s.histSection}>
            <button className={s.histSectionBtn} onClick={() => setShowKb(v => !v)}>📂 Conversas {threads.length > 0 ? `(${threads.length})` : ''} {showKb ? '▾' : '▸'}</button>
            {showKb && (
              <div className={s.histList}>
                <button className={s.histNovaBtn} onClick={() => { setMsgs([]); setMobileTab('chat') }} style={{ width: '100%', marginBottom: 6 }}>+ Nova conversa</button>
                {threads.map(t => (
                  <div key={t.id} className={s.histItem}>
                    <button className={s.histItemBtn} onClick={() => { carregarConversa(t); setMobileTab('chat') }}>
                      <span className={s.histItemTitulo}>{t.title}</span>
                      <span className={s.histItemData}>{t.date}</span>
                    </button>
                    <button className={s.histItemExcluir} onClick={() => excluirConversa(t.id)} title="Excluir">✕</button>
                  </div>
                ))}
                {threads.length === 0 && <p className={s.histVazio}>Nenhuma conversa salva</p>}
              </div>
            )}
          </div>

          {/* Guias de conhecimento */}
          <div className={s.histSection}>
            <button className={s.histSectionBtn} onClick={() => setShowGuias(v => !v)}>📘 Guias {guias.length > 0 ? `(${guias.length})` : ''} {showGuias ? '▾' : '▸'}</button>
            {showGuias && (
              <div className={s.guiasList}>
                {guias.length === 0 && <p className={s.histVazio}>Nenhum guia cadastrado</p>}
                {guias.map(g => (
                  <div key={g.id} className={s.guiaItem}>
                    <button className={s.guiaItemBtn} onClick={() => carregarGuia(g.id)}>
                      <span className={s.guiaItemTitulo}>{g.titulo}</span>
                      <span className={s.guiaItemMeta}>{g.categoria} · {g.nivel}</span>
                    </button>
                    {guiaExpandido === g.id && guiaDetalhe && (
                      <div className={s.guiaDetalhe}>
                        {(guiaDetalhe as Record<string, string>).o_que_e && <div className={s.guiaBloco}><strong>O que é</strong><p>{(guiaDetalhe as Record<string, string>).o_que_e}</p></div>}
                        {(guiaDetalhe as Record<string, string>).quando_usar && <div className={s.guiaBloco}><strong>Quando usar</strong><p>{(guiaDetalhe as Record<string, string>).quando_usar}</p></div>}
                        {(guiaDetalhe as Record<string, string>).como_fazer && <div className={s.guiaBloco}><strong>Como fazer</strong><pre className={s.guiaCodigo}>{(guiaDetalhe as Record<string, string>).como_fazer}</pre></div>}
                        {(guiaDetalhe as Record<string, string>).onde_fazer && <div className={s.guiaBloco}><strong>Onde fazer</strong><p>{(guiaDetalhe as Record<string, string>).onde_fazer}</p></div>}
                        {(guiaDetalhe as Record<string, string>).por_que && <div className={s.guiaBloco}><strong>Por quê</strong><p>{(guiaDetalhe as Record<string, string>).por_que}</p></div>}
                        <button className={s.guiaUsarBtn} onClick={() => { setInput(`Explique sobre: ${(guiaDetalhe as Record<string, string>).titulo}`); setMobileTab('chat'); setTimeout(() => inputRef.current?.focus(), 50) }}>💬 Perguntar à IA</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={s.histSection}>
            <button className={s.histSectionBtn} onClick={() => setShowUsage(v => !v)}>💰 Custos API {showUsage ? '▾' : '▸'}</button>
            {showUsage && <UsageDashboard />}
          </div>
        </div>
      </div>

      {/* CENTER — Conversa */}
      <div className={s.chatArea}>
        {msgs.length > 0 && (
          <div className={s.chatHeader}>
            <span className={s.chatTitle}>{msgs.find(m => m.role === 'user')?.content.slice(0, 60) || 'Nova conversa'}</span>
          </div>
        )}
        {msgs.length === 0 ? (
          <div className={s.welcome}>
            <h2 className={s.welcomeTitle}>Assistente Pousinox</h2>
            <p className={s.welcomeSub}>Consulte dados do ERP com inteligência artificial</p>
            <div className={s.sugestoes}>
              {PRESETS.slice(0, 4).map((p, i) => (
                <button key={i} className={s.sugestaoBtn} onClick={() => { const u = JSON.parse(localStorage.getItem('assistente_preset_usage') || '{}'); u[p.label] = (u[p.label] || 0) + 1; localStorage.setItem('assistente_preset_usage', JSON.stringify(u)); enviar(p.prompt) }} disabled={loading}>
                  <span className={s.sugestaoBtnIcon}>{p.label.slice(0, 2)}</span>
                  {p.label.slice(2).trim()}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={s.scroll} ref={scrollRef}>
            <div className={s.content}>
              {msgs.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} className={s.userRow}>
                    <div className={s.userBubble}>{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className={s.botRow}>
                    {(() => {
                      const lines = m.content.split('\n')
                      const sugLines = lines.filter(l => l.trim().startsWith('>'))
                      const mainText = lines.filter(l => !l.trim().startsWith('>')).join('\n').trimEnd()
                      const suggestions = sugLines.map(l => l.trim().replace(/^>\s*/, '').replace(/\*\*/g, '').replace(/^[^\w\sÀ-ÿ]*\s*/, '').trim()).filter(s => s && s.endsWith('?'))
                      return (
                        <>
                          <div className={s.botContent}>
                            <RenderResponse text={mainText} onFollowUp={enviar} />
                            {m.rag_sources?.length ? <RAGSources sources={m.rag_sources} /> : null}
                            <div className={s.msgMeta}>
                              <ModelBadge model={m.model} />
                              {m.badges?.map((b, j) => <span key={j} className={s.msgBadge}>{b}</span>)}
                            </div>
                          </div>
                          {suggestions.length > 0 && (
                            <div className={s.suggestionsBar}>
                              {suggestions.map((sug, j) => (
                                <button key={j} className={s.suggestionChip} onClick={() => enviar(sug)}>
                                  {sug}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )
              ))}
              {loading && (
                <div className={s.typingRow}>
                  <div className={s.typingBox}>
                    <div className={s.dots}><span /><span /><span /></div>
                    Analisando dados…
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={s.composer}>
          <div className={s.composerInner}>
            <FileUpload disabled={loading} onResult={handleFileResult} />
            <textarea
              ref={inputRef}
              className={s.composerInput}
              placeholder="Pergunte sobre o sistema..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
            />
            {docCount > 0 && <span className={s.composerFontes}>{docCount} fonte{docCount !== 1 ? 's' : ''}</span>}
            <button className={s.composerSend} onClick={() => enviar()} disabled={loading || !input.trim()} aria-label="Enviar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div className={s.composerMeta}>
            <div className={s.metaRow}>
              <select
                className={s.metaSelect}
                value={modelo}
                onChange={e => { setModelo(e.target.value as ModelKey); localStorage.setItem('assistente_modelo', e.target.value) }}
              >
                <option value="auto">🤖 Auto</option>
                <option value="gemini">💎 Gemini</option>
                <option value="groq">⚡ Groq</option>
                <option value="cerebras">🧠 Cerebras</option>
                <option value="mistral">🌀 Mistral</option>
                <option value="haiku">🍃 Haiku</option>
                <option value="sonnet">🎵 Sonnet</option>
              </select>
              <select
                className={s.metaSelect}
                value={searchSource}
                onChange={e => { setSearchSource(e.target.value); localStorage.setItem('assistente_search', e.target.value) }}
              >
                {SEARCH_SOURCES.map(src => <option key={src.id} value={src.id}>{src.label}</option>)}
              </select>
              {msgs.length > 0 && <button className={s.metaBtn} onClick={salvarConversa}>💾 Salvar</button>}
              {msgs.length > 0 && <button className={s.metaBtn} onClick={() => setMsgs([])}>+ Nova</button>}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Estúdio */}
      <div className={`${s.studioPanel} ${mobileTab === 'studio' ? s.studioPanelMobileVisible : ''}`}>
        <StudioPanel fonteCount={docCount} onGenerate={handleStudioGenerate} onGuiaSaved={() => {
          supabaseAdmin.from('knowledge_guias').select('id, titulo, categoria, nivel').eq('ativo', true).order('categoria').order('titulo')
            .then(({ data }) => { if (data) setGuias(data) })
        }} />
      </div>

      {pendingTools && (
        <ActionConfirm
          tools={pendingTools.tools}
          onComplete={handleActionComplete}
          onCancel={handleActionCancel}
        />
      )}
    </div>
  )
}
