import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from '../../lib/masks'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClienteInfo {
  nome: string; empresa: string; cnpj: string; telefone: string; email: string
  tipo_pessoa: 'pf' | 'pj'
  perfil_comprador: '' | 'revendedor' | 'aplicador' | 'dono_obra' | 'especificador'
  whatsapp: string
  cargo: string
  cargo_outro: string
  inscricao_estadual: string
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string
  endereco: string
  email_nf: string
  contatos: { tipo: 'telefone' | 'whatsapp' | 'email'; valor: string }[]
  ent_diferente: boolean
  ent_responsavel: string; ent_telefone: string; ent_whatsapp: string
  ent_cep: string; ent_logradouro: string; ent_numero: string; ent_complemento: string; ent_bairro: string; ent_cidade: string; ent_uf: string
}

interface ClienteResult {
  cnpj: string; nome: string; telefone: string | null; email: string | null
  fonte: 'cliente' | 'prospect'
  logradouro?: string | null; numero?: string | null; bairro?: string | null
  cidade?: string | null; uf?: string | null; cep?: string | null
}

export interface ClienteFormProps {
  cliente: ClienteInfo
  setCliente: React.Dispatch<React.SetStateAction<ClienteInfo>>
  styles: Record<string, string>
}

// ── Constants ────────────────────────────────────────────────────────────────

const CARGOS = [
  'Comprador(a)', 'Diretor(a)', 'Engenheiro(a)', 'Gerente', 'Proprietário(a)',
  'Responsável Técnico', 'Financeiro', 'Administrativo', 'Arquiteto(a)', 'Outro',
]

// ── Component ────────────────────────────────────────────────────────────────

