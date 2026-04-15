import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
export type DocTipo = 'recebido' | 'emitido'
type Vista = 'lista' | 'form' | 'detalhe'

type StatusRecebido = 'pendente' | 'autorizada' | 'cancelada' | 'denegada'
type StatusEmitido  = 'rascunho' | 'autorizada' | 'cancelada' | 'denegada'
type StatusDoc = StatusRecebido | StatusEmitido

interface DocRecebido {
  id: number
  nf_numero: string | null
  nf_serie: string | null
  nf_chave: string | null
  emitente_cnpj: string | null
  emitente_nome: string
  data_emissao: string | null
  data_entrada: string
  valor_total: number
  status: StatusRecebido
  recebimento_id: number | null
  estoque_movimentado: boolean
  observacoes: string | null
  created_at: string
}

interface DocEmitido {
  id: number
  nf_numero: string | null
  nf_serie: string | null
  nf_chave: string | null
  destinatario_cnpj: string | null
  destinatario_nome: string
  data_emissao: string
  valor_total: number
  status: StatusEmitido
  venda_id: string | null
  estoque_movimentado: boolean
  observacoes: string | null
  created_at: string
}

type Doc = DocRecebido | DocEmitido

interface ItemDoc {
  id?: number
  descricao: string
  ncm: string
  cfop: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
  estoque_item_id: number | null
  ordem: number
}

interface EstoqueItem { id: number; nome: string; tipo: string; unidade: string; saldo_atual: number }
interface Recebimento { id: number; numero: string }
interface Venda { id: string; numero?: string; cliente_nome?: string }

// ── Helpers ───────────────────────────────────────────────────────
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABELS: Record<StatusDoc, string> = {
  pendente: 'Pendente', rascunho: 'Rascunho',
  autorizada: 'Autorizada', cancelada: 'Cancelada', denegada: 'Denegada',
}
const STATUS_CSS: Record<StatusDoc, string> = {
  pendente:  styles.badgePendente,
  rascunho:  styles.badgeRascunho,
  autorizada: styles.badgeAprovada,
  cancelada:  styles.badgeCancelado,
  denegada:   styles.badgeReprovada,
}

function BadgeStatus({ status }: { status: StatusDoc }) {
  return <span className={STATUS_CSS[status]}>{STATUS_LABELS[status]}</span>
}

const itemVazio = (): ItemDoc => ({
  descricao: '', ncm: '', cfop: '', quantidade: 1, unidade: 'un',
  valor_unitario: 0, valor_total: 0, estoque_item_id: null, ordem: 0,
})

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  tipo: DocTipo
  titulo: string
  subtitulo: string
}

