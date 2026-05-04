import { useState } from 'react'
import { Settings, Pencil, Trash2, X } from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'
import { maskCEP } from '../../lib/masks'
import { formatarDadoBancario } from './types'
import type { EmpresaEmissora, Vendedor, DadoBancario, ExibirProposta } from './types'
import ConfigSection from './sections/ConfigSection'

type Tab = 'empresas' | 'consultores' | 'banco' | 'preferencias'

interface Props {
  open: boolean
  onClose: () => void
  // Empresas
  empresas: EmpresaEmissora[]
  carregarEmpresas: () => void
  uploadandoLogo: boolean
  uploadLogo: (file: File, empId: number, input: HTMLInputElement) => void
  showMsg: (tipo: 'ok' | 'erro', texto: string) => void
  // Vendedores
  vendedores: Vendedor[]
  carregarVendedores: () => void
  // Dados bancários
  dadosBancarios: DadoBancario[]
  carregarDadosBancarios: () => void
  // Preferências (ConfigSection props)
  showControles: boolean
  setShowControles: (fn: (v: boolean) => boolean) => void
  exibir: ExibirProposta
  setExibir: (fn: (v: ExibirProposta) => ExibirProposta) => void
  watermarkAtivo: boolean
  setWatermarkAtivo: (v: boolean) => void
  watermarkLogo: boolean
  setWatermarkLogo: (v: boolean) => void
  watermarkTexto: string
  setWatermarkTexto: (v: string) => void
  imagemUrl: string
  setImagemUrl: (v: string) => void
  imagemRef: React.RefObject<HTMLInputElement | null>
  uploadandoImagem: boolean
  uploadImagem: (file: File) => void
  origemLead: string
  setOrigemLead: (v: string) => void
  obsInternas: string
  setObsInternas: (v: string) => void
  styles: Record<string, string>
}

