import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminQualidade.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiVision, fileToBase64 } from '../lib/aiHelper'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoOrigem = 'producao' | 'fornecedor' | 'estoque' | 'documento' | 'manual'
type Resultado  = 'aprovado' | 'reprovado'
type Severidade = 'baixa' | 'media' | 'alta'
type NCStatus   = 'aberta' | 'em_analise' | 'tratada' | 'fechada'
type Vista      = 'inspecoes' | 'inspecao_form' | 'inspecao_detalhe' | 'nao_conformidades'

interface Inspecao {
  id:              number
  tipo_origem:     TipoOrigem
  origem_id:       number | null
  origem_label:    string | null
  item_descricao:  string
  criterio:        string | null
  resultado:       Resultado
  data_inspecao:   string
  responsavel:     string | null
  observacao:      string | null
  created_at:      string
}

interface NaoConformidade {
  id:            number
  inspecao_id:   number
  titulo:        string
  descricao:     string | null
  severidade:    Severidade
  status:        NCStatus
  responsavel:   string | null
  acao_imediata: string | null
  created_at:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoOrigem, string> = {
  producao:   '⚙ Produção',
  fornecedor: '🏭 Fornecedor',
  estoque:    '📦 Estoque',
  documento:  '📄 Documento',
  manual:     '✍ Manual',
}

const SEV_CLASS: Record<Severidade, string> = {
  baixa: styles.sevBaixa,
  media: styles.sevMedia,
  alta:  styles.sevAlta,
}
const SEV_LABEL: Record<Severidade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }


