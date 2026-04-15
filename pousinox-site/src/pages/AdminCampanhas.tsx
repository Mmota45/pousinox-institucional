import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCampanhas.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Campanha {
  id: number
  nome: string
  descricao: string | null
  segmentos_rfm: string[] | null
  status_cobr: string[] | null
  regioes: string[] | null
  apenas_com_telefone: boolean
  apenas_prioridade: boolean
  status: 'rascunho' | 'pronta' | 'enviada' | 'cancelada'
  destinatarios_preview: number | null
  criado_em: string
  enviado_em: string | null
}

interface PreviewDestinatario {
  id: number
  razao_social: string | null
  cnpj: string
  telefone: string | null
  rfm_segmento: string | null
  rfm_score: number | null
  tem_cobranca: boolean
}

const SEGMENTOS = ['VIP', 'Recorrente', 'Regular', 'Novo', 'Em Risco', 'Inativo']
const COBRANCA_STATUS = [
  { value: 'nao_cobrado',  label: 'Não cobrado'   },
  { value: 'cobrado',      label: 'Cobrado'        },
  { value: 'negociado',    label: 'Em negociação'  },
  { value: 'prometido',    label: 'Prometido'      },
  { value: 'inadimplente', label: 'Inadimplente'   },
]
const STATUS_LABELS: Record<string, string> = {
  rascunho:  'Rascunho',
  pronta:    'Pronta',
  enviada:   'Enviada',
  cancelada: 'Cancelada',
}

const FORM_VAZIO = {
  nome:               '',
  descricao:          '',
  segmentos_rfm:      [] as string[],
  status_cobr:        [] as string[],
  apenas_com_telefone: true,
  apenas_prioridade:  false,
}

