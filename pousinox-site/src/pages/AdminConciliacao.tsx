import { useState, useCallback, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminConciliacao.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ExtratoInput {
  data: string
  valor: number
  tipo: 'credito' | 'debito'
  descricao: string | null
  doc: string | null
  fitid: string | null
}

interface ConciliacaoRow {
  lancamento_id: number
  lanc_descricao: string
  lanc_valor: number
  data_vencimento: string
  origem: string
  nf_chave: string | null
  extrato_id_candidato: number | null
  extrato_data: string | null
  extrato_valor: number | null
  extrato_descricao: string | null
  extrato_doc: string | null
  diferenca_valor: number | null
  diferenca_dias: number | null
}

interface Candidato {
  extrato_id: number
  extrato_data: string
  extrato_valor: number
  extrato_descricao: string | null
  diferenca_valor: number
  diferenca_dias: number
  confianca: number
  sim_texto: number
}

interface CandidatoTemporal {
  extrato_id: number
  extrato_data: string
  extrato_valor: number
  extrato_descricao: string | null
  diferenca_dias: number
}

interface LancGrupo {
  lancamento_id: number
  descricao: string
  valor: number
  data_vencimento: string
  origem: string
  nf_chave: string | null
  candidatos: Candidato[]
  candidatoTemporal?: CandidatoTemporal
}

interface LancConciliada {
  id: number
  descricao: string
  valor: number
  data_pagamento: string | null
  extrato_id: number | null
  nf_chave: string | null
  extrato_bancario: { data: string; valor: number; descricao: string | null } | null
}

interface ExtratoOrfao {
  id: number
  data: string
  valor: number
  descricao: string | null
  doc: string | null
  conta: string
}

type Aba = 'conciliar' | 'extrato' | 'revisao'

// ── Constantes ────────────────────────────────────────────────────────────────

const TAXA_KEYWORDS = /tarifa|taxa|iof|ted|doc\b|saque|cpmf|seguro|anuidade|manutencao|manutenção|mensalidade|pix\s*out|pagto|pgto|cobr/i

// ── Helpers ────────────────────────────────────────────────────────────────────

function normTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
     .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
     .replace(/[^a-z0-9 ]/g, ' ')
     .split(/\s+/).filter(w => w.length > 2)
  )
}

function simTexto(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const wa = normTokens(a)
  const wb = normTokens(b)
  if (!wa.size || !wb.size) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.max(wa.size, wb.size)
}

// Pondera: 60% valor · 25% data · 15% texto
function calcConfianca(difValor: number, lancValor: number, difDias: number, st = 0): number {
  const sv = Math.max(0, 1 - difValor / Math.max(lancValor, 0.01))
  const sd = Math.max(0, 1 - difDias / 7)
  return Math.round((sv * 0.60 + sd * 0.25 + st * 0.15) * 100)
}

function isTaxaOuTarifa(o: ExtratoOrfao): boolean {
  if (Math.abs(o.valor) < 50) return true
  return o.descricao ? TAXA_KEYWORDS.test(o.descricao) : false
}

function detectarDuplicatasIds(orfaos: ExtratoOrfao[]): Set<number> {
  const ids = new Set<number>()
  for (let i = 0; i < orfaos.length; i++) {
    for (let j = i + 1; j < orfaos.length; j++) {
      const a = orfaos[i]; const b = orfaos[j]
      if (Math.abs(Math.abs(a.valor) - Math.abs(b.valor)) < 0.01) {
        const diffDias = Math.abs(new Date(a.data).getTime() - new Date(b.data).getTime()) / 86400000
        if (diffDias <= 3) { ids.add(a.id); ids.add(b.id) }
      }
    }
  }
  return ids
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(v: string | null) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function diasAtraso(dataVenc: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const venc  = new Date(dataVenc + 'T00:00:00')
  return Math.floor((today.getTime() - venc.getTime()) / 86400000)
}

// ── Parser OFX (SGML v1 e XML v2) ────────────────────────────────────────────

function parseOFX(text: string): ExtratoInput[] {
  const results: ExtratoInput[] = []
  let inTrn = false
  let cur: Partial<ExtratoInput> & { fitid?: string } = {}

  function push() {
    if (cur.data && cur.valor !== undefined && cur.tipo) {
      results.push({
        data:      cur.data,
        valor:     cur.valor,
        tipo:      cur.tipo,
        descricao: cur.descricao ?? null,
        doc:       cur.doc ?? null,
        fitid:     cur.fitid ?? null,
      })
    }
    cur = {}
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line === '<STMTTRN>') {
      if (inTrn) push()
      inTrn = true; cur = {}
      continue
    }
    if (line === '</STMTTRN>') { push(); inTrn = false; continue }
    if (!inTrn) continue

    const m = line.match(/^<([^>]+)>(.*)$/)
    if (!m) continue
    const tag = m[1].toUpperCase()
    const val = m[2].trim()

    switch (tag) {
      case 'TRNTYPE':
        cur.tipo = ['CREDIT','DEP','INT','DIV','XFER'].includes(val.toUpperCase())
          ? 'credito' : 'debito'
        break
      case 'DTPOSTED':
      case 'DTUSER': {
        if (cur.data) break
        const d = val.replace(/[^\d].*$/, '').slice(0, 8)
        if (d.length === 8) cur.data = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
        break
      }
      case 'TRNAMT': {
        const n = parseFloat(val.replace(',', '.'))
        cur.valor = Math.abs(n)
        if (cur.tipo === undefined) cur.tipo = n >= 0 ? 'credito' : 'debito'
        break
      }
      case 'FITID':    cur.fitid    = val;  break
      case 'MEMO':     if (!cur.descricao) cur.descricao = val; break
      case 'NAME':     if (!cur.descricao) cur.descricao = val; break
      case 'CHECKNUM': cur.doc = val; break
    }
  }
  if (inTrn) push()
  return results
}