function fmtData(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

const FORM_VAZIO = {
  tipo_origem:    'manual'   as TipoOrigem,
  origem_label:   '',
  item_descricao: '',
  criterio:       '',
  resultado:      'aprovado' as Resultado,
  data_inspecao:  new Date().toISOString().slice(0, 10),
  responsavel:    '',
  observacao:     '',
}

const NC_FORM_VAZIO = {
  titulo:        '',
  descricao:     '',
  severidade:    'media' as Severidade,
  responsavel:   '',
  acao_imediata: '',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminQualidade() {
  const [vista,      setVista]      = useState<Vista>('inspecoes')
  const [inspecoes,  setInspecoes]  = useState<Inspecao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [filtroRes,  setFiltroRes]  = useState<string>('todos')

  const [inspecaoAtual, setInspecaoAtual] = useState<Inspecao | null>(null)
  const [ncs,           setNcs]           = useState<NaoConformidade[]>([])
  const [carregandoNCs, setCarregandoNCs] = useState(false)

  // Form inspeção
  const [form,     setForm]     = useState({ ...FORM_VAZIO })
  const [salvando, setSalvando] = useState(false)
  const [formMsg,  setFormMsg]  = useState<{ ok: boolean; texto: string } | null>(null)

  // NC inline
  const [ncFormAberto, setNcFormAberto] = useState(false)
  const [ncForm,       setNcForm]       = useState({ ...NC_FORM_VAZIO })
  const [salvandoNC,   setSalvandoNC]   = useState(false)
  const [ncMsg,        setNcMsg]        = useState<{ ok: boolean; texto: string } | null>(null)

  // Lista global NCs
  const [todasNCs,     setTodasNCs]     = useState<NaoConformidade[]>([])
  const [carregandoAllNCs, setCarregandoAllNCs] = useState(false)
  const [filtroNC,     setFiltroNC]     = useState<string>('todos')

  // ── Carregar inspeções ──────────────────────────────────────────────────────

  const carregarInspecoes = useCallback(async () => {
    setCarregando(true)
    let q = supabaseAdmin
      .from('inspecoes')
      .select('*')
      .order('data_inspecao', { ascending: false })
      .order('created_at',    { ascending: false })
    if (filtroRes !== 'todos') q = q.eq('resultado', filtroRes)
    const { data } = await q
    setInspecoes((data as Inspecao[]) ?? [])
    setCarregando(false)
  }, [filtroRes])

  useEffect(() => {
    if (vista === 'inspecoes') carregarInspecoes()
  }, [vista, carregarInspecoes])

  // ── Carregar NCs de uma inspeção ────────────────────────────────────────────

  const carregarNCs = useCallback(async (inspecaoId: number) => {
    setCarregandoNCs(true)
    const { data } = await supabaseAdmin
      .from('nao_conformidades')
      .select('*')
      .eq('inspecao_id', inspecaoId)
      .order('created_at', { ascending: false })
    setNcs((data as NaoConformidade[]) ?? [])
    setCarregandoNCs(false)
  }, [])

  // ── Carregar todas as NCs ───────────────────────────────────────────────────

  const carregarTodasNCs = useCallback(async () => {
    setCarregandoAllNCs(true)
    let q = supabaseAdmin
      .from('nao_conformidades')
      .select('*')
      .order('created_at', { ascending: false })
    if (filtroNC !== 'todos') q = q.eq('status', filtroNC)
    const { data } = await q
    setTodasNCs((data as NaoConformidade[]) ?? [])
    setCarregandoAllNCs(false)
  }, [filtroNC])

  useEffect(() => {
    if (vista === 'nao_conformidades') carregarTodasNCs()
  }, [vista, carregarTodasNCs])

  // ── Abrir detalhe ───────────────────────────────────────────────────────────

  function abrirDetalhe(i: Inspecao) {
    setInspecaoAtual(i)
    setNcs([])
    setNcFormAberto(false)
    setNcForm({ ...NC_FORM_VAZIO })
    setNcMsg(null)
    carregarNCs(i.id)
    setVista('inspecao_detalhe')
  }

  // ── Abrir form nova inspeção ────────────────────────────────────────────────

  function abrirNovaInspecao() {
    setForm({ ...FORM_VAZIO, data_inspecao: new Date().toISOString().slice(0, 10) })
    setFormMsg(null)
    setVista('inspecao_form')
  }

  // ── Salvar inspeção ─────────────────────────────────────────────────────────

  async function salvarInspecao() {
    if (!form.item_descricao.trim()) {
      setFormMsg({ ok: false, texto: 'Item inspecionado é obrigatório.' })
      return
    }
    setSalvando(true)
    setFormMsg(null)
    const payload = {
      tipo_origem:    form.tipo_origem,
      origem_label:   form.origem_label.trim() || null,
      item_descricao: form.item_descricao.trim(),
      criterio:       form.criterio.trim() || null,
      resultado:      form.resultado,
      data_inspecao:  form.data_inspecao,
      responsavel:    form.responsavel.trim() || null,
      observacao:     form.observacao.trim() || null,
    }
    const { data, error } = await supabaseAdmin
      .from('inspecoes')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setFormMsg({ ok: false, texto: error.message })
      setSalvando(false)
      return
    }
    setSalvando(false)
    // Se reprovado, abre direto no detalhe para facilitar abertura de NC
    if (form.resultado === 'reprovado') {
      abrirDetalhe(data as Inspecao)
    } else {
      setFormMsg({ ok: true, texto: 'Inspeção registrada.' })
      setTimeout(() => setVista('inspecoes'), 900)
    }
  }

  // ── Salvar NC ───────────────────────────────────────────────────────────────

  async function salvarNC() {
    if (!inspecaoAtual || !ncForm.titulo.trim()) {
      setNcMsg({ ok: false, texto: 'Título da NC é obrigatório.' })
      return
    }
    setSalvandoNC(true)
    setNcMsg(null)
    const payload = {
      inspecao_id:   inspecaoAtual.id,
      titulo:        ncForm.titulo.trim(),
      descricao:     ncForm.descricao.trim() || null,
      severidade:    ncForm.severidade,
      status:        'aberta' as NCStatus,
      responsavel:   ncForm.responsavel.trim() || null,
      acao_imediata: ncForm.acao_imediata.trim() || null,
    }
    const { data, error } = await supabaseAdmin
      .from('nao_conformidades')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setNcMsg({ ok: false, texto: error.message })
    } else {
      setNcs(prev => [data as NaoConformidade, ...prev])
      setNcForm({ ...NC_FORM_VAZIO })
      setNcFormAberto(false)
      setNcMsg({ ok: true, texto: 'Não conformidade registrada.' })
    }
    setSalvandoNC(false)
  }

  // ── Atualizar status NC ─────────────────────────────────────────────────────

  async function atualizarStatusNC(id: number, status: NCStatus, lista: 'detalhe' | 'todas') {
    await supabaseAdmin.from('nao_conformidades').update({ status }).eq('id', id)
    if (lista === 'detalhe') {
      setNcs(prev => prev.map(n => n.id === id ? { ...n, status } : n))
    } else {
      setTodasNCs(prev => prev.map(n => n.id === id ? { ...n, status } : n))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {/* ── Cabeçalho permanente ────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Qualidade</h1>
          <p className={styles.pageSubtitle}>Inspeções e não conformidades</p>
        </div>
        {vista === 'inspecoes' && (
          <button className={styles.btnPrimary} onClick={abrirNovaInspecao}>+ Nova Inspeção</button>
        )}
        {(vista === 'inspecao_form' || vista === 'inspecao_detalhe') && (
          <button className={styles.btnSecondary} onClick={() => setVista('inspecoes')}>← Voltar</button>
        )}
      </div>

      {/* ── Nav principal ───────────────────────────────────────────────── */}
      {(vista === 'inspecoes' || vista === 'nao_conformidades') && (
        <div className={styles.navPrincipal}>
          <button
            className={`${styles.navBtn} ${vista === 'inspecoes' ? styles.navAtivo : ''}`}
            onClick={() => setVista('inspecoes')}
          >
            🔍 Inspeções
          </button>
          <button
            className={`${styles.navBtn} ${vista === 'nao_conformidades' ? styles.navAtivo : ''}`}
            onClick={() => setVista('nao_conformidades')}
          >
            ⚠ Não Conformidades
          </button>
        </div>
      )}

      {/* ══ LISTA INSPEÇÕES ═══════════════════════════════════════════════ */}
      {vista === 'inspecoes' && (
        <>
          <div className={styles.toolbar}>
            <select
              className={styles.selectFiltro}
              value={filtroRes}
              onChange={e => setFiltroRes(e.target.value)}
            >
              <option value="todos">Todos os resultados</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
            </select>
          </div>

          <div className={styles.card}>
            {carregando ? (
              <div className={styles.loading}>Carregando inspeções…</div>
            ) : inspecoes.length === 0 ? (
              <div className={styles.vazio}>Nenhuma inspeção registrada.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Item Inspecionado</th>
                      <th>Origem</th>
                      <th>Critério</th>
                      <th>Resultado</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspecoes.map(i => (
                      <tr key={i.id} onClick={() => abrirDetalhe(i)}>
                        <td><span className={styles.data}>{fmtData(i.data_inspecao)}</span></td>
                        <td>
                          <div className={styles.itemCell}>{i.item_descricao}</div>
                          {i.origem_label && <div className={styles.itemSub}>{i.origem_label}</div>}
                        </td>
                        <td><span style={{ fontSize: '0.82rem' }}>{TIPO_LABEL[i.tipo_origem]}</span></td>
                        <td><span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>{i.criterio ?? '—'}</span></td>
                        <td>
                          <span className={i.resultado === 'aprovado' ? styles.badgeAprovado : styles.badgeReprovado}>
                            {i.resultado === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                          </span>
                        </td>
                        <td><span style={{ fontSize: '0.85rem' }}>{i.responsavel ?? '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ FORM INSPEÇÃO ═════════════════════════════════════════════════ */}
      {vista === 'inspecao_form' && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitulo}>Nova Inspeção</h2>

          <div className={styles.formGrid}>
            {/* Item inspecionado */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Item inspecionado *</label>
              <input
                className={styles.formInput}
                value={form.item_descricao}
                onChange={e => setForm(f => ({ ...f, item_descricao: e.target.value }))}
                placeholder="Ex: Suporte FP-10 inox 316L — lote 042"
              />
            </div>

            {/* Critério */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Critério de aceitação</label>
              <input
                className={styles.formInput}
                value={form.criterio}
                onChange={e => setForm(f => ({ ...f, criterio: e.target.value }))}
                placeholder="Ex: Espessura mínima 1,5 mm, sem trincas visíveis"
              />
            </div>

            {/* Resultado */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Resultado *</label>
              <select
                className={styles.formSelect}
                value={form.resultado}
                onChange={e => setForm(f => ({ ...f, resultado: e.target.value as Resultado }))}
              >
                <option value="aprovado">✅ Aprovado</option>
                <option value="reprovado">❌ Reprovado</option>
              </select>
            </div>

            {/* Data */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data da inspeção</label>
              <input
                type="date"
                className={styles.formInput}
                value={form.data_inspecao}
                onChange={e => setForm(f => ({ ...f, data_inspecao: e.target.value }))}
              />
            </div>

            {/* Tipo de origem */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Origem</label>
              <select
                className={styles.formSelect}
                value={form.tipo_origem}
                onChange={e => setForm(f => ({ ...f, tipo_origem: e.target.value as TipoOrigem }))}
              >
                <option value="manual">✍ Manual</option>
                <option value="producao">⚙ Produção</option>
                <option value="fornecedor">🏭 Fornecedor</option>
                <option value="estoque">📦 Estoque</option>
                <option value="documento">📄 Documento</option>
              </select>
            </div>

            {/* Descrição da origem */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Referência de origem</label>
              <input
                className={styles.formInput}
                value={form.origem_label}
                onChange={e => setForm(f => ({ ...f, origem_label: e.target.value }))}
                placeholder={
                  form.tipo_origem === 'producao'   ? 'Ex: OP-0012' :
                  form.tipo_origem === 'fornecedor' ? 'Ex: Aço Bragança LTDA' :
                  form.tipo_origem === 'estoque'    ? 'Ex: Prato base 316L' :
                  'Referência livre'
                }
              />
            </div>

            {/* Responsável */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Responsável pela inspeção</label>
              <input
                className={styles.formInput}
                value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome do inspetor"
              />
            </div>

            {/* Observação */}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Observações</label>
              <textarea
                className={styles.formTextarea}
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Detalhes adicionais, medições, referências…"
              />
            </div>
          </div>

          {form.resultado === 'reprovado' && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
              ⚠ Resultado reprovado — você poderá abrir uma não conformidade após salvar.
            </div>
          )}

          {formMsg && (
            <div className={`${styles.formMsg} ${formMsg.ok ? styles.formMsgOk : styles.formMsgErro}`}>
              {formMsg.texto}
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.btnSecondary} onClick={() => setVista('inspecoes')}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvarInspecao} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Registrar inspeção'}
            </button>
          </div>
        </div>
      )}

      {/* ══ DETALHE INSPEÇÃO ══════════════════════════════════════════════ */}
      {vista === 'inspecao_detalhe' && inspecaoAtual && (
        <div className={styles.detalheCard}>
          <div className={styles.detalheHeader}>
            <div>
              <h2 className={styles.detalheTitulo}>{inspecaoAtual.item_descricao}</h2>
              <span className={inspecaoAtual.resultado === 'aprovado' ? styles.badgeAprovado : styles.badgeReprovado}>
                {inspecaoAtual.resultado === 'aprovado' ? 'Aprovado' : 'Reprovado'}
              </span>
            </div>
          </div>

          {/* Origem */}
          {inspecaoAtual.origem_label && (
            <div>
              <span className={styles.origemTag}>
                {TIPO_LABEL[inspecaoAtual.tipo_origem]} — {inspecaoAtual.origem_label}
              </span>
            </div>
          )}

          <div className={styles.detalheGrid}>
            <div className={styles.detalheField}>
              <label>Origem</label>
              <span>{TIPO_LABEL[inspecaoAtual.tipo_origem]}</span>
            </div>
            <div className={styles.detalheField}>
              <label>Data</label>
              <span>{fmtData(inspecaoAtual.data_inspecao)}</span>
            </div>
            <div className={styles.detalheField}>
              <label>Responsável</label>
              <span>{inspecaoAtual.responsavel ?? '—'}</span>
            </div>
            {inspecaoAtual.criterio && (
              <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                <label>Critério</label>
                <span>{inspecaoAtual.criterio}</span>
              </div>
            )}
            {inspecaoAtual.observacao && (
              <div className={styles.detalheField} style={{ gridColumn: '1 / -1' }}>
                <label>Observações</label>
                <span style={{ whiteSpace: 'pre-wrap' }}>{inspecaoAtual.observacao}</span>
              </div>
            )}
          </div>

          {/* ── Não Conformidades vinculadas ── */}
          {inspecaoAtual.resultado === 'reprovado' && (
            <div className={styles.ncSection}>
              <div className={styles.ncSectionTitulo}>
                ⚠ Não Conformidades ({carregandoNCs ? '…' : ncs.length})
              </div>

              {ncs.map(nc => (
                <div key={nc.id} className={styles.ncCard}>
                  <div className={styles.ncCardHeader}>
                    <span className={styles.ncCardTitulo}>{nc.titulo}</span>
                    <span className={SEV_CLASS[nc.severidade]}>{SEV_LABEL[nc.severidade]}</span>
                    <select
                      className={styles.ncStatusSelect}
                      value={nc.status}
                      onChange={e => atualizarStatusNC(nc.id, e.target.value as NCStatus, 'detalhe')}
                    >
                      <option value="aberta">Aberta</option>
                      <option value="em_analise">Em Análise</option>
                      <option value="tratada">Tratada</option>
                      <option value="fechada">Fechada</option>
                    </select>
                  </div>
                  {nc.descricao && <div className={styles.ncCardDescricao}>{nc.descricao}</div>}
                  {nc.acao_imediata && (
                    <div className={styles.ncCardAcao}>
                      <div className={styles.ncCardAcaoLabel}>Ação imediata</div>
                      {nc.acao_imediata}
                    </div>
                  )}
                </div>
              ))}

              {/* Formulário inline de NC */}
              {!ncFormAberto ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className={styles.btnAbrirNC} onClick={() => setNcFormAberto(true)}>
                    + Abrir não conformidade
                  </button>
                  <AiActionButton label="Analisar defeito" icon="📸" modelName="Gemini" acceptImage
                    actionWithFile={async (file) => {
                      const base64 = await fileToBase64(file)
                      const r = await aiVision({ imageBase64: base64, mimeType: file.type, filename: file.name })
                      return r.error ? `Erro: ${r.error}` : r.content
                    }}
                    action={async () => ''} small />
                </div>
              ) : (
                <div className={styles.ncFormBox}>
                  <div className={styles.ncFormTitulo}>Nova Não Conformidade</div>
                  <div className={styles.ncFormGrid}>
                    <div className={`${styles.formGroup} ${styles.ncFormFull}`}>
                      <label className={styles.formLabel}>Título *</label>
                      <input
                        className={styles.formInput}
                        value={ncForm.titulo}
                        onChange={e => setNcForm(f => ({ ...f, titulo: e.target.value }))}
                        placeholder="Ex: Espessura fora do limite — lote 042"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Severidade</label>
                      <select
                        className={styles.formSelect}
                        value={ncForm.severidade}
                        onChange={e => setNcForm(f => ({ ...f, severidade: e.target.value as Severidade }))}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Responsável</label>
                      <input
                        className={styles.formInput}
                        value={ncForm.responsavel}
                        onChange={e => setNcForm(f => ({ ...f, responsavel: e.target.value }))}
                        placeholder="Nome"
                      />
                    </div>
                    <div className={`${styles.formGroup} ${styles.ncFormFull}`}>
                      <label className={styles.formLabel}>Descrição</label>
                      <textarea
                        className={styles.formTextarea}
                        style={{ minHeight: '60px' }}
                        value={ncForm.descricao}
                        onChange={e => setNcForm(f => ({ ...f, descricao: e.target.value }))}
                        placeholder="Detalhe a falha encontrada"
                      />
                    </div>
                    <div className={`${styles.formGroup} ${styles.ncFormFull}`}>
                      <label className={styles.formLabel}>Ação imediata</label>
                      <input
                        className={styles.formInput}
                        value={ncForm.acao_imediata}
                        onChange={e => setNcForm(f => ({ ...f, acao_imediata: e.target.value }))}
                        placeholder="Ex: Separar lote, acionar fornecedor, reprocessar"
                      />
                    </div>
                  </div>
                  {ncMsg && (
                    <div className={`${styles.formMsg} ${ncMsg.ok ? styles.formMsgOk : styles.formMsgErro}`}>
                      {ncMsg.texto}
                    </div>
                  )}
                  <div className={styles.formActions}>
                    <button className={styles.btnSecondary} onClick={() => { setNcFormAberto(false); setNcMsg(null) }}>
                      Cancelar
                    </button>
                    <button className={styles.btnPrimary} onClick={salvarNC} disabled={salvandoNC}>
                      {salvandoNC ? 'Salvando…' : 'Registrar NC'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ LISTA GLOBAL NCs ══════════════════════════════════════════════ */}
      {vista === 'nao_conformidades' && (
        <>
          <div className={styles.toolbar}>
            <select
              className={styles.selectFiltro}
              value={filtroNC}
              onChange={e => setFiltroNC(e.target.value)}
            >
              <option value="todos">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="em_analise">Em Análise</option>
              <option value="tratada">Tratada</option>
              <option value="fechada">Fechada</option>
            </select>
          </div>

          <div className={styles.card}>
            {carregandoAllNCs ? (
              <div className={styles.loading}>Carregando não conformidades…</div>
            ) : todasNCs.length === 0 ? (
              <div className={styles.vazio}>Nenhuma não conformidade encontrada.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Título</th>
                      <th>Severidade</th>
                      <th>Status</th>
                      <th>Responsável</th>
                      <th>Ação imediata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todasNCs.map(nc => (
                      <tr key={nc.id} onClick={e => e.stopPropagation()}>
                        <td><span className={styles.data}>{fmtData(nc.created_at)}</span></td>
                        <td>
                          <div className={styles.itemCell}>{nc.titulo}</div>
                          {nc.descricao && <div className={styles.itemSub}>{nc.descricao}</div>}
                        </td>
                        <td><span className={SEV_CLASS[nc.severidade]}>{SEV_LABEL[nc.severidade]}</span></td>
                        <td>
                          <select
                            className={styles.ncStatusSelect}
                            value={nc.status}
                            onChange={e => atualizarStatusNC(nc.id, e.target.value as NCStatus, 'todas')}
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="aberta">Aberta</option>
                            <option value="em_analise">Em Análise</option>
                            <option value="tratada">Tratada</option>
                            <option value="fechada">Fechada</option>
                          </select>
                        </td>
                        <td><span style={{ fontSize: '0.85rem' }}>{nc.responsavel ?? '—'}</span></td>
                        <td><span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>{nc.acao_imediata ?? '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
