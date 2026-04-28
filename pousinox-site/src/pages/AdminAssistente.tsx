import { useState, useRef, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import UsageDashboard from '../components/assistente/UsageDashboard'
import ModelSelector, { ModelBadge, type ModelKey } from '../components/assistente/ModelSelector'
import ActionConfirm from '../components/assistente/ActionConfirm'
import FileUpload from '../components/assistente/FileUpload'
import KnowledgeBase from '../components/assistente/KnowledgeBase'
import type { ToolCall, ActionResult } from '../components/assistente/actions/executeAction'
import ChartRenderer, { type ChartConfig } from '../components/assistente/ChartRenderer'
import s from './AdminAssistente.module.css'

interface RAGSource { file: string; excerpt: string; similarity: number; chunks: number }
interface Msg { role: 'user' | 'assistant'; content: string; model?: string; rag_sources?: RAGSource[] }

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
                  onClick={() => onFollowUp?.(`Aprofunde: ${plainItem}`)}
                  role="button"
                  title="Clique para aprofundar"
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

const SYSTEM_PROMPT = `Você é o assistente interno da Pousinox, indústria metalúrgica de Pouso Alegre/MG.

SOBRE A EMPRESA:
- Razão social: POUSINOX LTDA | CNPJ: 12.115.379/0001-64
- CNAE principal: 2829-1/99 — Fabricação de máquinas, equipamentos, peças e acessórios de uso geral
- Segmento: fabricação de peças, fixadores, acessórios e componentes em aço inoxidável
- Produtos: fixadores de porcelanato, suportes, abraçadeiras, peças sob medida, corte a laser inox, entre centenas de itens
- CNAEs secundários: manutenção de equipamentos (3319-8/00), comércio atacadista (4693-1/00), varejo (4789-0/99)
- Porte: Empresa de Pequeno Porte
- Localização: Av. Antonio Mariosa, 4545 — Santa Angelina, Pouso Alegre/MG

Seu papel:
- Analisar dados do ERP (financeiro, estoque, produção, vendas, pipeline, qualidade, manutenção, prospecção, mercado)
- Gerar resumos executivos e insights acionáveis
- Responder em português brasileiro, de forma concisa e direta
- Quando os dados forem fornecidos em contexto, analisar e responder com base neles
- Se não tiver dados suficientes, dizer claramente o que falta
- NUNCA invente, fabrique ou simule dados. Se os dados do sistema não contêm a informação, diga "Não encontrei dados para..." em vez de criar exemplos fictícios. Dados inventados são PROIBIDOS. Só use números e nomes que estejam explicitamente nos dados fornecidos entre "--- DADOS DO SISTEMA ---"

REGRAS DE FORMATAÇÃO (obrigatório):
- Use markdown padrão: # para títulos, **negrito**, - para bullets
- Tabelas DEVEM usar sintaxe markdown com pipes: | Col1 | Col2 |, com separador |---|---|
- Nunca use tabs para alinhar colunas — sempre pipes |
- Valores monetários: R$ 1.234,56
- Formato direto, profissional, sem rodeios
- GRÁFICOS: quando o usuário pedir gráfico/chart ou quando dados numéricos se beneficiariam de visualização, inclua um bloco \`\`\`chart com JSON: {"type":"bar|line|pie|area","title":"Título","data":[{"name":"A","value":10}],"xKey":"name","yKeys":["value"],"colors":["#2563eb"]}. O bloco será renderizado como gráfico interativo.
- DESTAQUES: ao final de TODA resposta (curta ou longa, com ou sem tabela), inclua 2-4 destaques usando blockquote. Cada destaque em uma linha separada, começando com > e um emoji relevante. Exemplos:
  > 📌 Faturamento cresceu 15% vs mês anterior
  > ⚠️ 3 itens abaixo do estoque mínimo
  > 💡 Segmento construção civil concentra 40% da receita
  > 🏆 Cliente XYZ é o maior comprador do trimestre
  Os destaques devem ser insights acionáveis, dados-chave ou alertas relevantes da resposta.`

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
  const [showKb, setShowKb] = useState(false)
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

  const enviar = useCallback(async (texto?: string) => {
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
      console.log('[Assistente] ragEnabled:', ragEnabled, 'modelo:', modelo, 'msgs:', historico.length)
      const { data, error } = await supabaseAdmin.functions.invoke('assistente-chat', { body: { messages: historico, system: ragEnabled ? '' : SYSTEM_PROMPT, model: modelo, rag: ragEnabled } })
      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      // Se tem tool_calls, mostrar modal de confirmação
      if (parsed?.tool_calls?.length) {
        if (parsed.content) setMsgs(prev => [...prev, { role: 'assistant', content: parsed.content, model: parsed.model }])
        setPendingTools({ tools: parsed.tool_calls, historico })
        setLoading(false)
        return
      }
      const ragInfo = parsed?.rag_used ? '\n\n📚 _Resposta baseada na base de conhecimento_' : ''
      setMsgs(prev => [...prev, { role: 'assistant', content: (parsed?.content || parsed?.message || parsed?.error || 'Sem resposta.') + ragInfo, model: parsed?.model, rag_sources: parsed?.rag_sources }])
    } catch (err: unknown) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Erro: ${err instanceof Error ? err.message : 'desconhecido'}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, msgs, modelo, ragEnabled])

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

  return (
    <div className={s.container}>
      {/* ── Sidebar ── */}
      <div className={s.sidebar}>
        <div className={s.sideHead}>🤖 Assistente</div>
        <div className={s.sideSection}>Consultas rápidas</div>
        {[...PRESETS].sort((a, b) => {
          const usage = JSON.parse(localStorage.getItem('assistente_preset_usage') || '{}')
          return (usage[b.label] || 0) - (usage[a.label] || 0)
        }).map((p, i) => (
          <button key={i} className={s.sideBtn} onClick={() => { const u = JSON.parse(localStorage.getItem('assistente_preset_usage') || '{}'); u[p.label] = (u[p.label] || 0) + 1; localStorage.setItem('assistente_preset_usage', JSON.stringify(u)); enviar(p.prompt) }} disabled={loading}>
            {p.label}
          </button>
        ))}
        {msgs.length > 0 && (
          <>
            <div className={s.sideSection}>Conversa atual</div>
            <button className={s.sideBtn} onClick={salvarConversa}>💾 Salvar e nova</button>
            <button className={s.sideClear} onClick={() => setMsgs([])}>🗑 Limpar</button>
          </>
        )}
        {threads.length > 0 && (
          <>
            <div className={s.sideSection}>Histórico</div>
            <div className={s.threadList}>
              {threads.map(t => (
                <div key={t.id} className={s.threadItem}>
                  <button className={s.threadBtn} onClick={() => carregarConversa(t)} title={t.title}>
                    {t.title}
                  </button>
                  <button className={s.threadDel} onClick={() => excluirConversa(t.id)} title="Excluir">×</button>
                </div>
              ))}
            </div>
          </>
        )}
        {/* Custo API */}
        <div className={s.sideSection}>
          <button className={s.usageToggle} onClick={() => setShowUsage(v => !v)}>
            💰 Custos API {showUsage ? '▾' : '▸'}
          </button>
        </div>
        {showUsage && <UsageDashboard />}

        <div className={s.sideSection}>
          <button className={s.usageToggle} onClick={() => setShowKb(v => !v)}>
            📚 Base Conhecimento {showKb ? '▾' : '▸'}
          </button>
        </div>
        {showKb && <KnowledgeBase ragEnabled={ragEnabled} onRagToggle={v => { setRagEnabled(v); localStorage.setItem('assistente_rag', v ? '1' : '0') }} onAskQuestion={q => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }} />}

        <div className={s.sideSpacer} />
      </div>

      {/* ── Main ── */}
      <div className={s.main}>
        {/* Scroll container — ONLY vertical scroll in the page */}
        <div className={s.scroll} ref={scrollRef}>
          <div className={s.content}>
            {msgs.length === 0 && (
              <div className={s.empty}>
                <div>🤖</div>
                <strong>Assistente Pousinox</strong>
                <div>Consulte dados de financeiro, estoque, produção, vendas, pipeline, qualidade ou manutenção.</div>
              </div>
            )}

            {msgs.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className={s.userRow}>
                  <div className={s.userBubble}>{m.content}</div>
                </div>
              ) : (
                <div key={i} className={s.botRow}>
                  <div className={s.avatar}>{ico.bot}</div>
                  <div className={s.botContent}>
                    <RenderResponse text={m.content} onFollowUp={enviar} />
                    {m.rag_sources?.length ? <RAGSources sources={m.rag_sources} /> : null}
                    <ModelBadge model={m.model} />
                  </div>
                </div>
              )
            ))}

            {loading && (
              <div className={s.typingRow}>
                <div className={s.avatar}>{ico.bot}</div>
                <div className={s.typingBox}>
                  <div className={s.dots}><span /><span /><span /></div>
                  Analisando dados…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer — fixed bottom, outside scroll */}
        <div className={s.composer}>
          <div className={s.composerModel}>
            <ModelSelector value={modelo} onChange={m => { setModelo(m); localStorage.setItem('assistente_modelo', m) }} />
          </div>
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
            <button className={s.composerSend} onClick={() => enviar()} disabled={loading || !input.trim()} aria-label="Enviar">
              {loading ? '…' : '↑'}
            </button>
          </div>
          <div className={s.composerHint}>
            {ragEnabled && <span className={s.ragBadge}>📚 Base de conhecimento ativa</span>}
            Dados buscados automaticamente com base na sua pergunta
          </div>
        </div>
      </div>

      {/* Modal de confirmação de ações */}
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