// ── Component ─────────────────────────────────────────────────────
export default function AdminFiscalDocBase({ tipo, titulo, subtitulo }: Props) {
  const tabela     = tipo === 'recebido' ? 'docs_fiscais_recebidos' : 'docs_fiscais_emitidos'
  const tabelaItens = tipo === 'recebido' ? 'itens_doc_recebido'    : 'itens_doc_emitido'
  const tipoMovEstoque = tipo === 'recebido' ? 'entrada' : 'saida'
  const origemTipo = tipo === 'recebido' ? 'nf_recebida' : 'nf_emitida'

  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando, setEditando] = useState<Doc | null>(null)
  const [detalhe, setDetalhe] = useState<Doc | null>(null)
  const [itens, setItens] = useState<ItemDoc[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [estItens, setEstItens] = useState<EstoqueItem[]>([])
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])

  // Form
  const [fNfNum, setFNfNum]     = useState('')
  const [fNfSerie, setFNfSerie] = useState('')
  const [fNfChave, setFNfChave] = useState('')
  const [fParte, setFParte]     = useState('') // emitente_nome ou destinatario_nome
  const [fCnpj, setFCnpj]       = useState('')
  const [fDataEmissao, setFDataEmissao] = useState('')
  const [fDataRef, setFDataRef]         = useState('') // data_entrada ou data_emissao (emitido)
  const [fValor, setFValor]     = useState('0')
  const [fStatus, setFStatus]   = useState<StatusDoc>(tipo === 'recebido' ? 'pendente' : 'rascunho')
  const [fVinculo, setFVinculo] = useState<string>('')
  const [fObs, setFObs]         = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin.from(tabela).select('*').order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }, [tabela])

  useEffect(() => {
    carregar()
    supabaseAdmin.from('estoque_itens').select('id,nome,tipo,unidade,saldo_atual').eq('ativo', true).order('nome')
      .then(({ data }) => setEstItens(data ?? []))
    if (tipo === 'recebido') {
      supabaseAdmin.from('recebimentos_compra').select('id,numero').order('created_at', { ascending: false })
        .then(({ data }) => setRecebimentos(data ?? []))
    } else {
      supabaseAdmin.from('vendas').select('id').order('created_at', { ascending: false }).limit(200)
        .then(({ data }) => setVendas(data ?? []))
    }
  }, [carregar, tipo])

  const listaFiltrada = filtroStatus === 'todos' ? lista : lista.filter(d => d.status === filtroStatus)

  function nomeParte(d: Doc) {
    return tipo === 'recebido' ? (d as DocRecebido).emitente_nome : (d as DocEmitido).destinatario_nome
  }

  function abrirForm(doc?: Doc) {
    if (doc) {
      setEditando(doc)
      setFNfNum(doc.nf_numero ?? '')
      setFNfSerie(doc.nf_serie ?? '')
      setFNfChave(doc.nf_chave ?? '')
      setFValor(doc.valor_total.toString())
      setFStatus(doc.status)
      setFObs(doc.observacoes ?? '')
      if (tipo === 'recebido') {
        const r = doc as DocRecebido
        setFParte(r.emitente_nome)
        setFCnpj(r.emitente_cnpj ?? '')
        setFDataEmissao(r.data_emissao ?? '')
        setFDataRef(r.data_entrada)
        setFVinculo(r.recebimento_id?.toString() ?? '')
      } else {
        const e = doc as DocEmitido
        setFParte(e.destinatario_nome)
        setFCnpj(e.destinatario_cnpj ?? '')
        setFDataEmissao(e.data_emissao)
        setFDataRef(e.data_emissao)
        setFVinculo(e.venda_id ?? '')
      }
    } else {
      setEditando(null)
      setFNfNum(''); setFNfSerie(''); setFNfChave('')
      setFParte(''); setFCnpj(''); setFValor('0')
      setFStatus(tipo === 'recebido' ? 'pendente' : 'rascunho')
      setFObs(''); setFVinculo('')
      const hoje = new Date().toISOString().slice(0, 10)
      setFDataEmissao(hoje); setFDataRef(hoje)
    }
    setMsg(null)
    setVista('form')
  }

  async function salvarForm() {
    if (!fParte.trim()) { setMsg({ tipo: 'erro', texto: tipo === 'recebido' ? 'Emitente obrigatório.' : 'Destinatário obrigatório.' }); return }
    setSalvando(true)
    const base = {
      nf_numero:  fNfNum.trim() || null,
      nf_serie:   fNfSerie.trim() || null,
      nf_chave:   fNfChave.trim() || null,
      valor_total: parseFloat(fValor) || 0,
      status:      fStatus,
      observacoes: fObs.trim() || null,
    }
    const payload = tipo === 'recebido' ? {
      ...base,
      emitente_nome: fParte.trim(),
      emitente_cnpj: fCnpj.trim() || null,
      data_emissao:  fDataEmissao || null,
      data_entrada:  fDataRef || new Date().toISOString().slice(0, 10),
      recebimento_id: fVinculo ? parseInt(fVinculo) : null,
    } : {
      ...base,
      destinatario_nome: fParte.trim(),
      destinatario_cnpj: fCnpj.trim() || null,
      data_emissao:      fDataEmissao || new Date().toISOString().slice(0, 10),
      venda_id:          fVinculo || null,
    }

    if (editando) {
      const { error } = await supabaseAdmin.from(tabela).update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabaseAdmin.from(tabela).insert(payload)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(doc: Doc) {
    setDetalhe(doc)
    const { data } = await supabaseAdmin.from(tabelaItens).select('*').eq('doc_id', doc.id).order('ordem')
    setItens(data && data.length > 0 ? data : [itemVazio()])
    setMsg(null)
    setVista('detalhe')
  }

  async function salvarItens() {
    if (!detalhe) return
    setSalvando(true)
    await supabaseAdmin.from(tabelaItens).delete().eq('doc_id', detalhe.id)
    const validos = itens.filter(i => i.descricao.trim())
    if (validos.length > 0) {
      await supabaseAdmin.from(tabelaItens).insert(
        validos.map((i, idx) => ({
          ...i, id: undefined,
          doc_id: detalhe.id,
          valor_total: i.quantidade * i.valor_unitario,
          ordem: idx,
        }))
      )
    }
    // Recalcular valor_total do documento
    const total = validos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
    await supabaseAdmin.from(tabela).update({ valor_total: total }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, valor_total: total }
    setDetalhe(atualizado as Doc)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado as Doc : d))
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Itens salvos.' })
  }

  async function avancarStatus(prox: StatusDoc) {
    if (!detalhe) return
    await supabaseAdmin.from(tabela).update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado as Doc)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado as Doc : d))
  }

  async function gerarMovimentacaoEstoque() {
    if (!detalhe) return
    const itensVinculados = itens.filter(i => i.estoque_item_id && i.quantidade > 0)
    if (itensVinculados.length === 0) {
      setMsg({ tipo: 'erro', texto: 'Nenhum item vinculado a item de estoque. Vincule os itens antes de gerar.' })
      return
    }
    setSalvando(true)

    let gerados = 0
    for (const it of itensVinculados) {
      // Buscar saldo atual
      const { data: itemEst } = await supabaseAdmin
        .from('estoque_itens').select('saldo_atual, custo_medio').eq('id', it.estoque_item_id!).single()
      if (!itemEst) continue

      const saldoAnt = itemEst.saldo_atual
      const isEntrada = tipoMovEstoque === 'entrada'
      const saldoPost = isEntrada ? saldoAnt + it.quantidade : Math.max(0, saldoAnt - it.quantidade)
      const custoUnit = it.valor_unitario || itemEst.custo_medio

      await supabaseAdmin.from('estoque_movimentacoes').insert({
        item_id: it.estoque_item_id,
        tipo_movimentacao: tipoMovEstoque,
        quantidade: it.quantidade,
        custo_unitario: custoUnit,
        valor_total: it.quantidade * custoUnit,
        saldo_anterior: saldoAnt,
        saldo_posterior: saldoPost,
        origem_tipo: origemTipo,
        origem_id: detalhe.id,
        origem_label: `NF ${detalhe.nf_numero ?? detalhe.id}`,
        observacoes: `Gerado automaticamente — doc fiscal #${detalhe.id}`,
      })

      // Atualizar saldo
      let novoCusto = itemEst.custo_medio
      if (isEntrada && custoUnit > 0) {
        const totalAnt = saldoAnt * itemEst.custo_medio
        novoCusto = saldoPost > 0 ? (totalAnt + it.quantidade * custoUnit) / saldoPost : custoUnit
      }
      await supabaseAdmin.from('estoque_itens').update({ saldo_atual: saldoPost, custo_medio: novoCusto }).eq('id', it.estoque_item_id!)
      gerados++
    }

    // Marcar doc como movimentado
    await supabaseAdmin.from(tabela).update({ estoque_movimentado: true }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, estoque_movimentado: true }
    setDetalhe(atualizado as Doc)
    setLista(l => l.map(d => d.id === detalhe.id ? atualizado as Doc : d))

    setSalvando(false)
    setMsg({ tipo: 'ok', texto: `${gerados} movimentação(ões) gerada(s) em estoque_movimentacoes.` })
  }

  function updateItem(idx: number, campo: keyof ItemDoc, valor: string | number | null) {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [campo]: valor }
      if (campo === 'quantidade' || campo === 'valor_unitario') {
        updated.valor_total = updated.quantidade * updated.valor_unitario
      }
      // Se vinculou item de estoque, puxar unidade
      if (campo === 'estoque_item_id' && valor) {
        const ei = estItens.find(e => e.id === valor)
        if (ei) updated.unidade = ei.unidade
      }
      return updated
    }))
  }

  const statusOpts: StatusDoc[] = tipo === 'recebido'
    ? ['pendente', 'autorizada', 'cancelada', 'denegada']
    : ['rascunho', 'autorizada', 'cancelada', 'denegada']

  const podeGerarEstoque = detalhe?.status === 'autorizada' && !detalhe?.estoque_movimentado

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{titulo}</h1>
          <p className={styles.pageSubtitle}>{subtitulo}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Novo Documento</button>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          {statusOpts.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className={styles.card}>
        {loading ? <div className={styles.loading}>Carregando…</div>
        : listaFiltrada.length === 0 ? <div className={styles.vazio}>Nenhum documento encontrado.</div>
        : (
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
                <tr key={doc.id} onClick={() => abrirDetalhe(doc)}>
                  <td>
                    <span className={styles.numero}>{doc.nf_numero ?? '—'}</span>
                    {doc.nf_serie && <span className={styles.sub}> s{doc.nf_serie}</span>}
                  </td>
                  <td><span className={styles.tituloCell}>{nomeParte(doc)}</span></td>
                  <td><span className={styles.data}>{fmtData(tipo === 'recebido' ? (doc as DocRecebido).data_entrada : (doc as DocEmitido).data_emissao)}</span></td>
                  <td><span className={styles.valor}>{fmtValor(doc.valor_total)}</span></td>
                  <td>
                    {doc.estoque_movimentado
                      ? <span className={styles.badgeAprovada}>✓ Movimentado</span>
                      : <span className={styles.badgeRascunho}>Pendente</span>}
                  </td>
                  <td><BadgeStatus status={doc.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ── Render: Form ──
  if (vista === 'form') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{editando ? 'Editar Documento' : `Novo Documento — ${titulo}`}</h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>
      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{tipo === 'recebido' ? 'Emitente *' : 'Destinatário *'}</label>
            <input className={styles.formInput} value={fParte} onChange={e => setFParte(e.target.value)} placeholder="Razão social" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CNPJ</label>
            <input className={styles.formInput} value={fCnpj} onChange={e => setFCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Número NF</label>
            <input className={styles.formInput} value={fNfNum} onChange={e => setFNfNum(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Série</label>
            <input className={styles.formInput} value={fNfSerie} onChange={e => setFNfSerie(e.target.value)} placeholder="1" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data Emissão</label>
            <input className={styles.formInput} type="date" value={fDataEmissao} onChange={e => setFDataEmissao(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{tipo === 'recebido' ? 'Data de Entrada' : 'Data Emissão (sistema)'}</label>
            <input className={styles.formInput} type="date" value={fDataRef} onChange={e => setFDataRef(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Valor Total (R$)</label>
            <input className={styles.formInput} type="number" min="0" step="0.01" value={fValor} onChange={e => setFValor(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus} onChange={e => setFStatus(e.target.value as StatusDoc)}>
              {statusOpts.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          {tipo === 'recebido' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Recebimento Vinculado</label>
              <select className={styles.formSelect} value={fVinculo} onChange={e => setFVinculo(e.target.value)}>
                <option value="">— Nenhum —</option>
                {recebimentos.map(r => <option key={r.id} value={r.id}>{r.numero}</option>)}
              </select>
            </div>
          )}
          {tipo === 'emitido' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Venda Vinculada</label>
              <select className={styles.formSelect} value={fVinculo} onChange={e => setFVinculo(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {vendas.map(v => <option key={v.id} value={v.id}>Venda #{v.id}</option>)}
              </select>
            </div>
          )}
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Chave NF-e (44 dígitos)</label>
            <input className={styles.formInput} value={fNfChave} onChange={e => setFNfChave(e.target.value)} placeholder="Chave de acesso" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={fObs} onChange={e => setFObs(e.target.value)} rows={2} />
          </div>
        </div>
        {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}
        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={salvarForm} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )

  // ── Render: Detalhe ──
  if (vista === 'detalhe' && detalhe) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.detalheNumero}>NF {detalhe.nf_numero ?? '—'}{detalhe.nf_serie ? ` · s${detalhe.nf_serie}` : ''}</div>
          <h1 className={styles.pageTitle}>{nomeParte(detalhe)}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
        </div>
      </div>

      <div className={styles.detalheCard}>
        <div className={styles.detalheGrid}>
          <div className={styles.detalheField}><label>Status</label><span><BadgeStatus status={detalhe.status} /></span></div>
          <div className={styles.detalheField}><label>Valor Total</label><span style={{ fontWeight: 700 }}>{fmtValor(detalhe.valor_total)}</span></div>
          {tipo === 'recebido' && <>
            <div className={styles.detalheField}><label>Data Emissão</label><span>{fmtData((detalhe as DocRecebido).data_emissao)}</span></div>
            <div className={styles.detalheField}><label>Data Entrada</label><span>{fmtData((detalhe as DocRecebido).data_entrada)}</span></div>
            <div className={styles.detalheField}><label>Emitente CNPJ</label><span>{(detalhe as DocRecebido).emitente_cnpj ?? '—'}</span></div>
            {(detalhe as DocRecebido).recebimento_id && (
              <div className={styles.detalheField}><label>Recebimento</label>
                <span className={styles.vinculoBadge}>{recebimentos.find(r => r.id === (detalhe as DocRecebido).recebimento_id)?.numero ?? `#${(detalhe as DocRecebido).recebimento_id}`}</span>
              </div>
            )}
          </>}
          {tipo === 'emitido' && <>
            <div className={styles.detalheField}><label>Data Emissão</label><span>{fmtData((detalhe as DocEmitido).data_emissao)}</span></div>
            <div className={styles.detalheField}><label>Dest. CNPJ</label><span>{(detalhe as DocEmitido).destinatario_cnpj ?? '—'}</span></div>
          </>}
          <div className={styles.detalheField}>
            <label>Estoque</label>
            <span>{detalhe.estoque_movimentado
              ? <span className={styles.badgeAprovada}>✓ Movimentado</span>
              : <span className={styles.badgeRascunho}>Não movimentado</span>}
            </span>
          </div>
          {detalhe.nf_chave && (
            <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
              <label>Chave NF-e</label>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{detalhe.nf_chave}</span>
            </div>
          )}
        </div>

        {/* Status flow */}
        {detalhe.status !== 'autorizada' && detalhe.status !== 'cancelada' && detalhe.status !== 'denegada' && (
          <div className={styles.statusFlow}>
            <div className={styles.statusFlowTitulo}>Avançar status</div>
            <div className={styles.statusFlowBtns}>
              <button className={styles.btnAvancar} onClick={() => avancarStatus('autorizada')}>✅ Autorizada</button>
              <button className={styles.btnCancelar} onClick={() => avancarStatus('cancelada')}>Cancelar NF</button>
              <button className={styles.btnCancelar} onClick={() => avancarStatus('denegada')}>Denegada</button>
            </div>
          </div>
        )}

        {/* Gerar Movimentação de Estoque */}
        {podeGerarEstoque && (
          <div className={styles.statusFlow}>
            <div className={styles.statusFlowTitulo}>Movimentação de Estoque</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 8 }}>
              Gera entradas/saídas em <strong>estoque_movimentacoes</strong> para cada item vinculado a um item de estoque.
              Apenas itens com "Estoque Item" vinculado serão processados.
            </div>
            <div className={styles.statusFlowBtns}>
              <button className={styles.btnAvancar} onClick={gerarMovimentacaoEstoque} disabled={salvando}>
                {salvando ? 'Processando…' : `📦 Gerar movimentação de ${tipoMovEstoque === 'entrada' ? 'entrada' : 'saída'}`}
              </button>
            </div>
          </div>
        )}

        {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}

        {/* Itens */}
        <div className={styles.itensSection}>
          <div className={styles.itensTitulo}>Itens do documento</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
            Vincule cada item a um <strong>Item de Estoque</strong> para que a movimentação de estoque seja gerada corretamente.
          </div>
          <table className={styles.itensTabela}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Descrição</th>
                <th style={{ width: '10%' }}>NCM</th>
                <th style={{ width: '8%' }}>CFOP</th>
                <th style={{ width: '9%' }}>Qtd</th>
                <th style={{ width: '7%' }}>Un</th>
                <th style={{ width: '12%' }}>Valor Unit.</th>
                <th style={{ width: '12%' }}>Total</th>
                <th style={{ width: '16%' }}>Estoque Item</th>
                <th style={{ width: '4%' }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx}>
                  <td><input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição" /></td>
                  <td><input value={it.ncm} onChange={e => updateItem(idx, 'ncm', e.target.value)} placeholder="0000.00.00" /></td>
                  <td><input value={it.cfop} onChange={e => updateItem(idx, 'cfop', e.target.value)} placeholder="5102" /></td>
                  <td><input type="number" value={it.quantidade} min="0" step="0.001" onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} /></td>
                  <td><input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} /></td>
                  <td><input type="number" value={it.valor_unitario} min="0" step="0.0001" onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmtValor(it.quantidade * it.valor_unitario)}</td>
                  <td>
                    <select style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '0.78rem', background: '#f8fafc' }}
                      value={it.estoque_item_id ?? ''} onChange={e => updateItem(idx, 'estoque_item_id', e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">— Nenhum —</option>
                      {estItens.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.tipo.toUpperCase()})</option>)}
                    </select>
                  </td>
                  <td><button className={styles.btnGhost} onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnAddItem} onClick={() => setItens(p => [...p, itemVazio()])}>+ Item</button>
            <button className={styles.btnPrimary} onClick={salvarItens} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar itens'}</button>
          </div>
        </div>
      </div>
    </div>
  )

  return null
}