// ── Parser CSV genérico: data;descrição;valor ─────────────────────────────────

function parseCSVExtrato(text: string): ExtratoInput[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','

  return lines.slice(1).flatMap(linha => {
    const c = linha.split(sep).map(x => x.trim().replace(/^"|"$/g, ''))
    if (c.length < 3) return []

    const raw = c[0]
    let data: string | null = null
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/'); data = `${y}-${m}-${d}`
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      data = raw
    }
    if (!data) return []

    const n = parseFloat(c[c.length - 1].replace(/\./g, '').replace(',', '.'))
    if (isNaN(n)) return []

    return [{
      data,
      valor:    Math.abs(n),
      tipo:     n >= 0 ? 'credito' as const : 'debito' as const,
      descricao: c.slice(1, c.length - 1).join(' ').trim() || null,
      doc:      null,
      fitid:    null,
    }]
  })
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminConciliacao() {
  const [aba, setAba] = useState<Aba>('conciliar')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Extrato
  const [arquivo,       setArquivo]       = useState<File | null>(null)
  const [linhasPreview, setLinhasPreview] = useState<ExtratoInput[]>([])
  const [importando,    setImportando]    = useState(false)
  const [resultImport,  setResultImport]  = useState<{ novas: number; dup: number } | null>(null)

  // Conciliar — grupos com candidatos (classificados no render)
  const [grupos,         setGrupos]         = useState<LancGrupo[]>([])
  // Sem candidatos na janela padrão
  const [semCandidato,   setSemCandidato]   = useState<LancGrupo[]>([])
  // Sem candidatos na janela, mas com extrato de valor próximo fora da janela
  const [difTemporal,    setDifTemporal]    = useState<LancGrupo[]>([])
  // Orfaos classificados
  const [orfaosGenericos, setOrfaosGenericos] = useState<ExtratoOrfao[]>([])
  const [orfaosTaxa,      setOrfaosTaxa]      = useState<ExtratoOrfao[]>([])
  const [orfaosDup,       setOrfaosDup]       = useState<ExtratoOrfao[]>([])

  const [loading,      setLoading]      = useState(false)
  const [ignorados,    setIgnorados]    = useState<Set<string>>(new Set())
  const [conciliando,  setConciliando]  = useState<number | null>(null)

  // Revisão
  const [conciliadas,  setConciliadas]  = useState<LancConciliada[]>([])
  const [loadingRev,   setLoadingRev]   = useState(false)
  const [desfazendo,   setDesfazendo]   = useState<number | null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  // ── Parse arquivo ──────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setArquivo(file)
    setResultImport(null)
    const text = await file.text()
    const isOFX = file.name.toLowerCase().match(/\.(ofx|qfx)$/) || text.includes('<OFX>') || text.includes('<STMTTRN>')
    setLinhasPreview(isOFX ? parseOFX(text) : parseCSVExtrato(text))
  }

  // ── Importar extrato ───────────────────────────────────────────────────────

  async function importarExtrato() {
    if (!linhasPreview.length) return
    setImportando(true)

    const fitids = linhasPreview.map(l => l.fitid).filter(Boolean) as string[]
    const { data: existFitid } = fitids.length
      ? await supabaseAdmin.from('extrato_bancario').select('fitid').in('fitid', fitids)
      : { data: [] }
    const setFitid = new Set((existFitid ?? []).map((r: { fitid: string }) => r.fitid))

    let novas = 0, dup = 0

    for (let i = 0; i < linhasPreview.length; i += 100) {
      const chunk = linhasPreview.slice(i, i + 100)
      const paraInserir = chunk.filter(l => {
        if (l.fitid && setFitid.has(l.fitid)) { dup++; return false }
        return true
      })
      if (!paraInserir.length) continue
      const { error } = await supabaseAdmin.from('extrato_bancario').insert(
        paraInserir.map(l => ({
          data:      l.data,
          valor:     l.tipo === 'credito' ? l.valor : -l.valor,
          tipo:      l.tipo,
          descricao: l.descricao,
          doc:       l.doc,
          fitid:     l.fitid,
          conta:     'banco',
        }))
      )
      if (!error) novas += paraInserir.length
      else        dup   += paraInserir.length
    }

    setResultImport({ novas, dup })
    setImportando(false)
    if (novas > 0) setMsg({ tipo: 'ok', texto: `${novas} linhas importadas com sucesso.` })
  }

  // ── Carregar conciliação ───────────────────────────────────────────────────

  const carregarConciliacao = useCallback(async () => {
    setLoading(true)

    // 1. Candidatos da janela padrão (±5% valor, ±7 dias)
    const { data } = await supabaseAdmin
      .from('vw_fin_conciliacao')
      .select('*')
      .limit(300)

    const rows = (data ?? []) as ConciliacaoRow[]
    const map = new Map<number, LancGrupo>()

    for (const row of rows) {
      if (!map.has(row.lancamento_id)) {
        map.set(row.lancamento_id, {
          lancamento_id:   row.lancamento_id,
          descricao:       row.lanc_descricao,
          valor:           row.lanc_valor,
          data_vencimento: row.data_vencimento,
          origem:          row.origem,
          nf_chave:        row.nf_chave,
          candidatos:      [],
        })
      }
      if (row.extrato_id_candidato != null) {
        const st = simTexto(row.extrato_descricao, row.lanc_descricao)
        const confianca = calcConfianca(row.diferenca_valor ?? 0, row.lanc_valor, row.diferenca_dias ?? 0, st)
        map.get(row.lancamento_id)!.candidatos.push({
          extrato_id:        row.extrato_id_candidato,
          extrato_data:      row.extrato_data!,
          extrato_valor:     row.extrato_valor!,
          extrato_descricao: row.extrato_descricao,
          diferenca_valor:   row.diferenca_valor ?? 0,
          diferenca_dias:    row.diferenca_dias  ?? 0,
          confianca,
          sim_texto:         st,
        })
      }
    }

    const all = Array.from(map.values())
    all.forEach(g => g.candidatos.sort((a, b) => b.confianca - a.confianca))

    setGrupos(
      all
        .filter(g => g.candidatos.length > 0)
        .sort((a, b) => {
          const ca = a.candidatos[0]?.confianca ?? 0
          const cb = b.candidatos[0]?.confianca ?? 0
          if (cb !== ca) return cb - ca
          return diasAtraso(b.data_vencimento) - diasAtraso(a.data_vencimento)
        })
    )

    const rawSemMatch = all
      .filter(g => g.candidatos.length === 0)
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())

    // 2. Todos os débitos livres (para detecção temporal fora da janela)
    const { data: todosLivres } = await supabaseAdmin
      .from('extrato_bancario')
      .select('id, data, valor, descricao')
      .eq('tipo', 'debito')
      .eq('conciliado', false)
      .is('lancamento_id', null)

    const livres = (todosLivres ?? []) as Array<{ id: number; data: string; valor: number; descricao: string | null }>

    // Classifica semMatch: diferenca_temporal vs sem_candidato
    const semCandidatoList: LancGrupo[] = []
    const difTemporalList:  LancGrupo[] = []

    for (const g of rawSemMatch) {
      const candidatoFora = livres.find(e => {
        const difVal = Math.abs(Math.abs(e.valor) - g.valor)
        return difVal / Math.max(g.valor, 0.01) <= 0.05
      })
      if (candidatoFora) {
        const difDias = Math.abs(
          new Date(candidatoFora.data).getTime() - new Date(g.data_vencimento).getTime()
        ) / 86400000
        difTemporalList.push({
          ...g,
          candidatoTemporal: {
            extrato_id:        candidatoFora.id,
            extrato_data:      candidatoFora.data,
            extrato_valor:     Math.abs(candidatoFora.valor),
            extrato_descricao: candidatoFora.descricao,
            diferenca_dias:    Math.round(difDias),
          },
        })
      } else {
        semCandidatoList.push(g)
      }
    }

    setSemCandidato(semCandidatoList)
    setDifTemporal(difTemporalList)

    // 3. Orfaos: débitos não conciliados sem lançamento candidato
    const { data: orfaosData } = await supabaseAdmin
      .from('extrato_bancario')
      .select('id, data, valor, descricao, doc, conta')
      .eq('tipo', 'debito')
      .eq('conciliado', false)
      .is('lancamento_id', null)
      .order('data', { ascending: false })
      .limit(200)

    const orfaosAll = (orfaosData ?? []) as ExtratoOrfao[]
    const dupIds    = detectarDuplicatasIds(orfaosAll)

    // Prioridade: duplicata > taxa/tarifa > genérico (pode estar em mais de uma categoria — usa primeira)
    const genericos: ExtratoOrfao[] = []
    const taxas:     ExtratoOrfao[] = []
    const dups:      ExtratoOrfao[] = []

    for (const o of orfaosAll) {
      if (dupIds.has(o.id))         { dups.push(o); continue }
      if (isTaxaOuTarifa(o))        { taxas.push(o); continue }
      genericos.push(o)
    }

    setOrfaosGenericos(genericos)
    setOrfaosTaxa(taxas)
    setOrfaosDup(dups)

    setLoading(false)
  }, [])

  const carregarRevisao = useCallback(async () => {
    setLoadingRev(true)
    const { data } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('id, descricao, valor, data_pagamento, extrato_id, nf_chave, extrato_bancario(data, valor, descricao)')
      .eq('tipo', 'despesa')
      .eq('status', 'pago')
      .not('extrato_id', 'is', null)
      .order('data_pagamento', { ascending: false })
      .limit(50)
    setConciliadas((data ?? []) as unknown as LancConciliada[])
    setLoadingRev(false)
  }, [])

  useEffect(() => {
    if (aba === 'conciliar') carregarConciliacao()
    if (aba === 'revisao')   carregarRevisao()
  }, [aba, carregarConciliacao, carregarRevisao])

  // ── Confirmar match ────────────────────────────────────────────────────────

  async function confirmarMatch(lancamentoId: number, extratoId: number, extratoData: string) {
    setConciliando(lancamentoId)
    const { error } = await supabaseAdmin.rpc('fn_conciliar', {
      p_lancamento_id:  lancamentoId,
      p_extrato_id:     extratoId,
      p_data_pagamento: extratoData,
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Pagamento confirmado.' })
      carregarConciliacao()
    }
    setConciliando(null)
  }

  // ── Desfazer conciliação ───────────────────────────────────────────────────

  async function desfazerConciliacao(lancamentoId: number) {
    if (!confirm('Desfazer esta conciliação? O lançamento voltará para pendente.')) return
    setDesfazendo(lancamentoId)
    const { error } = await supabaseAdmin.rpc('fn_desconciliar', { p_lancamento_id: lancamentoId })
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Conciliação desfeita.' })
      carregarRevisao()
    }
    setDesfazendo(null)
  }

  // ── Helpers de render ──────────────────────────────────────────────────────

  function bestConf(g: LancGrupo): number {
    return g.candidatos[0]?.confianca ?? 0
  }

  // Classifica grupos com candidatos em sub-tipos de exceção
  function tipoGrupo(g: LancGrupo): 'forte' | 'fraco' | 'div_valor' | 'div_data' {
    const c = bestConf(g)
    if (c >= 80) return 'forte'
    if (c >= 60) return 'fraco'
    const melhor = g.candidatos[0]
    const pctValor = melhor.diferenca_valor / Math.max(g.valor, 0.01)
    return pctValor > 0.03 ? 'div_valor' : 'div_data'
  }

  // Card de candidatos (reutilizado em forte, fraco, div_valor, div_data)
  function renderCardGrupo(g: LancGrupo) {
    const candidatosFiltrados = g.candidatos.filter(
      c => !ignorados.has(`${g.lancamento_id}-${c.extrato_id}`)
    )
    if (!candidatosFiltrados.length) return null
    const atraso = diasAtraso(g.data_vencimento)
    const tipo = tipoGrupo(g)

    return (
      <div key={g.lancamento_id}
        className={`${styles.card} ${atraso > 30 ? styles.cardUrgente : atraso > 7 ? styles.cardAlerta : ''}`}>

        <div className={styles.cardTop}>
          <div className={styles.lancInfo}>
            <div className={styles.lancDesc}>{g.descricao}</div>
            <div className={styles.lancMeta}>
              Venc. {fmtData(g.data_vencimento)}
              {atraso > 0 && <span className={styles.badgeAtraso}>{atraso}d</span>}
              {g.nf_chave && <span className={styles.badgeNF}>NF</span>}
              {g.origem !== 'manual' && g.origem !== 'nf' &&
                <span className={styles.badgeOrigem}>{g.origem}</span>}
            </div>
          </div>
          <strong className={styles.lancValor}>{fmtBRL(g.valor)}</strong>
        </div>

        {(tipo === 'div_valor' || tipo === 'div_data') && (
          <div className={styles.weakWarning}>
            {tipo === 'div_valor'
              ? '⚠ Diferença de valor acima do esperado — confirme apenas se reconhecer o débito.'
              : '⚠ A data do extrato difere bastante do vencimento — verifique se é o lançamento correto.'}
          </div>
        )}
        {tipo === 'fraco' && candidatosFiltrados[0]?.confianca < 60 && (
          <div className={styles.weakWarning}>
            ⚠ Nenhum candidato com confiança satisfatória — revise manualmente antes de confirmar.
          </div>
        )}

        <div className={styles.candidatos}>
          {candidatosFiltrados.map((c, idx) => {
            const isMelhor = idx === 0
            return (
              <div key={c.extrato_id}
                className={`${styles.candidato} ${isMelhor && c.confianca >= 80 ? styles.candidatoMelhor : ''}`}>
                <div className={styles.candEsq}>
                  <div className={styles.confCol}>
                    {isMelhor && c.confianca >= 80 && (
                      <span className={styles.melhorLabel}>✓ Melhor</span>
                    )}
                    <span className={`${styles.confBadge}
                      ${c.confianca >= 80 ? styles.confAlta
                      : c.confianca >= 60 ? styles.confMedia
                      : styles.confBaixa}`}>
                      {c.confianca}%
                    </span>
                    {c.sim_texto > 0.3 && (
                      <span className={styles.simTextoLabel} title="Descrição similar">T</span>
                    )}
                  </div>
                  <div>
                    <div className={styles.candData}>{fmtData(c.extrato_data)}</div>
                    <div className={styles.candDesc}>{c.extrato_descricao || '—'}</div>
                    {c.diferenca_valor > 0.01 && (
                      <div className={styles.candDiverg}>
                        Δ valor: {fmtBRL(c.diferenca_valor)}
                        {c.diferenca_dias > 0 && <> · {c.diferenca_dias}d de diferença</>}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.candDir}>
                  <span className={styles.candValor}>{fmtBRL(c.extrato_valor)}</span>
                  <button
                    className={`${styles.btnConfirmar} ${isMelhor && c.confianca >= 80 ? styles.btnConfirmarForte : ''}`}
                    disabled={conciliando === g.lancamento_id}
                    onClick={() => confirmarMatch(g.lancamento_id, c.extrato_id, c.extrato_data)}>
                    {conciliando === g.lancamento_id ? '...' : '✓ Confirmar'}
                  </button>
                  <button
                    className={styles.btnIgnorar}
                    title="Ignorar este candidato"
                    onClick={() => setIgnorados(s => new Set([...s, `${g.lancamento_id}-${c.extrato_id}`]))}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Seção de exceção com header colorido e lista interna
  function renderExcecaoSection(
    icon: string,
    titulo: string,
    dica: string,
    conteudo: React.ReactNode,
    cor?: 'amarelo' | 'vermelho'
  ) {
    return (
      <div className={`${styles.excecaoSection} ${cor === 'vermelho' ? styles.excecaoSectionVerm : ''}`}>
        <div className={styles.excecaoTitulo}>
          <span className={styles.excecaoIcone}>{icon}</span>
          {titulo}
          <span className={styles.excecaoDica}>{dica}</span>
        </div>
        <div className={styles.excecaoLista}>{conteudo}</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const matchForte   = grupos.filter(g => tipoGrupo(g) === 'forte')
  const matchFraco   = grupos.filter(g => tipoGrupo(g) === 'fraco')
  const divValorList = grupos.filter(g => tipoGrupo(g) === 'div_valor')
  const divDataList  = grupos.filter(g => tipoGrupo(g) === 'div_data')

  const totalOrfaos = orfaosGenericos.length + orfaosTaxa.length + orfaosDup.length

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      <div className={styles.abas}>
        {([
          { key: 'conciliar', label: '🔗 Conciliar'        },
          { key: 'extrato',   label: '📄 Importar Extrato' },
          { key: 'revisao',   label: '✅ Revisão'           },
        ] as { key: Aba; label: string }[]).map(a => (
          <button key={a.key}
            className={`${styles.aba} ${aba === a.key ? styles.abaAtiva : ''}`}
            onClick={() => setAba(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ══ IMPORTAR EXTRATO ════════════════════════════════════════════════ */}
      {aba === 'extrato' && (
        <div className={styles.section}>
          <p className={styles.info}>
            Importe o extrato em <strong>OFX</strong> (recomendado — exportado pelo banco) ou <strong>CSV</strong> genérico com colunas <code>data;descrição;valor</code>. Reimportações do mesmo arquivo são seguras — duplicatas são ignoradas automaticamente.
          </p>

          <div
            className={`${styles.dropzone} ${arquivo ? styles.dropzoneOk : ''}`}
            onClick={() => document.getElementById('inp-extrato')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
            <input id="inp-extrato" type="file" accept=".ofx,.qfx,.csv,.txt"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <span className={styles.dropIcon}>{arquivo ? '✅' : '📄'}</span>
            <span className={styles.dropLabel}>
              {arquivo ? arquivo.name : 'Clique ou arraste o arquivo OFX / CSV aqui'}
            </span>
            {linhasPreview.length > 0 && (
              <span className={styles.dropSub}>
                {linhasPreview.length} transações · {linhasPreview.filter(l => l.tipo === 'debito').length} débitos · {linhasPreview.filter(l => l.tipo === 'credito').length} créditos
              </span>
            )}
          </div>

          {linhasPreview.length > 0 && (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>FITID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasPreview.slice(0, 20).map((l, i) => (
                      <tr key={i}>
                        <td className={styles.dataCell}>{fmtData(l.data)}</td>
                        <td className={styles.descCell}>{l.descricao || '—'}</td>
                        <td>
                          <span className={l.tipo === 'credito' ? styles.tipoCredito : styles.tipoDebito}>
                            {l.tipo === 'credito' ? '↑' : '↓'} {l.tipo}
                          </span>
                        </td>
                        <td className={l.tipo === 'credito' ? styles.valorPos : styles.valorNeg}>
                          {fmtBRL(l.valor)}
                        </td>
                        <td className={styles.fitid}>{l.fitid || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {linhasPreview.length > 20 && (
                  <div className={styles.maisLinhas}>+ {linhasPreview.length - 20} transações não exibidas</div>
                )}
              </div>

              <div className={styles.importActions}>
                <button className={styles.btnPrimary} onClick={importarExtrato} disabled={importando}>
                  {importando ? 'Importando...' : `↓ Importar ${linhasPreview.length} transações`}
                </button>
              </div>
            </>
          )}

          {resultImport && (
            <div className={styles.resultBox}>
              <strong>{resultImport.novas}</strong> novas linhas importadas
              {resultImport.dup > 0 && (
                <span className={styles.dupLabel}> · {resultImport.dup} duplicatas ignoradas</span>
              )}
              {resultImport.novas > 0 && (
                <button className={styles.btnLink} onClick={() => setAba('conciliar')}>
                  → Ir para Conciliar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ CONCILIAR ═══════════════════════════════════════════════════════ */}
      {aba === 'conciliar' && (
        <div className={styles.section}>
          {loading ? (
            <div className={styles.loading}>Carregando...</div>
          ) : (
            <>
              {/* Stats bar */}
              <div className={styles.statsBar}>
                {matchForte.length > 0 && (
                  <span className={`${styles.stat} ${styles.statForte}`} title="Confiança ≥ 80%">
                    <strong>{matchForte.length}</strong> match forte
                  </span>
                )}
                {(matchFraco.length + divValorList.length + divDataList.length) > 0 && (
                  <span className={`${styles.stat} ${styles.statFraco}`} title="Confiança < 80% ou divergência">
                    <strong>{matchFraco.length + divValorList.length + divDataList.length}</strong> exceção c/ candidato
                  </span>
                )}
                {(semCandidato.length + difTemporal.length) > 0 && (
                  <span className={`${styles.stat} ${styles.statSem}`}>
                    <strong>{semCandidato.length + difTemporal.length}</strong> sem match
                  </span>
                )}
                {totalOrfaos > 0 && (
                  <span className={`${styles.stat} ${styles.statOrfao}`} title="Débitos no extrato sem lançamento">
                    <strong>{totalOrfaos}</strong> órfão{totalOrfaos !== 1 ? 's' : ''}
                  </span>
                )}
                <button className={styles.btnRefresh} onClick={carregarConciliacao} title="Atualizar">↻</button>
              </div>

              {grupos.length === 0 && semCandidato.length === 0 && difTemporal.length === 0 && (
                <div className={styles.vazio}>
                  Nenhum lançamento pendente de conciliação.
                  {' '}<button className={styles.btnLink} onClick={() => setAba('extrato')}>Importar extrato →</button>
                </div>
              )}

              {/* ── Match forte (≥ 80%) ── */}
              {matchForte.map(g => renderCardGrupo(g))}

              {/* ── Match fraco (60–79%) ── */}
              {matchFraco.length > 0 && renderExcecaoSection(
                '🟡', `${matchFraco.length} match${matchFraco.length !== 1 ? 'es' : ''} fraco${matchFraco.length !== 1 ? 's' : ''} (60–79%)`,
                'Candidato provável mas não conclusivo — confira os valores e datas antes de confirmar.',
                <>{matchFraco.map(g => renderCardGrupo(g))}</>
              )}

              {/* ── Divergência de valor ── */}
              {divValorList.length > 0 && renderExcecaoSection(
                '💰', `${divValorList.length} com divergência de valor`,
                'Há um débito próximo no extrato, mas o valor difere mais de 3%. Pode ser desconto, juros ou lançamento errado.',
                <>{divValorList.map(g => renderCardGrupo(g))}</>
              )}

              {/* ── Divergência de data ── */}
              {divDataList.length > 0 && renderExcecaoSection(
                '📅', `${divDataList.length} com divergência de data`,
                'Valor próximo, mas a data de pagamento no extrato difere bastante do vencimento.',
                <>{divDataList.map(g => renderCardGrupo(g))}</>
              )}

              {/* ── Diferença temporal (fora da janela de 7 dias) ── */}
              {difTemporal.length > 0 && renderExcecaoSection(
                '⏱', `${difTemporal.length} com candidato fora da janela de datas`,
                'Há um débito com valor próximo no extrato, mas com data muito distante do vencimento (> 7 dias). Confira manualmente.',
                <>
                  {difTemporal.map(g => {
                    const ct = g.candidatoTemporal!
                    const atraso = diasAtraso(g.data_vencimento)
                    return (
                      <div key={g.lancamento_id} className={`${styles.excecaoItem} ${atraso > 30 ? styles.excecaoItemUrgente : ''}`}>
                        <div style={{ flex: 1 }}>
                          <div className={styles.lancDesc}>{g.descricao}</div>
                          <div className={styles.lancMeta}>
                            Venc. {fmtData(g.data_vencimento)}
                            {atraso > 0 && <span className={styles.badgeAtraso}>{atraso}d</span>}
                            {g.nf_chave && <span className={styles.badgeNF}>NF</span>}
                          </div>
                          <div className={styles.candDiverg} style={{ marginTop: 4 }}>
                            Extrato: {fmtData(ct.extrato_data)} · {ct.extrato_descricao || '—'} · {ct.diferenca_dias}d de diferença
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong className={styles.lancValor}>{fmtBRL(g.valor)}</strong>
                          <button
                            className={styles.btnConfirmar}
                            disabled={conciliando === g.lancamento_id}
                            onClick={() => confirmarMatch(g.lancamento_id, ct.extrato_id, ct.extrato_data)}>
                            {conciliando === g.lancamento_id ? '...' : '✓ Confirmar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {/* ── Sem candidato ── */}
              {semCandidato.length > 0 && renderExcecaoSection(
                '⚠', `${semCandidato.length} lançamento${semCandidato.length !== 1 ? 's' : ''} sem candidato no extrato`,
                'Verifique se o pagamento foi feito por outro meio ou se o extrato está desatualizado.',
                <>
                  {semCandidato.map(g => {
                    const atraso = diasAtraso(g.data_vencimento)
                    return (
                      <div key={g.lancamento_id} className={`${styles.excecaoItem} ${atraso > 30 ? styles.excecaoItemUrgente : ''}`}>
                        <div>
                          <div className={styles.lancDesc}>{g.descricao}</div>
                          <div className={styles.lancMeta}>
                            Venc. {fmtData(g.data_vencimento)}
                            {atraso > 0 && <span className={styles.badgeAtraso}>{atraso}d</span>}
                            {g.nf_chave && <span className={styles.badgeNF}>NF</span>}
                          </div>
                        </div>
                        <strong className={styles.lancValor}>{fmtBRL(g.valor)}</strong>
                      </div>
                    )
                  })}
                </>
              )}

              {/* ── Possível duplicata no extrato ── */}
              {orfaosDup.length > 0 && renderExcecaoSection(
                '🔁', `${orfaosDup.length} possível duplicata no extrato`,
                'Dois débitos com mesmo valor e datas próximas — pode ser cobrança duplicada.',
                <>
                  {orfaosDup.map(e => (
                    <div key={e.id} className={styles.excecaoItem}>
                      <div>
                        <div className={styles.lancDesc}>{e.descricao || '—'}</div>
                        <div className={styles.lancMeta}>
                          {fmtData(e.data)}
                          {e.doc && <span className={styles.badgeOrigem}>{e.doc}</span>}
                          <span className={styles.badgeDup}>duplicata?</span>
                        </div>
                      </div>
                      <strong className={styles.lancValor}>{fmtBRL(Math.abs(e.valor))}</strong>
                    </div>
                  ))}
                </>
              )}

              {/* ── Possível taxa ou tarifa ── */}
              {orfaosTaxa.length > 0 && renderExcecaoSection(
                '🏦', `${orfaosTaxa.length} possível taxa ou tarifa bancária`,
                'Débito de valor pequeno ou com descrição de tarifa, IOF, TED etc. — lançar como despesa bancária se necessário.',
                <>
                  {orfaosTaxa.map(e => (
                    <div key={e.id} className={styles.excecaoItem}>
                      <div>
                        <div className={styles.lancDesc}>{e.descricao || '—'}</div>
                        <div className={styles.lancMeta}>
                          {fmtData(e.data)}
                          {e.doc && <span className={styles.badgeOrigem}>{e.doc}</span>}
                          <span className={styles.badgeTaxa}>taxa/tarifa</span>
                        </div>
                      </div>
                      <strong className={styles.lancValor}>{fmtBRL(Math.abs(e.valor))}</strong>
                    </div>
                  ))}
                </>
              )}

              {/* ── Débitos genéricos sem lançamento ── */}
              {orfaosGenericos.length > 0 && renderExcecaoSection(
                '❓', `${orfaosGenericos.length} débito${orfaosGenericos.length !== 1 ? 's' : ''} no extrato sem lançamento correspondente`,
                'O banco debitou, mas não há NF ou despesa lançada no sistema para este valor.',
                <>
                  {orfaosGenericos.map(e => (
                    <div key={e.id} className={styles.excecaoItem}>
                      <div>
                        <div className={styles.lancDesc}>{e.descricao || '—'}</div>
                        <div className={styles.lancMeta}>
                          {fmtData(e.data)}
                          {e.doc && <span className={styles.badgeOrigem}>{e.doc}</span>}
                          <span className={styles.badgeOrigem}>{e.conta}</span>
                        </div>
                      </div>
                      <strong className={styles.lancValor}>{fmtBRL(Math.abs(e.valor))}</strong>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ REVISÃO ═════════════════════════════════════════════════════════ */}
      {aba === 'revisao' && (
        <div className={styles.section}>
          <p className={styles.info}>Conciliações confirmadas. Use "Desfazer" apenas para corrigir erros de match.</p>
          {loadingRev ? (
            <div className={styles.loading}>Carregando...</div>
          ) : conciliadas.length === 0 ? (
            <div className={styles.vazio}>Nenhuma conciliação registrada.</div>
          ) : (
            <div className={styles.revisaoLista}>
              {conciliadas.map(c => {
                const ext = c.extrato_bancario
                const dif = ext ? Math.abs(Math.abs(ext.valor) - c.valor) : 0
                const temDivergencia = dif > 0.01
                return (
                  <div key={c.id} className={`${styles.revisaoCard} ${temDivergencia ? styles.revisaoCardDiverg : ''}`}>

                    <div className={styles.revisaoLado}>
                      <div className={styles.revisaoLadoLabel}>Lançamento</div>
                      <div className={styles.lancDesc}>{c.descricao}</div>
                      <div className={styles.revisaoLadoMeta}>
                        {c.nf_chave && <span className={styles.badgeNF}>NF</span>}
                        <span className={styles.badgeOrigem}>pago em {fmtData(c.data_pagamento)}</span>
                      </div>
                      <strong className={styles.revisaoValor}>{fmtBRL(c.valor)}</strong>
                    </div>

                    <div className={styles.revisaoSeta}>
                      {temDivergencia
                        ? <span className={styles.setaDiverg} title={`Diferença: ${fmtBRL(dif)}`}>≠</span>
                        : <span className={styles.setaOk}>✓</span>}
                    </div>

                    <div className={styles.revisaoLado}>
                      <div className={styles.revisaoLadoLabel}>Extrato bancário</div>
                      {ext ? (
                        <>
                          <div className={styles.lancDesc}>{ext.descricao || '—'}</div>
                          <div className={styles.revisaoLadoMeta}>
                            <span className={styles.badgeOrigem}>{fmtData(ext.data)}</span>
                          </div>
                          <strong className={`${styles.revisaoValor} ${temDivergencia ? styles.revisaoValorDiverg : ''}`}>
                            {fmtBRL(Math.abs(ext.valor))}
                            {temDivergencia && <span className={styles.difLabel}> (Δ {fmtBRL(dif)})</span>}
                          </strong>
                        </>
                      ) : <span className={styles.semExtrato}>Extrato não encontrado</span>}
                    </div>

                    <div className={styles.revisaoAcao}>
                      <button
                        className={styles.btnDesfazer}
                        disabled={desfazendo === c.id}
                        onClick={() => desfazerConciliacao(c.id)}>
                        {desfazendo === c.id ? '...' : 'Desfazer'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
