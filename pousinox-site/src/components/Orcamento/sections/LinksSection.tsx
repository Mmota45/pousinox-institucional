import { MessageCircle, Link, RefreshCw, Eye, Download, ChevronDown, ChevronRight, ClipboardCopy, Mail, X, Info } from 'lucide-react'
import type { OrcLink, Vendedor, ClienteInfo } from '../types'

interface Props {
  editandoId: number | null
  links: OrcLink[]
  gerandoLink: boolean
  novoLinkDest: string
  setNovoLinkDest: (v: string) => void
  acessosLink: Record<string, any[]>
  expandedLink: string | null
  carregarLinks: (orcId: number) => void
  toggleAcessos: (linkId: string) => void
  gerarLink: () => void
  desativarLink: (linkId: string) => void
  linkUrl: (l: OrcLink) => string
  showMsg: (tipo: 'ok' | 'erro', texto: string) => void
  vendedores: Vendedor[]
  vendedorId: number | null
  cliente: ClienteInfo
  numero: string
  styles: Record<string, string>
}

export default function LinksSection({
  editandoId, links, gerandoLink, novoLinkDest, setNovoLinkDest,
  acessosLink, expandedLink, carregarLinks, toggleAcessos,
  gerarLink, desativarLink, linkUrl, showMsg,
  vendedores, vendedorId, cliente, numero, styles,
}: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Links de Rastreamento</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input className={styles.input} style={{ flex: 1 }} placeholder="Destinatário (ex: João — Construtora ABC)" value={novoLinkDest} onChange={e => setNovoLinkDest(e.target.value)} />
        <button className={styles.btnAddItem} onClick={gerarLink} disabled={gerandoLink}>{gerandoLink ? '...' : <><Link size={14} /> Gerar link</>}</button>
        <button className={styles.btnSecondary} onClick={() => editandoId && carregarLinks(editandoId)} title="Atualizar contadores"><RefreshCw size={14} /></button>
      </div>
      {links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map(l => (
            <div key={l.id} style={{ background: l.ativo ? '#f8fafc' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{l.destinatario || '— Sem destinatário —'}</span>
                  {!l.ativo && <span style={{ marginLeft: 6, color: '#94a3b8' }}>(inativo)</span>}
                  <div style={{ color: '#64748b', marginTop: 2 }}>
                    {l.visualizacoes > 0 ? <><Eye size={12} /> {l.visualizacoes} visualiz. · </> : ''}
                    {l.downloads > 0 ? <><Download size={12} /> {l.downloads} download(s) · </> : ''}
                    {l.primeiro_acesso ? `1º acesso: ${new Date(l.primeiro_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Nunca acessado'}
                    {l.visualizacoes > 0 && (
                      <span
                        style={{ marginLeft: 8, cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                        onClick={() => toggleAcessos(l.id)}
                      >
                        {expandedLink === l.id ? <><ChevronDown size={12} /> ocultar detalhes</> : <><ChevronRight size={12} /> ver por IP</>}
                      </span>
                    )}
                  </div>
                  {expandedLink === l.id && (
                    <div style={{ marginTop: 8, fontSize: '0.7rem', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                      {!acessosLink[l.id] ? (
                        <span style={{ color: '#94a3b8' }}>carregando…</span>
                      ) : acessosLink[l.id].length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>nenhum acesso registrado</span>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#64748b' }}>
                              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Quando</th>
                              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>IP</th>
                              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Dispositivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {acessosLink[l.id].map((a: any, i: number) => {
                              const ua = a.user_agent ?? ''
                              const device = /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop'
                              const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Outro'
                              return (
                                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '3px 0', color: '#475569' }}>{new Date(a.acessado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                  <td style={{ padding: '3px 8px', color: '#475569', fontFamily: 'monospace' }}>{a.ip ?? '—'}</td>
                                  <td style={{ padding: '3px 0', color: '#475569' }}>{device} · {browser}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {l.ativo && (
                    <>
                      <button className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                        onClick={() => { navigator.clipboard.writeText(linkUrl(l)); showMsg('ok', 'Link copiado!') }}>
                        <ClipboardCopy size={14} /> Copiar
                      </button>
                      {(() => {
                        const vend = vendedores.find(v => v.id === vendedorId)
                        const nomeCompleto = cliente.tipo_pessoa === 'pf' ? (cliente.nome || cliente.empresa) : cliente.empresa
                        const primeiroNome = nomeCompleto ? nomeCompleto.split(' ')[0] : ''
                        const assinaturaWa = vend?.nome ?? ''
                        const assinaturaEmail = [vend?.nome, vend?.telefone].filter(Boolean).join(' · ')
                        const corpo = (assinatura: string) => [
                          `Olá${primeiroNome ? ', ' + primeiroNome : ''}!`,
                          '',
                          `Segue o orçamento ${numero} da Pousinox conforme conversamos.`,
                          '',
                          linkUrl(l),
                          '',
                          'Qualquer dúvida estou à disposição.',
                          assinatura,
                        ].join('\n')
                        return (
                          <>
                            <a href={`https://wa.me/?text=${encodeURIComponent(corpo(assinaturaWa))}`} target="_blank" rel="noreferrer"
                              className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem', textDecoration: 'none' }}>
                              <MessageCircle size={14} /> WhatsApp
                            </a>
                            <a href={`mailto:${l.destinatario ?? ''}?subject=${encodeURIComponent(`Orçamento ${numero} — Pousinox`)}&body=${encodeURIComponent(corpo(assinaturaEmail))}`}
                              className={styles.btnAddItem} style={{ padding: '3px 10px', fontSize: '0.72rem', textDecoration: 'none' }}>
                              <Mail size={14} /> E-mail
                            </a>
                          </>
                        )
                      })()}
                      <button className={styles.btnRemoveItem} onClick={() => desativarLink(l.id)} title="Desativar link"><X size={14} /></button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ color: '#94a3b8', marginTop: 3, wordBreak: 'break-all' }}>{linkUrl(l)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginTop: 6 }}>
        <Info size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cada link é único por destinatário. O rastreamento registra acessos via link — PDFs baixados offline não são rastreados.
      </div>
    </div>
  )
}
