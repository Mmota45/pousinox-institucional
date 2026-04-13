import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFornecedores.module.css'
import type { Fornecedor, ContatoFornecedor } from '../types/fornecedores'
import {
  FORNECEDOR_VAZIO, CONTATO_VAZIO,
  SEGMENTOS_FORNECEDOR, CATEGORIAS_FORNECEDOR, ESTADOS_BR,
} from '../types/fornecedores'

type Vista = 'lista' | 'form' | 'detalhe'
type AbaForm = 'dados' | 'contatos'

function fmtData(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}

function labelSegmento(s: string) {
  const map: Record<string, string> = {
    distribuidor: 'Distribuidor', fabricante: 'Fabricante',
    servico: 'Serviço', representante: 'Representante', outro: 'Outro',
  }
  return map[s] ?? s
}

function labelCategoria(s: string) {
  const map: Record<string, string> = {
    aco_inox: 'Aço Inox', fixadores: 'Fixadores', corte_laser: 'Corte Laser',
    dobramento: 'Dobramento', solda: 'Solda', acabamento: 'Acabamento',
    embalagem: 'Embalagem', logistica: 'Logística', outros: 'Outros',
  }
  return map[s] ?? s
}

type FormState = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at' | 'importado_csv' | 'qtd_contatos'> & {
  razao_social: string
}

const FORM_VAZIO: FormState = {
  ...FORNECEDOR_VAZIO,
  razao_social: '',
  codigo: null, nome_fantasia: null, cnpj: null,
  segmento: null, categoria: null, cidade: null, estado: null,
  cep: null, endereco: null, telefone: null, email: null,
  site: null, whatsapp: null, observacoes: null,
  prazo_entrega_padrao: null, condicao_pagamento: null,
  ativo: true, preferencial: false,
}

type ContatoLocal = Omit<ContatoFornecedor, 'id' | 'fornecedor_id' | 'created_at'> & { id?: number }