export default function ConfigDrawer({
  open, onClose,
  empresas, carregarEmpresas, uploadandoLogo, uploadLogo, showMsg,
  vendedores, carregarVendedores,
  dadosBancarios, carregarDadosBancarios,
  showControles, setShowControles, exibir, setExibir,
  watermarkAtivo, setWatermarkAtivo, watermarkLogo, setWatermarkLogo,
  watermarkTexto, setWatermarkTexto, imagemUrl, setImagemUrl,
  imagemRef, uploadandoImagem, uploadImagem,
  origemLead, setOrigemLead, obsInternas, setObsInternas,
  styles,
}: Props) {
  const [tab, setTab] = useState<Tab>('empresas')
  const [formEmpresa, setFormEmpresa] = useState<Partial<EmpresaEmissora>>({})
  const [editEmpresaId, setEditEmpresaId] = useState<number | null>(null)
  const [formVendedor, setFormVendedor] = useState<Partial<Vendedor>>({})
  const [editVendedorId, setEditVendedorId] = useState<number | null>(null)
  const [formBanco, setFormBanco] = useState<Partial<DadoBancario>>({})

  if (!open) return null

  async function salvarEmpresa() {
    if (!formEmpresa.nome_fantasia?.trim()) return
    if (editEmpresaId) {
      const { id: _id, ...payload } = formEmpresa as EmpresaEmissora
      const { error } = await supabaseAdmin.from('empresas_emissoras').update(payload).eq('id', editEmpresaId)
      if (error) { showMsg('erro', 'Erro ao salvar: ' + error.message); return }
      showMsg('ok', 'Empresa atualizada!')
    } else {
      const { error } = await supabaseAdmin.from('empresas_emissoras').insert({ ...formEmpresa, ativa: true })
      if (error) { showMsg('erro', 'Erro ao criar: ' + error.message); return }
      showMsg('ok', 'Empresa criada!')
    }
    setFormEmpresa({}); setEditEmpresaId(null); carregarEmpresas()
  }

  async function salvarVendedor() {
    if (!formVendedor.nome?.trim()) return
    if (editVendedorId) { const { id: _id, ...payload } = formVendedor as Vendedor; await supabaseAdmin.from('vendedores').update(payload).eq('id', editVendedorId) }
    else { await supabaseAdmin.from('vendedores').insert({ ...formVendedor, ativo: true }) }
    setFormVendedor({}); setEditVendedorId(null); carregarVendedores()
  }

  async function salvarDadoBancario() {
    if (!formBanco.apelido?.trim()) { showMsg('erro', 'Apelido obrigatório'); return }
    const { error } = await supabaseAdmin.from('dados_bancarios').insert({
      apelido: formBanco.apelido, banco: formBanco.banco || null, agencia: formBanco.agencia || null,
      conta: formBanco.conta || null, tipo_conta: formBanco.tipo_conta || 'corrente',
      pix_chave: formBanco.pix_chave || null, pix_tipo: formBanco.pix_tipo || null,
      titular: formBanco.titular || null, cnpj_titular: formBanco.cnpj_titular || null,
      observacao: formBanco.observacao || null, ordem: dadosBancarios.length,
    })
    if (error) { showMsg('erro', 'Erro: ' + error.message); return }
    setFormBanco({}); carregarDadosBancarios(); showMsg('ok', 'Conta cadastrada!')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'empresas', label: 'Empresas' },
    { key: 'consultores', label: 'Consultores' },
    { key: 'banco', label: 'Bancários' },
    { key: 'preferencias', label: 'Preferências' },
  ]

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}><Settings size={16} /> Configurações</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.drawerTabs}>
          {TABS.map(t => (
            <button key={t.key} className={`${styles.drawerTab} ${tab === t.key ? styles.drawerTabAtivo : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.drawerBody}>

          {/* ── Empresas ── */}
          {tab === 'empresas' && (
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionTitle}>{editEmpresaId ? 'Editar Empresa' : 'Nova Empresa Emissora'}</div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Nome fantasia *</label><input className={styles.input} value={formEmpresa.nome_fantasia ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, nome_fantasia: e.target.value }))} /></div>
                <div className={styles.fg}><label>Razão social</label><input className={styles.input} value={formEmpresa.razao_social ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, razao_social: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>CNPJ</label><input className={styles.input} value={formEmpresa.cnpj ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, cnpj: e.target.value }))} /></div>
                <div className={styles.fg}>
                  <label>Telefone</label>
                  <input className={styles.input} value={formEmpresa.telefone ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, telefone: e.target.value }))} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: '0.72rem', color: '#64748b', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!formEmpresa.telefone_is_whatsapp}
                      onChange={e => setFormEmpresa(f => ({ ...f, telefone_is_whatsapp: e.target.checked }))} />
                    WhatsApp
                  </label>
                </div>
              </div>
              <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={formEmpresa.email ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, email: e.target.value }))} /></div>
              <div className={styles.row2}>
                <div className={styles.fg}>
                  <label>CEP</label>
                  <input className={styles.input} placeholder="00000-000"
                    value={formEmpresa.cep ?? ''}
                    onChange={e => setFormEmpresa(f => ({ ...f, cep: maskCEP(e.target.value) }))}
                    onBlur={async e => {
                      const cep = e.target.value.replace(/\D/g, '')
                      if (cep.length !== 8) return
                      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
                      const d = await r.json()
                      if (d.erro) return
                      setFormEmpresa(f => ({
                        ...f,
                        logradouro: d.logradouro || f.logradouro,
                        bairro: d.bairro || f.bairro,
                        cidade: d.localidade || f.cidade,
                        uf: d.uf || f.uf,
                        endereco: `${d.logradouro}${f.numero ? ', nº ' + f.numero : ''} — ${d.bairro} — ${d.localidade}/${d.uf}`,
                      }))
                    }}
                  />
                </div>
                <div className={styles.fg}><label>Número</label><input className={styles.input} placeholder="1020" value={formEmpresa.numero ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, numero: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Logradouro</label><input className={styles.input} placeholder="Preenchido pelo CEP" value={formEmpresa.logradouro ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, logradouro: e.target.value }))} /></div>
                <div className={styles.fg}><label>Complemento</label><input className={styles.input} placeholder="Sala, Galpão..." value={formEmpresa.complemento ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, complemento: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Bairro</label><input className={styles.input} placeholder="Preenchido pelo CEP" value={formEmpresa.bairro ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, bairro: e.target.value }))} /></div>
                <div className={styles.fg}><label>Cidade</label><input className={styles.input} placeholder="Preenchido pelo CEP" value={formEmpresa.cidade ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, cidade: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>UF</label><input className={styles.input} placeholder="MG" maxLength={2} value={formEmpresa.uf ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
                <div className={styles.fg}><label>Site</label><input className={styles.input} placeholder="pousinox.com.br" value={formEmpresa.site ?? ''} onChange={e => setFormEmpresa(f => ({ ...f, site: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnPrimary} onClick={salvarEmpresa}>{editEmpresaId ? 'Atualizar' : 'Criar empresa'}</button>
                {editEmpresaId && <button className={styles.btnSecondary} onClick={() => { setFormEmpresa({}); setEditEmpresaId(null) }}>Cancelar</button>}
              </div>

              {/* Lista */}
              {empresas.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {empresas.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      {e.logo_url ? <img src={e.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} /> : <span style={{ width: 28, height: 28, background: '#e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>logo</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome_fantasia}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{e.cnpj || e.email || ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <input type="file" accept="image/*" id={`drw-logo-${e.id}`} style={{ display: 'none' }} onChange={ev => ev.target.files?.[0] && uploadLogo(ev.target.files[0], e.id, ev.target as HTMLInputElement)} />
                        <label htmlFor={`drw-logo-${e.id}`} style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#1a5fa8', fontWeight: 600 }}>{uploadandoLogo ? '...' : '⬆'}</label>
                        <button className={styles.btnRemoveItem} style={{ width: 24, height: 24, fontSize: '0.7rem' }} onClick={() => { setEditEmpresaId(e.id); setFormEmpresa({ ...e }) }}><Pencil size={12} /></button>
                        <button className={styles.btnRemoveItem} style={{ width: 24, height: 24, fontSize: '0.7rem' }} onClick={async () => {
                          if (!window.confirm(`Excluir "${e.nome_fantasia}"?`)) return
                          await supabaseAdmin.from('empresas_emissoras').update({ ativa: false }).eq('id', e.id)
                          carregarEmpresas()
                        }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Consultores ── */}
          {tab === 'consultores' && (
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionTitle}>{editVendedorId ? 'Editar Consultor' : 'Novo Consultor'}</div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Nome *</label><input className={styles.input} value={formVendedor.nome ?? ''} onChange={e => setFormVendedor(f => ({ ...f, nome: e.target.value }))} /></div>
                <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={formVendedor.email ?? ''} onChange={e => setFormVendedor(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={formVendedor.telefone ?? ''} onChange={e => setFormVendedor(f => ({ ...f, telefone: e.target.value }))} /></div>
                <div className={styles.fg}><label>Comissão (%)</label><input className={styles.input} type="number" min="0" step="0.01" value={formVendedor.comissao_pct ?? ''} onChange={e => setFormVendedor(f => ({ ...f, comissao_pct: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnPrimary} onClick={salvarVendedor}>{editVendedorId ? 'Atualizar' : 'Cadastrar'}</button>
                {editVendedorId && <button className={styles.btnSecondary} onClick={() => { setFormVendedor({}); setEditVendedorId(null) }}>Cancelar</button>}
              </div>

              {vendedores.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {vendedores.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{v.nome}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{v.email || ''}{v.comissao_pct > 0 ? ` · ${v.comissao_pct}%` : ''}</div>
                      </div>
                      <button className={styles.btnRemoveItem} style={{ width: 24, height: 24, fontSize: '0.7rem' }} onClick={() => { setEditVendedorId(v.id); setFormVendedor({ ...v }) }}><Pencil size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Dados Bancários ── */}
          {tab === 'banco' && (
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionTitle}>Nova Conta</div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Apelido *</label><input className={styles.input} placeholder="Ex: Bradesco PJ" value={formBanco.apelido ?? ''} onChange={e => setFormBanco(f => ({ ...f, apelido: e.target.value }))} /></div>
                <div className={styles.fg}><label>Banco</label><input className={styles.input} placeholder="Bradesco" value={formBanco.banco ?? ''} onChange={e => setFormBanco(f => ({ ...f, banco: e.target.value }))} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Agência</label><input className={styles.input} placeholder="1234" value={formBanco.agencia ?? ''} onChange={e => setFormBanco(f => ({ ...f, agencia: e.target.value }))} /></div>
                <div className={styles.fg}><label>Conta</label><input className={styles.input} placeholder="56789-0" value={formBanco.conta ?? ''} onChange={e => setFormBanco(f => ({ ...f, conta: e.target.value }))} /></div>
              </div>
              <div className={styles.fg}>
                <label>Tipo</label>
                <select className={styles.input} value={formBanco.tipo_conta ?? 'corrente'} onChange={e => setFormBanco(f => ({ ...f, tipo_conta: e.target.value }))}>
                  <option value="corrente">Corrente</option><option value="poupanca">Poupança</option>
                </select>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Chave PIX</label><input className={styles.input} placeholder="CNPJ, e-mail, telefone..." value={formBanco.pix_chave ?? ''} onChange={e => setFormBanco(f => ({ ...f, pix_chave: e.target.value }))} /></div>
                <div className={styles.fg}>
                  <label>Tipo da chave</label>
                  <select className={styles.input} value={formBanco.pix_tipo ?? ''} onChange={e => setFormBanco(f => ({ ...f, pix_tipo: e.target.value }))}>
                    <option value="">—</option><option value="cnpj">CNPJ</option><option value="cpf">CPF</option>
                    <option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
                  </select>
                </div>
              </div>
              <div className={styles.row2}>
                <div className={styles.fg}><label>Titular</label><input className={styles.input} placeholder="Pousinox Ind. Com. LTDA" value={formBanco.titular ?? ''} onChange={e => setFormBanco(f => ({ ...f, titular: e.target.value }))} /></div>
                <div className={styles.fg}><label>CNPJ do titular</label><input className={styles.input} placeholder="12.115.379/0001-64" value={formBanco.cnpj_titular ?? ''} onChange={e => setFormBanco(f => ({ ...f, cnpj_titular: e.target.value }))} /></div>
              </div>
              <button className={styles.btnPrimary} onClick={salvarDadoBancario}>Salvar conta</button>

              {dadosBancarios.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dadosBancarios.map(d => (
                    <div key={d.id} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{d.apelido}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-line', marginTop: 2 }}>{formatarDadoBancario(d)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preferências ── */}
          {tab === 'preferencias' && (
            <ConfigSection
              showControles={true} setShowControles={setShowControles}
              exibir={exibir} setExibir={setExibir}
              watermarkAtivo={watermarkAtivo} setWatermarkAtivo={setWatermarkAtivo}
              watermarkLogo={watermarkLogo} setWatermarkLogo={setWatermarkLogo}
              watermarkTexto={watermarkTexto} setWatermarkTexto={setWatermarkTexto}
              imagemUrl={imagemUrl} setImagemUrl={setImagemUrl}
              imagemRef={imagemRef} uploadandoImagem={uploadandoImagem} uploadImagem={uploadImagem}
              origemLead={origemLead} setOrigemLead={setOrigemLead}
              obsInternas={obsInternas} setObsInternas={setObsInternas}
              styles={styles}
            />
          )}
        </div>
      </div>
    </>
  )
}
