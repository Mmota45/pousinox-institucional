import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
type Status = 'rascunho' | 'enviado' | 'confirmado' | 'parcialmente_recebido' | 'recebido' | 'cancelado'
type Vista = 'lista' | 'form' | 'detalhe'

interface Pedido {
  id: number
  numero: string
  cotacao_id: number | null
  fornecedor_id: number | null
  fornecedor_nome: string
  data_pedido: string
  previsao_entrega: string | null
  status: Status
  condicao_pagamento: string | null
  valor_total: number
  observacoes: string | null
  created_at: string
}

interface ItemPedido {
  id?: number
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  quantidade_recebida: number
  ordem: number
}

interface Fornecedor { id: number; razao_social: string; nome_fantasia: string | null }
interface Cotacao { id: number; numero: string; fornecedor_nome: string }

// ── Helpers ───────────────────────────────────────────────────────
function BadgeStatus({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    rascunho: styles.badgeRascunho,
    enviado: styles.badgeEnviada,
    confirmado: styles.badgeConfirmado,
    parcialmente_recebido: styles.badgeParcialmenteRecebido,
    recebido: styles.badgeRecebido,
    cancelado: styles.badgeCancelado,
  }
  const label: Record<Status, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', confirmado: 'Confirmado',
    parcialmente_recebido: 'Parcialmente Recebido', recebido: 'Recebido', cancelado: 'Cancelado',
  }
  return <span className={map[status]}>{label[status]}</span>
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function fmtValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const itemVazio = (): ItemPedido => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0, quantidade_recebida: 0, ordem: 0 })

