import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import CollapsibleSection from '../components/CollapsibleSection/CollapsibleSection'
import styles from './AdminVendas.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Produto { id: string; titulo: string; preco: number }

interface Venda {
  id: string
  produto_titulo: string
  valor_recebido: number
  forma_pagamento: string
  data_venda: string
  observacao: string | null
  recebimento: 'a_vista' | 'a_prazo'
  data_vencimento: string | null
  condicao_pagamento: string | null
  fin_lancamento_id: number | null
}

// ── Constantes ────────────────────────────────────────────────────────────────

const FORMAS = ['pix', 'dinheiro', 'cartão de débito', 'cartão de crédito', 'outros']

const CONDICOES_PRAZO = [
  { value: '7d',        label: '7 dias'   },
  { value: '14d',       label: '14 dias'  },
  { value: '21d',       label: '21 dias'  },
  { value: '28d',       label: '28 dias'  },
  { value: '30d',       label: '30 dias'  },
  { value: '45d',       label: '45 dias'  },
  { value: '60d',       label: '60 dias'  },
  { value: '90d',       label: '90 dias'  },
  { value: 'parcelado', label: 'Parcelado'},
]

const FORMA_FIN: Record<string, string> = {
  'pix':              'pix',
  'dinheiro':         'dinheiro',
  'cartão de débito': 'cartao_debito',
  'cartão de crédito':'cartao_credito',
  'outros':           'outro',
}

const FORM_VAZIO = {
  produto_id:         '',
  produto_titulo:     '',
  valor_recebido:     '',
  forma_pagamento:    'pix',
  data_venda:         new Date().toISOString().slice(0, 16),
  observacao:         '',
  recebimento:        'a_vista' as 'a_vista' | 'a_prazo',
  data_vencimento:    '',
  condicao_pagamento: '30d',
}

