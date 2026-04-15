import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminManutencao.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AtivoStatus = 'ativo' | 'inativo' | 'manutencao'
type TipoOM      = 'corretiva' | 'preventiva'
type Prioridade  = 'baixa' | 'media' | 'alta'
type OMStatus    = 'aberta' | 'em_execucao' | 'concluida' | 'cancelada'
type Aba         = 'ativos' | 'ordens'
type Vista       = 'ativos' | 'ativo_form' | 'ordens' | 'ordem_form' | 'ordem_detalhe'

interface Ativo {
  id:          number
  codigo:      string | null
  nome:        string
  categoria:   string | null
  localizacao: string | null
  fabricante:  string | null
  modelo:      string | null
  status:      AtivoStatus
  observacao:  string | null
  created_at:  string
}

interface OrdemManutencao {
  id:              number
  numero:          string
  ativo_id:        number | null
  tipo:            TipoOM
  titulo:          string
  descricao:       string | null
  prioridade:      Prioridade
  status:          OMStatus
  data_abertura:   string
  data_programada: string | null
  data_conclusao:  string | null
  responsavel:     string | null
  observacao:      string | null
  created_at:      string
  // join
  ativos?: { nome: string; codigo: string | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ATIVO_STATUS_CLASS: Record<AtivoStatus, string> = {
  ativo:      styles.ativoAtivo,
  inativo:    styles.ativoInativo,
  manutencao: styles.ativoManutencao,
}
const ATIVO_STATUS_LABEL: Record<AtivoStatus, string> = {
  ativo:      'Ativo',
  inativo:    'Inativo',
  manutencao: 'Em Manutenção',
}

const TIPO_CLASS: Record<TipoOM, string> = {
  corretiva:  styles.tipoCorretiva,
  preventiva: styles.tipoPreventiva,
}
const TIPO_LABEL: Record<TipoOM, string> = {
  corretiva:  'Corretiva',
  preventiva: 'Preventiva',
}

const PRIO_CLASS: Record<Prioridade, string> = {
  baixa: styles.prioBaixa,
  media: styles.prioMedia,
  alta:  styles.prioAlta,
}
const PRIO_LABEL: Record<Prioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

const OM_STATUS_CLASS: Record<OMStatus, string> = {
  aberta:      styles.omAberta,
  em_execucao: styles.omEmExecucao,
  concluida:   styles.omConcluida,
  cancelada:   styles.omCancelada,
}
const OM_STATUS_LABEL: Record<OMStatus, string> = {
  aberta:      'Aberta',
  em_execucao: 'Em Execução',
  concluida:   'Concluída',
  cancelada:   'Cancelada',
}

const PROXIMO_STATUS: Partial<Record<OMStatus, { status: OMStatus; label: string }>> = {
  aberta:      { status: 'em_execucao', label: '▶ Iniciar execução' },
  em_execucao: { status: 'concluida',   label: '✓ Concluir'         },
}

function fmtData(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

const ATIVO_FORM_VAZIO = {
  codigo: '', nome: '', categoria: '', localizacao: '',
  fabricante: '', modelo: '', status: 'ativo' as AtivoStatus, observacao: '',
}

const OM_FORM_VAZIO = {
  tipo:            'corretiva' as TipoOM,
  titulo:          '',
  descricao:       '',
  prioridade:      'media' as Prioridade,
  data_programada: '',
  responsavel:     '',
  observacao:      '',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminManutencao() {
  const [vista,     setVista]     = useState<Vista>('ativos')
  const [abaAtiva,  setAbaAtiva]  = useState<Aba>('ativos')

  // Ativos
  const [ativos,          setAtivos]          = useState<Ativo[]>([])
  const [carregandoAtivos, setCarregandoAtivos] = useState(false)
  const [filtroAtivoStatus, setFiltroAtivoStatus] = useState<string>('todos')
  const [ativoForm,  setAtivoForm]  = useState({ ...ATIVO_FORM_VAZIO })
  const [editAtivoId, setEditAtivoId] = useState<number | null>(null)

  // Ordens
  const [ordens,          setOrdens]          = useState<OrdemManutencao[]>([])
  const [carregandoOrdens, setCarregandoOrdens] = useState(false)
  const [filtroOMTipo,     setFiltroOMTipo]    = useState<string>('todos')
  const [filtroOMStatus,   setFiltroOMStatus]  = useState<string>('todos')
  const [omForm,      setOMForm]      = useState({ ...OM_FORM_VAZIO })
  const [ordemAtual,  setOrdemAtual]  = useState<OrdemManutencao | null>(null)

  // Busca de ativo no form de ordem
  const [ativoBusca,    setAtivoBusca]    = useState('')
  const [ativoOpts,     setAtivoOpts]     = useState<{ id: number; nome: string; codigo: string | null }[]>([])
  const [ativoSel,      setAtivoSel]      = useState<{ id: number; nome: string; codigo: string | null } | null>(null)
  const [buscandoAtivo, setBuscandoAtivo] = useState(false)

  // Form state compartilhado
  const [salvando, setSalvando] = useState(false)
  const [formMsg,  setFormMsg]  = useState<{ ok: boolean; texto: string } | null>(null)

  // ── Aba helper ─────────────────────────────────────────────────────────────

  function irAba(aba: Aba) {
    setAbaAtiva(aba)
    setVista(aba)
  }

  // ── Carregar ativos ─────────────────────────────────────────────────────────

  const carregarAtivos = useCallback(async () => {
    setCarregandoAtivos(true)
    let q = supabaseAdmin.from('ativos').select('*').order('nome')
    if (filtroAtivoStatus !== 'todos') q = q.eq('status', filtroAtivoStatus)
    const { data } = await q
    setAtivos((data as Ativo[]) ?? [])
    setCarregandoAtivos(false)
  }, [filtroAtivoStatus])

  useEffect(() => {
    if (vista === 'ativos') carregarAtivos()
  }, [vista, carregarAtivos])

  // ── Carregar ordens ─────────────────────────────────────────────────────────

  const carregarOrdens = useCallback(async () => {
    setCarregandoOrdens(true)
    let q = supabaseAdmin
      .from('ordens_manutencao')
      .select('*, ativos(nome, codigo)')
      .order('created_at', { ascending: false })
    if (filtroOMTipo   !== 'todos') q = q.eq('tipo',   filtroOMTipo)
    if (filtroOMStatus !== 'todos') q = q.eq('status', filtroOMStatus)
    const { data } = await q
    setOrdens((data as OrdemManutencao[]) ?? [])
    setCarregandoOrdens(false)
  }, [filtroOMTipo, filtroOMStatus])

  useEffect(() => {
    if (vista === 'ordens') carregarOrdens()
  }, [vista, carregarOrdens])

  // ── Busca de ativo (form ordem) ─────────────────────────────────────────────

  useEffect(() => {
    if (ativoBusca.length < 2) { setAtivoOpts([]); return }
    const t = setTimeout(async () => {
      setBuscandoAtivo(true)
      const { data } = await supabaseAdmin
        .from('ativos')
        .select('id, nome, codigo')
        .ilike('nome', `%${ativoBusca}%`)
        .eq('status', 'ativo')
        .limit(8)
      setAtivoOpts(data ?? [])
      setBuscandoAtivo(false)
    }, 300)
    return () => clearTimeout(t)
  }, [ativoBusca])

  // ── Ativo CRUD ──────────────────────────────────────────────────────────────

  function abrirNovoAtivo() {
    setAtivoForm({ ...ATIVO_FORM_VAZIO })
    setEditAtivoId(null)
    setFormMsg(null)
    setVista('ativo_form')
  }

  function abrirEditarAtivo(a: Ativo) {
    setAtivoForm({
      codigo: a.codigo ?? '', nome: a.nome, categoria: a.categoria ?? '',
      localizacao: a.localizacao ?? '', fabricante: a.fabricante ?? '',
      modelo: a.modelo ?? '', status: a.status, observacao: a.observacao ?? '',
    })
    setEditAtivoId(a.id)
    setFormMsg(null)
    setVista('ativo_form')
  }

  async function salvarAtivo() {
    if (!ativoForm.nome.trim()) { setFormMsg({ ok: false, texto: 'Nome do ativo é obrigatório.' }); return }
    setSalvando(true)
    setFormMsg(null)
    const payload = {
      codigo:      ativoForm.codigo.trim()      || null,
      nome:        ativoForm.nome.trim(),
      categoria:   ativoForm.categoria.trim()   || null,
      localizacao: ativoForm.localizacao.trim() || null,
      fabricante:  ativoForm.fabricante.trim()  || null,
      modelo:      ativoForm.modelo.trim()      || null,
      status:      ativoForm.status,
      observacao:  ativoForm.observacao.trim()  || null,
    }
    const { error } = editAtivoId
      ? await supabaseAdmin.from('ativos').update(payload).eq('id', editAtivoId)
      : await supabaseAdmin.from('ativos').insert(payload)

    if (error) { setFormMsg({ ok: false, texto: error.message }); setSalvando(false); return }
    setFormMsg({ ok: true, texto: editAtivoId ? 'Ativo atualizado.' : 'Ativo cadastrado.' })
    setTimeout(() => { irAba('ativos') }, 900)
    setSalvando(false)
  }

  // ── Ordem CRUD ──────────────────────────────────────────────────────────────

  function abrirNovaOrdem() {
    setOMForm({ ...OM_FORM_VAZIO, data_programada: '' })
    setAtivoSel(null)
    setAtivoBusca('')
    setAtivoOpts([])
    setFormMsg(null)
    setVista('ordem_form')
  }

  function abrirDetalheOrdem(o: OrdemManutencao) {
    setOrdemAtual(o)
    setVista('ordem_detalhe')
  }

  async function salvarOrdem() {
    if (!omForm.titulo.trim()) { setFormMsg({ ok: false, texto: 'Título é obrigatório.' }); return }
    setSalvando(true)
    setFormMsg(null)
    const payload = {
      ativo_id:        ativoSel?.id ?? null,
      tipo:            omForm.tipo,
      titulo:          omForm.titulo.trim(),
      descricao:       omForm.descricao.trim()       || null,
      prioridade:      omForm.prioridade,
      data_programada: omForm.data_programada        || null,
      responsavel:     omForm.responsavel.trim()     || null,
      observacao:      omForm.observacao.trim()       || null,
    }
    const { error } = await supabaseAdmin.from('ordens_manutencao').insert(payload)
    if (error) { setFormMsg({ ok: false, texto: error.message }); setSalvando(false); return }
    setFormMsg({ ok: true, texto: 'Ordem criada.' })
    setTimeout(() => { irAba('ordens') }, 900)
    setSalvando(false)
  }

  // ── Avançar status de ordem ─────────────────────────────────────────────────

  async function avancarStatus(o: OrdemManutencao, novoStatus: OMStatus) {
    const extra: Record<string, string> = {}
    if (novoStatus === 'concluida') extra.data_conclusao = new Date().toISOString().slice(0, 10)
    await supabaseAdmin.from('ordens_manutencao').update({ status: novoStatus, ...extra }).eq('id', o.id)
    setOrdemAtual(prev => prev ? { ...prev, status: novoStatus, ...extra } : prev)
    setOrdens(prev => prev.map(x => x.id === o.id ? { ...x, status: novoStatus, ...extra } : x))
  }

  async function cancelarOrdem(o: OrdemManutencao) {
    if (!confirm(`Cancelar a ordem ${o.numero}?`)) return
    await supabaseAdmin.from('ordens_manutencao').update({ status: 'cancelada' }).eq('id', o.id)
    setOrdemAtual(prev => prev ? { ...prev, status: 'cancelada' } : prev)
    setOrdens(prev => prev.map(x => x.id === o.id ? { ...x, status: 'cancelada' } : x))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const mostraNav   = vista === 'ativos' || vista === 'ordens'
  const mostraVoltar = vista === 'ativo_form' || vista === 'ordem_form' || vista === 'ordem_detalhe'
  const voltarPara: Vista = vista === 'ativo_form' ? 'ativos' : 'ordens'

  return (
    <div className={styles.wrap}>

      {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manutenção</h1>
          <p className={styles.pageSubtitle}>Ativos e ordens de manutenção</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {mostraVoltar && (
            <button className={styles.btnSecondary} onClick={() => { setVista(voltarPara); setAbaAtiva(voltarPara === 'ativos' ? 'ativos' : 'ordens') }}>
              ← Voltar
            </button>
          )}
          {vista === 'ativos' && (
            <button className={styles.btnPrimary} onClick={abrirNovoAtivo}>+ Novo Ativo</button>
          )}
          {vista === 'ordens' && (
            <button className={styles.btnPrimary} onClick={abrirNovaOrdem}>+ Nova Ordem</button>
          )}
          {vista === 'ordem_detalhe' && ordemAtual && (
            <button className={styles.btnSecondary} onClick={() => { setOMForm({ ...OM_FORM_VAZIO }); }}>
              {/* reservado para editar */}
            </button>
          )}
        </div>
      </div>

      {/* ── Nav (abas) ──────────────────────────────────────────────────── */}
      {mostraNav && (
        <div className={styles.navPrincipal}>
          <button
            className={`${styles.navBtn} ${abaAtiva === 'ativos' ? styles.navAtivo : ''}`}
            onClick={() => irAba('ativos')}
          >
            🔧 Ativos / Equipamentos
          </button>
          <button
            className={`${styles.navBtn} ${abaAtiva === 'ordens' ? styles.navAtivo : ''}`}
            onClick={() => irAba('ordens')}
          >
            📋 Ordens de Manutenção
          </button>
        </div>
      )}

      {/* ══ LISTA ATIVOS ══════════════════════════════════════════════════ */}
      {vista === 'ativos' && (
        <>
          <div className={styles.toolbar}>
            <select className={styles.selectFiltro} value={filtroAtivoStatus} onChange={e => setFiltroAtivoStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="manutencao">Em Manutenção</option>
            </select>
          </div>

          <div className={styles.card}>
            {carregandoAtivos ? (
              <div className={styles.loading}>Carregando ativos…</div>
            ) : ativos.length === 0 ? (
              <div className={styles.vazio}>Nenhum ativo cadastrado.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nome</th>
                      <th>Categoria</th>
                      <th>Localização</th>
                      <th>Fabricante / Modelo</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.map(a => (
                      <tr key={a.id} onClick={() => abrirEditarAtivo(a)}>
                        <td><span className={styles.codigo}>{a.codigo ?? '—'}</span></td>
                        <td><span className={styles.nomeCell}>{a.nome}</span></td>
                        <td><span style={{ fontSize: '0.85rem' }}>{a.categoria ?? '—'}</span></td>
                        <td><span style={{ fontSize: '0.85rem' }}>{a.localizacao ?? '—'}</span></td>
                        <td>
                          {a.fabricante || a.modelo
                            ? <div><div style={{ fontSize: '0.85rem' }}>{a.fabricante ?? ''}</div><div className={styles.nomeSub}>{a.modelo ?? ''}</div></div>
                            : <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>—</span>
                          }
                        </td>
                        <td><span className={ATIVO_STATUS_CLASS[a.status]}>{ATIVO_STATUS_LABEL[a.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ FORM ATIVO ════════════════════════════════════════════════════ */}
      {vista === 'ativo_form' && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitulo}>{editAtivoId ? 'Editar Ativo' : 'Novo Ativo / Equipamento'}</h2>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código</label>
              <input className={styles.formInput} value={ativoForm.codigo} onChange={e => setAtivoForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: EQ-001" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome *</label>
              <input className={styles.formInput} value={ativoForm.nome} onChange={e => setAtivoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Torno CNC Romi" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria</label>
              <input className={styles.formInput} value={ativoForm.categoria} onChange={e => setAtivoForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: usinagem, prensa, compressor" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Localização</label>
              <input className={styles.formInput} value={ativoForm.localizacao} onChange={e => setAtivoForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Setor A — Linha 2" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fabricante</label>
              <input className={styles.formInput} value={ativoForm.fabricante} onChange={e => setAtivoForm(f => ({ ...f, fabricante: e.target.value }))} placeholder="Ex: Romi, Schuler, Atlas Copco" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Modelo</label>
              <input className={styles.formInput} value={ativoForm.modelo} onChange={e => setAtivoForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ex: GL 240" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status</label>
              <select className={styles.formSelect} value={ativoForm.status} onChange={e => setAtivoForm(f => ({ ...f, status: e.target.value as AtivoStatus }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="manutencao">Em Manutenção</option>
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Observações</label>
              <textarea className={styles.formTextarea} value={ativoForm.observacao} onChange={e => setAtivoForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Características, histórico, notas técnicas…" />
            </div>
          </div>

          {formMsg && <div className={`${styles.formMsg} ${formMsg.ok ? styles.formMsgOk : styles.formMsgErro}`}>{formMsg.texto}</div>}

          <div className={styles.formActions}>
            <button className={styles.btnSecondary} onClick={() => irAba('ativos')}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvarAtivo} disabled={salvando}>
              {salvando ? 'Salvando…' : editAtivoId ? 'Salvar alterações' : 'Cadastrar ativo'}
            </button>
          </div>
        </div>
      )}

      {/* ══ LISTA ORDENS ══════════════════════════════════════════════════ */}
      {vista === 'ordens' && (
        <>
          <div className={styles.toolbar}>
            <select className={styles.selectFiltro} value={filtroOMTipo} onChange={e => setFiltroOMTipo(e.target.value)}>
              <option value="todos">Todos os tipos</option>
              <option value="corretiva">Corretiva</option>
              <option value="preventiva">Preventiva</option>
            </select>
            <select className={styles.selectFiltro} value={filtroOMStatus} onChange={e => setFiltroOMStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="em_execucao">Em Execução</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className={styles.card}>
            {carregandoOrdens ? (
              <div className={styles.loading}>Carregando ordens…</div>
            ) : ordens.length === 0 ? (
              <div className={styles.vazio}>Nenhuma ordem de manutenção encontrada.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Título</th>
                      <th>Ativo</th>
                      <th>Tipo</th>
                      <th>Prioridade</th>
                      <th>Status</th>
                      <th>Programado</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordens.map(o => (
                      <tr key={o.id} onClick={() => abrirDetalheOrdem(o)}>
                        <td><span className={styles.numero}>{o.numero}</span></td>
                        <td><span className={styles.nomeCell}>{o.titulo}</span></td>
                        <td>
                          {o.ativos
                            ? <div><div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{o.ativos.nome}</div>{o.ativos.codigo && <div className={styles.nomeSub}>{o.ativos.codigo}</div>}</div>
                            : <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>—</span>
                          }
                        </td>
                        <td><span className={TIPO_CLASS[o.tipo]}>{TIPO_LABEL[o.tipo]}</span></td>
                        <td><span className={PRIO_CLASS[o.prioridade]}>{PRIO_LABEL[o.prioridade]}</span></td>
                        <td><span className={OM_STATUS_CLASS[o.status]}>{OM_STATUS_LABEL[o.status]}</span></td>
                        <td><span className={styles.data}>{fmtData(o.data_programada)}</span></td>
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

      {/* ══ FORM ORDEM ════════════════════════════════════════════════════ */}
      {vista === 'ordem_form' && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitulo}>Nova Ordem de Manutenção</h2>

          <div className={styles.formGrid}>
            {/* Tipo */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo *</label>
              <select className={styles.formSelect} value={omForm.tipo} onChange={e => setOMForm(f => ({ ...f, tipo: e.target.value as TipoOM }))}>
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
              </select>
            </div>

            {/* Prioridade */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prioridade</label>
              <select className={styles.formSelect} value={omForm.prioridade} onChange={e => setOMForm(f => ({ ...f, prioridade: e.target.value as Prioridade }))}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            {/* Título */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Título *</label>
              <input className={styles.formInput} value={omForm.titulo} onChange={e => setOMForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Troca de correia — torno CNC" />
            </div>

            {/* Descrição */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea className={styles.formTextarea} value={omForm.descricao} onChange={e => setOMForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhe o problema encontrado ou o serviço programado…" />
            </div>

            {/* Ativo vinculado */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Ativo / Equipamento (opcional)</label>
              {ativoSel ? (
                <div className={styles.ativoSelecionado}>
                  <span>🔧 {ativoSel.nome}{ativoSel.codigo ? ` — ${ativoSel.codigo}` : ''}</span>
                  <button onClick={() => { setAtivoSel(null); setAtivoBusca('') }}>×</button>
                </div>
              ) : (
                <>
                  <input
                    className={styles.formInput}
                    value={ativoBusca}
                    onChange={e => setAtivoBusca(e.target.value)}
                    placeholder="Digite para buscar ativo por nome…"
                  />
                  {buscandoAtivo && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Buscando…</div>}
                  {ativoOpts.length > 0 && (
                    <div className={styles.ativoSugestoes}>
                      {ativoOpts.map(a => (
                        <div key={a.id} className={styles.ativoSugestaoItem} onClick={() => { setAtivoSel(a); setAtivoBusca(''); setAtivoOpts([]) }}>
                          {a.nome}{a.codigo ? ` — ${a.codigo}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Data programada */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data Programada</label>
              <input type="date" className={styles.formInput} value={omForm.data_programada} onChange={e => setOMForm(f => ({ ...f, data_programada: e.target.value }))} />
            </div>

            {/* Responsável */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Responsável</label>
              <input className={styles.formInput} value={omForm.responsavel} onChange={e => setOMForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>

            {/* Observação */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Observação</label>
              <textarea className={styles.formTextarea} value={omForm.observacao} onChange={e => setOMForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Instruções adicionais, referências, peças necessárias…" />
            </div>
          </div>

          {formMsg && <div className={`${styles.formMsg} ${formMsg.ok ? styles.formMsgOk : styles.formMsgErro}`}>{formMsg.texto}</div>}

          <div className={styles.formActions}>
            <button className={styles.btnSecondary} onClick={() => irAba('ordens')}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvarOrdem} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Criar ordem'}
            </button>
          </div>
        </div>
      )}

      {/* ══ DETALHE ORDEM ═════════════════════════════════════════════════ */}
      {vista === 'ordem_detalhe' && ordemAtual && (
        <div className={styles.detalheCard}>
          <div className={styles.detalheHeader}>
            <div>
              <div className={styles.detalheNumero}>{ordemAtual.numero}</div>
              <h2 className={styles.detalheTitulo}>{ordemAtual.titulo}</h2>
              <div className={styles.detalheBadges}>
                <span className={TIPO_CLASS[ordemAtual.tipo]}>{TIPO_LABEL[ordemAtual.tipo]}</span>
                <span className={PRIO_CLASS[ordemAtual.prioridade]}>{PRIO_LABEL[ordemAtual.prioridade]}</span>
                <span className={OM_STATUS_CLASS[ordemAtual.status]}>{OM_STATUS_LABEL[ordemAtual.status]}</span>
              </div>
            </div>
          </div>

          {/* Ativo vinculado */}
          {ordemAtual.ativos && (
            <div>
              <span className={styles.ativoVinculo}>
                🔧 {ordemAtual.ativos.nome}{ordemAtual.ativos.codigo ? ` — ${ordemAtual.ativos.codigo}` : ''}
              </span>
            </div>
          )}

          <div className={styles.detalheGrid}>
            <div className={styles.detalheField}>
              <label>Abertura</label>
              <span>{fmtData(ordemAtual.data_abertura)}</span>
            </div>
            <div className={styles.detalheField}>
              <label>Programado</label>
              <span>{fmtData(ordemAtual.data_programada)}</span>
            </div>
            <div className={styles.detalheField}>
              <label>Conclusão</label>
              <span>{fmtData(ordemAtual.data_conclusao)}</span>
            </div>
            <div className={styles.detalheField}>
              <label>Responsável</label>
              <span>{ordemAtual.responsavel ?? '—'}</span>
            </div>
            {ordemAtual.descricao && (
              <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                <label>Descrição</label>
                <span style={{ whiteSpace: 'pre-wrap' }}>{ordemAtual.descricao}</span>
              </div>
            )}
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
                {PROXIMO_STATUS[ordemAtual.status] && (
                  <button
                    className={styles.btnAvancar}
                    onClick={() => avancarStatus(ordemAtual, PROXIMO_STATUS[ordemAtual.status]!.status)}
                  >
                    {PROXIMO_STATUS[ordemAtual.status]!.label}
                  </button>
                )}
                <button className={styles.btnCancelar} onClick={() => cancelarOrdem(ordemAtual)}>
                  Cancelar ordem
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
