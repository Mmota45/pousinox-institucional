import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminEstoqueIndustrial.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'

// ── Types ─────────────────────────────────────────────────────────
type Vista = 'lista' | 'form' | 'detalhe'
type TipoItem = 'mp' | 'pa' | 'semiacabado'
type TipoMov = 'entrada' | 'saida' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia_entrada' | 'transferencia_saida'

export interface EstoqueItem {
  id: number
  codigo: string | null
  nome: string
  tipo: TipoItem
  unidade: string
  saldo_atual: number
  estoque_minimo: number
  custo_medio: number
  localizacao: string | null
  lote_padrao: string | null
  ativo: boolean
  created_at: string
}

interface Movimentacao {
  id: number
  item_id: number
  tipo_movimentacao: TipoMov
  quantidade: number
  custo_unitario: number
  valor_total: number
  saldo_anterior: number
  saldo_posterior: number
  lote: string | null
  localizacao: string | null
  origem_tipo: string | null
  origem_label: string | null
  responsavel: string | null
  observacoes: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtData(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function saldoStatus(item: EstoqueItem): 'ok' | 'baixo' | 'zerado' {
  if (item.saldo_atual <= 0) return 'zerado'
  if (item.estoque_minimo > 0 && item.saldo_atual <= item.estoque_minimo) return 'baixo'
  return 'ok'
}

function BadgeSaldo({ item }: { item: EstoqueItem }) {
  const s = saldoStatus(item)
  const cls = s === 'ok' ? styles.badgeOk : s === 'baixo' ? styles.badgeBaixo : styles.badgeZerado
  const label = s === 'ok' ? 'OK' : s === 'baixo' ? 'Baixo' : 'Zerado'
  return <span className={cls}>{label}</span>
}

function BadgeTipoMov({ tipo }: { tipo: TipoMov }) {
  const map: Record<TipoMov, [string, string]> = {
    entrada:               [styles.tipoEntrada,        'Entrada'],
    saida:                 [styles.tipoSaida,           'Saída'],
    ajuste_positivo:       [styles.tipoAjustePositivo,  'Ajuste +'],
    ajuste_negativo:       [styles.tipoAjusteNegativo,  'Ajuste −'],
    transferencia_entrada: [styles.tipoTransferencia,   'Transf. Entrada'],
    transferencia_saida:   [styles.tipoTransferencia,   'Transf. Saída'],
  }
  const [cls, label] = map[tipo]
  return <span className={cls}>{label}</span>
}

const TIPOS_MOV_LABEL: Record<TipoMov, string> = {
  entrada: 'Entrada', saida: 'Saída',
  ajuste_positivo: 'Ajuste positivo', ajuste_negativo: 'Ajuste negativo',
  transferencia_entrada: 'Transferência entrada', transferencia_saida: 'Transferência saída',
}

// Tipos que adicionam ao saldo
const TIPOS_POSITIVOS: TipoMov[] = ['entrada', 'ajuste_positivo', 'transferencia_entrada']

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  tipo: TipoItem
  titulo: string
  subtitulo: string
}

// ── Component ─────────────────────────────────────────────────────
export default function AdminEstoqueBase({ tipo, titulo, subtitulo }: Props) {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<EstoqueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editando, setEditando] = useState<EstoqueItem | null>(null)
  const [detalhe, setDetalhe] = useState<EstoqueItem | null>(null)
  const [historico, setHistorico] = useState<Movimentacao[]>([])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Form cadastro
  const [fCodigo, setFCodigo] = useState('')
  const [fNome, setFNome] = useState('')
  const [fUnidade, setFUnidade] = useState('un')
  const [fMinimo, setFMinimo] = useState('0')
  const [fCusto, setFCusto] = useState('0')
  const [fLocal, setFLocal] = useState('')
  const [fLote, setFLote] = useState('')
  const [fAtivo, setFAtivo] = useState(true)