type FiltroStatus = 'todos' | 'recebido' | 'pendente' | 'vencido'

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminVendas() {
  const { ocultarValores } = useAdmin()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas,   setVendas]   = useState<Venda[]>([])
  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [formAberto, setFormAberto] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')

  // Recebimento inline
  const [recebendoId, setRecebendoId] = useState<string | null>(null)
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10))

  // Ordenação
  const [sortKey, setSortKey] = useState<keyof Venda>('data_venda')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { fetchProdutos(); fetchVendas() }, [])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  const showMsg = useCallback((tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
  }, [])

  // ── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchProdutos() {
    const { data } = await supabaseAdmin.from('produtos').select('id, titulo, preco').order('titulo')
    setProdutos(data ?? [])
  }

  async function fetchVendas() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('vendas')
      .select('id, produto_titulo, valor_recebido, forma_pagamento, data_venda, observacao, recebimento, data_vencimento, condicao_pagamento, fin_lancamento_id')
      .order('data_venda', { ascending: false })
      .limit(200)
    setVendas((data ?? []) as Venda[])
    setLoading(false)
  }

  function selecionarProduto(id: string) {
    const p = produtos.find(p => p.id === id)
    if (p) setForm(f => ({ ...f, produto_id: id, produto_titulo: p.titulo, valor_recebido: String(p.preco) }))
  }

  // ── Financeiro helpers ──────────────────────────────────────────────────────

  async function criarLancamento({
    titulo, valor, dataCompetencia, dataVencimento, formaPagamento,
    condicaoPagamento, observacao, aVista,
  }: {
    titulo: string; valor: number; dataCompetencia: string; dataVencimento: string
    formaPagamento: string; condicaoPagamento: string; observacao: string | null; aVista: boolean
  }) {
    const { data } = await supabaseAdmin
      .from('fin_lancamentos')
      .insert({
        tipo:               'receita',
        descricao:          `Venda — ${titulo}`,
        valor,
        data_competencia:   dataCompetencia,
        data_vencimento:    dataVencimento,
        data_pagamento:     aVista ? dataCompetencia : null,
        status:             aVista ? 'pago' : 'pendente',
        forma_pagamento:    FORMA_FIN[formaPagamento] ?? 'outro',
        condicao_pagamento: condicaoPagamento,
        origem:             'venda',
        observacao,
      })
      .select('id')
      .single()
    return data?.id ?? null
  }

  async function criarMovimentacao(lancamentoId: number, valor: number, data: string, formaPagamento: string, titulo: string) {
    await supabaseAdmin.from('fin_movimentacoes').insert({
      lancamento_id: lancamentoId,
      tipo:          'entrada',
      valor,
      data,
      conta:         formaPagamento === 'dinheiro' ? 'caixa' : 'banco',
      descricao:     `Venda — ${titulo}`,
    })
  }

  // ── Registrar venda ─────────────────────────────────────────────────────────

  async function registrarVenda(e: React.FormEvent) {
    e.preventDefault()
    if (form.recebimento === 'a_prazo' && !form.data_vencimento) {
      showMsg('erro', 'Informe a data de vencimento para venda a prazo.')
      return
    }
    setSalvando(true)

    const dataVenda      = new Date(form.data_venda).toISOString()
    const dataISO        = dataVenda.slice(0, 10)
    const valor          = parseFloat(form.valor_recebido)
    const titulo         = form.produto_titulo.trim()
    const aVista         = form.recebimento === 'a_vista'
    const dataVencimento = aVista ? dataISO : form.data_vencimento

    const { data: vendaData, error } = await supabaseAdmin
      .from('vendas')
      .insert({
        produto_id:         form.produto_id || null,
        produto_titulo:     titulo,
        valor_recebido:     valor,
        forma_pagamento:    form.forma_pagamento,
        data_venda:         dataVenda,
        observacao:         form.observacao.trim() || null,
        recebimento:        form.recebimento,
        data_vencimento:    aVista ? null : form.data_vencimento,
        condicao_pagamento: aVista ? null : form.condicao_pagamento,
      })
      .select('id')
      .single()

    if (error || !vendaData) {
      showMsg('erro', 'Erro ao registrar venda.')
      setSalvando(false)
      return
    }

    const lancId = await criarLancamento({
      titulo, valor,
      dataCompetencia:   dataISO,
      dataVencimento:    dataVencimento,
      formaPagamento:    form.forma_pagamento,
      condicaoPagamento: aVista ? 'a_vista' : form.condicao_pagamento,
      observacao:        form.observacao.trim() || null,
      aVista,
    })

    if (lancId) {
      if (aVista) await criarMovimentacao(lancId, valor, dataISO, form.forma_pagamento, titulo)
      await supabaseAdmin.from('vendas').update({ fin_lancamento_id: lancId }).eq('id', vendaData.id)
    }

    if (form.produto_id) {
      await supabaseAdmin.from('produtos')
        .update({ disponivel: false, vendido_em: new Date().toISOString() })
        .eq('id', form.produto_id)
      await supabaseAdmin.from('movimentacoes_estoque').insert({
        produto_id:     form.produto_id,
        produto_titulo: titulo,
        tipo:           'venda',
        quantidade:     -1,
        observacao:     `Venda registrada — ${form.forma_pagamento}`,
      })
    }

    showMsg('ok', aVista
      ? 'Venda registrada. Lançamento criado como pago.'
      : 'Venda registrada. Lançamento pendente criado — baixe quando receber.')
    setForm(FORM_VAZIO)
    setFormAberto(false)
    fetchVendas()
    setSalvando(false)
  }

  // ── Recebimento a prazo ────────────────────────────────────────────────────

  async function registrarRecebimento(v: Venda) {
    if (!v.fin_lancamento_id) return
    setSalvando(true)
    await supabaseAdmin.from('fin_lancamentos')
      .update({ status: 'pago', data_pagamento: dataRecebimento })
      .eq('id', v.fin_lancamento_id)
    await criarMovimentacao(v.fin_lancamento_id, v.valor_recebido, dataRecebimento, v.forma_pagamento, v.produto_titulo)
    showMsg('ok', 'Recebimento registrado. Lançamento baixado.')
    setRecebendoId(null)
    fetchVendas()
    setSalvando(false)
  }

  // ── Vinculação retroativa ──────────────────────────────────────────────────

  async function vincularFinanceiro(v: Venda) {
    const dataISO = v.data_venda.slice(0, 10)
    const aVista  = (v.recebimento ?? 'a_vista') === 'a_vista'
    const lancId  = await criarLancamento({
      titulo:            v.produto_titulo,
      valor:             v.valor_recebido,
      dataCompetencia:   dataISO,
      dataVencimento:    v.data_vencimento ?? dataISO,
      formaPagamento:    v.forma_pagamento,
      condicaoPagamento: aVista ? 'a_vista' : (v.condicao_pagamento ?? 'a_vista'),
      observacao:        v.observacao,
      aVista,
    })
    if (lancId) {
      if (aVista) await criarMovimentacao(lancId, v.valor_recebido, dataISO, v.forma_pagamento, v.produto_titulo)
      await supabaseAdmin.from('vendas').update({ fin_lancamento_id: lancId }).eq('id', v.id)
      showMsg('ok', 'Venda vinculada ao financeiro.')
      fetchVendas()
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────────

  async function excluirVenda(id: string) {
    if (!confirm('Excluir esta venda?')) return
    await supabaseAdmin.from('vendas').delete().eq('id', id)
    fetchVendas()
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + Number(v).toFixed(2).replace('.', ',')
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.slice(0, 10).split('-')
    return `${day}/${m}/${y}`
  }

  function toggleSort(k: keyof Venda) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }
  function ind(k: keyof Venda) { return sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }

  const hoje = new Date().toISOString().slice(0, 10)

  // ── Filtros ─────────────────────────────────────────────────────────────────

  const vendasFiltradas = vendas.filter(v => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!v.produto_titulo.toLowerCase().includes(q) &&
          !(v.observacao ?? '').toLowerCase().includes(q)) return false
    }
    if (filtroPagamento && v.forma_pagamento !== filtroPagamento) return false
    if (filtroDataDe && v.data_venda.slice(0, 10) < filtroDataDe) return false
    if (filtroDataAte && v.data_venda.slice(0, 10) > filtroDataAte) return false
    if (filtroStatus !== 'todos') {
      const aVista = (v.recebimento ?? 'a_vista') === 'a_vista'
      const recebido = aVista || (v.fin_lancamento_id && v.data_vencimento && v.data_vencimento >= hoje)
      const vencido = !aVista && v.fin_lancamento_id && v.data_vencimento && v.data_vencimento < hoje
      if (filtroStatus === 'recebido' && !(aVista && v.fin_lancamento_id)) return false
      if (filtroStatus === 'pendente' && !(!aVista && v.fin_lancamento_id && !vencido)) return false
      if (filtroStatus === 'vencido' && !vencido) return false
    }
    return true
  })

  const vendasSorted = [...vendasFiltradas].sort((a, b) => {
    const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const totalVendas = vendasFiltradas.reduce((s, v) => s + v.valor_recebido, 0)
  const totalRecebido = vendasFiltradas
    .filter(v => (v.recebimento ?? 'a_vista') === 'a_vista' && v.fin_lancamento_id)
    .reduce((s, v) => s + v.valor_recebido, 0)
  const totalPendente = vendasFiltradas
    .filter(v => (v.recebimento ?? 'a_vista') !== 'a_vista' && v.fin_lancamento_id)
    .reduce((s, v) => s + v.valor_recebido, 0)
  const totalVencido = vendasFiltradas
    .filter(v => {
      const aVista = (v.recebimento ?? 'a_vista') === 'a_vista'
      return !aVista && v.fin_lancamento_id && v.data_vencimento && v.data_vencimento < hoje
    })
    .reduce((s, v) => s + v.valor_recebido, 0)

  const temFiltro = busca || filtroPagamento || filtroDataDe || filtroDataAte || filtroStatus !== 'todos'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

      {/* ── KPIs ── */}
      <div className={styles.indicadores}>
        <div className={styles.indicador}>
          <span>Total vendas</span>
          <strong>{fmt(totalVendas)}</strong>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{vendasFiltradas.length} vendas</span>
        </div>
        <div className={styles.indicador}>
          <span>Recebido</span>
          <strong style={{ color: '#16a34a' }}>{fmt(totalRecebido)}</strong>
        </div>
        <div className={styles.indicador}>
          <span>A receber</span>
          <strong style={{ color: totalVencido > 0 ? '#dc2626' : '#d97706' }}>{fmt(totalPendente)}</strong>
          {totalVencido > 0 && (
            <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>
              {fmt(totalVencido)} vencido
            </span>
          )}
        </div>
      </div>

      {/* ── Formulário colapsável ── */}
      <CollapsibleSection title="+ Nova venda" defaultOpen={formAberto}>
        <form className={styles.form} onSubmit={registrarVenda} style={{ border: 'none', padding: 0 }}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Produto</label>
              <select className={styles.input} value={form.produto_id} onChange={e => selecionarProduto(e.target.value)}>
                <option value="">— Selecione ou digite abaixo —</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Título do produto *</label>
              <input className={styles.input} value={form.produto_titulo}
                onChange={e => setForm(f => ({ ...f, produto_titulo: e.target.value }))}
                placeholder="Preenchido ao selecionar acima" required />
            </div>
          </div>

          <div className={styles.row3}>
            <div className={styles.field}>
              <label>Valor (R$) *</label>
              <input className={styles.input} type="number" step="0.01" min="0"
                value={form.valor_recebido}
                onChange={e => setForm(f => ({ ...f, valor_recebido: e.target.value }))} required />
            </div>
            <div className={styles.field}>
              <label>Forma de pagamento *</label>
              <select className={styles.input} value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                {FORMAS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Data da venda *</label>
              <input className={styles.input} type="datetime-local" value={form.data_venda}
                onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} required />
            </div>
          </div>

          <div className={styles.field}>
            <label>Recebimento *</label>
            <div className={styles.recebimentoToggle}>
              <button type="button"
                className={`${styles.recebBtn} ${form.recebimento === 'a_vista' ? styles.recebBtnAtivo : ''}`}
                onClick={() => setForm(f => ({ ...f, recebimento: 'a_vista' }))}>
                À vista — recebido no ato
              </button>
              <button type="button"
                className={`${styles.recebBtn} ${form.recebimento === 'a_prazo' ? styles.recebBtnAtivoAlerta : ''}`}
                onClick={() => setForm(f => ({ ...f, recebimento: 'a_prazo' }))}>
                A prazo — receber depois
              </button>
            </div>
          </div>

          {form.recebimento === 'a_prazo' && (
            <div className={styles.row} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '14px 16px' }}>
              <div className={styles.field}>
                <label>Data de vencimento *</label>
                <input className={styles.input} type="date" value={form.data_vencimento}
                  onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label>Condição</label>
                <select className={styles.input} value={form.condicao_pagamento}
                  onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}>
                  {CONDICOES_PRAZO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>Observação</label>
            <input className={styles.input} value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={salvando}>
              {salvando ? 'Registrando...' : 'Registrar venda'}
            </button>
          </div>
        </form>
      </CollapsibleSection>

      {/* ── Filtros ── */}
      <div className={styles.lista}>
        <div className={styles.listaHeader}>
          <h2 className={styles.formTitle}>Vendas ({vendasFiltradas.length})</h2>
          {temFiltro && (
            <button className={styles.btnSecondary} onClick={() => {
              setBusca(''); setFiltroStatus('todos'); setFiltroPagamento(''); setFiltroDataDe(''); setFiltroDataAte('')
            }}>Limpar filtros</button>
          )}
        </div>

        <div className={styles.row} style={{ gap: 10 }}>
          <input className={styles.input} placeholder="Buscar produto ou observação..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <select className={styles.input} value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}>
            <option value="todos">Todos os status</option>
            <option value="recebido">Recebido</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>
        <div className={styles.row} style={{ gap: 10 }}>
          <select className={styles.input} value={filtroPagamento}
            onChange={e => setFiltroPagamento(e.target.value)}>
            <option value="">Todas as formas</option>
            {FORMAS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>
          <input className={styles.input} type="date" value={filtroDataDe}
            onChange={e => setFiltroDataDe(e.target.value)} title="Data inicial" />
          <input className={styles.input} type="date" value={filtroDataAte}
            onChange={e => setFiltroDataAte(e.target.value)} title="Data final" />
        </div>

        {/* ── Tabela ── */}
        {loading ? (
          <p className={styles.vazio}>Carregando...</p>
        ) : vendasFiltradas.length === 0 ? (
          <p className={styles.vazio}>{temFiltro ? 'Nenhuma venda com esses filtros.' : 'Nenhuma venda registrada.'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th className={styles.sortable} onClick={() => toggleSort('produto_titulo')}>Produto{ind('produto_titulo')}</th>
                  <th className={styles.sortable} onClick={() => toggleSort('valor_recebido')}>Valor{ind('valor_recebido')}</th>
                  <th className={styles.sortable} onClick={() => toggleSort('forma_pagamento')}>Pagamento{ind('forma_pagamento')}</th>
                  <th className={styles.sortable} onClick={() => toggleSort('data_venda')}>Data{ind('data_venda')}</th>
                  <th>Vencimento</th>
                  <th>Obs</th>
                  <th>Financeiro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendasSorted.map(v => {
                  const aVista  = (v.recebimento ?? 'a_vista') === 'a_vista'
                  const pendente = v.fin_lancamento_id && !aVista
                  const vencido  = pendente && v.data_vencimento && v.data_vencimento < hoje

                  return (
                    <tr key={v.id}>
                      <td>{v.produto_titulo}</td>
                      <td className={styles.valor}>{fmt(v.valor_recebido)}</td>
                      <td>{v.forma_pagamento}</td>
                      <td>{fmtData(v.data_venda)}</td>
                      <td>
                        {aVista
                          ? <span className={styles.badgeVista}>À vista</span>
                          : <span className={vencido ? styles.badgeVencido : styles.badgePrazo}>
                              {fmtDate(v.data_vencimento)}
                            </span>
                        }
                      </td>
                      <td className={styles.obs}>{v.observacao ?? '—'}</td>
                      <td>
                        {!v.fin_lancamento_id && (
                          <button className={styles.btnVincular} onClick={() => vincularFinanceiro(v)}>
                            Vincular
                          </button>
                        )}
                        {v.fin_lancamento_id && aVista && (
                          <span className={styles.badgeOk}>Recebido</span>
                        )}
                        {v.fin_lancamento_id && !aVista && (
                          recebendoId === v.id ? (
                            <div className={styles.baixaInline}>
                              <input type="date" className={styles.inputSmall}
                                value={dataRecebimento}
                                onChange={e => setDataRecebimento(e.target.value)} />
                              <button className={styles.btnBaixar} disabled={salvando}
                                onClick={() => registrarRecebimento(v)}>
                                {salvando ? '...' : '✓'}
                              </button>
                              <button className={styles.btnCancelarBaixa}
                                onClick={() => setRecebendoId(null)}>✕</button>
                            </div>
                          ) : (
                            <button
                              className={vencido ? styles.btnReceberAlerta : styles.btnReceberPrazo}
                              onClick={() => { setRecebendoId(v.id); setDataRecebimento(new Date().toISOString().slice(0, 10)) }}>
                              {vencido ? 'Receber' : 'Receber'}
                            </button>
                          )
                        )}
                      </td>
                      <td>
                        <button className={styles.btnDanger} onClick={() => excluirVenda(v.id)}>Excluir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