export default function AdminFornecedores() {
  const [vista, setVista] = useState<Vista>('lista')
  const [abaForm, setAbaForm] = useState<AbaForm>('dados')

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [atual, setAtual] = useState<Fornecedor | null>(null)
  const [contatos, setContatos] = useState<ContatoFornecedor[]>([])

  const [form, setForm] = useState<FormState>({ ...FORM_VAZIO })
  const [contatosForm, setContatosForm] = useState<ContatoLocal[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  // ── Carregar lista ─────────────────────────────────────────────────────────
  const carregarLista = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('fornecedores')
      .select('*, qtd_contatos:contatos_fornecedor(count)')
      .order('razao_social')
    setFornecedores((data ?? []).map((f: Fornecedor & { qtd_contatos: { count: number }[] }) => ({
      ...f,
      qtd_contatos: f.qtd_contatos?.[0]?.count ?? 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const lista = fornecedores.filter(f => {
    const q = busca.toLowerCase()
    const matchBusca = !q ||
      f.razao_social.toLowerCase().includes(q) ||
      (f.nome_fantasia ?? '').toLowerCase().includes(q) ||
      (f.cnpj ?? '').includes(q) ||
      (f.cidade ?? '').toLowerCase().includes(q)
    const matchSeg  = !filtroSegmento  || f.segmento  === filtroSegmento
    const matchCat  = !filtroCategoria || f.categoria === filtroCategoria
    const matchAtivo = filtroAtivo === 'todos' || (filtroAtivo === 'ativo' ? f.ativo : !f.ativo)
    return matchBusca && matchSeg && matchCat && matchAtivo
  })

  // ── Abrir form ─────────────────────────────────────────────────────────────
  function abrirNovo() {
    setAtual(null)
    setForm({ ...FORM_VAZIO })
    setContatosForm([])
    setAbaForm('dados')
    setErro(null)
    setVista('form')
  }

  async function abrirEditar(f: Fornecedor) {
    setAtual(f)
    setForm({
      codigo: f.codigo, razao_social: f.razao_social, nome_fantasia: f.nome_fantasia,
      cnpj: f.cnpj, segmento: f.segmento, categoria: f.categoria,
      cidade: f.cidade, estado: f.estado, cep: f.cep, endereco: f.endereco,
      telefone: f.telefone, email: f.email, site: f.site, whatsapp: f.whatsapp,
      ativo: f.ativo, preferencial: f.preferencial, observacoes: f.observacoes,
      prazo_entrega_padrao: f.prazo_entrega_padrao, condicao_pagamento: f.condicao_pagamento,
    })
    const { data } = await supabaseAdmin
      .from('contatos_fornecedor').select('*').eq('fornecedor_id', f.id).order('principal', { ascending: false })
    setContatosForm((data ?? []).map((c: ContatoFornecedor) => ({
      id: c.id, nome: c.nome, cargo: c.cargo, telefone: c.telefone,
      whatsapp: c.whatsapp, email: c.email, principal: c.principal,
    })))
    setAbaForm('dados')
    setErro(null)
    setVista('form')
  }

  async function abrirDetalhe(f: Fornecedor) {
    setAtual(f)
    const { data } = await supabaseAdmin
      .from('contatos_fornecedor').select('*').eq('fornecedor_id', f.id).order('principal', { ascending: false })
    setContatos((data ?? []) as ContatoFornecedor[])
    setVista('detalhe')
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.razao_social.trim()) { setErro('Razão social é obrigatória.'); return }
    setSalvando(true); setErro(null)

    const payload = {
      codigo:               form.codigo?.trim() || null,
      razao_social:         form.razao_social.trim(),
      nome_fantasia:        form.nome_fantasia?.trim() || null,
      cnpj:                 form.cnpj?.replace(/\D/g, '') || null,
      segmento:             form.segmento || null,
      categoria:            form.categoria || null,
      cidade:               form.cidade?.trim() || null,
      estado:               form.estado || null,
      cep:                  form.cep?.replace(/\D/g, '') || null,
      endereco:             form.endereco?.trim() || null,
      telefone:             form.telefone?.trim() || null,
      email:                form.email?.trim() || null,
      site:                 form.site?.trim() || null,
      whatsapp:             form.whatsapp?.trim() || null,
      ativo:                form.ativo,
      preferencial:         form.preferencial,
      observacoes:          form.observacoes?.trim() || null,
      prazo_entrega_padrao: form.prazo_entrega_padrao || null,
      condicao_pagamento:   form.condicao_pagamento?.trim() || null,
    }

    let fornecedorId: number

    if (atual) {
      const { error } = await supabaseAdmin.from('fornecedores').update(payload).eq('id', atual.id)
      if (error) { setErro(error.message); setSalvando(false); return }
      fornecedorId = atual.id
    } else {
      const { data, error } = await supabaseAdmin.from('fornecedores').insert(payload).select('id').single()
      if (error || !data) { setErro(error?.message ?? 'Erro ao criar.'); setSalvando(false); return }
      fornecedorId = data.id
    }

    // Salvar contatos: remove todos e reinsere
    await supabaseAdmin.from('contatos_fornecedor').delete().eq('fornecedor_id', fornecedorId)
    const contRows = contatosForm
      .filter(c => c.nome.trim())
      .map(c => ({
        fornecedor_id: fornecedorId,
        nome:      c.nome.trim(),
        cargo:     c.cargo?.trim() || null,
        telefone:  c.telefone?.trim() || null,
        whatsapp:  c.whatsapp?.trim() || null,
        email:     c.email?.trim() || null,
        principal: c.principal,
      }))
    if (contRows.length > 0) {
      await supabaseAdmin.from('contatos_fornecedor').insert(contRows)
    }

    setSalvando(false)
    await carregarLista()
    const { data: fAtual } = await supabaseAdmin.from('fornecedores').select('*').eq('id', fornecedorId).single()
    if (fAtual) abrirDetalhe(fAtual as Fornecedor)
    else setVista('lista')
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function excluir(f: Fornecedor, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir "${f.razao_social}"?\nTodos os contatos vinculados serão removidos.`)) return
    await supabaseAdmin.from('fornecedores').delete().eq('id', f.id)
    await carregarLista()
  }

  // ── Contatos helpers ───────────────────────────────────────────────────────
  function addContato() {
    setContatosForm(prev => [...prev, { ...CONTATO_VAZIO }])
  }
  function updateContato(idx: number, field: keyof ContatoLocal, val: string | boolean) {
    setContatosForm(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }
  function removeContato(idx: number) {
    setContatosForm(prev => prev.filter((_, i) => i !== idx))
  }
  function setPrincipal(idx: number) {
    setContatosForm(prev => prev.map((c, i) => ({ ...c, principal: i === idx })))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: LISTA
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>Cadastro central de fornecedores e contatos</div>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNovo}>+ Novo Fornecedor</button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.buscaInput}
          placeholder="Buscar por nome, CNPJ ou cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className={styles.selectFiltro} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
          <option value="">Todos os segmentos</option>
          {SEGMENTOS_FORNECEDOR.map(s => <option key={s} value={s}>{labelSegmento(s)}</option>)}
        </select>
        <select className={styles.selectFiltro} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{labelCategoria(c)}</option>)}
        </select>
        <select className={styles.selectFiltro} value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value as typeof filtroAtivo)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : lista.length === 0 ? (
          <div className={styles.vazio}>Nenhum fornecedor encontrado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Razão Social</th>
                <th>Segmento</th>
                <th>Categoria</th>
                <th>Cidade/UF</th>
                <th>Contatos</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(f => (
                <tr key={f.id} onClick={() => abrirDetalhe(f)}>
                  <td>
                    <div className={styles.nomeCell}>
                      <span className={styles.razaoSocial}>{f.razao_social}</span>
                      {f.nome_fantasia && <span className={styles.nomeFantasia}>{f.nome_fantasia}</span>}
                      {f.preferencial && <span className={styles.badgePreferencial}>⭐ Preferencial</span>}
                    </div>
                  </td>
                  <td>{f.segmento ? <span className={styles.badge}>{labelSegmento(f.segmento)}</span> : <span className={styles.vazio}>—</span>}</td>
                  <td>{f.categoria ? <span className={styles.badgeCat}>{labelCategoria(f.categoria)}</span> : <span className={styles.vazio}>—</span>}</td>
                  <td><span className={styles.cidade}>{[f.cidade, f.estado].filter(Boolean).join('/') || '—'}</span></td>
                  <td><span className={styles.numBadge}>{f.qtd_contatos ?? 0} contato{(f.qtd_contatos ?? 0) !== 1 ? 's' : ''}</span></td>
                  <td>
                    <span className={f.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td><span className={styles.data}>{fmtData(f.created_at)}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                      onClick={e => excluir(f, e)} title="Excluir">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: DETALHE
  // ══════════════════════════════════════════════════════════════════════════
  if (vista === 'detalhe' && atual) return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>Detalhe do fornecedor</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Lista</button>
          <button className={styles.btnPrimary} onClick={() => abrirEditar(atual)}>✏️ Editar</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.detalheHeader}>
          <div>
            <div className={styles.detalheTitulo}>{atual.razao_social}</div>
            {atual.nome_fantasia && <div className={styles.detalheSubtitulo}>{atual.nome_fantasia}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {atual.preferencial && <span className={styles.badgePreferencial}>⭐ Preferencial</span>}
            {atual.segmento && <span className={styles.badge}>{labelSegmento(atual.segmento)}</span>}
            {atual.categoria && <span className={styles.badgeCat}>{labelCategoria(atual.categoria)}</span>}
            <span className={atual.ativo ? styles.badgeAtivo : styles.badgeInativo}>
              {atual.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        <div className={styles.detalheGrid}>
          <div className={styles.detalheSection}>
            <div className={styles.detalheSectionTitle}>Dados Cadastrais</div>
            {atual.cnpj && <div className={styles.detalheField}><span>CNPJ</span><span>{atual.cnpj}</span></div>}
            {atual.telefone && <div className={styles.detalheField}><span>Telefone</span><span>{atual.telefone}</span></div>}
            {atual.whatsapp && <div className={styles.detalheField}><span>WhatsApp</span><span>{atual.whatsapp}</span></div>}
            {atual.email && <div className={styles.detalheField}><span>E-mail</span><span>{atual.email}</span></div>}
            {atual.site && <div className={styles.detalheField}><span>Site</span><a href={atual.site} target="_blank" rel="noreferrer">{atual.site}</a></div>}
            {(atual.cidade || atual.estado) && <div className={styles.detalheField}><span>Cidade</span><span>{[atual.cidade, atual.estado].filter(Boolean).join(' — ')}</span></div>}
            {atual.endereco && <div className={styles.detalheField}><span>Endereço</span><span>{atual.endereco}</span></div>}
          </div>

          <div className={styles.detalheSection}>
            <div className={styles.detalheSectionTitle}>Condições Comerciais</div>
            {atual.prazo_entrega_padrao != null && <div className={styles.detalheField}><span>Prazo padrão</span><span>{atual.prazo_entrega_padrao} dias</span></div>}
            {atual.condicao_pagamento && <div className={styles.detalheField}><span>Pagamento</span><span>{atual.condicao_pagamento}</span></div>}
            {atual.observacoes && <div className={styles.detalheField} style={{ alignItems: 'flex-start' }}><span>Obs.</span><span style={{ whiteSpace: 'pre-wrap' }}>{atual.observacoes}</span></div>}

            {/* Placeholder Fase 2 */}
            <div className={styles.fase2Placeholder}>
              <span>🔩 Materiais vinculados</span>
              <span className={styles.fase2Tag}>Fase 2</span>
            </div>
          </div>
        </div>

        {/* Contatos */}
        <div className={styles.contatosSection}>
          <div className={styles.detalheSectionTitle}>Contatos</div>
          {contatos.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.86rem' }}>Nenhum contato cadastrado.</div>
          ) : (
            <div className={styles.contatosGrid}>
              {contatos.map(c => (
                <div key={c.id} className={`${styles.contatoCard} ${c.principal ? styles.contatoPrincipal : ''}`}>
                  {c.principal && <span className={styles.contatoTag}>Principal</span>}
                  <div className={styles.contatoNome}>{c.nome}</div>
                  {c.cargo && <div className={styles.contatoCargo}>{c.cargo}</div>}
                  <div className={styles.contatoInfo}>
                    {c.telefone && <span>📞 {c.telefone}</span>}
                    {c.whatsapp && <span>💬 {c.whatsapp}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: FORM
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>🏭 Hub de Fornecedores</div>
          <div className={styles.pageSubtitle}>{atual ? `Editando ${atual.razao_social}` : 'Novo Fornecedor'}</div>
        </div>
        <button className={styles.btnSecondary} onClick={() => setVista(atual ? 'detalhe' : 'lista')}>← Cancelar</button>
      </div>

      <div className={styles.card}>
        <div className={styles.abas}>
          {(['dados', 'contatos'] as AbaForm[]).map(a => (
            <button key={a} className={`${styles.aba} ${abaForm === a ? styles.abaAtiva : ''}`}
              onClick={() => setAbaForm(a)}>
              {a === 'dados' ? '🏭 Dados do Fornecedor' : `👤 Contatos (${contatosForm.length})`}
            </button>
          ))}
        </div>

        {erro && <div className={styles.erroMsg}>{erro}</div>}

        {/* ── ABA: DADOS ── */}
        {abaForm === 'dados' && (
          <div className={styles.formBody}>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Razão Social *</label>
                <input className={styles.formInput} value={form.razao_social}
                  onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
                  placeholder="Nome completo da empresa" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome Fantasia</label>
                <input className={styles.formInput} value={form.nome_fantasia ?? ''}
                  onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))}
                  placeholder="Como é conhecido no mercado" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CNPJ</label>
                <input className={styles.formInput} value={form.cnpj ?? ''}
                  onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00" maxLength={18} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Código interno</label>
                <input className={styles.formInput} value={form.codigo ?? ''}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="Ref. para importação CSV" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Segmento</label>
                <select className={styles.formSelect} value={form.segmento ?? ''}
                  onChange={e => setForm(f => ({ ...f, segmento: e.target.value || null }))}>
                  <option value="">Selecione…</option>
                  {SEGMENTOS_FORNECEDOR.map(s => <option key={s} value={s}>{labelSegmento(s)}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Categoria de Material</label>
                <select className={styles.formSelect} value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}>
                  <option value="">Selecione…</option>
                  {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{labelCategoria(c)}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Telefone</label>
                <input className={styles.formInput} value={form.telefone ?? ''}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(00) 0000-0000" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>WhatsApp</label>
                <input className={styles.formInput} value={form.whatsapp ?? ''}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="(00) 90000-0000" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>E-mail</label>
                <input className={styles.formInput} type="email" value={form.email ?? ''}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contato@empresa.com.br" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Site</label>
                <input className={styles.formInput} value={form.site ?? ''}
                  onChange={e => setForm(f => ({ ...f, site: e.target.value }))}
                  placeholder="https://..." />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cidade</label>
                <input className={styles.formInput} value={form.cidade ?? ''}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estado</label>
                <select className={styles.formSelect} value={form.estado ?? ''}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value || null }))}>
                  <option value="">UF…</option>
                  {ESTADOS_BR.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CEP</label>
                <input className={styles.formInput} value={form.cep ?? ''}
                  onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                  placeholder="00000-000" maxLength={9} />
              </div>
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Endereço</label>
                <input className={styles.formInput} value={form.endereco ?? ''}
                  onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                  placeholder="Rua, número, bairro" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Prazo de entrega padrão (dias)</label>
                <input className={styles.formInput} type="number" min="0"
                  value={form.prazo_entrega_padrao ?? ''}
                  onChange={e => setForm(f => ({ ...f, prazo_entrega_padrao: e.target.value ? parseInt(e.target.value) : null }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Condição de pagamento</label>
                <input className={styles.formInput} value={form.condicao_pagamento ?? ''}
                  onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
                  placeholder="Ex: 30 dias, à vista" />
              </div>

              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel}>Observações</label>
                <textarea className={styles.formTextarea} rows={3} value={form.observacoes ?? ''}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Notas internas, condições especiais…" />
              </div>

              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={form.ativo}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    Fornecedor ativo
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={form.preferencial}
                      onChange={e => setForm(f => ({ ...f, preferencial: e.target.checked }))} />
                    ⭐ Marcar como preferencial
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: CONTATOS ── */}
        {abaForm === 'contatos' && (
          <div className={styles.formBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contatosForm.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.86rem', padding: '12px 0' }}>
                  Nenhum contato adicionado.
                </div>
              )}
              {contatosForm.map((c, idx) => (
                <div key={idx} className={`${styles.contatoFormCard} ${c.principal ? styles.contatoPrincipalForm : ''}`}>
                  <div className={styles.contatoFormHeader}>
                    <span className={styles.contatoFormNum}>Contato {idx + 1}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label className={styles.checkboxLabel} style={{ fontSize: '0.82rem' }}>
                        <input type="checkbox" checked={c.principal}
                          onChange={() => setPrincipal(idx)} />
                        Principal
                      </label>
                      <button className={styles.btnDanger} style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                        onClick={() => removeContato(idx)}>✕</button>
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Nome *</label>
                      <input className={styles.formInput} value={c.nome}
                        onChange={e => updateContato(idx, 'nome', e.target.value)}
                        placeholder="Nome completo" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Cargo</label>
                      <input className={styles.formInput} value={c.cargo ?? ''}
                        onChange={e => updateContato(idx, 'cargo', e.target.value)}
                        placeholder="Ex: Vendedor, Gerente" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Telefone</label>
                      <input className={styles.formInput} value={c.telefone ?? ''}
                        onChange={e => updateContato(idx, 'telefone', e.target.value)}
                        placeholder="(00) 0000-0000" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>WhatsApp</label>
                      <input className={styles.formInput} value={c.whatsapp ?? ''}
                        onChange={e => updateContato(idx, 'whatsapp', e.target.value)}
                        placeholder="(00) 90000-0000" />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                      <label className={styles.formLabel}>E-mail</label>
                      <input className={styles.formInput} type="email" value={c.email ?? ''}
                        onChange={e => updateContato(idx, 'email', e.target.value)}
                        placeholder="contato@empresa.com.br" />
                    </div>
                  </div>
                </div>
              ))}
              <button className={styles.btnSecondary} style={{ alignSelf: 'flex-start' }}
                onClick={addContato}>
                + Adicionar Contato
              </button>
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={() => setVista(atual ? 'detalhe' : 'lista')}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : atual ? 'Salvar Alterações' : 'Criar Fornecedor'}
          </button>
        </div>
      </div>
    </div>
  )
}