  // Form movimentação
  const [mTipo, setMTipo] = useState<TipoMov>('entrada')
  const [mQtd, setMQtd] = useState('')
  const [mCusto, setMCusto] = useState('')
  const [mLote, setMLote] = useState('')
  const [mLocal, setMLocal] = useState('')
  const [mOrigem, setMOrigem] = useState('')
  const [mObs, setMObs] = useState('')
  const [mResp, setMResp] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('estoque_itens')
      .select('*')
      .eq('tipo', tipo)
      .order('nome')
    setLista(data ?? [])
    setLoading(false)
  }, [tipo])

  useEffect(() => { carregar() }, [carregar])

  const listaFiltrada = lista.filter(item => {
    if (!item.ativo && filtroStatus !== 'inativos') return false
    if (filtroStatus === 'todos') return item.ativo
    if (filtroStatus === 'baixo') return saldoStatus(item) === 'baixo'
    if (filtroStatus === 'zerado') return saldoStatus(item) === 'zerado'
    if (filtroStatus === 'inativos') return !item.ativo
    return true
  })

  // Resumo
  const totalItens = lista.filter(i => i.ativo).length
  const itensAbaixo = lista.filter(i => i.ativo && saldoStatus(i) === 'baixo').length
  const itensZerados = lista.filter(i => i.ativo && saldoStatus(i) === 'zerado').length
  const valorTotal = lista.filter(i => i.ativo).reduce((s, i) => s + i.saldo_atual * i.custo_medio, 0)

  function abrirForm(item?: EstoqueItem) {
    if (item) {
      setEditando(item)
      setFCodigo(item.codigo ?? '')
      setFNome(item.nome)
      setFUnidade(item.unidade)
      setFMinimo(item.estoque_minimo.toString())
      setFCusto(item.custo_medio.toString())
      setFLocal(item.localizacao ?? '')
      setFLote(item.lote_padrao ?? '')
      setFAtivo(item.ativo)
    } else {
      setEditando(null)
      setFCodigo('')
      setFNome('')
      setFUnidade('un')
      setFMinimo('0')
      setFCusto('0')
      setFLocal('')
      setFLote('')
      setFAtivo(true)
    }
    setMsg(null)
    setVista('form')
  }

  async function salvarForm() {
    if (!fNome.trim()) { setMsg({ tipo: 'erro', texto: 'Nome obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      codigo: fCodigo.trim() || null,
      nome: fNome.trim(),
      tipo,
      unidade: fUnidade.trim() || 'un',
      estoque_minimo: parseFloat(fMinimo) || 0,
      custo_medio: parseFloat(fCusto) || 0,
      localizacao: fLocal.trim() || null,
      lote_padrao: fLote.trim() || null,
      ativo: fAtivo,
    }
    if (editando) {
      const { error } = await supabaseAdmin.from('estoque_itens').update(payload).eq('id', editando.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabaseAdmin.from('estoque_itens').insert(payload)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
    }
    await carregar()
    setSalvando(false)
    setVista('lista')
  }

  async function abrirDetalhe(item: EstoqueItem) {
    setDetalhe(item)
    setMTipo('entrada')
    setMQtd('')
    setMCusto(item.custo_medio.toString())
    setMLote(item.lote_padrao ?? '')
    setMLocal(item.localizacao ?? '')
    setMOrigem('')
    setMObs('')
    setMResp('')
    setMsg(null)
    await carregarHistorico(item.id)
    setVista('detalhe')
  }

  async function carregarHistorico(itemId: number) {
    const { data } = await supabaseAdmin
      .from('estoque_movimentacoes')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50)
    setHistorico(data ?? [])
  }

  async function registrarMovimentacao() {
    if (!detalhe) return
    const qtd = parseFloat(mQtd)
    if (!qtd || qtd <= 0) { setMsg({ tipo: 'erro', texto: 'Quantidade inválida.' }); return }
    setSalvando(true)

    const saldoAnterior = detalhe.saldo_atual
    const isPositivo = TIPOS_POSITIVOS.includes(mTipo)
    const saldoPosterior = isPositivo ? saldoAnterior + qtd : Math.max(0, saldoAnterior - qtd)
    const custoUnit = parseFloat(mCusto) || 0

    const { error: errMov } = await supabaseAdmin.from('estoque_movimentacoes').insert({
      item_id: detalhe.id,
      tipo_movimentacao: mTipo,
      quantidade: qtd,
      custo_unitario: custoUnit,
      valor_total: qtd * custoUnit,
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      lote: mLote.trim() || null,
      localizacao: mLocal.trim() || null,
      origem_tipo: 'manual',
      origem_label: mOrigem.trim() || null,
      responsavel: mResp.trim() || null,
      observacoes: mObs.trim() || null,
    })

    if (errMov) { setMsg({ tipo: 'erro', texto: errMov.message }); setSalvando(false); return }

    // Atualizar saldo_atual e custo_medio no item
    let novoCustoMedio = detalhe.custo_medio
    if (isPositivo && custoUnit > 0) {
      // Custo médio ponderado (só recalcula em entradas)
      const totalAnterior = saldoAnterior * detalhe.custo_medio
      const totalNovo = qtd * custoUnit
      novoCustoMedio = saldoPosterior > 0 ? (totalAnterior + totalNovo) / saldoPosterior : custoUnit
    }

    await supabaseAdmin.from('estoque_itens').update({
      saldo_atual: saldoPosterior,
      custo_medio: novoCustoMedio,
    }).eq('id', detalhe.id)

    const itemAtualizado = { ...detalhe, saldo_atual: saldoPosterior, custo_medio: novoCustoMedio }
    setDetalhe(itemAtualizado)
    setLista(l => l.map(i => i.id === detalhe.id ? itemAtualizado : i))
    await carregarHistorico(detalhe.id)

    // Reset form mov
    setMQtd('')
    setMOrigem('')
    setMObs('')
    setMsg({ tipo: 'ok', texto: `Movimentação registrada. Novo saldo: ${saldoPosterior} ${detalhe.unidade}` })
    setSalvando(false)
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{titulo}</h1>
          <p className={styles.pageSubtitle}>{subtitulo}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AiActionButton label="Previsão reposição" icon="📊" action={async () => {
            const { data: itensData } = await supabaseAdmin.from('estoque_itens').select('nome,saldo_atual,estoque_minimo,custo_medio,unidade').eq('tipo', tipo).eq('ativo', true).order('saldo_atual', { ascending: true }).limit(30)
            if (!itensData?.length) return 'Sem itens no estoque.'
            const lista = itensData.map(i => `${i.nome}: saldo=${i.saldo_atual} ${i.unidade}, mín=${i.estoque_minimo}, custo=R$${i.custo_medio || 0}`).join('\n')
            const r = await aiChat({
              prompt: `Estoque ${tipo === 'mp' ? 'Matéria-Prima' : 'Produto Acabado'} da Pousinox:\n${lista}\n\nAnalise: itens críticos (abaixo do mínimo), previsão de necessidade de reposição, sugestão de compra priorizada com estimativa de valor.`,
              system: 'Analista de supply chain. Responda direto com tabela de prioridades e valores estimados. Português brasileiro.',
              model: 'groq',
            })
            return r.error ? `Erro: ${r.error}` : r.content
          }} />
          <button className={styles.btnPrimary} onClick={() => abrirForm()}>+ Novo Item</button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Itens ativos</span>
          <span className={styles.summaryValue}>{totalItens}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Abaixo do mínimo</span>
          <span className={`${styles.summaryValue} ${itensAbaixo > 0 ? styles.summaryAlert : ''}`}>{itensAbaixo}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Zerados</span>
          <span className={`${styles.summaryValue} ${itensZerados > 0 ? styles.summaryAlert : ''}`}>{itensZerados}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Valor em estoque</span>
          <span className={styles.summaryValue} style={{ fontSize: '1.2rem' }}>{fmtValor(valorTotal)}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos (ativos)</option>
          <option value="baixo">Abaixo do mínimo</option>
          <option value="zerado">Zerados</option>
          <option value="inativos">Inativos</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className={styles.vazio}>Nenhum item encontrado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Un</th>
                <th>Saldo</th>
                <th>Mínimo</th>
                <th>Custo Médio</th>
                <th>Localização</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(item => {
                const s = saldoStatus(item)
                const saldoCls = s === 'ok' ? styles.saldoOk : s === 'baixo' ? styles.saldoBaixo : styles.saldoZero
                return (
                  <tr key={item.id} onClick={() => abrirDetalhe(item)}>
                    <td><span className={styles.codigo}>{item.codigo ?? '—'}</span></td>
                    <td><span className={styles.nome}>{item.nome}</span></td>
                    <td>{item.unidade}</td>
                    <td><span className={`${styles.saldo} ${saldoCls}`}>{item.saldo_atual} {item.unidade}</span></td>
                    <td><span className={styles.data}>{item.estoque_minimo} {item.unidade}</span></td>
                    <td><span className={styles.valor}>{item.custo_medio > 0 ? fmtValor(item.custo_medio) : '—'}</span></td>
                    <td><span className={styles.sub}>{item.localizacao ?? '—'}</span></td>
                    <td>{item.ativo ? <BadgeSaldo item={item} /> : <span className={styles.badgeInativo}>Inativo</span>}</td>
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
        <h1 className={styles.pageTitle}>{editando ? `Editar — ${editando.nome}` : `Novo Item — ${titulo}`}</h1>
        <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome *</label>
            <input className={styles.formInput} value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Nome do item" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Código</label>
            <input className={styles.formInput} value={fCodigo} onChange={e => setFCodigo(e.target.value)} placeholder="Código interno (opcional)" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Unidade</label>
            <input className={styles.formInput} value={fUnidade} onChange={e => setFUnidade(e.target.value)} placeholder="un, kg, m, L…" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Estoque Mínimo</label>
            <input className={styles.formInput} type="number" min="0" step="0.001" value={fMinimo} onChange={e => setFMinimo(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Custo Médio (R$)</label>
            <input className={styles.formInput} type="number" min="0" step="0.0001" value={fCusto} onChange={e => setFCusto(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Localização</label>
            <input className={styles.formInput} value={fLocal} onChange={e => setFLocal(e.target.value)} placeholder="Ex: Prateleira A3" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Lote Padrão</label>
            <input className={styles.formInput} value={fLote} onChange={e => setFLote(e.target.value)} placeholder="Lote padrão (opcional)" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ativo</label>
            <select className={styles.formSelect} value={fAtivo ? 'sim' : 'nao'} onChange={e => setFAtivo(e.target.value === 'sim')}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
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
    const s = saldoStatus(detalhe)
    const saldoCls = s === 'ok' ? styles.saldoOk : s === 'baixo' ? styles.saldoBaixo : styles.saldoZero
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            {detalhe.codigo && <div className={styles.detalheNumero}>{detalhe.codigo}</div>}
            <h1 className={styles.pageTitle}>{detalhe.nome}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary} onClick={() => abrirForm(detalhe)}>✏️ Editar</button>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
          </div>
        </div>

        <div className={styles.detalheCard}>
          {/* Saldo destaque */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Saldo Atual</div>
              <div className={`${styles.saldoDestaque} ${saldoCls}`}>
                {detalhe.saldo_atual}
                <span className={styles.saldoUnidade}>{detalhe.unidade}</span>
              </div>
            </div>
            <div className={styles.detalheGrid} style={{ flex: 1 }}>
              <div className={styles.detalheField}><label>Status</label><span><BadgeSaldo item={detalhe} /></span></div>
              <div className={styles.detalheField}><label>Mínimo</label><span>{detalhe.estoque_minimo} {detalhe.unidade}</span></div>
              <div className={styles.detalheField}><label>Custo Médio</label><span>{detalhe.custo_medio > 0 ? fmtValor(detalhe.custo_medio) : '—'}</span></div>
              <div className={styles.detalheField}><label>Valor Total</label><span style={{ fontWeight: 700 }}>{fmtValor(detalhe.saldo_atual * detalhe.custo_medio)}</span></div>
              <div className={styles.detalheField}><label>Localização</label><span>{detalhe.localizacao ?? '—'}</span></div>
              <div className={styles.detalheField}><label>Lote Padrão</label><span>{detalhe.lote_padrao ?? '—'}</span></div>
            </div>
          </div>

          {/* Nova Movimentação */}
          <div className={styles.movSection}>
            <div className={styles.movSectionTitulo}>Registrar Movimentação</div>
            <div className={styles.movGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo</label>
                <select className={styles.formSelect} value={mTipo} onChange={e => setMTipo(e.target.value as TipoMov)}>
                  {(Object.keys(TIPOS_MOV_LABEL) as TipoMov[]).map(t => (
                    <option key={t} value={t}>{TIPOS_MOV_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Quantidade *</label>
                <input className={styles.formInput} type="number" min="0.001" step="0.001" value={mQtd} onChange={e => setMQtd(e.target.value)} placeholder={`Ex: 10 ${detalhe.unidade}`} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Custo Unit. (R$)</label>
                <input className={styles.formInput} type="number" min="0" step="0.0001" value={mCusto} onChange={e => setMCusto(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Responsável</label>
                <input className={styles.formInput} value={mResp} onChange={e => setMResp(e.target.value)} placeholder="Quem registrou" />
              </div>
            </div>
            <div className={styles.formGrid} style={{ marginTop: 0 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Lote</label>
                <input className={styles.formInput} value={mLote} onChange={e => setMLote(e.target.value)} placeholder="Nº do lote (opcional)" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Localização</label>
                <input className={styles.formInput} value={mLocal} onChange={e => setMLocal(e.target.value)} placeholder="Prateleira, setor…" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Origem / Referência</label>
                <input className={styles.formInput} value={mOrigem} onChange={e => setMOrigem(e.target.value)} placeholder="Ex: PC-0001, OP-0003…" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Observações</label>
                <input className={styles.formInput} value={mObs} onChange={e => setMObs(e.target.value)} />
              </div>
            </div>
            {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className={styles.btnPrimary} onClick={registrarMovimentacao} disabled={salvando}>
                {salvando ? 'Registrando…' : 'Registrar Movimentação'}
              </button>
            </div>
          </div>

          {/* Histórico */}
          <div className={styles.historicoSection}>
            <div className={styles.historicoTitulo}>Histórico de movimentações</div>
            {historico.length === 0 ? (
              <div className={styles.vazio} style={{ padding: '24px' }}>Nenhuma movimentação registrada.</div>
            ) : (
              <div className={styles.card}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Qtd</th>
                      <th>Custo Unit.</th>
                      <th>Valor</th>
                      <th>Saldo Ant.</th>
                      <th>Saldo Post.</th>
                      <th>Lote</th>
                      <th>Origem</th>
                      <th>Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map(m => (
                      <tr key={m.id} style={{ cursor: 'default' }}>
                        <td><span className={styles.data}>{fmtData(m.created_at)}</span></td>
                        <td><BadgeTipoMov tipo={m.tipo_movimentacao} /></td>
                        <td><span style={{ fontWeight: 600 }}>{TIPOS_POSITIVOS.includes(m.tipo_movimentacao) ? '+' : '−'}{m.quantidade}</span></td>
                        <td>{m.custo_unitario > 0 ? fmtValor(m.custo_unitario) : '—'}</td>
                        <td>{m.valor_total > 0 ? fmtValor(m.valor_total) : '—'}</td>
                        <td className={styles.data}>{m.saldo_anterior}</td>
                        <td style={{ fontWeight: 600 }}>{m.saldo_posterior}</td>
                        <td className={styles.data}>{m.lote ?? '—'}</td>
                        <td className={styles.data}>{m.origem_label ?? '—'}</td>
                        <td className={styles.data}>{m.observacoes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
