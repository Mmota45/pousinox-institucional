import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProducao.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Status = 'planejada' | 'liberada' | 'em_producao' | 'concluida' | 'cancelada'
type Vista  = 'lista' | 'form' | 'detalhe'

interface OrdemProducao {
  id:                number
  numero:            string
  titulo:            string
  projeto_id:        number | null
  produto_descricao: string | null
  quantidade:        number
  unidade:           string
  status:            Status
  data_planejada:    string | null
  data_inicio:       string | null
  data_conclusao:    string | null
  responsavel:       string | null
  observacao:        string | null
  created_at:        string
  updated_at:        string
  // join
  projetos?: { titulo: string } | null
}

interface ProjetoOpt {
  id: number
  titulo: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  planejada:   'Planejada',
  liberada:    'Liberada',
  em_producao: 'Em Produção',
  concluida:   'Concluída',
  cancelada:   'Cancelada',
}

const STATUS_CLASS: Record<Status, string> = {
  planejada:   styles.badgePlanejada,
  liberada:    styles.badgeLiberada,
  em_producao: styles.badgeEmProducao,
  concluida:   styles.badgeConcluida,
  cancelada:   styles.badgeCancelada,
}

// Status seguinte no fluxo normal (exceto concluida/cancelada)
const PROXIMO: Partial<Record<Status, { status: Status; label: string }>> = {
  planejada:   { status: 'liberada',    label: '▶ Liberar'         },
  liberada:    { status: 'em_producao', label: '▶ Iniciar Produção' },
  em_producao: { status: 'concluida',   label: '✓ Concluir'        },
}

