import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
type Status = 'pendente' | 'conferido' | 'divergente' | 'aceito' | 'recusado'
type Vista = 'lista' | 'form' | 'detalhe'

interface Recebimento {
  id: number
  numero: string
  pedido_id: number
  data_recebimento: string
  nf_numero: string | null
  nf_chave: string | null
  status: Status
  observacoes: string | null
  created_at: string
}

interface ItemRecebimento {
  id?: number
  item_pedido_id: number | null
  descricao: string
  quantidade_recebida: number
  unidade: string
  valor_unitario: number
  ordem: number
}

interface Pedido { id: number; numero: string; fornecedor_nome: string; status: string }
interface ItemPedido { id: number; descricao: string; quantidade: number; unidade: string; valor_unitario: number }

// ── Helpers ───────────────────────────────────────────────────────
function BadgeStatus({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pendente: styles.badgePendente,
    conferido: styles.badgeConferido,
    divergente: styles.badgeDivergente,
    aceito: styles.badgeAceito,
    recusado: styles.badgeRecusado,
  }
  const label: Record<Status, string> = {
    pendente: 'Pendente', conferido: 'Conferido', divergente: 'Divergente',
    aceito: 'Aceito', recusado: 'Recusado',
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

const itemVazio = (): ItemRecebimento => ({
  item_pedido_id: null, descricao: '', quantidade_recebida: 0, unidade: 'un', valor_unitario: 0, ordem: 0
})

// ── Component ─────────────────────────────────────────────────────
export default function AdminRecebimentosCompra() {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Recebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando, setEditando] = useState<Recebimento | null>(null)
  const [detalhe, setDetalhe] = useState<Recebimento | null>(null)
  const [itens, setItens] = useState<ItemRecebimento[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [itensPedidoAtual, setItensPedidoAtual] = useState<ItemPedido[]>([])
  const [pedidosSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)

  // Form state
  const [fPedidoId, setFPedidoId] = useState<number | ''>('')
  const [fData, setFData] = useState('')
  const [fNfNumero, setFNfNumero] = useState('')
  const [fNfChave, setFNfChave] = useState('')
  const [fStatus, setFStatus] = useState<Status>('pendente')
  const [fObs, setFObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('recebimentos_compra')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    supabaseAdmin.from('pedidos_compra').select('id,numero,fornecedor_nome,status')
      .not('status', 'eq', 'cancelado').order('created_at', { ascending: false })
      .then(({ data }) => setPedidos(data ?? []))
  }, [carregar])

  const listaFiltrada = filtroStatus === 'todos' ? lista : lista.filter(r => r.status === filtroStatus)

  async function onPedidoChange(id: number | '') {
    setFPedidoId(id)
    if (id) {
      const { data } = await supabaseAdmin.from('itens_pedido').select('*').eq('pedido_id', id).order('ordem')
      setItensPedidoAtual(data ?? [])
      // Pré-preencher itens com os do pedido
      if (data && data.length > 0) {
        setItens(data.map((it: ItemPedido, idx: number) => ({
          item_pedido_id: it.id,
          descricao: it.descricao,
          quantidade_recebida: it.quantidade,
          unidade: it.unidade,
          valor_unitario: it.valor_unitario,
          ordem: idx,
        })))
      }
    } else {
      setItensPedidoAtual([])
      setItens([itemVazio()])
    }
  }

  function abrirForm(rec?: Recebimento) {
    if (rec) {
      setEditando(rec)
      setFPedidoId(rec.pedido_id)
      setFData(rec.data_recebimento)
      setFNfNumero(rec.nf_numero ?? '')
      setFNfChave(rec.nf_chave ?? '')
      setFStatus(rec.status)
      setFObs(rec.observacoes ?? '')
    } else {
      setEditando(null)
      setFPedidoId('')
      setFData(new Date().toISOString().slice(0, 10))
      setFNfNumero('')
      setFNfChave('')
      setFStatus('pendente')
      setFObs('')
      setItens([itemVazio()])
      setItensPedidoAtual([])
    }
    setMsg(null)
    setVista('form')
  }

  async function salvarForm() {
    if (!fPedidoId) { setMsg({ tipo: 'erro', texto: 'Pedido obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      pedido_id: fPedidoId,
      data_recebimento: fData || new Date().toISOString().slice(0, 10),
      nf_numero: fNfNumero.trim() || null,
      nf_chave: fNfChave.trim() || null,
      status: fStatus,
      observacoes: fObs.trim() || null,
    }

    let recId: number | null = null
    if (editando) {
      const { error } = await supabaseAdmin.from('recebimentos_compra').update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
      recId = editando.id
    } else {
      const { data, error } = await supabaseAdmin.from('recebimentos_compra').insert(payload).select().single()
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
      recId = data.id
    }

    // Salvar itens
    if (recId) {
      await supabaseAdmin.from('itens_recebimento').delete().eq('recebimento_id', recId)
      const validos = itens.filter(i => i.descricao.trim())
      if (validos.length > 0) {
        await supabaseAdmin.from('itens_recebimento').insert(
          validos.map((i, idx) => ({ ...i, id: undefined, recebimento_id: recId, ordem: idx }))
        )
      }
      // Atualizar quantidade_recebida nos itens do pedido
      for (const it of validos) {
        if (it.item_pedido_id) {
          await supabaseAdmin.from('itens_pedido')
            .update({ quantidade_recebida: it.quantidade_recebida })
            .eq('id', it.item_pedido_id)
        }
      }
    }

    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(rec: Recebimento) {
    setDetalhe(rec)
    const { data } = await supabaseAdmin.from('itens_recebimento').select('*').eq('recebimento_id', rec.id).order('ordem')
    setItens(data && data.length > 0 ? data : [itemVazio()])
    const ped = pedidos.find(p => p.id === rec.pedido_id) ?? null
    setPedidoSelecionado(ped)
    setMsg(null)
    setVista('detalhe')
  }

  async function avancarStatus(prox: Status) {
    if (!detalhe) return
    await supabaseAdmin.from('recebimentos_compra').update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado)
    setLista(l => l.map(r => r.id === detalhe.id ? atualizado : r))
  }

  function updateItem(idx: number, campo: keyof ItemRecebimento, valor: string | number | null) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const STATUS_NEXT: Partial<Record<Status, { prox: Status; label: string; perigo?: boolean }[]>> = {
    pendente: [{ prox: 'conferido', label: 'Marcar como Conferido' }],
    conferido: [
      { prox: 'aceito', label: 'Aceitar' },
      { prox: 'divergente', label: 'Registrar Divergência' },
    ],
    divergente: [
      { prox: 'aceito', label: 'Aceitar mesmo assim' },
      { prox: 'recusado', label: 'Recusar', perigo: true },
    ],
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Recebimentos de Compra</h1>
          <p className={styles.pageSubtitle}>Conferência de materiais recebidos contra pedidos</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Novo Recebimento</button>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="conferido">Conferido</option>
          <option value="divergente">Divergente</option>
          <option value="aceito">Aceito</option>
          <option value="recusado">Recusado</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className={styles.vazio}>Nenhum recebimento encontrado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Pedido</th>
                <th>Data</th>
                <th>NF</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(rec => {
                const ped = pedidos.find(p => p.id === rec.pedido_id)
                return (
                  <tr key={rec.id} onClick={() => abrirDetalhe(rec)}>
                    <td><span className={styles.numero}>{rec.numero}</span></td>
                    <td>
                      <span className={styles.tituloCell}>{ped?.numero ?? `#${rec.pedido_id}`}</span>
                      {ped && <div className={styles.sub}>{ped.fornecedor_nome}</div>}
                    </td>
                    <td><span className={styles.data}>{fmtData(rec.data_recebimento)}</span></td>
                    <td><span className={styles.data}>{rec.nf_numero || '—'}</span></td>
                    <td><BadgeStatus status={rec.status} /></td>
                  </tr>
                )
              })}
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
        <h1 className={styles.pageTitle}>{editando ? 'Editar Recebimento' : 'Novo Recebimento'}</h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pedido de Compra *</label>
            <select className={styles.formSelect} value={fPedidoId} onChange={e => onPedidoChange(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Selecione o pedido —</option>
              {pedidos.map(p => <option key={p.id} value={p.id}>{p.numero} — {p.fornecedor_nome}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus} onChange={e => setFStatus(e.target.value as Status)}>
              <option value="pendente">Pendente</option>
              <option value="conferido">Conferido</option>
              <option value="divergente">Divergente</option>
              <option value="aceito">Aceito</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data do Recebimento</label>
            <input className={styles.formInput} type="date" value={fData} onChange={e => setFData(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Número NF</label>
            <input className={styles.formInput} value={fNfNumero} onChange={e => setFNfNumero(e.target.value)} placeholder="Ex: 001234" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Chave NF-e</label>
            <input className={styles.formInput} value={fNfChave} onChange={e => setFNfChave(e.target.value)} placeholder="44 dígitos" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={fObs} onChange={e => setFObs(e.target.value)} rows={2} />
          </div>
        </div>

        {/* Itens do recebimento */}
        <div className={styles.itensSection}>
          <div className={styles.itensTitulo}>Itens recebidos</div>
          {itensPedidoAtual.length > 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', margin: 0 }}>
              Pré-preenchido com itens do pedido. Ajuste as quantidades conforme o que foi fisicamente recebido.
            </p>
          )}
          <table className={styles.itensTabela}>
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Descrição</th>
                <th style={{ width: '18%' }}>Qtd Recebida</th>
                <th style={{ width: '10%' }}>Un</th>
                <th style={{ width: '18%' }}>Valor Unit.</th>
                <th style={{ width: '13%' }}>Total</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx}>
                  <td><input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição" /></td>
                  <td><input type="number" value={it.quantidade_recebida} min="0" step="0.001" onChange={e => updateItem(idx, 'quantidade_recebida', parseFloat(e.target.value) || 0)} /></td>
                  <td><input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} /></td>
                  <td><input type="number" value={it.valor_unitario} min="0" step="0.01" onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ fontWeight: 600 }}>{fmtValor(it.quantidade_recebida * it.valor_unitario)}</td>
                  <td><button className={styles.btnGhost} onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className={styles.btnAddItem} onClick={() => setItens(p => [...p, itemVazio()])}>+ Adicionar item</button>
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
    const total = itens.reduce((s, i) => s + i.quantidade_recebida * i.valor_unitario, 0)

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.detalheNumero}>{detalhe.numero}</div>
            <h1 className={styles.pageTitle}>
              {pedidosSelecionado?.numero ?? `Pedido #${detalhe.pedido_id}`}
              {pedidosSelecionado && <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-light)', marginLeft: 8 }}>{pedidosSelecionado.fornecedor_nome}</span>}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
          </div>
        </div>

        <div className={styles.detalheCard}>
          <div className={styles.detalheGrid}>
            <div className={styles.detalheField}><label>Status</label><span><BadgeStatus status={detalhe.status} /></span></div>
            <div className={styles.detalheField}><label>Data Recebimento</label><span>{fmtData(detalhe.data_recebimento)}</span></div>
            <div className={styles.detalheField}><label>NF</label><span>{detalhe.nf_numero || '—'}</span></div>
            {detalhe.nf_chave && (
              <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                <label>Chave NF-e</label>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{detalhe.nf_chave}</span>
              </div>
            )}
            {detalhe.observacoes && (
              <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                <label>Observações</label>
                <span style={{ whiteSpace: 'pre-wrap' }}>{detalhe.observacoes}</span>
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
            <div className={styles.itensTitulo}>Itens recebidos</div>
            <table className={styles.itensTabela}>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Descrição</th>
                  <th style={{ width: '18%' }}>Qtd Recebida</th>
                  <th style={{ width: '10%' }}>Un</th>
                  <th style={{ width: '16%' }}>Valor Unit.</th>
                  <th style={{ width: '16%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.descricao || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{it.quantidade_recebida} {it.unidade}</td>
                    <td>{it.unidade}</td>
                    <td>{fmtValor(it.valor_unitario)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtValor(it.quantidade_recebida * it.valor_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 0 && <div className={styles.itensTotal}>Total recebido: {fmtValor(total)}</div>}
          </div>
        </div>
      </div>
    )
  }

  return null
}
