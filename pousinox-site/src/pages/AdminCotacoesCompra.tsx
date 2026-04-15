import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

// ── Types ─────────────────────────────────────────────────────────
type Status = 'rascunho' | 'enviada' | 'recebida' | 'aprovada' | 'reprovada' | 'expirada'
type Vista = 'lista' | 'form' | 'detalhe'

interface Cotacao {
  id: number
  numero: string
  solicitacao_id: number | null
  fornecedor_id: number | null
  fornecedor_nome: string
  data_cotacao: string
  validade_ate: string | null
  status: Status
  condicao_pagamento: string | null
  prazo_entrega_dias: number | null
  observacoes: string | null
  created_at: string
}

interface ItemCotacao {
  id?: number
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  ordem: number
}

interface Fornecedor { id: number; razao_social: string; nome_fantasia: string | null }
interface Solicitacao { id: number; numero: string; solicitante: string }

// ── Helpers ───────────────────────────────────────────────────────
function BadgeStatus({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    rascunho: styles.badgeRascunho,
    enviada: styles.badgeEnviada,
    recebida: styles.badgeRecebida,
    aprovada: styles.badgeAprovada,
    reprovada: styles.badgeReprovada,
    expirada: styles.badgeExpirada,
  }
  const label: Record<Status, string> = {
    rascunho: 'Rascunho', enviada: 'Enviada', recebida: 'Recebida',
    aprovada: 'Aprovada', reprovada: 'Reprovada', expirada: 'Expirada',
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

const itemVazio = (): ItemCotacao => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0, ordem: 0 })