function fmtData(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const FORM_VAZIO = {
  titulo:            '',
  projeto_id:        null as number | null,
  produto_descricao: '',
  quantidade:        '1',
  unidade:           'un',
  status:            'planejada' as Status,
  data_planejada:    '',
  responsavel:       '',
  observacao:        '',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminProducao() {
  const [vista,      setVista]      = useState<Vista>('lista')
  const [ordens,     setOrdens]     = useState<OrdemProducao[]>([])
  const [carregando, setCarregando] = useState(false)
  const lp = useLoadingProgress(1)
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')

  const [ordemAtual, setOrdemAtual] = useState<OrdemProducao | null>(null)

  // Form
  const [form,         setForm]         = useState({ ...FORM_VAZIO })
  const [editId,       setEditId]       = useState<number | null>(null)
  const [salvando,     setSalvando]     = useState(false)
  const [formMsg,      setFormMsg]      = useState<{ ok: boolean; texto: string } | null>(null)

  // Busca de projeto
  const [projetoBusca,    setProjetoBusca]    = useState('')
  const [projetoOpts,     setProjetoOpts]     = useState<ProjetoOpt[]>([])
  const [projetoSel,      setProjetoSel]      = useState<ProjetoOpt | null>(null)
  const [buscandoProjeto, setBuscandoProjeto] = useState(false)

  // ── Carregar lista ──────────────────────────────────────────────────────────

  const carregarOrdens = useCallback(async () => {
    setCarregando(true)
    lp.reset()
    let q = supabaseAdmin
      .from('ordens_producao')
      .select('*, projetos(titulo)')
      .order('created_at', { ascending: false })
    if (filtroStatus !== 'todas') q = q.eq('status', filtroStatus)
    const { data } = await q
    lp.step()
    setOrdens((data as OrdemProducao[]) ?? [])
    setCarregando(false)
  }, [filtroStatus])

  useEffect(() => { if (vista === 'lista') carregarOrdens() }, [vista, carregarOrdens])

  // ── Busca de projetos ───────────────────────────────────────────────────────

  useEffect(() => {
    if (projetoBusca.length < 2) { setProjetoOpts([]); return }
    const t = setTimeout(async () => {
      setBuscandoProjeto(true)
      const { data } = await supabaseAdmin
        .from('projetos')
        .select('id, titulo')
        .ilike('titulo', `%${projetoBusca}%`)
        .limit(8)
      setProjetoOpts((data as ProjetoOpt[]) ?? [])
      setBuscandoProjeto(false)
    }, 300)
    return () => clearTimeout(t)
  }, [projetoBusca])

  // ── Abrir form (criar / editar) ─────────────────────────────────────────────

  function abrirNovaOrdem() {
    setForm({ ...FORM_VAZIO })
    setEditId(null)
    setProjetoBusca('')
    setProjetoOpts([])
    setProjetoSel(null)
    setFormMsg(null)
    setVista('form')
  }

  function abrirEditar(o: OrdemProducao) {
    setForm({
      titulo:            o.titulo,
      projeto_id:        o.projeto_id,
      produto_descricao: o.produto_descricao ?? '',
      quantidade:        String(o.quantidade),
      unidade:           o.unidade,
      status:            o.status,
      data_planejada:    o.data_planejada ?? '',
      responsavel:       o.responsavel ?? '',
      observacao:        o.observacao ?? '',
    })
    setEditId(o.id)
    setProjetoBusca('')
    setProjetoOpts([])
    setProjetoSel(o.projeto_id && o.projetos ? { id: o.projeto_id, titulo: o.projetos.titulo } : null)
    setFormMsg(null)
    setVista('form')
  }

  function abrirDetalhe(o: OrdemProducao) {
    setOrdemAtual(o)
    setVista('detalhe')
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────

  async function salvar() {
    if (!form.titulo.trim()) { setFormMsg({ ok: false, texto: 'Título obrigatório.' }); return }
    setSalvando(true)
    setFormMsg(null)

    const payload = {
      titulo:            form.titulo.trim(),
      projeto_id:        projetoSel?.id ?? null,
      produto_descricao: form.produto_descricao.trim() || null,
      quantidade:        parseFloat(form.quantidade) || 1,
      unidade:           form.unidade,
      status:            form.status,
      data_planejada:    form.data_planejada || null,
      responsavel:       form.responsavel.trim() || null,
      observacao:        form.observacao.trim() || null,
    }

    let erro: string | null = null
    if (editId) {
      const { error } = await supabaseAdmin.from('ordens_producao').update(payload).eq('id', editId)
      erro = error?.message ?? null
    } else {
      const { error } = await supabaseAdmin.from('ordens_producao').insert(payload)
      erro = error?.message ?? null
    }

    if (erro) {
      setFormMsg({ ok: false, texto: erro })
    } else {
      setFormMsg({ ok: true, texto: editId ? 'Ordem atualizada.' : 'Ordem criada com sucesso.' })
      setTimeout(() => { setVista('lista') }, 900)
    }
    setSalvando(false)
  }

  // ── Avançar status ──────────────────────────────────────────────────────────

  async function avancarStatus(o: OrdemProducao, novoStatus: Status) {
    const extra: Record<string, string> = {}
    if (novoStatus === 'em_producao') extra.data_inicio    = new Date().toISOString().slice(0, 10)
    if (novoStatus === 'concluida')   extra.data_conclusao = new Date().toISOString().slice(0, 10)

    await supabaseAdmin.from('ordens_producao').update({ status: novoStatus, ...extra }).eq('id', o.id)
    setOrdens(prev => prev.map(x => x.id === o.id ? { ...x, status: novoStatus, ...extra } : x))
    if (ordemAtual?.id === o.id) setOrdemAtual(prev => prev ? { ...prev, status: novoStatus, ...extra } : prev)
  }

  async function cancelar(o: OrdemProducao) {
    if (!confirm(`Cancelar a ordem ${o.numero}?`)) return
    await supabaseAdmin.from('ordens_producao').update({ status: 'cancelada' }).eq('id', o.id)
    setOrdens(prev => prev.map(x => x.id === o.id ? { ...x, status: 'cancelada' } : x))
    if (ordemAtual?.id === o.id) setOrdemAtual(prev => prev ? { ...prev, status: 'cancelada' } : prev)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {/* ── LISTA ─────────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Produção / PCP</h1>
              <p className={styles.pageSubtitle}>Ordens de produção</p>
            </div>
            <button className={styles.btnPrimary} onClick={abrirNovaOrdem}>+ Nova Ordem</button>
          </div>

          <div className={styles.toolbar}>
            <select
              className={styles.selectFiltro}
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
            >
              <option value="todas">Todos os status</option>
              <option value="planejada">Planejada</option>
              <option value="liberada">Liberada</option>
              <option value="em_producao">Em Produção</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className={styles.card}>
            {carregando ? (
              <AdminLoading total={lp.total} current={lp.current} label="Carregando ordens…" />
            ) : ordens.length === 0 ? (
              <div className={styles.vazio}>Nenhuma ordem de produção encontrada.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Título</th>
                      <th>Produto / Qtd</th>
                      <th>Projeto</th>
                      <th>Status</th>
                      <th>Planejado para</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordens.map(o => (
                      <tr key={o.id} onClick={() => abrirDetalhe(o)}>
                        <td><span className={styles.numero}>{o.numero}</span></td>
                        <td><span className={styles.tituloCell}>{o.titulo}</span></td>
                        <td>
                          <div className={styles.qtd}>{Number(o.quantidade).toLocaleString('pt-BR')} {o.unidade}</div>
                          {o.produto_descricao && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{o.produto_descricao}</div>
                          )}
                        </td>
                        <td>
                          {o.projetos?.titulo
                            ? <span className={styles.projetoLink}>🔗 {o.projetos.titulo}</span>
                            : <span style={{ color: 'var(--color-text-light)', fontSize: '0.82rem' }}>—</span>
                          }
                        </td>
                        <td><span className={STATUS_CLASS[o.status]}>{STATUS_LABEL[o.status]}</span></td>
                        <td><span className={styles.data}>{fmtData(o.data_planejada)}</span></td>
                        <td><span style={{ fontSize: '0.85rem' }}>{o.responsavel ?? '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      {vista === 'form' && (
        <>
          <div className={styles.pageHeader}>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
          </div>

          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitulo}>{editId ? 'Editar Ordem' : 'Nova Ordem de Produção'}</h2>
            </div>

            <div className={styles.formGrid}>
              {/* Título */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Título *</label>
                <input
                  className={styles.formInput}
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Fabricação de suportes 316L – Lote A"
                />
              </div>

              {/* Produto */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Produto / Descrição</label>
                <input
                  className={styles.formInput}
                  value={form.produto_descricao}
                  onChange={e => setForm(f => ({ ...f, produto_descricao: e.target.value }))}
                  placeholder="Ex: Fixador FP-10 inox 316L"
                />
              </div>

              {/* Quantidade + Unidade */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Quantidade</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  className={styles.formInput}
                  value={form.quantidade}
                  onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Unidade</label>
                <select
                  className={styles.formSelect}
                  value={form.unidade}
                  onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                >
                  <option value="un">un</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="m²">m²</option>
                  <option value="cx">cx</option>
                  <option value="pc">pc</option>
                  <option value="lote">lote</option>
                </select>
              </div>

              {/* Status */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status</label>
                <select
                  className={styles.formSelect}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                >
                  <option value="planejada">Planejada</option>
                  <option value="liberada">Liberada</option>
                  <option value="em_producao">Em Produção</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              {/* Data planejada */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Data Planejada</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={form.data_planejada}
                  onChange={e => setForm(f => ({ ...f, data_planejada: e.target.value }))}
                />
              </div>

              {/* Responsável */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Responsável</label>
                <input
                  className={styles.formInput}
                  value={form.responsavel}
                  onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  placeholder="Nome do responsável pela produção"
                />
              </div>

              {/* Vínculo com Projeto */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Projeto vinculado (opcional)</label>
                {projetoSel ? (
                  <div className={styles.projetoSelecionado}>
                    <span>🔗 {projetoSel.titulo}</span>
                    <button onClick={() => { setProjetoSel(null); setProjetoBusca('') }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      className={styles.formInput}
                      value={projetoBusca}
                      onChange={e => setProjetoBusca(e.target.value)}
                      placeholder="Digite para buscar projeto por nome…"
                    />
                    {buscandoProjeto && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Buscando…</div>}
                    {projetoOpts.length > 0 && (
                      <div className={styles.projetoSugestoes}>
                        {projetoOpts.map(p => (
                          <div
                            key={p.id}
                            className={styles.projetoSugestaoItem}
                            onClick={() => { setProjetoSel(p); setProjetoBusca(''); setProjetoOpts([]) }}
                          >
                            {p.titulo}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Observação */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Observação</label>
                <textarea
                  className={styles.formTextarea}
                  value={form.observacao}
                  onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Instruções especiais, referências, notas…"
                />
              </div>
            </div>

            {formMsg && (
              <div className={`${styles.formMsg} ${formMsg.ok ? styles.formMsgOk : styles.formMsgErro}`}>
                {formMsg.texto}
              </div>
            )}

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setVista('lista')}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando…' : editId ? 'Salvar alterações' : 'Criar ordem'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DETALHE ───────────────────────────────────────────────────────── */}
      {vista === 'detalhe' && ordemAtual && (
        <>
          <div className={styles.pageHeader}>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
            <button className={styles.btnSecondary} onClick={() => abrirEditar(ordemAtual)}>✏ Editar</button>
          </div>

          <div className={styles.detalheCard}>
            <div className={styles.detalheHeader}>
              <div>
                <div className={styles.detalheNumero}>{ordemAtual.numero}</div>
                <h2 className={styles.detalheTitulo}>{ordemAtual.titulo}</h2>
                <span className={STATUS_CLASS[ordemAtual.status]}>{STATUS_LABEL[ordemAtual.status]}</span>
              </div>
            </div>

            {/* Vínculo com projeto */}
            {ordemAtual.projetos?.titulo && (
              <div>
                <div className={styles.projetoVinculo}>
                  🔗 Projeto: <strong>{ordemAtual.projetos.titulo}</strong>
                </div>
              </div>
            )}

            <div className={styles.detalheGrid}>
              <div className={styles.detalheField}>
                <label>Produto</label>
                <span>{ordemAtual.produto_descricao ?? '—'}</span>
              </div>
              <div className={styles.detalheField}>
                <label>Quantidade</label>
                <span>{Number(ordemAtual.quantidade).toLocaleString('pt-BR')} {ordemAtual.unidade}</span>
              </div>
              <div className={styles.detalheField}>
                <label>Responsável</label>
                <span>{ordemAtual.responsavel ?? '—'}</span>
              </div>
              <div className={styles.detalheField}>
                <label>Data Planejada</label>
                <span>{fmtData(ordemAtual.data_planejada)}</span>
              </div>
              <div className={styles.detalheField}>
                <label>Início</label>
                <span>{fmtData(ordemAtual.data_inicio)}</span>
              </div>
              <div className={styles.detalheField}>
                <label>Conclusão</label>
                <span>{fmtData(ordemAtual.data_conclusao)}</span>
              </div>
              {ordemAtual.observacao && (
                <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                  <label>Observação</label>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{ordemAtual.observacao}</span>
                </div>
              )}
            </div>

            {/* Progressão de status */}
            {ordemAtual.status !== 'concluida' && ordemAtual.status !== 'cancelada' && (
              <div className={styles.statusFlow}>
                <div className={styles.statusFlowTitulo}>Avançar status</div>
                <div className={styles.statusFlowBtns}>
                  {PROXIMO[ordemAtual.status] && (
                    <button
                      className={styles.btnAvancar}
                      onClick={() => avancarStatus(ordemAtual, PROXIMO[ordemAtual.status]!.status)}
                    >
                      {PROXIMO[ordemAtual.status]!.label}
                    </button>
                  )}
                  <button
                    className={styles.btnCancelar}
                    onClick={() => cancelar(ordemAtual)}
                  >
                    Cancelar ordem
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