// ── Component ─────────────────────────────────────────────────────
export default function AdminPedidosCompra() {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando, setEditando] = useState<Pedido | null>(null)
  const [detalhe, setDetalhe] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])

  // Form state
  const [fCotacaoId, setFCotacaoId] = useState<number | ''>('')
  const [fFornecedorId, setFFornecedorId] = useState<number | ''>('')
  const [fFornecedorNome, setFFornecedorNome] = useState('')
  const [fDataPedido, setFDataPedido] = useState('')
  const [fPrevisao, setFPrevisao] = useState('')
  const [fStatus, setFStatus] = useState<Status>('rascunho')
  const [fCondicao, setFCondicao] = useState('')
  const [fObs, setFObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('pedidos_compra')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    supabaseAdmin.from('fornecedores').select('id,razao_social,nome_fantasia').order('razao_social')
      .then(({ data }) => setFornecedores(data ?? []))
    supabaseAdmin.from('cotacoes_compra').select('id,numero,fornecedor_nome').order('created_at', { ascending: false })
      .then(({ data }) => setCotacoes(data ?? []))
  }, [carregar])

  const listaFiltrada = filtroStatus === 'todos' ? lista : lista.filter(p => p.status === filtroStatus)

  function calcTotal(its: ItemPedido[]) {
    return its.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  }

  function abrirForm(ped?: Pedido) {
    if (ped) {
      setEditando(ped)
      setFCotacaoId(ped.cotacao_id ?? '')
      setFFornecedorId(ped.fornecedor_id ?? '')
      setFFornecedorNome(ped.fornecedor_nome)
      setFDataPedido(ped.data_pedido)
      setFPrevisao(ped.previsao_entrega ?? '')
      setFStatus(ped.status)
      setFCondicao(ped.condicao_pagamento ?? '')
      setFObs(ped.observacoes ?? '')
    } else {
      setEditando(null)
      setFCotacaoId('')
      setFFornecedorId('')
      setFFornecedorNome('')
      setFDataPedido(new Date().toISOString().slice(0, 10))
      setFPrevisao('')
      setFStatus('rascunho')
      setFCondicao('')
      setFObs('')
    }
    setMsg(null)
    setVista('form')
  }

  function onFornecedorChange(id: number | '') {
    setFFornecedorId(id)
    if (id) {
      const f = fornecedores.find(f => f.id === id)
      if (f) setFFornecedorNome(f.nome_fantasia || f.razao_social)
    }
  }

  function onCotacaoChange(id: number | '') {
    setFCotacaoId(id)
    if (id) {
      const c = cotacoes.find(c => c.id === id)
      if (c) setFFornecedorNome(c.fornecedor_nome)
    }
  }

  async function salvarForm() {
    if (!fFornecedorNome.trim()) { setMsg({ tipo: 'erro', texto: 'Fornecedor obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      cotacao_id: fCotacaoId || null,
      fornecedor_id: fFornecedorId || null,
      fornecedor_nome: fFornecedorNome.trim(),
      data_pedido: fDataPedido || new Date().toISOString().slice(0, 10),
      previsao_entrega: fPrevisao || null,
      status: fStatus,
      condicao_pagamento: fCondicao.trim() || null,
      valor_total: 0,
      observacoes: fObs.trim() || null,
    }
    if (editando) {
      const { error } = await supabaseAdmin.from('pedidos_compra').update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabaseAdmin.from('pedidos_compra').insert(payload)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(ped: Pedido) {
    setDetalhe(ped)
    const { data } = await supabaseAdmin.from('itens_pedido').select('*').eq('pedido_id', ped.id).order('ordem')
    setItens(data && data.length > 0 ? data : [itemVazio()])
    setMsg(null)
    setVista('detalhe')
  }

  async function salvarItens() {
    if (!detalhe) return
    setSalvando(true)
    await supabaseAdmin.from('itens_pedido').delete().eq('pedido_id', detalhe.id)
    const validos = itens.filter(i => i.descricao.trim())
    if (validos.length > 0) {
      await supabaseAdmin.from('itens_pedido').insert(
        validos.map((i, idx) => ({ ...i, id: undefined, pedido_id: detalhe.id, ordem: idx }))
      )
    }
    // Atualizar valor_total
    const total = calcTotal(validos)
    await supabaseAdmin.from('pedidos_compra').update({ valor_total: total }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, valor_total: total }
    setDetalhe(atualizado)
    setLista(l => l.map(p => p.id === detalhe.id ? atualizado : p))
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Itens e valor total atualizados.' })
  }

  async function avancarStatus(prox: Status) {
    if (!detalhe) return
    await supabaseAdmin.from('pedidos_compra').update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado)
    setLista(l => l.map(p => p.id === detalhe.id ? atualizado : p))
  }

  function updateItem(idx: number, campo: keyof ItemPedido, valor: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const STATUS_NEXT: Partial<Record<Status, { prox: Status; label: string; perigo?: boolean }[]>> = {
    rascunho: [
      { prox: 'enviado', label: 'Marcar como Enviado' },
      { prox: 'cancelado', label: 'Cancelar', perigo: true },
    ],
    enviado: [
      { prox: 'confirmado', label: 'Fornecedor Confirmou' },
      { prox: 'cancelado', label: 'Cancelar', perigo: true },
    ],
    confirmado: [
      { prox: 'parcialmente_recebido', label: 'Recebimento Parcial' },
      { prox: 'recebido', label: 'Recebido Completo' },
      { prox: 'cancelado', label: 'Cancelar', perigo: true },
    ],
    parcialmente_recebido: [
      { prox: 'recebido', label: 'Recebido Completo' },
    ],
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pedidos de Compra</h1>
          <p className={styles.pageSubtitle}>Ordens de compra emitidas para fornecedores</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Novo Pedido</button>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviado">Enviado</option>
          <option value="confirmado">Confirmado</option>
          <option value="parcialmente_recebido">Parcialmente Recebido</option>
          <option value="recebido">Recebido</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className={styles.vazio}>Nenhum pedido encontrado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Fornecedor</th>
                <th>Data</th>
                <th>Previsão</th>
                <th>Valor Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(ped => (
                <tr key={ped.id} onClick={() => abrirDetalhe(ped)}>
                  <td><span className={styles.numero}>{ped.numero}</span></td>
                  <td><span className={styles.tituloCell}>{ped.fornecedor_nome || '—'}</span></td>
                  <td><span className={styles.data}>{fmtData(ped.data_pedido)}</span></td>
                  <td><span className={styles.data}>{fmtData(ped.previsao_entrega)}</span></td>
                  <td><span className={styles.valor}>{ped.valor_total > 0 ? fmtValor(ped.valor_total) : '—'}</span></td>
                  <td><BadgeStatus status={ped.status} /></td>
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
        <h1 className={styles.pageTitle}>{editando ? 'Editar Pedido' : 'Novo Pedido de Compra'}</h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cotação vinculada</label>
            <select className={styles.formSelect} value={fCotacaoId} onChange={e => onCotacaoChange(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Nenhuma —</option>
              {cotacoes.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.fornecedor_nome}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fornecedor (cadastrado)</label>
            <select className={styles.formSelect} value={fFornecedorId} onChange={e => onFornecedorChange(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Selecione —</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome do Fornecedor *</label>
            <input className={styles.formInput} value={fFornecedorNome} onChange={e => setFFornecedorNome(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus} onChange={e => setFStatus(e.target.value as Status)}>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="confirmado">Confirmado</option>
              <option value="parcialmente_recebido">Parcialmente Recebido</option>
              <option value="recebido">Recebido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data do Pedido</label>
            <input className={styles.formInput} type="date" value={fDataPedido} onChange={e => setFDataPedido(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Previsão de Entrega</label>
            <input className={styles.formInput} type="date" value={fPrevisao} onChange={e => setFPrevisao(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Condição de Pagamento</label>
            <input className={styles.formInput} value={fCondicao} onChange={e => setFCondicao(e.target.value)} placeholder="Ex: 30 dias, boleto…" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={fObs} onChange={e => setFObs(e.target.value)} rows={3} />
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
  if (vista === 'detalhe' && detalhe) {
    const proximos = STATUS_NEXT[detalhe.status] ?? []
    const total = calcTotal(itens)

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.detalheNumero}>{detalhe.numero}</div>
            <h1 className={styles.pageTitle}>{detalhe.fornecedor_nome || '—'}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
          </div>
        </div>

        <div className={styles.detalheCard}>
          <div className={styles.detalheGrid}>
            <div className={styles.detalheField}><label>Status</label><span><BadgeStatus status={detalhe.status} /></span></div>
            <div className={styles.detalheField}><label>Data Pedido</label><span>{fmtData(detalhe.data_pedido)}</span></div>
            <div className={styles.detalheField}><label>Previsão Entrega</label><span>{fmtData(detalhe.previsao_entrega)}</span></div>
            <div className={styles.detalheField}><label>Cond. Pagamento</label><span>{detalhe.condicao_pagamento || '—'}</span></div>
            <div className={styles.detalheField}><label>Valor Total</label><span style={{ fontWeight: 700 }}>{fmtValor(detalhe.valor_total)}</span></div>
            {detalhe.cotacao_id && (
              <div className={styles.detalheField}>
                <label>Cotação</label>
                <span className={styles.vinculoBadge}>{cotacoes.find(c => c.id === detalhe.cotacao_id)?.numero ?? `#${detalhe.cotacao_id}`}</span>
              </div>
            )}
          </div>

          {proximos.length > 0 && (
            <div className={styles.statusFlow}>
              <div className={styles.statusFlowTitulo}>Avançar status</div>
              <div className={styles.statusFlowBtns}>
                {proximos.map(p => (
                  <button key={p.prox} className={p.perigo ? styles.btnCancelar : styles.btnAvancar} onClick={() => avancarStatus(p.prox)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Itens */}
          <div className={styles.itensSection}>
            <div className={styles.itensTitulo}>Itens do pedido</div>
            <table className={styles.itensTabela}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Descrição</th>
                  <th style={{ width: '12%' }}>Qtd</th>
                  <th style={{ width: '8%' }}>Un</th>
                  <th style={{ width: '16%' }}>Valor Unit.</th>
                  <th style={{ width: '16%' }}>Total</th>
                  <th style={{ width: '12%' }}>Recebido</th>
                  <th style={{ width: '6%' }}></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => (
                  <tr key={idx}>
                    <td><input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição" /></td>
                    <td><input type="number" value={it.quantidade} min="0" step="0.001" onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} /></td>
                    <td><input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} /></td>
                    <td><input type="number" value={it.valor_unitario} min="0" step="0.01" onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)} /></td>
                    <td style={{ fontWeight: 600 }}>{fmtValor(it.quantidade * it.valor_unitario)}</td>
                    <td style={{ fontSize: '0.8rem', color: it.quantidade_recebida >= it.quantidade ? '#166534' : 'var(--color-text-light)' }}>
                      {it.quantidade_recebida}/{it.quantidade} {it.unidade}
                    </td>
                    <td><button className={styles.btnGhost} onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 0 && <div className={styles.itensTotal}>Total: {fmtValor(total)}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className={styles.btnAddItem} onClick={() => setItens(p => [...p, itemVazio()])}>+ Adicionar item</button>
              <button className={styles.btnPrimary} onClick={salvarItens} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar itens'}</button>
            </div>
            {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}
          </div>
        </div>
      </div>
    )
  }

  return null
}
