import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
export type DocTipo = 'recebido' | 'emitido'
type Vista     = 'lista' | 'form' | 'detalhe' | 'importar'
type StatusDoc = 'pendente' | 'rascunho' | 'autorizada' | 'cancelada' | 'denegada'

interface Doc {
  id:                  number
  tipo:                DocTipo
  nf_numero:           string | null
  nf_serie:            string | null
  nf_chave:            string | null
  contraparte_cnpj:    string | null
  contraparte_nome:    string
  data_emissao:        string | null
  data_entrada:        string | null
  valor_total:         number
  status:              StatusDoc
  recebimento_id:      number | null
  venda_id:            string | null
  estoque_movimentado: boolean
  observacoes:         string | null
  created_at:          string
}

interface ItemDoc {
  id?:             number
  codigo_produto:  string | null
  descricao:       string
  ncm:             string | null
  cfop:            string | null
  quantidade:      number
  unidade:         string
  valor_unitario:  number
  valor_total:     number
  estoque_item_id: number | null
  ordem:           number
}

interface EstoqueItem { id: number; nome: string; unidade: string; saldo_atual: number }
interface Recebimento { id: number; numero: string }
interface Venda       { id: string }

// ── Helpers ───────────────────────────────────────────────────────
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABELS: Record<StatusDoc, string> = {
  pendente:   'Pendente',
  rascunho:   'Rascunho',
  autorizada: 'Autorizada',
  cancelada:  'Cancelada',
  denegada:   'Denegada',
}

function BadgeStatus({ status }: { status: StatusDoc }) {
  const cls: Record<StatusDoc, string> = {
    pendente:   styles.badgeRascunho,
    rascunho:   styles.badgeRascunho,
    autorizada: styles.badgeAprovada,
    cancelada:  styles.badgeCancelado,
    denegada:   styles.badgeCancelado,
  }
  return <span className={cls[status]}>{STATUS_LABELS[status]}</span>
}

const itemVazio = (): ItemDoc => ({
  codigo_produto: null, descricao: '', ncm: null, cfop: null,
  quantidade: 1, unidade: 'un', valor_unitario: 0, valor_total: 0,
  estoque_item_id: null, ordem: 0,
})

// ── CSV helpers ───────────────────────────────────────────────────
// NFSTok layout: NF(0) CNPJ(1) Destinatário(2) Emissão(3)
//   Código(4) NCM(5) EAN(6) Descrição(7) CFOP(8) Qtd(9)
//   VlrUnit(10) … VlrTotal(19)

function parseCSVRows(content: string): string[][] {
  // Auto-detecta separador pela primeira linha
  const firstLine = content.slice(0, content.indexOf('\n') || content.length)
  const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ','

  const rows: string[][] = []
  let i = 0
  while (i < content.length) {
    const row: string[] = []
    while (i < content.length && content[i] !== '\n') {
      if (content[i] === '"') {
        let cell = ''; i++
        while (i < content.length && !(content[i] === '"' && content[i + 1] !== '"')) {
          if (content[i] === '"' && content[i + 1] === '"') { cell += '"'; i += 2 }
          else { cell += content[i++] }
        }
        i++ // fecha aspas
        // avança separador após campo quoted
        if (i < content.length && content[i] === sep) i++
        row.push(cell.trim())
        continue
      } else {
        let cell = ''
        while (i < content.length && content[i] !== sep && content[i] !== '\n') cell += content[i++]
        row.push(cell.trim())
      }
      if (i < content.length && content[i] === sep) i++
    }
    if (content[i] === '\n') i++
    if (row.length > 1 || (row.length === 1 && row[0])) rows.push(row)
  }
  return rows
}

function parseVal(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

function parseDateBR(s: string): string | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  tipo:      DocTipo
  titulo:    string
  subtitulo: string
}

