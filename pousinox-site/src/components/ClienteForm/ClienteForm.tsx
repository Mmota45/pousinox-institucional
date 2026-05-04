import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { maskCNPJ, maskCPF, maskPhone, maskCEP, maskIE } from '../../lib/masks'

// ── Types ────────────────────────────────────────────────────────────────────

export type ContatoTipo = 'telefone' | 'whatsapp' | 'email' | 'email_nf' | 'email_financeiro' | 'email_compras' | 'email_engenharia'

export const CONTATO_LABELS: Record<ContatoTipo, string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  email_nf: 'E-mail NFs / Boletos',
  email_financeiro: 'E-mail Financeiro',
  email_compras: 'E-mail Compras',
  email_engenharia: 'E-mail Engenharia',
}

export interface ClienteInfo {
  nome: string; empresa: string; nome_fantasia: string; cnpj: string; telefone: string; telefone_is_whatsapp: boolean; email: string
  tipo_pessoa: 'pf' | 'pj'
  perfil_comprador: string
  whatsapp: string
  cargo: string
  cargo_outro: string
  inscricao_estadual: string
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string
  endereco: string
  email_nf: string
  contatos: { tipo: ContatoTipo; valor: string }[]
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

interface PerfilComprador {
  id: number; nome: string; descricao: string | null
  mostrar_ie: boolean; mostrar_contato: boolean; mostrar_contatos_adicionais: boolean
}

export interface ClienteFormProps {
  cliente: ClienteInfo
  setCliente: React.Dispatch<React.SetStateAction<ClienteInfo>>
  styles: Record<string, string>
}

// ── Constants ────────────────────────────────────────────────────────────────

const CARGOS = [
  'Comprador(a)', 'Diretor(a)', 'Engenheiro(a)', 'Gerente', 'Proprietário(a)',
  'Responsável Técnico', 'Financeiro', 'Administrativo', 'Arquiteto(a)', 'Síndico(a)', 'Outro',
]

// Perfis padrão (fallback quando tabela não existe ou está vazia)
const PERFIS_DEFAULT: PerfilComprador[] = [
  { id: 0, nome: 'revendedor', descricao: 'Revendedor / Distribuidor', mostrar_ie: true, mostrar_contato: true, mostrar_contatos_adicionais: true },
  { id: 0, nome: 'aplicador', descricao: 'Aplicador / Instalador', mostrar_ie: false, mostrar_contato: true, mostrar_contatos_adicionais: true },
  { id: 0, nome: 'construtora', descricao: 'Construtora', mostrar_ie: false, mostrar_contato: true, mostrar_contatos_adicionais: true },
  { id: 0, nome: 'dono_obra', descricao: 'Dono de Obra / Uso Próprio', mostrar_ie: false, mostrar_contato: false, mostrar_contatos_adicionais: false },
  { id: 0, nome: 'especificador', descricao: 'Especificador (Arq. / Eng.)', mostrar_ie: false, mostrar_contato: true, mostrar_contatos_adicionais: true },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function ClienteForm({ cliente, setCliente, styles }: ClienteFormProps) {
  const [buscaCliente, setBuscaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<ClienteResult[]>([])
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [showDropCliente, setShowDropCliente] = useState(false)
  const [perfis, setPerfis] = useState<PerfilComprador[]>(PERFIS_DEFAULT)

  useEffect(() => {
    supabaseAdmin.from('perfis_comprador').select('*').eq('ativo', true).order('ordem').then(({ data }) => {
      if (data && data.length > 0) setPerfis(data as PerfilComprador[])
    })
  }, [])

  const perfilSel = perfis.find(p => p.nome === cliente.perfil_comprador)
  const isPJ = cliente.tipo_pessoa === 'pj'
  const showIE = isPJ && (perfilSel?.mostrar_ie ?? false)
  const showContato = isPJ ? (perfilSel?.mostrar_contato ?? true) : false
  const showContatosAdicionais = isPJ ? (perfilSel?.mostrar_contatos_adicionais ?? true) : false

  useEffect(() => {
    if (buscaCliente.length < 2) { setResultadosCliente([]); return }
    const t = setTimeout(async () => {
      setLoadingCliente(true)
      const termo = buscaCliente.trim()
      const soDigitos = termo.replace(/\D/g, '')
      const isCnpj = soDigitos.length >= 8 && soDigitos.length <= 14 && /^\d+$/.test(soDigitos)
      let query = supabaseAdmin
        .from('prospeccao')
        .select('cnpj, razao_social, telefone1, email, endereco, bairro, cidade, uf, cep, cliente_ativo')
      if (isCnpj) {
        query = query.like('cnpj', `${soDigitos}%`)
      } else {
        query = query.ilike('razao_social', `%${termo}%`)
      }
      const { data: pros } = await query.limit(10)
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

      {/* ── 0. Busca + Tipo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isPJ ? '1fr 140px 160px' : '1fr 140px', gap: 6, alignItems: 'end' }}>
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
        <div className={styles.fg}>
          <label>Tipo</label>
          <select className={styles.input} value={cliente.tipo_pessoa} onChange={e => setCliente(c => ({ ...c, tipo_pessoa: e.target.value as 'pf' | 'pj', cnpj: '', perfil_comprador: '' }))}>
            <option value="pj">Pessoa Jurídica</option>
            <option value="pf">Pessoa Física</option>
          </select>
        </div>
        {isPJ && (
          <div className={styles.fg}>
            <label>Perfil</label>
            <select className={styles.input} value={cliente.perfil_comprador} onChange={e => setCliente(c => ({ ...c, perfil_comprador: e.target.value }))}>
              <option value="">— Selecionar —</option>
              {perfis.map(p => <option key={p.nome} value={p.nome}>{p.descricao || p.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── 1. Identificação ── */}
      {isPJ ? (
        <div style={{ display: 'grid', gridTemplateColumns: showIE ? '1fr 1fr 1fr 160px' : '1fr 1fr 1fr', gap: 6 }}>
          <div className={styles.fg}><label>Razão Social *</label><input className={styles.input} value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))} placeholder="Nome jurídico oficial" /></div>
          <div className={styles.fg}><label>Nome Fantasia</label><input className={styles.input} value={cliente.nome_fantasia} onChange={e => setCliente(c => ({ ...c, nome_fantasia: e.target.value }))} placeholder="Nome comercial" /></div>
          <div className={styles.fg}><label>CNPJ *</label><input className={styles.input} value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: maskCNPJ(e.target.value) }))} placeholder="00.000.000/0000-00" maxLength={18} /></div>
          {showIE && <div className={styles.fg}><label>Insc. Estadual</label><input className={styles.input} value={cliente.inscricao_estadual} onChange={e => setCliente(c => ({ ...c, inscricao_estadual: maskIE(e.target.value) }))} placeholder="000.000.000.000" maxLength={18} /></div>}
        </div>
      ) : (
        <div className={styles.row2}>
          <div className={styles.fg}><label>Nome completo *</label><input className={styles.input} value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))} placeholder="Nome completo" /></div>
          <div className={styles.fg}><label>CPF</label><input className={styles.input} value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: maskCPF(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} /></div>
        </div>
      )}

      {/* ── 2. Endereço ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6 }}>
        <div className={styles.fg}>
          <label>CEP</label>
          <input className={styles.input} value={cliente.cep} maxLength={9}
            onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'principal') }}
            placeholder="00000-000" />
        </div>
        <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.logradouro} onChange={e => setCliente(c => ({ ...c, logradouro: e.target.value }))} placeholder="Rua / Av. / Alameda..." /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 50px', gap: 6 }}>
        <div className={styles.fg}><label>Nº</label><input className={styles.input} value={cliente.numero} onChange={e => setCliente(c => ({ ...c, numero: e.target.value }))} /></div>
        <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.complemento} onChange={e => setCliente(c => ({ ...c, complemento: e.target.value }))} placeholder="Sala, Bloco..." /></div>
        <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.bairro} onChange={e => setCliente(c => ({ ...c, bairro: e.target.value }))} /></div>
        <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.cidade} onChange={e => setCliente(c => ({ ...c, cidade: e.target.value }))} /></div>
        <div className={styles.fg}><label>UF</label><input className={styles.input} value={cliente.uf} onChange={e => setCliente(c => ({ ...c, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} placeholder="MG" /></div>
      </div>
      {cliente.endereco && !cliente.logradouro && (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          ℹ️ Legado: {cliente.endereco}
        </div>
      )}

      {/* Endereço de entrega */}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={cliente.ent_diferente} onChange={e => setCliente(c => ({ ...c, ent_diferente: e.target.checked }))} />
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Endereço de entrega diferente</span>
      </label>
      {cliente.ent_diferente && (
        <div style={{ padding: '8px 10px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Local de entrega</div>
          <div className={styles.row3}>
            <div className={styles.fg}><label>Responsável</label><input className={styles.input} value={cliente.ent_responsavel} onChange={e => setCliente(c => ({ ...c, ent_responsavel: e.target.value }))} placeholder="Nome do responsável" /></div>
            <div className={styles.fg}>
              <label>Telefone</label>
              <input className={styles.input} value={cliente.ent_telefone} onChange={e => setCliente(c => ({ ...c, ent_telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
            <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.ent_whatsapp} onChange={e => setCliente(c => ({ ...c, ent_whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6 }}>
            <div className={styles.fg}>
              <label>CEP</label>
              <input className={styles.input} value={cliente.ent_cep} maxLength={9}
                onChange={e => { const v = maskCEP(e.target.value); setCliente(c => ({ ...c, ent_cep: v })); if (v.replace(/\D/g,'').length === 8) buscarCEP(v, 'entrega') }}
                placeholder="00000-000" />
            </div>
            <div className={styles.fg}><label>Logradouro</label><input className={styles.input} value={cliente.ent_logradouro} onChange={e => setCliente(c => ({ ...c, ent_logradouro: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 50px', gap: 6 }}>
            <div className={styles.fg}><label>Nº</label><input className={styles.input} value={cliente.ent_numero} onChange={e => setCliente(c => ({ ...c, ent_numero: e.target.value }))} /></div>
            <div className={styles.fg}><label>Complemento</label><input className={styles.input} value={cliente.ent_complemento} onChange={e => setCliente(c => ({ ...c, ent_complemento: e.target.value }))} /></div>
            <div className={styles.fg}><label>Bairro</label><input className={styles.input} value={cliente.ent_bairro} onChange={e => setCliente(c => ({ ...c, ent_bairro: e.target.value }))} /></div>
            <div className={styles.fg}><label>Cidade</label><input className={styles.input} value={cliente.ent_cidade} onChange={e => setCliente(c => ({ ...c, ent_cidade: e.target.value }))} /></div>
            <div className={styles.fg}><label>UF</label><input className={styles.input} value={cliente.ent_uf} onChange={e => setCliente(c => ({ ...c, ent_uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></div>
          </div>
        </div>
      )}

      {/* ── 3. Contato ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showContato && (
          <div className={styles.row2}>
            <div className={styles.fg}><label>A/C (Responsável)</label><input className={styles.input} value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} placeholder="Nome do contato" /></div>
            <div className={styles.fg}>
              <label>Cargo</label>
              <select className={styles.input} value={cliente.cargo} onChange={e => setCliente(c => ({ ...c, cargo: e.target.value }))}>
                <option value="">— Selecionar —</option>
                {CARGOS.map(c => <option key={c}>{c}</option>)}
              </select>
              {cliente.cargo === 'Outro' && (
                <input className={styles.input} style={{ marginTop: 2 }} placeholder="Especificar" value={cliente.cargo_outro} onChange={e => setCliente(c => ({ ...c, cargo_outro: e.target.value }))} />
              )}
            </div>
          </div>
        )}

        <div className={styles.row3}>
          <div className={styles.fg}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Telefone
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#64748b', fontWeight: 400, cursor: 'pointer' }}>
                <input type="checkbox" checked={cliente.telefone_is_whatsapp} onChange={e => setCliente(c => ({ ...c, telefone_is_whatsapp: e.target.checked, whatsapp: e.target.checked ? c.telefone : c.whatsapp }))} />
                = WhatsApp
              </label>
            </label>
            <input className={styles.input} value={cliente.telefone} onChange={e => setCliente(c => ({ ...c, telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          {!cliente.telefone_is_whatsapp && (
            <div className={styles.fg}><label>WhatsApp</label><input className={styles.input} value={cliente.whatsapp} onChange={e => setCliente(c => ({ ...c, whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
          )}
          <div className={styles.fg}><label>E-mail</label><input className={styles.input} value={cliente.email} onChange={e => setCliente(c => ({ ...c, email: e.target.value }))} /></div>
        </div>

        {/* Contatos adicionais */}
        {showContatosAdicionais && (
          <div>
            {cliente.contatos.length > 0 && (
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Contatos adicionais</div>
            )}
            {cliente.contatos.map((ct, ci) => {
              const isPhone = ct.tipo === 'telefone' || ct.tipo === 'whatsapp'
              return (
                <div key={ci} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 32px', gap: 6, marginBottom: 4 }}>
                  <select className={styles.input} value={ct.tipo} onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], tipo: e.target.value as ContatoTipo }; return { ...c, contatos: cc } })}>
                    {(Object.keys(CONTATO_LABELS) as ContatoTipo[]).map(k => (
                      <option key={k} value={k}>{CONTATO_LABELS[k]}</option>
                    ))}
                  </select>
                  <input className={styles.input} value={ct.valor}
                    onChange={e => setCliente(c => { const cc = [...c.contatos]; cc[ci] = { ...cc[ci], valor: isPhone ? maskPhone(e.target.value) : e.target.value }; return { ...c, contatos: cc } })}
                    placeholder={isPhone ? '(00) 00000-0000' : 'contato@empresa.com'}
                    maxLength={isPhone ? 15 : 120} />
                  <button className={styles.btnRemoveItem} style={{ marginTop: 0 }} onClick={() => setCliente(c => ({ ...c, contatos: c.contatos.filter((_, j) => j !== ci) }))}>✕</button>
                </div>
              )
            })}
            <button className={styles.btnAddItem} style={{ fontSize: '0.72rem', padding: '3px 10px', minHeight: 28 }}
              onClick={() => setCliente(c => ({ ...c, contatos: [...c.contatos, { tipo: 'email_nf', valor: '' }] }))}>
              + Contato adicional
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