function fmtData(v: string | null) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtCnpj(v: string) {
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminCampanhas() {
  const [campanhas, setCampanhas]       = useState<Campanha[]>([])
  const [loading, setLoading]           = useState(true)
  const [salvando, setSalvando]         = useState(false)
  const [msg, setMsg]                   = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [mostrarForm, setMostrarForm]   = useState(false)
  const [form, setForm]                 = useState(FORM_VAZIO)

  // Preview
  const [previewTotal, setPreviewTotal]   = useState<number | null>(null)
  const [previewLista, setPreviewLista]   = useState<PreviewDestinatario[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewFeito, setPreviewFeito]   = useState(false)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  const carregarCampanhas = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('wpp_campanhas')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50)
    setCampanhas((data ?? []) as Campanha[])
    setLoading(false)
  }, [])

  useEffect(() => { carregarCampanhas() }, [carregarCampanhas])

  // ── Preview ────────────────────────────────────────────────────────────────

  async function gerarPreview() {
    setLoadingPreview(true)
    setPreviewFeito(true)
    const { data, error } = await supabaseAdmin.rpc('fn_wpp_preview', {
      p_segmentos_rfm:    form.segmentos_rfm.length  ? form.segmentos_rfm  : null,
      p_status_cobr:      form.status_cobr.length    ? form.status_cobr    : null,
      p_regioes:          null,
      p_apenas_telefone:  form.apenas_com_telefone,
      p_apenas_prioridade: form.apenas_prioridade,
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro no preview: ' + error.message })
      setLoadingPreview(false)
      return
    }
    const res = data as { total: number; preview: PreviewDestinatario[] }
    setPreviewTotal(res.total)
    setPreviewLista(res.preview ?? [])
    setLoadingPreview(false)
  }

  // ── Salvar campanha ────────────────────────────────────────────────────────

  async function salvarCampanha(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      setMsg({ tipo: 'erro', texto: 'Informe o nome da campanha.' })
      return
    }
    setSalvando(true)
    const { error } = await supabaseAdmin.from('wpp_campanhas').insert({
      nome:                form.nome.trim(),
      descricao:           form.descricao.trim() || null,
      segmentos_rfm:       form.segmentos_rfm.length ? form.segmentos_rfm : null,
      status_cobr:         form.status_cobr.length   ? form.status_cobr   : null,
      regioes:             null,
      apenas_com_telefone: form.apenas_com_telefone,
      apenas_prioridade:   form.apenas_prioridade,
      status:              'rascunho',
      destinatarios_preview: previewTotal ?? null,
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Campanha criada como rascunho.' })
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      setPreviewTotal(null)
      setPreviewLista([])
      setPreviewFeito(false)
      carregarCampanhas()
    }
    setSalvando(false)
  }

  async function atualizarStatus(id: number, status: Campanha['status']) {
    const { error } = await supabaseAdmin
      .from('wpp_campanhas')
      .update({ status, ...(status === 'enviada' ? { enviado_em: new Date().toISOString() } : {}) })
      .eq('id', id)
    if (!error) carregarCampanhas()
    else setMsg({ tipo: 'erro', texto: 'Erro ao atualizar: ' + error.message })
  }

  // ── Helpers de form ────────────────────────────────────────────────────────

  function toggleSegmento(s: string) {
    setForm(f => ({
      ...f,
      segmentos_rfm: f.segmentos_rfm.includes(s)
        ? f.segmentos_rfm.filter(x => x !== s)
        : [...f.segmentos_rfm, s],
    }))
    setPreviewFeito(false)
  }

  function toggleStatusCobr(s: string) {
    setForm(f => ({
      ...f,
      status_cobr: f.status_cobr.includes(s)
        ? f.status_cobr.filter(x => x !== s)
        : [...f.status_cobr, s],
    }))
    setPreviewFeito(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.titulo}>Campanhas WhatsApp</h2>
          <p className={styles.subtitulo}>
            Segmente clientes por RFM e cobrança. O disparo real será feito via n8n (fase futura) — aqui você define e salva a campanha.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setMostrarForm(v => !v); setPreviewFeito(false) }}>
          {mostrarForm ? '✕ Fechar' : '+ Nova campanha'}
        </button>
      </div>

      {/* ── Formulário ── */}
      {mostrarForm && (
        <form className={styles.form} onSubmit={salvarCampanha}>

          <div className={styles.formSection}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Nome da campanha *</label>
                <input className={styles.input} value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Reativação clientes em risco — Abril" required />
              </div>
              <div className={styles.field}>
                <label>Descrição (opcional)</label>
                <input className={styles.input} value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Objetivo ou contexto da campanha" />
              </div>
            </div>
          </div>

          {/* Segmentos RFM */}
          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>Segmentos RFM <span className={styles.opcional}>(vazio = todos)</span></div>
            <div className={styles.chipRow}>
              {SEGMENTOS.map(s => (
                <button key={s} type="button"
                  className={`${styles.chip} ${form.segmentos_rfm.includes(s) ? styles.chipAtivo : ''}`}
                  onClick={() => toggleSegmento(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Status de cobrança */}
          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>Status de cobrança <span className={styles.opcional}>(vazio = sem filtro)</span></div>
            <div className={styles.chipRow}>
              {COBRANCA_STATUS.map(c => (
                <button key={c.value} type="button"
                  className={`${styles.chip} ${form.status_cobr.includes(c.value) ? styles.chipAtivo : ''}`}
                  onClick={() => toggleStatusCobr(c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opções */}
          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>Opções</div>
            <div className={styles.opcoes}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={form.apenas_com_telefone}
                  onChange={e => { setForm(f => ({ ...f, apenas_com_telefone: e.target.checked })); setPreviewFeito(false) }} />
                Apenas clientes com telefone cadastrado
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={form.apenas_prioridade}
                  onChange={e => { setForm(f => ({ ...f, apenas_prioridade: e.target.checked })); setPreviewFeito(false) }} />
                Apenas recebíveis marcados como prioritários
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className={styles.previewSection}>
            <button type="button" className={styles.btnPreview}
              onClick={gerarPreview} disabled={loadingPreview}>
              {loadingPreview ? 'Calculando...' : '🔍 Prévia de destinatários'}
            </button>

            {previewFeito && !loadingPreview && previewTotal !== null && (
              <div className={styles.previewResultado}>
                <div className={styles.previewTotal}>
                  <strong>{previewTotal}</strong> cliente{previewTotal !== 1 ? 's' : ''} elegíve{previewTotal !== 1 ? 'is' : 'l'}
                  {!form.apenas_com_telefone && <span className={styles.semFiltroPhone}> · sem filtro de telefone</span>}
                </div>

                {previewLista.length > 0 && (
                  <div className={styles.previewLista}>
                    <div className={styles.previewListaHeader}>
                      Mostrando {previewLista.length} de {previewTotal}:
                    </div>
                    <div className={styles.previewScroll}>
                      <table className={styles.tabelaPreview}>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Segmento</th>
                            <th>Score</th>
                            <th>Telefone</th>
                            <th>Cobrança</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewLista.map(p => (
                            <tr key={p.id}>
                              <td>
                                <div className={styles.nomePreview}>{p.razao_social || '—'}</div>
                                <div className={styles.cnpjPreview}>{fmtCnpj(p.cnpj)}</div>
                              </td>
                              <td>
                                <span className={styles[`seg${p.rfm_segmento?.replace(' ', '') ?? 'Regular'}` as keyof typeof styles]}>
                                  {p.rfm_segmento ?? '—'}
                                </span>
                              </td>
                              <td className={styles.scorePreview}>{p.rfm_score ?? '—'}</td>
                              <td className={styles.fonePreview}>
                                {p.telefone || <span className={styles.semFone}>sem tel.</span>}
                              </td>
                              <td>
                                {p.tem_cobranca ? <span className={styles.temCobr}>⏰ pendente</span> : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary}
              onClick={() => { setMostrarForm(false); setForm(FORM_VAZIO); setPreviewFeito(false) }}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar como rascunho'}
            </button>
          </div>
        </form>
      )}

      {/* ── Lista de campanhas ── */}
      {loading ? (
        <div className={styles.loading}>Carregando campanhas...</div>
      ) : campanhas.length === 0 ? (
        <div className={styles.vazio}>Nenhuma campanha criada ainda.</div>
      ) : (
        <div className={styles.lista}>
          {campanhas.map(camp => (
            <div key={camp.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardNome}>{camp.nome}</div>
                  {camp.descricao && <div className={styles.cardDesc}>{camp.descricao}</div>}
                </div>
                <span className={`${styles.statusBadge} ${styles[`status_${camp.status}` as keyof typeof styles]}`}>
                  {STATUS_LABELS[camp.status]}
                </span>
              </div>

              <div className={styles.cardTags}>
                {camp.segmentos_rfm?.map(s => (
                  <span key={s} className={styles.tagSegmento}>{s}</span>
                )) ?? <span className={styles.tagTodos}>Todos os segmentos</span>}
                {camp.apenas_com_telefone && <span className={styles.tagOpcao}>📱 com telefone</span>}
                {camp.apenas_prioridade   && <span className={styles.tagOpcao}>⭐ só prioritários</span>}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.cardMeta}>
                  Criada em {fmtData(camp.criado_em)}
                  {camp.destinatarios_preview !== null &&
                    ` · ${camp.destinatarios_preview} destinatário${camp.destinatarios_preview !== 1 ? 's' : ''}`}
                  {camp.enviado_em && ` · Enviada em ${fmtData(camp.enviado_em)}`}
                </span>
                {camp.status === 'rascunho' && (
                  <div className={styles.cardAcoes}>
                    <button className={styles.btnPromo}
                      onClick={() => atualizarStatus(camp.id, 'pronta')}>
                      Marcar como pronta
                    </button>
                    <button className={styles.btnDanger}
                      onClick={() => atualizarStatus(camp.id, 'cancelada')}>
                      Cancelar
                    </button>
                  </div>
                )}
                {camp.status === 'pronta' && (
                  <div className={styles.cardAcoes}>
                    <span className={styles.aguardandoEnvio}>
                      Aguardando disparo via n8n
                    </span>
                    <button className={styles.btnDanger}
                      onClick={() => atualizarStatus(camp.id, 'cancelada')}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