// ── Component ─────────────────────────────────────────────────────
export default function AdminCotacoesCompra() {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando, setEditando] = useState<Cotacao | null>(null)
  const [detalhe, setDetalhe] = useState<Cotacao | null>(null)
  const [itens, setItens] = useState<ItemCotacao[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Search
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])

  // Form state
  const [fSolicitacaoId, setFSolicitacaoId] = useState<number | ''>('')
  const [fFornecedorId, setFForncedorId] = useState<number | ''>('')
  const [fFornecedorNome, setFFornecedorNome] = useState('')
  const [fDataCotacao, setFDataCotacao] = useState('')
  const [fValidade, setFValidade] = useState('')
  const [fStatus, setFStatus] = useState<Status>('rascunho')
  const [fCondicao, setFCondicao] = useState('')
  const [fPrazo, setFPrazo] = useState('')
  const [fObs, setFObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('cotacoes_compra')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    supabaseAdmin.from('fornecedores').select('id,razao_social,nome_fantasia').order('razao_social')
      .then(({ data }) => setFornecedores(data ?? []))
    supabaseAdmin.from('solicitacoes_compra').select('id,numero,solicitante').order('created_at', { ascending: false })
      .then(({ data }) => setSolicitacoes(data ?? []))
  }, [carregar])

  const listaFiltrada = filtroStatus === 'todos' ? lista : lista.filter(c => c.status === filtroStatus)

  const totalItens = (its: ItemCotacao[]) => its.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)

  function abrirForm(cot?: Cotacao) {
    if (cot) {
      setEditando(cot)
      setFSolicitacaoId(cot.solicitacao_id ?? '')
      setFForncedorId(cot.fornecedor_id ?? '')
      setFFornecedorNome(cot.fornecedor_nome)
      setFDataCotacao(cot.data_cotacao)
      setFValidade(cot.validade_ate ?? '')
      setFStatus(cot.status)
      setFCondicao(cot.condicao_pagamento ?? '')
      setFPrazo(cot.prazo_entrega_dias?.toString() ?? '')
      setFObs(cot.observacoes ?? '')
    } else {
      setEditando(null)
      setFSolicitacaoId('')
      setFForncedorId('')
      setFFornecedorNome('')
      setFDataCotacao(new Date().toISOString().slice(0, 10))
      setFValidade('')
      setFStatus('rascunho')
      setFCondicao('')
      setFPrazo('')
      setFObs('')
    }
    setMsg(null)
    setVista('form')
  }

  function onFornecedorChange(id: number | '') {
    setFForncedorId(id)
    if (id) {
      const f = fornecedores.find(f => f.id === id)
      if (f) setFFornecedorNome(f.nome_fantasia || f.razao_social)
    }
  }

  async function salvarForm() {
    if (!fFornecedorNome.trim()) { setMsg({ tipo: 'erro', texto: 'Fornecedor obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      solicitacao_id: fSolicitacaoId || null,
      fornecedor_id: fFornecedorId || null,
      fornecedor_nome: fFornecedorNome.trim(),
      data_cotacao: fDataCotacao || new Date().toISOString().slice(0, 10),
      validade_ate: fValidade || null,
      status: fStatus,
      condicao_pagamento: fCondicao.trim() || null,
      prazo_entrega_dias: fPrazo ? parseInt(fPrazo) : null,
      observacoes: fObs.trim() || null,
    }
    if (editando) {
      const { error } = await supabaseAdmin.from('cotacoes_compra').update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabaseAdmin.from('cotacoes_compra').insert(payload)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(cot: Cotacao) {
    setDetalhe(cot)
    const { data } = await supabaseAdmin.from('itens_cotacao').select('*').eq('cotacao_id', cot.id).order('ordem')
    setItens(data && data.length > 0 ? data : [itemVazio()])
    setMsg(null)
    setVista('detalhe')
  }

  async function salvarItens() {
    if (!detalhe) return
    setSalvando(true)
    await supabaseAdmin.from('itens_cotacao').delete().eq('cotacao_id', detalhe.id)
    const validos = itens.filter(i => i.descricao.trim())
    if (validos.length > 0) {
      await supabaseAdmin.from('itens_cotacao').insert(
        validos.map((i, idx) => ({ ...i, id: undefined, cotacao_id: detalhe.id, ordem: idx }))
      )
    }
    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Itens salvos.' })
  }

  async function avancarStatus(prox: Status) {
    if (!detalhe) return
    await supabaseAdmin.from('cotacoes_compra').update({ status: prox }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: prox }
    setDetalhe(atualizado)
    setLista(l => l.map(c => c.id === detalhe.id ? atualizado : c))
  }

  function updateItem(idx: number, campo: keyof ItemCotacao, valor: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const STATUS_NEXT: Partial<Record<Status, { prox: Status; label: string }[]>> = {
    rascunho: [{ prox: 'enviada', label: 'Marcar como Enviada' }],
    enviada:  [{ prox: 'recebida', label: 'Registrar Retorno' }],
    recebida: [{ prox: 'aprovada', label: 'Aprovar' }, { prox: 'reprovada', label: 'Reprovar' }],
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cotações de Compra</h1>
          <p className={styles.pageSubtitle}>Propostas de fornecedores para solicitações aprovadas</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Nova Cotação</button>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviada">Enviada</option>
          <option value="recebida">Recebida</option>
          <option value="aprovada">Aprovada</option>
          <option value="reprovada">Reprovada</option>
          <option value="expirada">Expirada</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className={styles.vazio}>Nenhuma cotação encontrada.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Fornecedor</th>
                <th>Data</th>
                <th>Validade</th>
                <th>Prazo (dias)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(cot => (
                <tr key={cot.id} onClick={() => abrirDetalhe(cot)}>
                  <td><span className={styles.numero}>{cot.numero}</span></td>
                  <td><span className={styles.tituloCell}>{cot.fornecedor_nome || '—'}</span></td>
                  <td><span className={styles.data}>{fmtData(cot.data_cotacao)}</span></td>
                  <td><span className={styles.data}>{fmtData(cot.validade_ate)}</span></td>
                  <td>{cot.prazo_entrega_dias ?? '—'}</td>
                  <td><BadgeStatus status={cot.status} /></td>
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
        <h1 className={styles.pageTitle}>{editando ? 'Editar Cotação' : 'Nova Cotação'}</h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fornecedor (cadastrado)</label>
            <select className={styles.formSelect} value={fFornecedorId} onChange={e => onFornecedorChange(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Selecione ou informe abaixo —</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome do Fornecedor *</label>
            <input className={styles.formInput} value={fFornecedorNome} onChange={e => setFFornecedorNome(e.target.value)} placeholder="Nome (preenchido automaticamente ou manual)" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Solicitação vinculada</label>
            <select className={styles.formSelect} value={fSolicitacaoId} onChange={e => setFSolicitacaoId(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Nenhuma —</option>
              {solicitacoes.map(s => <option key={s.id} value={s.id}>{s.numero} — {s.solicitante}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select className={styles.formSelect} value={fStatus} onChange={e => setFStatus(e.target.value as Status)}>
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="recebida">Recebida</option>
              <option value="aprovada">Aprovada</option>
              <option value="reprovada">Reprovada</option>
              <option value="expirada">Expirada</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data da Cotação</label>
            <input className={styles.formInput} type="date" value={fDataCotacao} onChange={e => setFDataCotacao(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Validade até</label>
            <input className={styles.formInput} type="date" value={fValidade} onChange={e => setFValidade(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Condição de Pagamento</label>
            <input className={styles.formInput} value={fCondicao} onChange={e => setFCondicao(e.target.value)} placeholder="Ex: 30 dias, à vista…" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Prazo de Entrega (dias)</label>
            <input className={styles.formInput} type="number" value={fPrazo} onChange={e => setFPrazo(e.target.value)} placeholder="Ex: 7" />
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
    const total = totalItens(itens)
    const proximos = STATUS_NEXT[detalhe.status] ?? []

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
            <div className={styles.detalheField}><label>Data Cotação</label><span>{fmtData(detalhe.data_cotacao)}</span></div>
            <div className={styles.detalheField}><label>Validade</label><span>{fmtData(detalhe.validade_ate)}</span></div>
            <div className={styles.detalheField}><label>Prazo Entrega</label><span>{detalhe.prazo_entrega_dias ? `${detalhe.prazo_entrega_dias} dias` : '—'}</span></div>
            <div className={styles.detalheField}><label>Cond. Pagamento</label><span>{detalhe.condicao_pagamento || '—'}</span></div>
            {detalhe.solicitacao_id && (
              <div className={styles.detalheField}>
                <label>Solicitação</label>
                <span className={styles.vinculoBadge}>
                  {solicitacoes.find(s => s.id === detalhe.solicitacao_id)?.numero ?? `#${detalhe.solicitacao_id}`}
                </span>
              </div>
            )}
          </div>

          {proximos.length > 0 && (
            <div className={styles.statusFlow}>
              <div className={styles.statusFlowTitulo}>Avançar status</div>
              <div className={styles.statusFlowBtns}>
                {proximos.map(p => (
                  <button key={p.prox} className={p.prox === 'reprovada' ? styles.btnCancelar : styles.btnAvancar} onClick={() => avancarStatus(p.prox)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Itens */}
          <div className={styles.itensSection}>
            <div className={styles.itensTitulo}>Itens da cotação</div>
            <table className={styles.itensTabela}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Descrição</th>
                  <th style={{ width: '13%' }}>Qtd</th>
                  <th style={{ width: '10%' }}>Un</th>
                  <th style={{ width: '18%' }}>Valor Unit. (R$)</th>
                  <th style={{ width: '18%' }}>Total</th>
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