export default function ClienteForm({ cliente, setCliente, styles }: ClienteFormProps) {
  const [buscaCliente, setBuscaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<ClienteResult[]>([])
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [showDropCliente, setShowDropCliente] = useState(false)

  useEffect(() => {
    if (buscaCliente.length < 2) { setResultadosCliente([]); return }
    const t = setTimeout(async () => {
      setLoadingCliente(true)
      const termo = `%${buscaCliente}%`
      const { data: pros } = await supabaseAdmin
        .from('prospeccao')
        .select('cnpj, razao_social, telefone1, email, endereco, bairro, cidade, uf, cep, cliente_ativo')
        .ilike('razao_social', termo).limit(10)
      setResultadosCliente(
        ((pros ?? []) as any[]).map(p => ({
          cnpj: p.cnpj, nome: p.razao_social ?? '',
          telefone: p.telefone1 ?? null, email: p.email ?? null,
          fonte: p.cliente_ativo ? ('cliente' as const) : ('prospect' as const),
          logradouro: p.endereco ?? null, bairro: p.bairro ?? null,
          cidade: p.cidade ?? null, uf: p.uf ?? null, cep: p.cep ?? null,
        }))
      )
      setLoadingCliente(false)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  function selecionarCliente(r: ClienteResult) {
    setBuscaCliente(''); setShowDropCliente(false)
    setCliente(c => ({
      ...c,
      empresa: r.nome,
      cnpj: maskCNPJ(r.cnpj),
      telefone: r.telefone ? maskPhone(r.telefone) : '',
      email: r.email ?? '',
      logradouro: r.logradouro ?? '',
      bairro: r.bairro ?? '',
      cidade: r.cidade ?? '',
      uf: r.uf ?? '',
      cep: r.cep ? maskCEP(r.cep) : '',
      nome: '', cargo: '', cargo_outro: '',
    }))
  }

  async function buscarCEP(cep: string, destino: 'principal' | 'entrega') {
    const raw = cep.replace(/\D/g, '')
    if (raw.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const d = await res.json()
      if (d.erro) return
      if (destino === 'principal') {
        setCliente(c => ({ ...c, logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.localidade ?? '', uf: d.uf ?? '' }))
      } else {
        setCliente(c => ({ ...c, ent_logradouro: d.logradouro ?? '', ent_bairro: d.bairro ?? '', ent_cidade: d.localidade ?? '', ent_uf: d.uf ?? '' }))
      }
    } catch { /* silently ignore */ }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Destinatário</div>
      <div className={styles.buscaWrap}>
        <input className={styles.input} placeholder="🔍 Buscar cliente por nome..."
          value={buscaCliente}
          onChange={e => { setBuscaCliente(e.target.value); setShowDropCliente(true) }}
          onFocus={() => setShowDropCliente(true)}
          onBlur={() => setTimeout(() => setShowDropCliente(false), 200)}
        />
        {showDropCliente && buscaCliente.length >= 2 && (
          <div className={styles.dropdown}>
            {loadingCliente && <div className={styles.dropItem}>Buscando...</div>}
            {resultadosCliente.map(r => (
              <div key={r.cnpj} className={styles.dropItem} onMouseDown={() => selecionarCliente(r)}>
                <strong>{r.nome}</strong>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}> · {r.cnpj} · {r.fonte === 'cliente' ? '🟢 cliente' : '🔵 prospect'}</span>
              </div>
            ))}
            {!loadingCliente && resultadosCliente.length === 0 && (
              <div className={styles.dropItem} style={{ color: '#94a3b8' }}>Nenhum resultado — preencha manualmente</div>
            )}
          </div>
        )}
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}>
          <label>Tipo</label>
          <select className={styles.input} value={cliente.tipo_pessoa} onChange={e => setCliente(c => ({ ...c, tipo_pessoa: e.target.value as 'pf' | 'pj', cnpj: '' }))}>
            <option value="pj">Pessoa Jurídica</option>
            <option value="pf">Pessoa Física</option>
          </select>
        </div>
        <div className={styles.fg}>
          <label>Perfil do comprador</label>
          <select className={styles.input} value={cliente.perfil_comprador} onChange={e => setCliente(c => ({ ...c, perfil_comprador: e.target.value as ClienteInfo['perfil_comprador'] }))}>
            <option value="">— Não informado —</option>
            <option value="revendedor">Revendedor / Distribuidor</option>
            <option value="aplicador">Aplicador / Instalador</option>
            <option value="dono_obra">Dono de Obra / Uso Próprio</option>
            <option value="especificador">Especificador (Arq. / Eng.)</option>
          </select>
        </div>
        <div className={styles.fg}><label>{cliente.tipo_pessoa === 'pf' ? 'Nome completo *' : 'Empresa *'}</label><input className={styles.input} value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))} placeholder={cliente.tipo_pessoa === 'pf' ? 'Nome completo' : 'Razão social'} /></div>
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}><label>A/C. (Responsável)</label><input className={styles.input} value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} placeholder="Nome do contato" /></div>
        <div className={styles.fg}>
          <label>Cargo</label>
          <select className={styles.input} value={cliente.cargo} onChange={e => setCliente(c => ({ ...c, cargo: e.target.value }))}>
            <option value="">— Selecionar —</option>
            {CARGOS.map(c => <option key={c}>{c}</option>)}
          </select>
          {cliente.cargo === 'Outro' && (
            <input className={styles.input} style={{ marginTop: 4 }} placeholder="Especificar cargo" value={cliente.cargo_outro} onChange={e => setCliente(c => ({ ...c, cargo_outro: e.target.value }))} />
          )}
        </div>
      </div>
      <div className={styles.row3}>
        <div className={styles.fg}>
          <label>{cliente.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}</label>
          <input className={styles.input} value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: c.tipo_pessoa === 'pj' ? maskCNPJ(e.target.value) : maskCPF(e.target.value) }))} placeholder={cliente.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} maxLength={cliente.tipo_pessoa === 'pj' ? 18 : 14} />
        </div>
        <div className={styles.fg}><label>Insc. Estadual</label><input className={styles.input} value={cliente.inscricao_estadual} onChange={e => setCliente(c => ({ ...c, inscricao_estadual: e.target.value }))} /></div>
        <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={cliente.telefone} onChange={e => setCliente(c => ({ ...c, telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.whatsapp} onChange={e => setCliente(c => ({ ...c, whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
        <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={cliente.email} onChange={e => setCliente(c => ({ ...c, email: e.target.value }))} /></div>
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}><label>E-mail para NFs / Boletos</label><input className={styles.input} value={cliente.email_nf} onChange={e => setCliente(c => ({ ...c, email_nf: e.target.value }))} placeholder="financeiro@empresa.com.br" /></div>
      </div>

      {/* Contatos adicionais */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contatos adicionais</div>
        {cliente.contatos.map((ct, ci) => (
          <div key={ci} className={styles.row3} style={{ marginBottom: 4 }}>
            <div style={{ width: 130, flexShrink: 0 }}>
              <select className={styles.input} value={ct.tipo} onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], tipo: e.target.value as 'telefone' | 'whatsapp' | 'email' }; return { ...c, contatos: cc } })}>
                <option value="telefone">Telefone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
            </div>
            <div className={styles.fg}>
              <input className={styles.input} value={ct.valor}
                onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], valor: ct.tipo === 'email' ? e.target.value : maskPhone(e.target.value) }; return { ...c, contatos: cc } })}
                placeholder={ct.tipo === 'email' ? 'contato@empresa.com' : '(00) 00000-0000'}
                maxLength={ct.tipo === 'email' ? 120 : 15} />
            </div>
            <button className={styles.btnRemoveItem} style={{ marginTop: 0 }} onClick={() => setCliente(c => ({ ...c, contatos: c.contatos.filter((_, j) => j !== ci) }))}>✕</button>
          </div>
        ))}
        <button className={styles.btnSecondary} style={{ marginTop: 2, fontSize: '0.78rem', padding: '4px 10px' }}
          onClick={() => setCliente(c => ({ ...c, contatos: [...c.contatos, { tipo: 'whatsapp', valor: '' }] }))}>
          + Adicionar contato
        </button>
      </div>

      {/* Endereço principal */}
      <div style={{ marginTop: 8, marginBottom: 4, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Endereço principal</div>
      <div className={styles.row2}>
        <div style={{ width: 150, flexShrink: 0 }}>
          <label>CEP</label>
          <input className={styles.input} value={cliente.cep} maxLength={9}
            onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'principal') }}
            placeholder="00000-000" />
        </div>
        <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.logradouro} onChange={e => setCliente(c => ({ ...c, logradouro: e.target.value }))} placeholder="Rua / Av. / Alameda..." /></div>
      </div>
      <div className={styles.row3}>
        <div style={{ width: 90, flexShrink: 0 }}><label>Número</label><input className={styles.input} value={cliente.numero} onChange={e => setCliente(c => ({ ...c, numero: e.target.value }))} /></div>
        <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.complemento} onChange={e => setCliente(c => ({ ...c, complemento: e.target.value }))} placeholder="Sala, Bloco..." /></div>
        <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.bairro} onChange={e => setCliente(c => ({ ...c, bairro: e.target.value }))} /></div>
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.cidade} onChange={e => setCliente(c => ({ ...c, cidade: e.target.value }))} /></div>
        <div style={{ width: 70, flexShrink: 0 }}><label>UF</label><input className={styles.input} value={cliente.uf} onChange={e => setCliente(c => ({ ...c, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} placeholder="MG" /></div>
      </div>
      {cliente.endereco && !cliente.logradouro && (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          ℹ️ Legado: {cliente.endereco}
        </div>
      )}

      {/* Endereço de entrega */}
      <label className={styles.toggleLabel} style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={cliente.ent_diferente} onChange={e => setCliente(c => ({ ...c, ent_diferente: e.target.checked }))} />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Endereço de entrega diferente do principal</span>
      </label>
      {cliente.ent_diferente && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>LOCAL DE ENTREGA</div>
          <div className={styles.row3}>
            <div className={styles.fg}><label>Responsável local</label><input className={styles.input} value={cliente.ent_responsavel} onChange={e => setCliente(c => ({ ...c, ent_responsavel: e.target.value }))} placeholder="Nome do responsável" /></div>
            <div className={styles.fg}><label>Telefone</label><input className={styles.input} value={cliente.ent_telefone} onChange={e => setCliente(c => ({ ...c, ent_telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
            <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.ent_whatsapp} onChange={e => setCliente(c => ({ ...c, ent_whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
          </div>
          <div className={styles.row2}>
            <div style={{ width: 150, flexShrink: 0 }}>
              <label>CEP</label>
              <input className={styles.input} value={cliente.ent_cep} maxLength={9}
                onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, ent_cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'entrega') }}
                placeholder="00000-000" />
            </div>
            <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.ent_logradouro} onChange={e => setCliente(c => ({ ...c, ent_logradouro: e.target.value }))} /></div>
          </div>
          <div className={styles.row3}>
            <div style={{ width: 90, flexShrink: 0 }}><label>Número</label><input className={styles.input} value={cliente.ent_numero} onChange={e => setCliente(c => ({ ...c, ent_numero: e.target.value }))} /></div>
            <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.ent_complemento} onChange={e => setCliente(c => ({ ...c, ent_complemento: e.target.value }))} /></div>
            <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.ent_bairro} onChange={e => setCliente(c => ({ ...c, ent_bairro: e.target.value }))} /></div>
          </div>
          <div className={styles.row2}>
            <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.ent_cidade} onChange={e => setCliente(c => ({ ...c, ent_cidade: e.target.value }))} /></div>
            <div style={{ width: 70, flexShrink: 0 }}><label>UF</label><input className={styles.input} value={cliente.ent_uf} onChange={e => setCliente(c => ({ ...c, ent_uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
