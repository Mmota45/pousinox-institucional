/**
 * CompartilharProposta — Gera link protegido para proposta comercial
 * Mesmo critério de proteção do LaudoProtegido: senha + watermark + auditoria + expiração
 */

import { useState } from 'react'
import { Lock, CheckCircle, ClipboardCopy, Check, AlertTriangle, X } from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'

interface Props {
  orcamentoId: number | null
  empresa: string
  cnpj: string
  contato: string
  email: string
  usuario: string
}

interface Resultado {
  watermark_id: string
  senha: string
  link: string
  expira_em: string
  max_downloads: number
}

export default function CompartilharProposta({ orcamentoId, empresa, cnpj, contato, email, usuario }: Props) {
  const [aberto, setAberto] = useState(false)
  const [expiraHoras, setExpiraHoras] = useState(72)
  const [maxDownloads, setMaxDownloads] = useState(5)
  const [senhaManual, setSenhaManual] = useState('')
  const [senhaAuto, setSenhaAuto] = useState(true)
  const [canal, setCanal] = useState('link')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [copiado, setCopiado] = useState<'link' | 'senha' | null>(null)

  async function gerar() {
    if (!orcamentoId) { setErro('Salve o orçamento antes de compartilhar.'); return }
    if (!empresa.trim()) { setErro('Preencha o destinatário.'); return }
    setGerando(true)
    setErro(null)

    try {
      const res = await supabaseAdmin.functions.invoke('proteger-pdf', {
        body: {
          action: 'gerar_proposta',
          orcamento_id: orcamentoId,
          destinatario: empresa.trim(),
          cnpj: cnpj.trim() || undefined,
          contato: contato.trim() || undefined,
          email: email.trim() || undefined,
          senha: senhaAuto ? undefined : senhaManual.trim() || undefined,
          enviado_por: usuario || undefined,
          canal_envio: canal,
          expira_horas: expiraHoras,
          max_downloads: maxDownloads,
        },
      })

      if (res.error || !res.data?.ok) {
        setErro(res.data?.error || res.error?.message || 'Erro ao gerar link protegido')
        return
      }

      setResultado({
        watermark_id: res.data.watermark_id,
        senha: res.data.senha,
        link: `${window.location.origin}${res.data.link}`,
        expira_em: res.data.expira_em,
        max_downloads: res.data.max_downloads,
      })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setGerando(false)
    }
  }

  function copiar(tipo: 'link' | 'senha') {
    if (!resultado) return
    navigator.clipboard.writeText(tipo === 'link' ? resultado.link : resultado.senha)
    setCopiado(tipo)
    setTimeout(() => setCopiado(null), 2000)
  }

  function fechar() { setAberto(false); setResultado(null); setErro(null) }

  function fmtData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <button onClick={() => setAberto(true)} type="button" style={btnMain}>
        <Lock size={14} /> Compartilhar Proposta Protegida
      </button>

      {aberto && (
        <div style={overlay} onClick={fechar}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                {resultado ? <><CheckCircle size={16} /> Link Gerado</> : <><Lock size={16} /> Compartilhar Proposta Protegida</>}
              </h3>
              <button onClick={fechar} style={btnClose}><X size={16} /></button>
            </div>

            {resultado ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={sucessoBox}>
                  Link protegido gerado. Compartilhe o link e a senha <strong>separadamente</strong>.
                </p>

                <div>
                  <span style={labelSm}>Link de acesso:</span>
                  <div style={rowCopy}>
                    <code style={codeBox}>{resultado.link}</code>
                    <button style={btnCopiar} onClick={() => copiar('link')}>{copiado === 'link' ? <Check size={14} /> : <ClipboardCopy size={14} />}</button>
                  </div>
                </div>

                <div>
                  <span style={labelSm}>Senha:</span>
                  <div style={rowCopy}>
                    <code style={codeBox}>{resultado.senha}</code>
                    <button style={btnCopiar} onClick={() => copiar('senha')}>{copiado === 'senha' ? <Check size={14} /> : <ClipboardCopy size={14} />}</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 20, fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Expira em: {fmtData(resultado.expira_em)}</span>
                  <span>Max acessos: {resultado.max_downloads}</span>
                </div>

                <div style={avisoSenha}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> A senha não será exibida novamente. Anote ou compartilhe agora.</div>
              </div>
            ) : (
              <>
                <p style={avisoBox}>
                  A proposta será visualizada com marca d'água rastreável (nome + CNPJ do destinatário).
                  O acesso será protegido por senha com link expirável.
                </p>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1a3a5c' }}>{empresa || '—'}</div>
                  {cnpj && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>CNPJ: {cnpj}</div>}
                  {contato && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Contato: {contato}</div>}
                  {email && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Email: {email}</div>}
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#444', cursor: 'pointer' }}>
                    <input type="checkbox" checked={senhaAuto} onChange={e => setSenhaAuto(e.target.checked)} style={{ accentColor: '#1a3a5c' }} />
                    Gerar senha automaticamente (6 dígitos)
                  </label>
                  {!senhaAuto && (
                    <input value={senhaManual} onChange={e => setSenhaManual(e.target.value)}
                      placeholder="Digite a senha" style={{ ...inputSm, marginTop: 6 }} />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <label style={labelCol}>
                    Validade
                    <select style={inputSm} value={expiraHoras} onChange={e => setExpiraHoras(Number(e.target.value))}>
                      <option value={24}>24 horas</option>
                      <option value={48}>48 horas</option>
                      <option value={72}>72 horas</option>
                      <option value={168}>7 dias</option>
                      <option value={720}>30 dias</option>
                    </select>
                  </label>
                  <label style={labelCol}>
                    Max acessos
                    <select style={inputSm} value={maxDownloads} onChange={e => setMaxDownloads(Number(e.target.value))}>
                      <option value={1}>1</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </label>
                  <label style={labelCol}>
                    Canal
                    <select style={inputSm} value={canal} onChange={e => setCanal(e.target.value)}>
                      <option value="link">Link</option>
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="presencial">Presencial</option>
                    </select>
                  </label>
                </div>

                {erro && <p style={{ fontSize: '0.8rem', color: '#c0392b', background: '#fdf0ee', borderRadius: 8, padding: '8px 12px' }}>{erro}</p>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button onClick={fechar} style={btnCancel}>Cancelar</button>
                  <button onClick={gerar} disabled={gerando} style={btnConfirm}>
                    {gerando ? 'Gerando…' : <><Lock size={14} /> Gerar Link Protegido</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Styles ── */
const btnMain: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const modal: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, width: 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const btnClose: React.CSSProperties = { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#666', padding: '2px 6px', borderRadius: 4 }
const avisoBox: React.CSSProperties = { fontSize: '0.78rem', color: '#666', background: '#f5f7fa', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, borderLeft: '3px solid #1a3a5c' }
const sucessoBox: React.CSSProperties = { fontSize: '0.85rem', color: '#166534', background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, borderLeft: '3px solid #16a34a' }
const avisoSenha: React.CSSProperties = { fontSize: '0.78rem', color: '#d97706', background: '#fffbeb', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #f59e0b', fontWeight: 500 }
const labelSm: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }
const labelCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#444' }
const rowCopy: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const codeBox: React.CSSProperties = { flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', fontFamily: "'Courier New', monospace", color: '#1a1a2e', wordBreak: 'break-all' }
const btnCopiar: React.CSSProperties = { background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.9rem' }
const inputSm: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', width: '100%' }
const btnCancel: React.CSSProperties = { background: 'none', border: '1px solid #d0d7de', borderRadius: 8, padding: '8px 18px', fontSize: '0.85rem', cursor: 'pointer', color: '#444' }
const btnConfirm: React.CSSProperties = { background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
