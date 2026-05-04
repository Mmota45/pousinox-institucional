import { useState, useEffect } from 'react'
import { Save, FileText, Palette, Send, CheckCircle, XCircle, DollarSign, Package, Tag, File, X, Trash2, Loader2, Check, MessageCircle, Eye, Edit3 } from 'lucide-react'
import type { Status, Instalacao } from '../types'
import { fmtBRL, STATUS_CFG } from '../types'
import type { FreteSummary } from '../../../types/frete'
import { supabaseAdmin } from '../../../lib/supabase'

interface LaudoRef { watermark_id: string; nome?: string }

function LaudoStatsLine({ wid, nome }: { wid: string; nome?: string }) {
  const [stats, setStats] = useState<{ downloads: number; max_downloads: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabaseAdmin.from('docs_enviados').select('downloads, max_downloads')
      .eq('watermark_id', wid).single()
      .then(({ data }) => { if (data) setStats(data as any) })
  }, [wid])

  if (!stats) return null
  const pct = stats.max_downloads > 0 ? stats.downloads / stats.max_downloads : 0
  const cor = pct >= 0.8 ? '#dc2626' : pct >= 0.5 ? '#f59e0b' : '#16a34a'

  async function salvar() {
    const n = parseInt(val)
    if (!n || n < stats!.downloads) return
    setSaving(true)
    await supabaseAdmin.from('docs_enviados').update({ max_downloads: n }).eq('watermark_id', wid)
    setStats(prev => prev ? { ...prev, max_downloads: n } : prev)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '4px 0' }}>
      <Eye size={12} style={{ color: cor, flexShrink: 0 }} />
      <span style={{ color: cor, fontWeight: 600 }}>{stats.downloads}/{stats.max_downloads}</span>
      <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || 'Laudo'}</span>
      {!editing ? (
        <button onClick={() => { setVal(String(stats.max_downloads)); setEditing(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280' }} title="Alterar limite">
          <Edit3 size={11} />
        </button>
      ) : (
        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
          <input type="number" value={val} onChange={e => setVal(e.target.value)}
            style={{ width: 44, fontSize: '0.7rem', padding: '1px 3px', border: '1px solid #d1d5db', borderRadius: 3 }} min={stats.downloads} />
          <button onClick={salvar} disabled={saving}
            style={{ fontSize: '0.65rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>OK</button>
          <button onClick={() => setEditing(false)}
            style={{ fontSize: '0.65rem', background: '#e5e7eb', border: 'none', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>✕</button>
        </span>
      )}
    </div>
  )
}

interface Props {
  numero: string
  status: Status
  empresaNome: string | null
  clienteNome: string
  subtotal: number
  valorDesc: number
  tipoDesc: string
  frete: FreteSummary
  instalacao: Instalacao
  total: number
  ocultarValores: boolean
  salvando: boolean
  onSalvar: (novoStatus?: Status) => void
  onImprimir: () => void
  onCanva?: () => void
  gerandoCanva?: boolean
  // Status actions
  finLancId: number | null
  gerandoRec: boolean
  onGerarReceivel: () => void
  // Etiqueta
  etiquetaPreId: string | null
  gerandoEtiq: boolean
  baixandoRotulo: boolean
  baixandoDace: boolean
  cancelandoEtiq: boolean
  onGerarEtiqueta: () => void
  onBaixarRotulo: () => void
  onBaixarDace: () => void
  onCancelarEtiqueta: () => void
  // E-mail
  clienteEmail: string
  enviandoEmail: boolean
  onEnviarEmail: () => void
  // WhatsApp
  clienteWhatsapp: string
  enviandoWa: boolean
  onEnviarWhatsApp: () => void
  // Laudos
  laudos: LaudoRef[]
  // Excluir
  editandoId: number | null
  isAdminUser: boolean
  confirmExcluir: boolean
  setConfirmExcluir: (v: boolean) => void
  onExcluir: (id: number) => void
  styles: Record<string, string>
}

export default function ResumoSidebar({
  numero, status, empresaNome, clienteNome,
  subtotal, valorDesc, tipoDesc, frete, instalacao, total,
  ocultarValores, salvando, onSalvar, onImprimir, onCanva, gerandoCanva,
  finLancId, gerandoRec, onGerarReceivel,
  etiquetaPreId, gerandoEtiq, baixandoRotulo, baixandoDace, cancelandoEtiq,
  onGerarEtiqueta, onBaixarRotulo, onBaixarDace, onCancelarEtiqueta,
  clienteEmail, enviandoEmail, onEnviarEmail,
  clienteWhatsapp, enviandoWa, onEnviarWhatsApp,
  laudos,
  editandoId, isAdminUser, confirmExcluir, setConfirmExcluir, onExcluir,
  styles,
}: Props) {
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const cfg = STATUS_CFG[status]

  const valorFrete = frete.modalidade === 'bonus' || frete.tipo === 'FOB' ? 0 : frete.valor
  const valorInst = instalacao.inclui && instalacao.modalidade === 'cobrar' ? (parseFloat(instalacao.valor.replace(',', '.')) || 0) : 0

  return (
    <>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarNumero}>{numero || 'Novo'}</span>
          <span className={styles.statusBadge} style={{ background: cfg.cor + '18', color: cfg.cor, borderRadius: 20 }}>{cfg.label}</span>
        </div>

        {empresaNome && (
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarLabel}>Empresa</span>
            <span className={styles.sidebarValue}>{empresaNome}</span>
          </div>
        )}

        {clienteNome && (
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarLabel}>Cliente</span>
            <span className={styles.sidebarValue}>{clienteNome}</span>
          </div>
        )}

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarLine}>
          <span>Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>

        {valorDesc > 0 && (
          <div className={styles.sidebarLine}>
            <span>Desconto {tipoDesc === '%' ? `(${tipoDesc})` : ''}</span>
            <span style={{ color: '#dc2626' }}>−{fmt(valorDesc)}</span>
          </div>
        )}

        {valorFrete > 0 && (
          <div className={styles.sidebarLine}>
            <span>Frete {frete.servico ? `(${frete.servico})` : ''}</span>
            <span>{fmt(valorFrete)}</span>
          </div>
        )}
        {frete.tipo === 'FOB' && (
          <div className={styles.sidebarLine}>
            <span>Frete</span>
            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>FOB</span>
          </div>
        )}

        {valorInst > 0 && (
          <div className={styles.sidebarLine}>
            <span>Instalação</span>
            <span>{fmt(valorInst)}</span>
          </div>
        )}
        {instalacao.inclui && instalacao.modalidade === 'bonus' && (
          <div className={styles.sidebarLine}>
            <span>Instalação</span>
            <span style={{ color: '#16a34a', fontSize: '0.78rem' }}>Bonificada</span>
          </div>
        )}

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarTotal}>
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>

        {/* Ações principais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className={styles.btnPrimary} onClick={() => onSalvar()} disabled={salvando} style={{ width: '100%', background: 'linear-gradient(135deg, #1a5fa8, #2563eb)' }}>
            {salvando ? <><Loader2 size={15} className="spin" /> Salvando...</> : <><Save size={15} /> Salvar</>}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={styles.btnImprimir} onClick={onImprimir} style={{ flex: 1 }}>
              <FileText size={15} /> PDF
            </button>
            {onCanva && (
              <button
                className={styles.btnImprimir}
                onClick={onCanva}
                disabled={gerandoCanva}
                style={{ flex: 1, background: '#f3f0ff', color: '#7c3aed', borderColor: '#c4b5fd' }}
                title="Gerar proposta visual no Canva"
              >
                {gerandoCanva ? <Loader2 size={15} className="spin" /> : <><Palette size={15} /> Canva</>}
              </button>
            )}
          </div>
        </div>

        {/* Ações de status */}
        <div className={styles.sidebarDivider} />
        <div className={styles.sidebarActions}>
          {status === 'rascunho' && clienteEmail && (
            <button className={styles.btnEnviar} onClick={onEnviarEmail} disabled={enviandoEmail || salvando} style={{ width: '100%' }}>
              {enviandoEmail ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {enviandoEmail ? 'Enviando...' : 'Enviar por E-mail'}
            </button>
          )}
          {status === 'rascunho' && !clienteEmail && (
            <button className={styles.btnEnviar} onClick={() => onSalvar('enviado')} disabled={salvando} style={{ width: '100%' }}>
              <Send size={15} /> Marcar Enviado
            </button>
          )}
          {status === 'enviado' && <>
            {clienteWhatsapp && (
              <button className={styles.btnEnviar} onClick={onEnviarWhatsApp} disabled={enviandoWa || salvando} style={{ width: '100%', background: '#25d366', borderColor: '#25d366', color: '#fff' }}>
                {enviandoWa ? <Loader2 size={15} className="spin" /> : <MessageCircle size={15} />} {enviandoWa ? 'Enviando...' : 'Enviar WhatsApp'}
              </button>
            )}
            <button className={styles.btnAprovar} onClick={() => onSalvar('aprovado')} disabled={salvando} style={{ width: '100%' }}>
              <CheckCircle size={15} /> Aprovado
            </button>
            <button className={styles.btnRecusar} onClick={() => onSalvar('recusado')} disabled={salvando} style={{ width: '100%' }}>
              <XCircle size={15} /> Recusado
            </button>
          </>}

          {status === 'aprovado' && !finLancId && (
            <button className={styles.btnReceivel} onClick={onGerarReceivel} disabled={gerandoRec} style={{ width: '100%' }}>
              {gerandoRec ? <Loader2 size={15} className="spin" /> : <><DollarSign size={15} /> Gerar Recebível</>}
            </button>
          )}
          {status === 'aprovado' && finLancId && (
            <span className={styles.receivelOk} style={{ textAlign: 'center', display: 'block' }}><Check size={13} style={{ verticalAlign: 'middle' }} /> Recebível #{finLancId}</span>
          )}

          {status === 'aprovado' && !etiquetaPreId && (
            <button className={styles.btnEnviar} onClick={onGerarEtiqueta} disabled={gerandoEtiq} style={{ width: '100%' }}>
              {gerandoEtiq ? <><Loader2 size={15} className="spin" /> Gerando...</> : <><Package size={15} /> Etiqueta Correios</>}
            </button>
          )}
          {etiquetaPreId && <>
            <button className={styles.btnAprovar} onClick={onBaixarRotulo} disabled={baixandoRotulo} style={{ width: '100%' }}>
              {baixandoRotulo ? <><Loader2 size={15} className="spin" /> Processando...</> : <><Tag size={15} /> Baixar Rótulo</>}
            </button>
            <button className={styles.btnImprimir} onClick={onBaixarDace} disabled={baixandoDace} style={{ width: '100%' }}>
              {baixandoDace ? <><Loader2 size={15} className="spin" /> Gerando...</> : <><File size={15} /> DACE</>}
            </button>
            <button className={styles.btnRecusar} onClick={onCancelarEtiqueta} disabled={cancelandoEtiq} style={{ width: '100%', fontSize: '0.78rem' }}>
              {cancelandoEtiq ? <Loader2 size={15} className="spin" /> : <><X size={15} /> Cancelar Envio</>}
            </button>
          </>}
        </div>

        {/* Laudos — acessos */}
        {laudos.length > 0 && <>
          <div className={styles.sidebarDivider} />
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Laudos — Acessos</div>
          {laudos.map(l => <LaudoStatsLine key={l.watermark_id} wid={l.watermark_id} nome={l.nome} />)}
        </>}

        {/* Excluir */}
        {isAdminUser && editandoId && <>
          <div className={styles.sidebarDivider} />
          {confirmExcluir ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#dc2626', textAlign: 'center' }}>Confirmar exclusão?</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                  onClick={() => onExcluir(editandoId)}>Sim</button>
                <button style={{ flex: 1, background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem' }}
                  onClick={() => setConfirmExcluir(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button style={{ width: '100%', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem' }}
              onClick={() => setConfirmExcluir(true)}><Trash2 size={14} /> Excluir orçamento</button>
          )}
        </>}
    </>
  )
}