// ── Component ─────────────────────────────────────────────────────
export default function AdminFiscalDocBase({ tipo, titulo, subtitulo }: Props) {
  const tipoMovEstoque: 'entrada' | 'saida' = tipo === 'recebido' ? 'entrada' : 'saida'
  const origemTipo     = tipo === 'recebido' ? 'nf_recebida' : 'nf_emitida'
  const statusInicial: StatusDoc = tipo === 'recebido' ? 'pendente' : 'rascunho'
  const statusOpts: StatusDoc[]  = tipo === 'recebido'
    ? ['pendente', 'autorizada', 'cancelada', 'denegada']
    : ['rascunho',  'autorizada', 'cancelada', 'denegada']

  const [vista,        setVista]        = useState<Vista>('lista')
  const [lista,        setLista]        = useState<Doc[]>([])
  const [loading,      setLoading]      = useState(true)
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando,     setEditando]     = useState<Doc | null>(null)
  const [detalhe,      setDetalhe]      = useState<Doc | null>(null)
  const [itens,        setItens]        = useState<ItemDoc[]>([itemVazio()])
  const [salvando,     setSalvando]     = useState(false)
  const [msg,          setMsg]          = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [estItens,     setEstItens]     = useState<EstoqueItem[]>([])
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [vendas,       setVendas]       = useState<Venda[]>([])

  // Form state
  const [fNfNum,       setFNfNum]       = useState('')
  const [fNfSerie,     setFNfSerie]     = useState('')
  const [fNfChave,     setFNfChave]     = useState('')
  const [fParte,       setFParte]       = useState('')
  const [fCnpj,        setFCnpj]        = useState('')
  const [fDataEmissao, setFDataEmissao] = useState('')
  const [fDataEntrada, setFDataEntrada] = useState('')
  const [fValor,       setFValor]       = useState('0')
  const [fStatus,      setFStatus]      = useState<StatusDoc>(statusInicial)
  const [fVinculo,     setFVinculo]     = useState('')
  const [fObs,         setFObs]         = useState('')

  // CSV import state
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvMsg,     setCsvMsg]     = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<{ nf: string; contraparte: string; itens: number; total: number }[]>([])
  const [csvRows,    setCsvRows]    = useState<string[][]>([])
  const [csvNomeArq, setCsvNomeArq] = useState('')
  const [csvFormat,  setCsvFormat]  = useState<'itens' | 'cabecalho' | null>(null)
  const [csvProgress, setCsvProgress] = useState<{ atual: number; total: number } | null>(null)

  // ── Carregar ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('docs_fiscais')
      .select('*')
      .eq('tipo', tipo)
      .order('created_at', { ascending: false })
    setLista((data as Doc[]) ?? [])
    setLoading(false)
  }, [tipo])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      supabaseAdmin.from('admin_perfis')
        .select('permissoes').eq('user_id', session.user.id).single()
        .then(({ data }) => {
          if (data?.permissoes?.includes('usuarios')) setIsAdmin(true)
        })
    })
  }, [])

  useEffect(() => {
    carregar()
    supabaseAdmin.from('estoque_itens')
      .select('id,nome,unidade,saldo_atual').eq('ativo', true).order('nome')
      .then(({ data }) => setEstItens((data as EstoqueItem[]) ?? []))
    if (tipo === 'recebido') {
      supabaseAdmin.from('recebimentos_compra')
        .select('id,numero').order('created_at', { ascending: false })
        .then(({ data }) => setRecebimentos((data as Recebimento[]) ?? []))
    } else {
      supabaseAdmin.from('vendas')
        .select('id').order('created_at', { ascending: false }).limit(200)
        .then(({ data }) => setVendas((data as Venda[]) ?? []))
    }
  }, [carregar, tipo])

  const listaFiltrada = filtroStatus === 'todos' ? lista : lista.filter(d => d.status === filtroStatus)

  // ── Form ──────────────────────────────────────────────────────────
  function abrirForm(doc?: Doc) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (doc) {
      setEditando(doc)
      setFNfNum(doc.nf_numero ?? '')
      setFNfSerie(doc.nf_serie ?? '')
      setFNfChave(doc.nf_chave ?? '')
      setFParte(doc.contraparte_nome)
      setFCnpj(doc.contraparte_cnpj ?? '')
      setFDataEmissao(doc.data_emissao ?? hoje)
      setFDataEntrada(doc.data_entrada ?? hoje)
      setFValor(doc.valor_total.toString())
      setFStatus(doc.status)
      setFVinculo(tipo === 'recebido' ? (doc.recebimento_id?.toString() ?? '') : (doc.venda_id ?? ''))
      setFObs(doc.observacoes ?? '')
    } else {
      setEditando(null)
      setFNfNum(''); setFNfSerie(''); setFNfChave('')
      setFParte(''); setFCnpj(''); setFValor('0')
      setFStatus(statusInicial); setFObs(''); setFVinculo('')
      setFDataEmissao(hoje); setFDataEntrada(hoje)
    }
    setMsg(null)
    setVista('form')
  }

  async function salvarForm() {
    if (!fParte.trim()) {
      setMsg({ tipo: 'erro', texto: tipo === 'recebido' ? 'Emitente obrigatório.' : 'Destinatário obrigatório.' })
      return
    }
    setSalvando(true)
    const payload = {
      tipo,
      nf_numero:        fNfNum.trim()   || null,
      nf_serie:         fNfSerie.trim() || null,
      nf_chave:         fNfChave.trim() || null,
      contraparte_nome: fParte.trim(),
      contraparte_cnpj: fCnpj.trim()    || null,
      data_emissao:     fDataEmissao    || null,
      data_entrada:     tipo === 'recebido' ? (fDataEntrada || new Date().toISOString().slice(0, 10)) : null,
      valor_total:      parseFloat(fValor) || 0,
      status:           fStatus,
      recebimento_id:   tipo === 'recebido' ? (fVinculo ? parseInt(fVinculo) : null) : null,
      venda_id:         tipo === 'emitido'  ? (fVinculo || null)                     : null,
      observacoes:      fObs.trim() || null,
    }
    const { error } = editando
      ? await supabaseAdmin.from('docs_fiscais').update(payload).eq('id', editando.id)
      : await supabaseAdmin.from('docs_fiscais').insert(payload)
    if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  // ── Excluir todos (admin only) ───────────────────────────────────
  async function excluirTodos() {
    const confirmacao = prompt(`Isso irá excluir TODOS os ${lista.length} documentos ${tipo === 'emitido' ? 'emitidos' : 'recebidos'}.\n\nDigite EXCLUIR TUDO para confirmar:`)
    if (confirmacao !== 'EXCLUIR TUDO') return
    const ids = lista.map(d => d.id)
    if (ids.length === 0) return
    await supabaseAdmin.from('itens_doc').delete().in('doc_id', ids)
    await supabaseAdmin.from('docs_fiscais').delete().eq('tipo', tipo)
    await carregar()
  }

  // ── Excluir em massa (zerados) ────────────────────────────────────
  async function excluirZerados() {
    const zerados = lista.filter(d => !d.valor_total || Number(d.valor_total) === 0)
    if (zerados.length === 0) return
    if (!confirm(`Excluir ${zerados.length} documento(s) com valor R$ 0,00?`)) return
    const ids = zerados.map(d => d.id)
    await supabaseAdmin.from('itens_doc').delete().in('doc_id', ids)
    await supabaseAdmin.from('docs_fiscais').delete().in('id', ids)
    await carregar()
  }

  // ── Excluir ───────────────────────────────────────────────────────
  async function excluirDoc(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (!confirm('Excluir este documento? Esta ação não pode ser desfeita.')) return
    await supabaseAdmin.from('itens_doc').delete().eq('doc_id', id)
    await supabaseAdmin.from('docs_fiscais').delete().eq('id', id)
    setLista(l => l.filter(d => d.id !== id))
  }

  // ── Detalhe ───────────────────────────────────────────────────────
  async function abrirDetalhe(doc: Doc) {
    setDetalhe(doc)
    const { data } = await supabaseAdmin
      .from('itens_doc').select('*').eq('doc_id', doc.id).order('ordem')
    setItens((data as ItemDoc[]) ?? [])
    setMsg(null)
    setVista('detalhe')
  }

  function updateItem(idx: number, campo: keyof ItemDoc, valor: string | number | null) {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [campo]: valor }
      if (campo === 'quantidade' || campo === 'valor_unitario') {
        updated.valor_total = updated.quantidade * updated.valor_unitario
      }
      if (campo === 'estoque_item_id' && valor) {
        const est = estItens.find(e => e.id === valor)
        if (est) updated.unidade = est.unidade
      }
      return updated
    }))
  }

  async function salvarItens() {
    if (!detalhe) return
    setSalvando(true)
    await supabaseAdmin.from('itens_doc').delete().eq('doc_id', detalhe.id)
    const validos = itens.filter(i => i.descricao.trim())
    if (validos.length > 0) {
      await supabaseAdmin.from('itens_doc').insert(
        validos.map((it, idx) => ({
          ...it, id: undefined,
          doc_id:      detalhe.id,
          valor_total: it.quantidade * it.valor_unitario,
          ordem:       idx,
        }))
      )
    }
    const total = validos.reduce((s, it) => s + it.quantidade * it.valor_unitario, 0)
    await supabaseAdmin.from('docs_fiscais').update({ valor_total: total }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, valor_total: total }
    setDetalhe(atualizado)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado : d))
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Itens salvos.' })
  }

  async function avancarStatus(prox: StatusDoc) {
    if (!detalhe) return
    await supabaseAdmin.from('docs_fiscais').update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado : d))
  }

  async function gerarMovimentacaoEstoque() {
    if (!detalhe) return
    const vinculados = itens.filter(i => i.estoque_item_id && i.quantidade > 0)
    if (vinculados.length === 0) {
      setMsg({ tipo: 'erro', texto: 'Nenhum item vinculado a estoque. Vincule antes de gerar.' })
      return
    }
    setSalvando(true)
    let gerados = 0
    for (const it of vinculados) {
      const { data: est } = await supabaseAdmin
        .from('estoque_itens').select('saldo_atual,custo_medio').eq('id', it.estoque_item_id!).single()
      if (!est) continue
      const isEntrada = tipoMovEstoque === 'entrada'
      const saldoAnt  = est.saldo_atual
      const saldoPost = isEntrada ? saldoAnt + it.quantidade : Math.max(0, saldoAnt - it.quantidade)
      const custoUnit = it.valor_unitario || est.custo_medio
      await supabaseAdmin.from('estoque_movimentacoes').insert({
        item_id:           it.estoque_item_id,
        tipo_movimentacao: tipoMovEstoque,
        quantidade:        it.quantidade,
        custo_unitario:    custoUnit,
        valor_total:       it.quantidade * custoUnit,
        saldo_anterior:    saldoAnt,
        saldo_posterior:   saldoPost,
        origem_tipo:       origemTipo,
        origem_id:         detalhe.id,
        origem_label:      `NF ${detalhe.nf_numero ?? detalhe.id}`,
        observacoes:       `Doc fiscal #${detalhe.id}`,
      })
      let novoCusto = est.custo_medio
      if (isEntrada && custoUnit > 0) {
        novoCusto = saldoPost > 0
          ? (saldoAnt * est.custo_medio + it.quantidade * custoUnit) / saldoPost
          : custoUnit
      }
      await supabaseAdmin.from('estoque_itens')
        .update({ saldo_atual: saldoPost, custo_medio: novoCusto }).eq('id', it.estoque_item_id!)
      gerados++
    }
    await supabaseAdmin.from('docs_fiscais').update({ estoque_movimentado: true }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, estoque_movimentado: true }
    setDetalhe(atualizado)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado : d))
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: `${gerados} movimentação(ões) gerada(s).` })
  }

  // ── CSV Import ────────────────────────────────────────────────────
  // Detecta formato pelo header:
  //   cabecalho: Série;Número;CPF/CNPJ;Fornecedor;UF;Chave;Origem;Status;Emissão;Total
  //   itens:     NF;CNPJ;Destinatário;Emissão;Código;NCM;EAN;Descrição;CFOP;Qtd;VlrUnit;…;VlrTotal(19)
  function detectFormat(header: string[]): 'itens' | 'cabecalho' {
    const h0 = header[0]?.toLowerCase().trim()
    // Cabeçalho NFSTok: primeira coluna é 'Série' ou 'Número'
    if (h0 === 'série' || h0 === 'serie' || h0 === 'número' || h0 === 'numero') return 'cabecalho'
    // Itens NFSTok: primeira coluna é 'NF' e header contém 'Qtd'
    if (h0 === 'nf' || h0 === 'nota fiscal' || h0 === 'nota') return 'itens'
    const hasQtd = header.some(h => { const v = h.toLowerCase().trim(); return v === 'qtd' || v === 'quantidade' })
    if (hasQtd) return 'itens'
    return header.length >= 20 ? 'itens' : 'cabecalho'
  }

  function mapStatusNFSTok(s: string): StatusDoc {
    const v = s.toLowerCase().trim()
    if (v === 'autorizada') return 'autorizada'
    if (v === 'cancelada')  return 'cancelada'
    if (v === 'denegada')   return 'denegada'
    return statusInicial
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvMsg(null); setCsvPreview([]); setCsvRows([]); setCsvNomeArq(file.name); setCsvFormat(null)
    setCsvLoading(true)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const allRows = parseCSVRows(ev.target?.result as string)
        if (allRows.length < 2) {
          setCsvMsg('Arquivo vazio ou sem dados.')
          setCsvLoading(false)
          return
        }
        const fmt = detectFormat(allRows[0])
        setCsvFormat(fmt)
        const rows = allRows.slice(1)
        setCsvRows(rows)

        if (fmt === 'cabecalho') {
          // Cada linha = 1 NF: Série(0) Número(1) CNPJ(2) Fornecedor(3) UF(4) Chave(5) Origem(6) Status(7) Emissão(8) Total(9)
          const preview = rows
            .filter(r => r.length >= 2 && r[1])
            .slice(0, 30)
            .map(r => ({ nf: r[1], contraparte: r[3] ?? '', itens: 0, total: parseVal(r[9]) }))
          setCsvPreview(preview)
        } else {
          // Formato itens: agrupa por NF (col 0), valor total em col 19
          const byNF: Record<string, { cnpj: string; nome: string; total: number; qtd: number }> = {}
          for (const r of rows) {
            if (r.length < 20 || !r[0]) continue
            const nf = r[0]
            if (!byNF[nf]) byNF[nf] = { cnpj: r[1], nome: r[2], total: 0, qtd: 0 }
            byNF[nf].total += parseVal(r[19])
            byNF[nf].qtd++
          }
          setCsvPreview(
            Object.entries(byNF).slice(0, 30).map(([nf, v]) => ({
              nf, contraparte: v.nome, itens: v.qtd, total: v.total,
            }))
          )
        }
        setCsvLoading(false)
      } catch {
        setCsvMsg('Erro ao ler o arquivo. Verifique o formato.')
        setCsvLoading(false)
      }
    }
    reader.readAsText(file, 'latin1')
    e.target.value = ''
  }

  async function importarCsv() {
    if (csvRows.length === 0) return
    setSalvando(true); setCsvMsg(null); setCsvProgress(null)
    let inseridos = 0; let pulados = 0

    if (csvFormat === 'cabecalho') {
      const linhasValidas = csvRows.filter(r => r.length >= 2 && r[1])
      const total = linhasValidas.length
      let processados = 0
      // Formato cabeçalho: Série(0) Número(1) CNPJ(2) Fornecedor(3) UF(4) Chave(5) Origem(6) Status(7) Emissão(8) Total(9)
      for (const r of csvRows) {
        if (r.length < 2 || !r[1]) continue
        const nfNum = r[1]
        const { data: existe } = await supabaseAdmin
          .from('docs_fiscais').select('id').eq('tipo', tipo).eq('nf_numero', nfNum).limit(1)
        if (r.length >= 2 && r[1]) { processados++; setCsvProgress({ atual: processados, total }) }
        if (existe && existe.length > 0) { pulados++; continue }
        const dataEmissao = parseDateBR(r[8])
        await supabaseAdmin.from('docs_fiscais').insert({
          tipo,
          nf_serie:         r[0] || null,
          nf_numero:        nfNum,
          nf_chave:         r[5] || null,
          contraparte_cnpj: r[2] || null,
          contraparte_nome: r[3] || '',
          data_emissao:     dataEmissao,
          data_entrada:     tipo === 'recebido' ? (dataEmissao ?? new Date().toISOString().slice(0, 10)) : null,
          valor_total:      parseVal(r[9]),
          status:           mapStatusNFSTok(r[7] ?? ''),
        })
        inseridos++
      }
    } else {
      const nfsUnicas = Object.keys((() => {
        const m: Record<string, 1> = {}
        for (const r of csvRows) { if (r.length >= 20 && r[0]) m[r[0]] = 1 }
        return m
      })())
      const total = nfsUnicas.length
      let processados = 0
      let totalValorImportado = 0
    // Formato itens: NF(0) CNPJ(1) Destinatário(2) Emissão(3) Código(4) NCM(5) EAN(6) Descrição(7) CFOP(8) Qtd(9) VlrUnit(10) … VlrTotal(19)
    const byNF: Record<string, { cnpj: string; nome: string; emissao: string; rows: string[][] }> = {}
    for (const r of csvRows) {
      if (r.length < 20 || !r[0]) continue
      const nf = r[0]
      if (!byNF[nf]) byNF[nf] = { cnpj: r[1], nome: r[2], emissao: r[3], rows: [] }
      byNF[nf].rows.push(r)
    }
    for (const [nfNum, grupo] of Object.entries(byNF)) {
      const { data: existe } = await supabaseAdmin
        .from('docs_fiscais').select('id').eq('tipo', tipo).eq('nf_numero', nfNum).limit(1)
      processados++; setCsvProgress({ atual: processados, total })
      if (existe && existe.length > 0) { pulados++; continue }
      const valorTotal  = grupo.rows.reduce((s, r) => s + parseVal(r[19]), 0)
      totalValorImportado += valorTotal
      const dataEmissao = parseDateBR(grupo.emissao)
      const { data: doc, error } = await supabaseAdmin
        .from('docs_fiscais')
        .insert({
          tipo,
          nf_numero:        nfNum,
          contraparte_cnpj: grupo.cnpj || null,
          contraparte_nome: grupo.nome || '',
          data_emissao:     dataEmissao,
          data_entrada:     tipo === 'recebido' ? (dataEmissao ?? new Date().toISOString().slice(0, 10)) : null,
          valor_total:      valorTotal,
          status:           statusInicial,
        })
        .select('id').single()
      if (error || !doc) continue
      const itensNF = grupo.rows
        .filter(r => r[7]?.trim())
        .map((r, idx) => ({
          doc_id:          doc.id,
          codigo_produto:  r[4]  || null,
          descricao:       r[7],
          ncm:             r[5]  || null,
          cfop:            r[8]  || null,
          quantidade:      parseVal(r[9]),
          unidade:         'un',
          valor_unitario:  parseVal(r[10]),
          valor_total:     parseVal(r[19]),
          estoque_item_id: null,
          ordem:           idx,
        }))
      if (itensNF.length > 0) await supabaseAdmin.from('itens_doc').insert(itensNF)
      inseridos++
    }
    } // fim else formato itens
    await carregar()
    setSalvando(false)
    setCsvProgress(null)
    const avisoZero = csvFormat === 'itens' && inseridos > 0 && totalValorImportado === 0
      ? ' ⚠️ Todos os valores importados são R$ 0,00 — verifique se o arquivo é exportação de itens (20 colunas) e não de cabeçalho.'
      : ''
    setCsvMsg(`Concluído: ${inseridos} NF(s) importada(s), ${pulados} já existia(m) e foram ignorada(s).${avisoZero}`)
    setCsvPreview([]); setCsvRows([])
  }

  const podeGerarEstoque = detalhe?.status === 'autorizada' && !detalhe.estoque_movimentado

  // ── Render: Lista ─────────────────────────────────────────────────
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{titulo}</h1>
          <p className={styles.pageSubtitle}>{subtitulo}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary}
            onClick={() => { setCsvPreview([]); setCsvRows([]); setCsvMsg(null); setVista('importar') }}>
            📥 Importar CSV
          </button>
          <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Novo Documento</button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {statusOpts.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {lista.some(d => !d.valor_total || Number(d.valor_total) === 0) && (
          <button className={styles.btnDanger} onClick={excluirZerados}>
            🗑 Excluir zerados ({lista.filter(d => !d.valor_total || Number(d.valor_total) === 0).length})
          </button>
        )}
        {isAdmin && lista.length > 0 && (
          <button className={styles.btnDanger} onClick={excluirTodos}>
            🗑 Excluir todos ({lista.length})
          </button>
        )}
      </div>

      <div className={styles.card}>
        {loading
          ? <div className={styles.loading}>Carregando…</div>
          : listaFiltrada.length === 0
            ? <div className={styles.vazio}>Nenhum documento encontrado.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>NF</th>
                      <th>{tipo === 'recebido' ? 'Emitente' : 'Destinatário'}</th>
                      <th>Data {tipo === 'recebido' ? 'Entrada' : 'Emissão'}</th>
                      <th>Valor Total</th>
                      <th>Estoque</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map(doc => (
                      <tr key={doc.id} onClick={() => abrirDetalhe(doc)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span className={styles.numero}>{doc.nf_numero ?? '—'}</span>
                          {doc.nf_serie && <span className={styles.sub}> s{doc.nf_serie}</span>}
                        </td>
                        <td><span className={styles.tituloCell}>{doc.contraparte_nome}</span></td>
                        <td>
                          <span className={styles.data}>
                            {fmtData(tipo === 'recebido' ? doc.data_entrada : doc.data_emissao)}
                          </span>
                        </td>
                        <td><span className={styles.valor}>{fmtValor(doc.valor_total)}</span></td>
                        <td>
                          {doc.estoque_movimentado
                            ? <span className={styles.badgeAprovada}>✓ Movimentado</span>
                            : <span className={styles.badgeRascunho}>Pendente</span>}
                        </td>
                        <td><BadgeStatus status={doc.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className={styles.btnExcluirLinha}
                            onClick={e => excluirDoc(e, doc.id)}
                            title="Excluir documento"
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>
    </div>
  )

  // ── Render: Importar CSV ──────────────────────────────────────────
  if (vista === 'importar') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Importar CSV — {titulo}</h1>
          <p className={styles.pageSubtitle}>
            Exportação de itens NFSTok — colunas: NF, CNPJ, {tipo === 'recebido' ? 'Emitente' : 'Destinatário'}, Emissão, Código, NCM, EAN,
            Descrição, CFOP, Qtd, Vlr Unit, …, Vlr Total. NFs já existentes são ignoradas (dedup por número).
          </p>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label className={styles.btnSecondary} style={{ cursor: 'pointer' }}>
            {csvLoading ? 'Lendo…' : '📂 Selecionar CSV'}
            <input ref={csvRef} type="file" accept=".csv,text/csv"
              onChange={handleCsvFile} disabled={csvLoading} hidden />
          </label>
          {csvPreview.length > 0 && (
            <button className={styles.btnPrimary} onClick={importarCsv} disabled={salvando}>
              {salvando ? 'Importando…' : `✅ Importar ${csvPreview.length} NF(s)`}
            </button>
          )}
        </div>

        {csvProgress && (
          <div style={{ margin: '8px 0' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', marginBottom: 4 }}>
              Importando… {csvProgress.atual} / {csvProgress.total} NF(s)
            </div>
            <div style={{ background: 'var(--color-border, #e5e7eb)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'var(--color-primary, #2563eb)',
                width: `${Math.round((csvProgress.atual / csvProgress.total) * 100)}%`,
                transition: 'width 0.2s ease',
              }} />
            </div>
          </div>
        )}

        {csvMsg && (
          <div className={`${styles.formMsg} ${csvMsg.startsWith('Erro') ? styles.formMsgErro : styles.formMsgOk}`}>
            {csvMsg}
          </div>
        )}

        {csvPreview.length > 0 && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', margin: '0 0 8px' }}>
              <strong>{csvNomeArq}</strong> — {csvPreview.length} NF(s) detectada(s)
              {csvFormat === 'cabecalho' ? ' · formato cabeçalho (sem itens)' : ' · formato itens'}
            </p>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>NF</th>
                  <th>{tipo === 'recebido' ? 'Emitente' : 'Destinatário'}</th>
                  <th>Itens</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.map(p => (
                  <tr key={p.nf}>
                    <td><span className={styles.numero}>{p.nf}</span></td>
                    <td><span className={styles.tituloCell}>{p.contraparte}</span></td>
                    <td>{p.itens}</td>
                    <td><span className={styles.valor}>{fmtValor(p.total)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )

  // ── Render: Form ──────────────────────────────────────────────────
  if (vista === 'form') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {editando ? 'Editar Documento' : `Novo Documento — ${titulo}`}
        </h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>
      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{tipo === 'recebido' ? 'Emitente *' : 'Destinatário *'}</label>
            <input className={styles.formInput} value={fParte}
              onChange={e => setFParte(e.target.value)} placeholder="Razão social" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CNPJ</label>
            <input className={styles.formInput} value={fCnpj}
              onChange={e => setFCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Número NF</label>
            <input className={styles.formInput} value={fNfNum}
              onChange={e => setFNfNum(e.target.value)} placeholder="000001234" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Série</label>
            <input className={styles.formInput} value={fNfSerie}
              onChange={e => setFNfSerie(e.target.value)} placeholder="1" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Chave NF-e (44 dígitos)</label>
            <input className={styles.formInput} value={fNfChave}
              onChange={e => setFNfChave(e.target.value)}
              placeholder="00000000000000000000000000000000000000000000" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data Emissão</label>
            <input className={styles.formInput} type="date" value={fDataEmissao}
              onChange={e => setFDataEmissao(e.target.value)} />
          </div>
          {tipo === 'recebido' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de Entrada</label>
              <input className={styles.formInput} type="date" value={fDataEntrada}
                onChange={e => setFDataEntrada(e.target.value)} />
            </div>
          )}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Valor Total (R$)</label>
            <input className={styles.formInput} type="number" min="0" step="0.01" value={fValor}
              onChange={e => setFValor(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus}
              onChange={e => setFStatus(e.target.value as StatusDoc)}>
              {statusOpts.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          {tipo === 'recebido' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Recebimento Vinculado</label>
              <select className={styles.formSelect} value={fVinculo}
                onChange={e => setFVinculo(e.target.value)}>
                <option value="">— Nenhum —</option>
                {recebimentos.map(r => <option key={r.id} value={r.id}>{r.numero}</option>)}
              </select>
            </div>
          )}
          {tipo === 'emitido' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Venda Vinculada</label>
              <select className={styles.formSelect} value={fVinculo}
                onChange={e => setFVinculo(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {vendas.map(v => <option key={v.id} value={v.id}>{v.id.slice(0, 8)}…</option>)}
              </select>
            </div>
          )}
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={fObs}
              onChange={e => setFObs(e.target.value)} rows={2} />
          </div>
        </div>
        {msg && (
          <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>
            {msg.texto}
          </div>
        )}
        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={salvarForm} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Render: Detalhe ───────────────────────────────────────────────
  if (vista === 'detalhe' && detalhe) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            NF {detalhe.nf_numero ?? '—'}
            {detalhe.nf_serie && <span className={styles.sub}> s{detalhe.nf_serie}</span>}
          </h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <BadgeStatus status={detalhe.status} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.detalheGrid}>
          <div className={styles.detalheField}>
            <label>{tipo === 'recebido' ? 'Emitente' : 'Destinatário'}</label>
            <span>{detalhe.contraparte_nome}</span>
          </div>
          {detalhe.contraparte_cnpj && (
            <div className={styles.detalheField}>
              <label>CNPJ</label>
              <span>{detalhe.contraparte_cnpj}</span>
            </div>
          )}
          <div className={styles.detalheField}>
            <label>Data {tipo === 'recebido' ? 'Entrada' : 'Emissão'}</label>
            <span>{fmtData(tipo === 'recebido' ? detalhe.data_entrada : detalhe.data_emissao)}</span>
          </div>
          {tipo === 'recebido' && detalhe.data_emissao && (
            <div className={styles.detalheField}>
              <label>Data Emissão</label>
              <span>{fmtData(detalhe.data_emissao)}</span>
            </div>
          )}
          <div className={styles.detalheField}>
            <label>Valor Total</label>
            <span>{fmtValor(detalhe.valor_total)}</span>
          </div>
          {detalhe.nf_chave && (
            <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
              <label>Chave NF-e</label>
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {detalhe.nf_chave}
              </span>
            </div>
          )}
          {detalhe.observacoes && (
            <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
              <label>Observações</label>
              <span style={{ whiteSpace: 'pre-wrap' }}>{detalhe.observacoes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Itens</h3>
          <button className={styles.btnSecondary}
            onClick={() => setItens(p => [...p, itemVazio()])}>+ Item</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>NCM</th>
                <th>CFOP</th>
                <th>Qtd</th>
                <th>Vlr Unit</th>
                <th>Vlr Total</th>
                <th>Item Estoque</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <input className={styles.cellInput} value={it.codigo_produto ?? ''}
                      onChange={e => updateItem(idx, 'codigo_produto', e.target.value || null)}
                      style={{ width: 80 }} />
                  </td>
                  <td>
                    <input className={styles.cellInput} value={it.descricao}
                      onChange={e => updateItem(idx, 'descricao', e.target.value)}
                      style={{ width: 200 }} />
                  </td>
                  <td>
                    <input className={styles.cellInput} value={it.ncm ?? ''}
                      onChange={e => updateItem(idx, 'ncm', e.target.value || null)}
                      style={{ width: 80 }} />
                  </td>
                  <td>
                    <input className={styles.cellInput} value={it.cfop ?? ''}
                      onChange={e => updateItem(idx, 'cfop', e.target.value || null)}
                      style={{ width: 60 }} />
                  </td>
                  <td>
                    <input className={styles.cellInput} type="number" value={it.quantidade}
                      onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                      style={{ width: 70 }} />
                  </td>
                  <td>
                    <input className={styles.cellInput} type="number" value={it.valor_unitario}
                      onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                      style={{ width: 90 }} />
                  </td>
                  <td><span className={styles.valor}>{fmtValor(it.valor_total)}</span></td>
                  <td>
                    <select className={styles.cellInput} value={it.estoque_item_id ?? ''}
                      onChange={e => updateItem(idx, 'estoque_item_id', e.target.value ? parseInt(e.target.value) : null)}
                      style={{ width: 160 }}>
                      <option value="">— Nenhum —</option>
                      {estItens.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className={styles.btnRemove}
                      onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.formActions}>
          <button className={styles.btnPrimary} onClick={salvarItens} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar Itens'}
          </button>
        </div>
      </div>

      {/* Avançar status */}
      {detalhe.status !== 'autorizada' && detalhe.status !== 'cancelada' && detalhe.status !== 'denegada' && (
        <div className={styles.statusFlow}>
          <div className={styles.statusFlowTitulo}>Avançar status</div>
          <div className={styles.statusFlowBtns}>
            <button className={styles.btnAvancar} onClick={() => avancarStatus('autorizada')}>
              ✓ Autorizar
            </button>
            <button className={styles.btnCancelar} onClick={() => avancarStatus('cancelada')}>
              Cancelar NF
            </button>
          </div>
        </div>
      )}

      {/* Movimentação de estoque */}
      {podeGerarEstoque && (
        <div className={styles.statusFlow}>
          <div className={styles.statusFlowTitulo}>Movimentação de Estoque</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 8 }}>
            Gera {tipoMovEstoque === 'entrada' ? 'entradas' : 'saídas'} em{' '}
            <strong>estoque_movimentacoes</strong> para itens vinculados a item de estoque.
          </div>
          <div className={styles.statusFlowBtns}>
            <button className={styles.btnAvancar} onClick={gerarMovimentacaoEstoque} disabled={salvando}>
              {salvando ? 'Processando…' : `📦 Gerar movimentação de ${tipoMovEstoque}`}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>
          {msg.texto}
        </div>
      )}
    </div>
  )

  return null
}
