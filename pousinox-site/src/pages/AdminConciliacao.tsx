import { useState, useCallback, useEffect, useRef } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminConciliacao.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Conta { id: number; nome: string; banco: string | null; tipo: string; negocio: string }

interface EntradaExtrato {
  data: string           // YYYY-MM-DD
  valor: number          // positivo = crédito, negativo = débito
  descricao: string
  fitid: string | null
  tipo_lancamento: string | null
}

interface ExtratoRow {
  id: number
  conta_id: number | null
  data: string
  valor: number
  descricao: string | null
  tipo_lancamento: string | null
  fitid: string | null
  status: 'pendente' | 'conciliado' | 'ignorado'
  movimentacao_id: number | null
  confianca: 'alta' | 'media' | 'baixa' | null
  importado_em: string
  // join
  mov_descricao?: string | null
  mov_data?: string | null
  mov_valor?: number | null
  mov_categoria?: string | null
}

interface Movimentacao {
  id: number
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  descricao: string | null
  categoria_nome: string | null
  conta_id: number | null
  status: string
  conciliado: boolean
}

type Aba = 'importar' | 'revisao' | 'historico'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtData(v: string | null) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}


// ── Parser OFX (SGML 1.x — formato padrão bancos BR) ─────────────────────────
function parseOFX(text: string): EntradaExtrato[] {
  const entries: EntradaExtrato[] = []
  // Extrai todos os blocos <STMTTRN>...</STMTTRN>
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(text)) !== null) {
    const content = block[1]
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(content)
      return m ? m[1].trim() : null
    }
    const trnamt = parseFloat((get('TRNAMT') ?? '0').replace(',', '.'))
    const dtposted = get('DTPOSTED') ?? ''
    // OFX date: YYYYMMDD or YYYYMMDDHHmmss
    const year  = dtposted.slice(0, 4)
    const month = dtposted.slice(4, 6)
    const day   = dtposted.slice(6, 8)
    if (!year || !month || !day || isNaN(trnamt)) continue
    entries.push({
      data:            `${year}-${month}-${day}`,
      valor:           trnamt,
      descricao:       get('MEMO') ?? get('NAME') ?? '',
      fitid:           get('FITID'),
      tipo_lancamento: get('TRNTYPE'),
    })
  }
  return entries
}

// ── Parser CSV genérico ───────────────────────────────────────────────────────
function parseCSV(text: string): EntradaExtrato[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const idx = (candidates: string[]) =>
    candidates.reduce<number>((found, c) => found >= 0 ? found : headers.indexOf(c), -1)

  const iData  = idx(['data', 'date', 'dt lançamento', 'data lançamento', 'data mov'])
  const iValor = idx(['valor', 'value', 'amount', 'vlr lancamento', 'vlr. lancamento'])
  const iDesc  = idx(['descricao', 'descrição', 'historico', 'histórico', 'memo', 'description'])
  const iDoc   = idx(['doc', 'fitid', 'id transacao', 'id transação', 'nro doc'])

  if (iData < 0 || iValor < 0) return []

  const entries: EntradaExtrato[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const rawData  = cols[iData]  ?? ''
    const rawValor = cols[iValor] ?? '0'
    const desc     = iDesc >= 0 ? (cols[iDesc] ?? '') : ''
    const fitid    = iDoc  >= 0 ? (cols[iDoc]  ?? null) : null

    // Normaliza data: DD/MM/YYYY ou YYYY-MM-DD
    let data = rawData
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawData)) {
      const [d, m, y] = rawData.split('/')
      data = `${y}-${m}-${d}`
    }

    // Normaliza valor: aceita ponto e vírgula como separadores
    const valor = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'))
    if (isNaN(valor)) continue

    entries.push({ data, valor, descricao: desc, fitid: fitid || null, tipo_lancamento: null })
  }
  return entries
}

