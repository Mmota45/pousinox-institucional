import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
type Status = 'rascunho' | 'pendente' | 'aprovada' | 'reprovada' | 'atendida'
type Vista = 'lista' | 'form' | 'detalhe'

interface Solicitacao {
  id: number
  numero: string
  data_solicitacao: string
  data_necessidade: string | null
  solicitante: string
  departamento: string
  status: Status
  observacoes: string | null
  created_at: string
}

interface ItemSolicitacao {
  id?: number
  descricao: string
  quantidade: number
  unidade: string
  observacao: string
  ordem: number
}

// ── Helpers ───────────────────────────────────────────────────────
function BadgeStatus({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    rascunho: styles.badgeRascunho,
    pendente: styles.badgePendente,
    aprovada: styles.badgeAprovada,
    reprovada: styles.badgeReprovada,
    atendida: styles.badgeAtendida,
  }
  const label: Record<Status, string> = {
    rascunho: 'Rascunho', pendente: 'Pendente', aprovada: 'Aprovada',
    reprovada: 'Reprovada', atendida: 'Atendida',
  }
  return <span className={map[status]}>{label[status]}</span>
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

const STATUS_FLOW: Record<Status, { next: Status; label: string } | null> = {
  rascunho: { next: 'pendente', label: 'Enviar para aprovação' },
  pendente: null,
  aprovada: null,
  reprovada: null,
  atendida: null,
}

const itemVazio = (): ItemSolicitacao => ({ descricao: '', quantidade: 1, unidade: 'un', observacao: '', ordem: 0 })

// ── Component ─────────────────────────────────────────────────────
export default function AdminSolicitacoesCompra() {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [editando, setEditando] = useState<Solicitacao | null>(null)
  const [detalhe, setDetalhe] = useState<Solicitacao | null>(null)
  const [itens, setItens] = useState<ItemSolicitacao[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Form state
  const [fData, setFData] = useState('')
  const [fNecessidade, setFNecessidade] = useState('')
  const [fSolicitante, setFSolicitante] = useState('')
  const [fDepartamento, setFDepartamento] = useState('')
  const [fStatus, setFStatus] = useState<Status>('pendente')
  const [fObs, setFObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('solicitacoes_compra')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const listaFiltrada = filtroStatus === 'todos'
    ? lista
    : lista.filter(s => s.status === filtroStatus)

  function abrirForm(sol?: Solicitacao) {
    if (sol) {
      setEditando(sol)
      setFData(sol.data_solicitacao)
      setFNecessidade(sol.data_necessidade ?? '')
      setFSolicitante(sol.solicitante)
      setFDepartamento(sol.departamento)
      setFStatus(sol.status)
      setFObs(sol.observacoes ?? '')
    } else {
      setEditando(null)
      setFData(new Date().toISOString().slice(0, 10))
      setFNecessidade('')
      setFSolicitante('')
      setFDepartamento('')
      setFStatus('pendente')
      setFObs('')
    }
    setMsg(null)
    setVista('form')
  }

  async function salvarForm() {
    if (!fSolicitante.trim()) { setMsg({ tipo: 'erro', texto: 'Solicitante obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      data_solicitacao: fData || new Date().toISOString().slice(0, 10),
      data_necessidade: fNecessidade || null,
      solicitante: fSolicitante.trim(),
      departamento: fDepartamento.trim(),
      status: fStatus,
      observacoes: fObs.trim() || null,
    }
    if (editando) {
      const { error } = await supabaseAdmin.from('solicitacoes_compra').update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabaseAdmin.from('solicitacoes_compra').insert(payload)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(sol: Solicitacao) {
    setDetalhe(sol)
    const { data } = await supabaseAdmin
      .from('itens_solicitacao')
      .select('*')
      .eq('solicitacao_id', sol.id)
      .order('ordem')
    setItens(data && data.length > 0 ? data : [itemVazio()])
    setVista('detalhe')
  }

  async function salvarItens() {
    if (!detalhe) return
    setSalvando(true)
    await supabaseAdmin.from('itens_solicitacao').delete().eq('solicitacao_id', detalhe.id)
    const validos = itens.filter(i => i.descricao.trim())
    if (validos.length > 0) {
      await supabaseAdmin.from('itens_solicitacao').insert(
        validos.map((i, idx) => ({ ...i, id: undefined, solicitacao_id: detalhe.id, ordem: idx }))
      )
    }
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Itens salvos.' })
  }

  async function avancarStatus(prox: Status) {
    if (!detalhe) return
    await supabaseAdmin.from('solicitacoes_compra').update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado)
    setLista(l => l.map(s => s.id === detalhe.id ? atualizado : s))
  }

  async function aprovar(status: 'aprovada' | 'reprovada') {
    if (!detalhe) return
    await supabaseAdmin.from('solicitacoes_compra').update({ status }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status }
    setDetalhe(atualizado)
    setLista(l => l.map(s => s.id === detalhe.id ? atualizado : s))
  }

  function updateItem(idx: number, campo: keyof ItemSolicitacao, valor: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  function addItem() {
    setItens(prev => [...prev, itemVazio()])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Solicitações de Compra</h1>
          <p className={styles.pageSubtitle}>Necessidades internas de aquisição de materiais e serviços</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Nova Solicitação</button>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="pendente">Pendente</option>
          <option value="aprovada">Aprovada</option>
          <option value="reprovada">Reprovada</option>
          <option value="atendida">Atendida</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className={styles.vazio}>Nenhuma solicitação encontrada.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Solicitante</th>
                <th>Departamento</th>
                <th>Data</th>
                <th>Necessidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(sol => (
                <tr key={sol.id} onClick={() => abrirDetalhe(sol)}>
                  <td><span className={styles.numero}>{sol.numero}</span></td>
                  <td><span className={styles.tituloCell}>{sol.solicitante}</span></td>
                  <td>{sol.departamento || '—'}</td>
                  <td><span className={styles.data}>{fmtData(sol.data_solicitacao)}</span></td>
                  <td><span className={styles.data}>{fmtData(sol.data_necessidade)}</span></td>
                  <td><BadgeStatus status={sol.status} /></td>
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
        <div>
          <h1 className={styles.pageTitle}>{editando ? 'Editar Solicitação' : 'Nova Solicitação'}</h1>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Solicitante *</label>
            <input className={styles.formInput} value={fSolicitante} onChange={e => setFSolicitante(e.target.value)} placeholder="Nome do solicitante" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Departamento</label>
            <input className={styles.formInput} value={fDepartamento} onChange={e => setFDepartamento(e.target.value)} placeholder="Ex: Produção, Manutenção…" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data da Solicitação</label>
            <input className={styles.formInput} type="date" value={fData} onChange={e => setFData(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data de Necessidade</label>
            <input className={styles.formInput} type="date" value={fNecessidade} onChange={e => setFNecessidade(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus} onChange={e => setFStatus(e.target.value as Status)}>
              <option value="rascunho">Rascunho</option>
              <option value="pendente">Pendente</option>
              <option value="aprovada">Aprovada</option>
              <option value="reprovada">Reprovada</option>
              <option value="atendida">Atendida</option>
            </select>
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={fObs} onChange={e => setFObs(e.target.value)} rows={3} />
          </div>
        </div>

        {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}

        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={salvarForm} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Render: Detalhe ──
  if (vista === 'detalhe' && detalhe) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.detalheNumero}>{detalhe.numero}</div>
          <h1 className={styles.pageTitle}>{detalhe.solicitante}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
        </div>
      </div>

      <div className={styles.detalheCard}>
        <div className={styles.detalheGrid}>
          <div className={styles.detalheField}>
            <label>Status</label>
            <span><BadgeStatus status={detalhe.status} /></span>
          </div>
          <div className={styles.detalheField}>
            <label>Departamento</label>
            <span>{detalhe.departamento || '—'}</span>
          </div>
          <div className={styles.detalheField}>
            <label>Data da Solicitação</label>
            <span>{fmtData(detalhe.data_solicitacao)}</span>
          </div>
          <div className={styles.detalheField}>
            <label>Data de Necessidade</label>
            <span>{fmtData(detalhe.data_necessidade)}</span>
          </div>
          {detalhe.observacoes && (
            <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
              <label>Observações</label>
              <span style={{ whiteSpace: 'pre-wrap' }}>{detalhe.observacoes}</span>
            </div>
          )}
        </div>

        {/* Status flow */}
        {detalhe.status === 'rascunho' && (
          <div className={styles.statusFlow}>
            <div className={styles.statusFlowTitulo}>Ações</div>
            <div className={styles.statusFlowBtns}>
              <button className={styles.btnAvancar} onClick={() => avancarStatus('pendente')}>Enviar para aprovação</button>
            </div>
          </div>
        )}
        {detalhe.status === 'pendente' && (
          <div className={styles.statusFlow}>
            <div className={styles.statusFlowTitulo}>Aprovação</div>
            <div className={styles.statusFlowBtns}>
              <button className={styles.btnAvancar} onClick={() => aprovar('aprovada')}>✅ Aprovar</button>
              <button className={styles.btnCancelar} onClick={() => aprovar('reprovada')}>❌ Reprovar</button>
            </div>
          </div>
        )}
        {detalhe.status === 'aprovada' && (
          <div className={styles.statusFlow}>
            <div className={styles.statusFlowTitulo}>Ações</div>
            <div className={styles.statusFlowBtns}>
              <button className={styles.btnAvancar} onClick={() => avancarStatus('atendida')}>Marcar como Atendida</button>
            </div>
          </div>
        )}

        {/* Itens */}
        <div className={styles.itensSection}>
          <div className={styles.itensTitulo}>Itens solicitados</div>
          <table className={styles.itensTabela}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Descrição</th>
                <th style={{ width: '15%' }}>Qtd</th>
                <th style={{ width: '15%' }}>Un</th>
                <th style={{ width: '25%' }}>Observação</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx}>
                  <td><input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição do item" /></td>
                  <td><input type="number" value={it.quantidade} min="0" step="0.001" onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} /></td>
                  <td><input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} /></td>
                  <td><input value={it.observacao} onChange={e => updateItem(idx, 'observacao', e.target.value)} placeholder="Opcional" /></td>
                  <td><button className={styles.btnGhost} onClick={() => removeItem(idx)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className={styles.btnAddItem} onClick={addItem}>+ Adicionar item</button>
            <button className={styles.btnPrimary} onClick={salvarItens} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar itens'}
            </button>
          </div>
          {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}
        </div>
      </div>
    </div>
  )

  return null
}