// ── Auto-match ────────────────────────────────────────────────────────────────
function autoMatch(
  entrada: EntradaExtrato,
  movs: Movimentacao[]
): { mov: Movimentacao; confianca: 'alta' | 'media' | 'baixa' } | null {
  const valorAbs = Math.abs(entrada.valor)
  const dataE = new Date(entrada.data).getTime()

  const scored = movs
    .filter(m => !m.conciliado)
    .map(m => {
      const valorM = m.valor
      const dataM  = new Date(m.data).getTime()
      const diffDias = Math.abs((dataE - dataM) / 86400000)
      const diffValor = Math.abs(valorAbs - valorM)
      const tipoOk = entrada.valor > 0
        ? m.tipo === 'entrada'
        : m.tipo === 'saida'
      if (!tipoOk || diffValor > 0.02) return null

      let score = 0
      if (diffDias === 0) score += 3
      else if (diffDias <= 1) score += 2
      else if (diffDias <= 3) score += 1
      else if (diffDias <= 7) score += 0
      else return null

      return { mov: m, score, diffDias }
    })
    .filter(Boolean) as { mov: Movimentacao; score: number; diffDias: number }[]

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const confianca: 'alta' | 'media' | 'baixa' =
    best.score >= 3 ? 'alta' : best.score >= 1 ? 'media' : 'baixa'
  return { mov: best.mov, confianca }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminConciliacao() {
  const [aba, setAba] = useState<Aba>('revisao')
  const [contas, setContas] = useState<Conta[]>([])
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Importar
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<EntradaExtrato[]>([])
  const [importando, setImportando] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Revisão
  const [extratoRows, setExtratoRows]   = useState<ExtratoRow[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pendente' | 'conciliado' | 'ignorado'>('pendente')
  const [filtroConta, setFiltroConta]   = useState('')
  const [selecionandoMov, setSelecionandoMov] = useState<number | null>(null) // extrato id
  const [movQuery, setMovQuery] = useState('')

  // Histórico
  const [histRows, setHistRows] = useState<ExtratoRow[]>([])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  const carregarContas = useCallback(async () => {
    const { data } = await supabaseAdmin.from('fin_contas').select('*').eq('ativo', true).order('nome')
    setContas((data ?? []) as Conta[])
    setLoading(false)
  }, [])
  useEffect(() => { carregarContas() }, [carregarContas])

  const carregarRevisao = useCallback(async () => {
    let q = supabaseAdmin
      .from('fin_extrato_bancario')
      .select('*')
      .order('data', { ascending: false })
      .limit(300)
    if (filtroStatus) q = q.eq('status', filtroStatus)
    if (filtroConta)  q = q.eq('conta_id', filtroConta)
    const { data } = await q
    setExtratoRows((data ?? []) as ExtratoRow[])

    // Carrega movimentações para mostrar vínculo e para busca manual
    const { data: movs } = await supabaseAdmin
      .from('vw_fin_extrato')
      .select('id, tipo, valor, data, descricao, categoria_nome, conta_id, status, conciliado')
      .order('data', { ascending: false })
      .limit(500)
    setMovimentacoes((movs ?? []) as Movimentacao[])
  }, [filtroStatus, filtroConta])

  useEffect(() => {
    if (aba === 'revisao') carregarRevisao()
    if (aba === 'historico') carregarHistorico()
  }, [aba, carregarRevisao])

  useEffect(() => {
    if (aba === 'revisao') carregarRevisao()
  }, [filtroStatus, filtroConta, aba, carregarRevisao])

  async function carregarHistorico() {
    const { data } = await supabaseAdmin
      .from('fin_extrato_bancario')
      .select('*')
      .eq('status', 'conciliado')
      .order('data', { ascending: false })
      .limit(200)
    setHistRows((data ?? []) as ExtratoRow[])
  }

  // ── Parse arquivo ───────────────────────────────────────────────────────────

  function handleArquivo(file: File) {
    setArquivo(file)
    setPreview([])
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const isOFX = file.name.toLowerCase().endsWith('.ofx') ||
                    text.includes('<OFX>') || text.includes('<STMTTRN>')
      const entradas = isOFX ? parseOFX(text) : parseCSV(text)
      setPreview(entradas.slice(0, 200))
      if (entradas.length === 0)
        setMsg({ tipo: 'erro', texto: 'Nenhuma transação encontrada. Verifique o formato do arquivo.' })
    }
    reader.readAsText(file, 'latin1')
  }

  // ── Importar com auto-match ─────────────────────────────────────────────────

  async function importar() {
    if (!preview.length || !contaSelecionada) {
      setMsg({ tipo: 'erro', texto: 'Selecione uma conta e carregue um arquivo.' })
      return
    }
    setImportando(true)
    setImportProgress(0)

    // Carrega movimentações da conta para auto-match
    const { data: movs } = await supabaseAdmin
      .from('vw_fin_extrato')
      .select('id, tipo, valor, data, descricao, categoria_nome, conta_id, status, conciliado')
      .eq('conta_id', contaSelecionada)
      .eq('status', 'realizado')
      .limit(500)
    const movsLocal = (movs ?? []) as Movimentacao[]

    let ok = 0; let dup = 0; let erro = 0
    for (let i = 0; i < preview.length; i++) {
      const e = preview[i]
      const match = autoMatch(e, movsLocal)

      const payload: Record<string, unknown> = {
        conta_id:       Number(contaSelecionada),
        data:           e.data,
        valor:          e.valor,
        descricao:      e.descricao || null,
        tipo_lancamento: e.tipo_lancamento || null,
        fitid:          e.fitid || null,
        status:         match ? 'pendente' : 'pendente',
        movimentacao_id: match ? match.mov.id : null,
        confianca:      match ? match.confianca : 'baixa',
      }

      const { error } = await supabaseAdmin.from('fin_extrato_bancario').upsert(payload, {
        onConflict: 'conta_id,fitid',
        ignoreDuplicates: true,
      })
      if (error) {
        if (error.code === '23505') dup++
        else erro++
      } else ok++

      setImportProgress(Math.round(((i + 1) / preview.length) * 100))
    }

    setImportando(false)
    setMsg({ tipo: 'ok', texto: `${ok} importadas${dup ? `, ${dup} duplicatas ignoradas` : ''}${erro ? `, ${erro} erros` : ''}.` })
    setPreview([])
    setArquivo(null)
    setAba('revisao')
    carregarRevisao()
  }

  // ── Confirmar conciliação ───────────────────────────────────────────────────

  async function confirmar(row: ExtratoRow) {
    if (!row.movimentacao_id) return
    await Promise.all([
      supabaseAdmin.from('fin_extrato_bancario').update({ status: 'conciliado' }).eq('id', row.id),
      supabaseAdmin.from('fin_movimentacoes').update({
        conciliado: true,
        conciliado_em: new Date().toISOString(),
        conciliado_por: 'extrato',
      }).eq('id', row.movimentacao_id),
    ])
    setMsg({ tipo: 'ok', texto: 'Conciliado.' })
    carregarRevisao()
  }

  async function ignorar(id: number) {
    await supabaseAdmin.from('fin_extrato_bancario').update({ status: 'ignorado' }).eq('id', id)
    carregarRevisao()
  }

  async function vincularManual(extratoId: number, movId: number) {
    await supabaseAdmin.from('fin_extrato_bancario').update({
      movimentacao_id: movId,
      confianca: 'alta',
    }).eq('id', extratoId)
    setSelecionandoMov(null)
    carregarRevisao()
  }

  async function criarMovimentacao(row: ExtratoRow) {
    const { data, error } = await supabaseAdmin.from('fin_movimentacoes').insert({
      tipo:       row.valor > 0 ? 'entrada' : 'saida',
      valor:      Math.abs(row.valor),
      data:       row.data,
      descricao:  row.descricao,
      conta_id:   row.conta_id,
      status:     'realizado',
      origem_tipo: 'extrato',
      conciliado: true,
      conciliado_em: new Date().toISOString(),
      conciliado_por: 'extrato',
    }).select('id').single()
    if (error) { setMsg({ tipo: 'erro', texto: error.message }); return }
    await supabaseAdmin.from('fin_extrato_bancario').update({
      status: 'conciliado',
      movimentacao_id: data?.id,
      confianca: 'alta',
    }).eq('id', row.id)
    setMsg({ tipo: 'ok', texto: 'Movimentação criada e conciliada.' })
    carregarRevisao()
  }

  async function desconciliar(row: ExtratoRow) {
    await supabaseAdmin.from('fin_extrato_bancario').update({ status: 'pendente' }).eq('id', row.id)
    if (row.movimentacao_id) {
      await supabaseAdmin.from('fin_movimentacoes').update({ conciliado: false, conciliado_em: null }).eq('id', row.movimentacao_id)
    }
    carregarHistorico()
  }

  const movsFiltradas = movimentacoes.filter(m =>
    !movQuery || m.descricao?.toLowerCase().includes(movQuery.toLowerCase()) ||
    String(m.valor).includes(movQuery)
  ).slice(0, 20)

  const pendentesCount = extratoRows.filter(r => r.status === 'pendente').length
  const autoMatchCount = extratoRows.filter(r => r.status === 'pendente' && r.movimentacao_id).length

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <div className={styles.wrap}>
      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {/* Abas */}
      <div className={styles.abas}>
        {([
          { key: 'revisao',   label: '✅ Revisão' },
          { key: 'importar',  label: '📄 Importar Extrato' },
          { key: 'historico', label: '🕓 Histórico' },
        ] as { key: Aba; label: string }[]).map(a => (
          <button key={a.key}
            className={`${styles.aba} ${aba === a.key ? styles.abaAtiva : ''}`}
            onClick={() => setAba(a.key)}>
            {a.label}
            {a.key === 'revisao' && pendentesCount > 0 && (
              <span className={styles.abaBadge}>{pendentesCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ IMPORTAR ══════════════════════════════════════════════════════════ */}
      {aba === 'importar' && (
        <div className={styles.importWrap}>
          <div className={styles.importCard}>
            <div className={styles.importTitulo}>Importar extrato bancário</div>
            <div className={styles.importDesc}>
              Suporta arquivos <strong>OFX</strong> (padrão Bradesco, Itaú, BB, Sicoob) e <strong>CSV</strong> (qualquer banco com colunas data / valor / descrição).
            </div>

            {/* Conta */}
            <div className={styles.field}>
              <label>Conta bancária *</label>
              <select className={styles.input} value={contaSelecionada}
                onChange={e => setContaSelecionada(e.target.value)}>
                <option value="">Selecione a conta…</option>
                {contas.map(c => <option key={c.id} value={String(c.id)}>{c.nome}{c.banco ? ` — ${c.banco}` : ''}</option>)}
              </select>
            </div>

            {/* Drop zone */}
            <div
              className={styles.dropZone}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dropZoneOver) }}
              onDragLeave={e => e.currentTarget.classList.remove(styles.dropZoneOver)}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.classList.remove(styles.dropZoneOver)
                const f = e.dataTransfer.files[0]
                if (f) handleArquivo(f)
              }}>
              <input ref={inputRef} type="file" accept=".ofx,.csv,.txt" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleArquivo(f) }} />
              <div className={styles.dropIcon}>📂</div>
              <div className={styles.dropText}>
                {arquivo ? arquivo.name : 'Arraste o arquivo OFX ou CSV aqui, ou clique para selecionar'}
              </div>
              {arquivo && (
                <button className={styles.btnRemover} onClick={e => { e.stopPropagation(); setArquivo(null); setPreview([]) }}>
                  ✕ Remover
                </button>
              )}
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <>
                <div className={styles.previewInfo}>
                  <strong>{preview.length}</strong> transações encontradas
                  {preview.some(p => p.fitid) && <span className={styles.tagOfx}>OFX</span>}
                  {!preview.some(p => p.fitid) && <span className={styles.tagCsv}>CSV</span>}
                </div>
                <div className={styles.tableScroll}>
                  <table className={styles.tabela}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                        <th>Tipo OFX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 20).map((e, i) => (
                        <tr key={i}>
                          <td className={styles.data}>{fmtData(e.data)}</td>
                          <td className={styles.descCell}>{e.descricao || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={e.valor >= 0 ? styles.valPos : styles.valNeg}>
                              {fmtBRL(e.valor)}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{e.tipo_lancamento ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 20 && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>… e mais {preview.length - 20} transações</div>
                )}
                <div className={styles.importAcoes}>
                  <button className={styles.btnPrimary} onClick={importar} disabled={importando || !contaSelecionada}>
                    {importando
                      ? `Importando… ${importProgress}%`
                      : `Importar ${preview.length} transações`}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Instruções */}
          <div className={styles.instrucoes}>
            <div className={styles.instrucoesTitulo}>Como exportar o extrato?</div>
            <div className={styles.instrucaoItem}><strong>Bradesco:</strong> Internet Banking → Conta Corrente → Extrato → Exportar OFX</div>
            <div className={styles.instrucaoItem}><strong>Itaú:</strong> Área logada → Extrato → Exportar → Formato OFX</div>
            <div className={styles.instrucaoItem}><strong>Banco do Brasil:</strong> Autoatendimento → Extrato → Exportar OFX</div>
            <div className={styles.instrucaoItem}><strong>Sicoob/Sicredi:</strong> Internet Banking → Extrato → Download OFX</div>
            <div className={styles.instrucaoItem}><strong>CSV genérico:</strong> Qualquer planilha com colunas: <em>data, valor, descrição</em></div>
          </div>
        </div>
      )}

      {/* ══ REVISÃO ═══════════════════════════════════════════════════════════ */}
      {aba === 'revisao' && (
        <div className={styles.revisaoWrap}>

          {/* Resumo */}
          {pendentesCount > 0 && (
            <div className={styles.revisaoResumo}>
              <div className={styles.resumoItem}>
                <strong>{pendentesCount}</strong>
                <span>pendentes de revisão</span>
              </div>
              <div className={styles.resumoDivider} />
              <div className={styles.resumoItem}>
                <strong className={styles.verde}>{autoMatchCount}</strong>
                <span>com match automático</span>
              </div>
              <div className={styles.resumoDivider} />
              <div className={styles.resumoItem}>
                <strong className={styles.vermelho}>{pendentesCount - autoMatchCount}</strong>
                <span>sem match — ação necessária</span>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className={styles.filtros}>
            <select className={styles.filtroSelect} value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="pendente">Pendentes</option>
              <option value="">Todos</option>
              <option value="conciliado">Conciliados</option>
              <option value="ignorado">Ignorados</option>
            </select>
            <select className={styles.filtroSelect} value={filtroConta}
              onChange={e => setFiltroConta(e.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
            </select>
            <button className={styles.btnSecondary} onClick={carregarRevisao}>↻ Atualizar</button>
          </div>

          {/* Tabela de conciliação */}
          {extratoRows.length === 0 ? (
            <div className={styles.vazio}>
              {filtroStatus === 'pendente'
                ? '🎉 Nenhum lançamento pendente de conciliação.'
                : 'Nenhum registro encontrado.'}
              {filtroStatus === 'pendente' && (
                <button className={styles.btnLinkSmall} onClick={() => setAba('importar')}>
                  Importar extrato →
                </button>
              )}
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.tabelaConcil}>
                <thead>
                  <tr>
                    <th>Data extrato</th>
                    <th>Descrição banco</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Confiança</th>
                    <th>Movimentação vinculada</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {extratoRows.map(row => {
                    const movVinc = movimentacoes.find(m => m.id === row.movimentacao_id)
                    const isSelecionando = selecionandoMov === row.id
                    return (
                      <>
                        <tr key={row.id} className={
                          row.status === 'conciliado' ? styles.rowConciliado
                          : row.status === 'ignorado' ? styles.rowIgnorado
                          : !row.movimentacao_id ? styles.rowSemMatch : ''
                        }>
                          <td className={styles.data}>{fmtData(row.data)}</td>
                          <td className={styles.descCell}>{row.descricao ?? '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={row.valor >= 0 ? styles.valPos : styles.valNeg}>
                              {fmtBRL(row.valor)}
                            </span>
                          </td>
                          <td>
                            {row.confianca === 'alta'  && <span className={styles.tagAlta}>✓ Alta</span>}
                            {row.confianca === 'media' && <span className={styles.tagMedia}>~ Média</span>}
                            {row.confianca === 'baixa' && !row.movimentacao_id && <span className={styles.tagSemMatch}>Sem match</span>}
                            {row.confianca === 'baixa' && row.movimentacao_id  && <span className={styles.tagMedia}>~ Baixa</span>}
                            {!row.confianca && <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td>
                            {movVinc ? (
                              <div>
                                <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{movVinc.descricao ?? '—'}</div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  {fmtData(movVinc.data)} · {fmtBRL(movVinc.valor)} · {movVinc.tipo}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#d1d5db', fontSize: '0.82rem' }}>Nenhuma vinculada</span>
                            )}
                          </td>
                          <td>
                            <div className={styles.acoes}>
                              {row.status === 'pendente' && row.movimentacao_id && (
                                <button className={styles.btnConfirmar} onClick={() => confirmar(row)}>
                                  ✓ Confirmar
                                </button>
                              )}
                              {row.status === 'pendente' && !row.movimentacao_id && (
                                <button className={styles.btnCriar} onClick={() => criarMovimentacao(row)}>
                                  + Criar mov.
                                </button>
                              )}
                              {row.status === 'pendente' && (
                                <button className={styles.btnVincular}
                                  onClick={() => { setSelecionandoMov(isSelecionando ? null : row.id); setMovQuery('') }}>
                                  🔗 Vincular
                                </button>
                              )}
                              {row.status === 'pendente' && (
                                <button className={styles.btnIgnorar} onClick={() => ignorar(row.id)}>
                                  Ignorar
                                </button>
                              )}
                              {row.status === 'conciliado' && (
                                <button className={styles.btnIgnorar} onClick={() => desconciliar(row)}>
                                  ↩ Desfazer
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Busca manual de movimentação */}
                        {isSelecionando && (
                          <tr key={`sel-${row.id}`}>
                            <td colSpan={6} className={styles.vincularCell}>
                              <div className={styles.vincularBox}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>
                                  Selecione a movimentação para vincular:
                                </div>
                                <input className={styles.input} placeholder="Buscar por descrição ou valor…"
                                  value={movQuery} onChange={e => setMovQuery(e.target.value)} autoFocus />
                                <div className={styles.movList}>
                                  {movsFiltradas.map(m => (
                                    <button key={m.id} className={styles.movItem}
                                      onClick={() => vincularManual(row.id, m.id)}>
                                      <span className={m.tipo === 'entrada' ? styles.valPos : styles.valNeg}>
                                        {fmtBRL(m.valor)}
                                      </span>
                                      <span>{fmtData(m.data)}</span>
                                      <span className={styles.movDesc}>{m.descricao ?? '—'}</span>
                                    </button>
                                  ))}
                                  {movsFiltradas.length === 0 && (
                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: 8 }}>
                                      Nenhuma movimentação encontrada.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ HISTÓRICO ═════════════════════════════════════════════════════════ */}
      {aba === 'historico' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: '0.85rem', color: '#64748b' }}>
            {histRows.length} transações conciliadas
          </div>
          {histRows.length === 0 ? (
            <div className={styles.vazio}>Nenhuma transação conciliada ainda.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Confiança</th>
                    <th>Importado em</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {histRows.map(row => (
                    <tr key={row.id}>
                      <td className={styles.data}>{fmtData(row.data)}</td>
                      <td className={styles.descCell}>{row.descricao ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={row.valor >= 0 ? styles.valPos : styles.valNeg}>
                          {fmtBRL(row.valor)}
                        </span>
                      </td>
                      <td>
                        {row.confianca === 'alta'  && <span className={styles.tagAlta}>✓ Alta</span>}
                        {row.confianca === 'media' && <span className={styles.tagMedia}>~ Média</span>}
                        {row.confianca === 'baixa' && <span className={styles.tagSemMatch}>Baixa</span>}
                      </td>
                      <td className={styles.data}>{fmtData(row.importado_em?.slice(0,10))}</td>
                      <td>
                        <button className={styles.btnIgnorar} onClick={() => desconciliar(row)}>
                          ↩ Desfazer
                        </button>
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
