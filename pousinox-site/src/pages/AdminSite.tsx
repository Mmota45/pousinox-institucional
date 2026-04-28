import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminSite.module.css'

// ── IA Helper ──
async function chamarIA(acao: string, params: Record<string, unknown>): Promise<{ resultado: unknown; error?: string }> {
  const { data, error } = await supabaseAdmin.functions.invoke('site-ia', {
    body: { acao, ...params },
  })
  if (error) return { resultado: null, error: error.message }
  if (data?.error) return { resultado: null, error: data.error }
  return { resultado: data?.resultado }
}

// ── Types ──
interface ConfigRow { chave: string; valor: string; descricao: string | null }
interface Contador { id?: number; valor: number; sufixo: string; label: string; ordem: number; ativo: boolean }
interface Depoimento { id?: number; nome: string; avatar_cor: string; texto: string; nota: number; ordem: number; ativo: boolean }
interface Etapa { id?: number; numero: string; titulo: string; descricao: string; ordem: number; ativo: boolean }
interface Faq { id?: number; pergunta: string; resposta: string; categoria: string; ordem: number; ativo: boolean }
interface Video { id?: number; titulo: string; youtube_url: string; secao: string; ordem: number; ativo: boolean }
interface SeoRow { id?: number; rota: string; titulo: string; descricao: string; og_image: string }

type Tab = 'config' | 'contadores' | 'depoimentos' | 'etapas' | 'faq' | 'videos' | 'seo'

const TABS: { key: Tab; label: string }[] = [
  { key: 'config', label: '⚙️ Configurações' },
  { key: 'contadores', label: '🔢 Contadores' },
  { key: 'depoimentos', label: '⭐ Depoimentos' },
  { key: 'etapas', label: '📋 Etapas' },
  { key: 'faq', label: '❓ FAQ' },
  { key: 'videos', label: '🎬 Vídeos' },
  { key: 'seo', label: '🔍 SEO' },
]

export default function AdminSite() {
  const [tab, setTab] = useState<Tab>('config')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Gestão do Site</h1>
          <p className={styles.pageSubtitle}>Gerencie o conteúdo das páginas públicas</p>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={tab === t.key ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <TabConfig showToast={showToast} />}
      {tab === 'contadores' && <TabContadores showToast={showToast} />}
      {tab === 'depoimentos' && <TabDepoimentos showToast={showToast} />}
      {tab === 'etapas' && <TabEtapas showToast={showToast} />}
      {tab === 'faq' && <TabFaq showToast={showToast} />}
      {tab === 'videos' && <TabVideos showToast={showToast} />}
      {tab === 'seo' && <TabSeo showToast={showToast} />}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: Configurações (key-value)
// ═══════════════════════════════════════════
function TabConfig({ showToast }: { showToast: (m: string) => void }) {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabaseAdmin.from('site_config').select('*').order('chave')
    setRows(data || [])
    setEdited({})
  }, [])

  useEffect(() => { load() }, [load])

  function handleChange(chave: string, valor: string) {
    setEdited(prev => ({ ...prev, [chave]: valor }))
  }

  async function salvar() {
    setSaving(true)
    for (const [chave, valor] of Object.entries(edited)) {
      await supabaseAdmin.from('site_config').update({ valor, updated_at: new Date().toISOString() }).eq('chave', chave)
    }
    setSaving(false)
    showToast('Configurações salvas!')
    load()
  }

  const hasChanges = Object.keys(edited).length > 0

  // Agrupar por prefixo da chave
  const GROUPS: { key: string; label: string; prefixes: string[] }[] = [
    { key: 'geral', label: '🌐 Geral', prefixes: ['whatsapp_', 'google_', 'cnpj', 'cidade', 'n8n_'] },
    { key: 'home', label: '🏠 Home', prefixes: ['hero_', 'fabrica_', 'cta_'] },
    { key: 'fixador', label: '🔩 Fixador de Porcelanato', prefixes: ['fixador_'] },
    { key: 'produtos', label: '📦 Produtos', prefixes: ['produtos_'] },
    { key: 'sobre', label: '🏭 Sobre', prefixes: ['sobre_'] },
    { key: 'contato', label: '📞 Contato', prefixes: ['contato_'] },
    { key: 'laser', label: '⚡ Corte a Laser', prefixes: ['laser_'] },
  ]

  function getGroup(chave: string): string {
    for (const g of GROUPS) {
      if (g.prefixes.some(p => chave.startsWith(p))) return g.key
    }
    return 'outros'
  }

  const grouped = rows.reduce<Record<string, ConfigRow[]>>((acc, r) => {
    const g = getGroup(r.chave)
    ;(acc[g] ??= []).push(r)
    return acc
  }, {})

  const allGroups = [...GROUPS]
  if (grouped['outros']?.length) allGroups.push({ key: 'outros', label: '📋 Outros', prefixes: [] })

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ geral: true })
  const [iaLoading, setIaLoading] = useState<string | null>(null)

  function toggleGroup(key: string) {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isTextoCampo = (chave: string, valor: string) => {
    const skip = ['url', 'link', 'maps', 'webhook', 'numero', 'cnpj', 'rating', 'video', 'mensagem', 'telefone', 'endereco', 'horario', 'email', 'cidade']
    return !skip.some(s => chave.toLowerCase().includes(s)) && !/^https?:\/\//.test(valor) && !/^\d+(\.\d+)?$/.test(valor)
  }

  async function melhorarCampo(chave: string, valor: string, pagina: string) {
    if (!valor.trim()) return
    setIaLoading(chave)
    const { resultado, error } = await chamarIA('melhorar_texto', { texto: valor, campo: chave, pagina })
    if (error) { showToast('Erro IA: ' + error) }
    else if (typeof resultado === 'string') { handleChange(chave, resultado); showToast('✨ Texto melhorado — revise antes de salvar') }
    setIaLoading(null)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Configurações do Site</h3>
        {hasChanges && (
          <button className={styles.btnPrimary} onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : '💾 Salvar alterações'}
          </button>
        )}
      </div>

      {allGroups.filter(g => grouped[g.key]?.length).map(g => (
        <div key={g.key} className={styles.configSection}>
          <button className={styles.configSectionHeader} onClick={() => toggleGroup(g.key)}>
            <span className={styles.configSectionTitle}>{g.label}</span>
            <span className={styles.configSectionCount}>{grouped[g.key].length} campos</span>
            <span className={styles.configSectionChevron}>{openGroups[g.key] ? '▾' : '▸'}</span>
          </button>
          {openGroups[g.key] && (
            <div className={styles.configGrid}>
              {grouped[g.key].map(r => (
                <div key={r.chave} className={styles.configItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className={styles.configKey}>{r.chave.replace(/^(whatsapp_|google_|hero_|fabrica_|cta_|fixador_|produtos_|sobre_|contato_|laser_|n8n_)/, '')}</label>
                    {isTextoCampo(r.chave, r.valor) && (
                      <button className={styles.btnIA} disabled={iaLoading === r.chave}
                        onClick={() => melhorarCampo(r.chave, edited[r.chave] ?? r.valor, g.label)}
                        title="Melhorar com IA">
                        {iaLoading === r.chave ? '⏳' : '✨'}
                      </button>
                    )}
                  </div>
                  {r.descricao && <span className={styles.configDesc}>{r.descricao}</span>}
                  {(r.valor?.length || 0) > 80 ? (
                    <textarea
                      className={styles.textarea}
                      value={edited[r.chave] ?? r.valor}
                      onChange={e => handleChange(r.chave, e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <input
                      className={styles.input}
                      value={edited[r.chave] ?? r.valor}
                      onChange={e => handleChange(r.chave, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// Generic CRUD helper
// ═══════════════════════════════════════════
function useCrud<T extends { id?: number }>(
  table: string,
  showToast: (m: string) => void,
  orderCol = 'ordem'
) {
  const [rows, setRows] = useState<T[]>([])
  const [editing, setEditing] = useState<T | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabaseAdmin.from(table).select('*').order(orderCol)
    setRows((data || []) as T[])
  }, [table, orderCol])

  useEffect(() => { load() }, [load])

  async function salvar(item: T) {
    if (item.id) {
      const { id, ...rest } = item
      await supabaseAdmin.from(table).update(rest).eq('id', id)
    } else {
      const { id: _, ...rest } = item
      await supabaseAdmin.from(table).insert(rest)
    }
    showToast('Salvo!')
    setEditing(null)
    load()
  }

  async function remover(id: number) {
    await supabaseAdmin.from(table).delete().eq('id', id)
    showToast('Removido!')
    load()
  }

  async function toggleAtivo(id: number, ativo: boolean) {
    await supabaseAdmin.from(table).update({ ativo: !ativo }).eq('id', id)
    load()
  }

  return { rows, editing, setEditing, salvar, remover, toggleAtivo, load }
}

// ═══════════════════════════════════════════
// Tab: Contadores
// ═══════════════════════════════════════════
function TabContadores({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover, toggleAtivo } = useCrud<Contador>('site_contadores', showToast)
  const [form, setForm] = useState<Contador>({ valor: 0, sufixo: '', label: '', ordem: 0, ativo: true })

  useEffect(() => {
    if (editing) setForm(editing)
  }, [editing])

  function resetForm() {
    setForm({ valor: 0, sufixo: '', label: '', ordem: 0, ativo: true })
    setEditing(null)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Contadores do Hero</h3>
        <button className={styles.btnPrimary} onClick={resetForm}>+ Novo</button>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Valor</label>
          <input className={styles.input} type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: +e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Sufixo</label>
          <input className={styles.input} value={form.sufixo} onChange={e => setForm(f => ({ ...f, sufixo: e.target.value }))} placeholder="+ ou %" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Label</label>
          <input className={styles.input} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Anos de mercado" />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Ordem</label>
          <input className={styles.input} type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} />
        </div>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th>Valor</th><th>Sufixo</th><th>Label</th><th>Ordem</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.valor}</td>
              <td>{r.sufixo}</td>
              <td>{r.label}</td>
              <td>{r.ordem}</td>
              <td><span className={r.ativo ? styles.badgeActive : styles.badgeInactive}>{r.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className={styles.actions}>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => toggleAtivo(r.id!, r.ativo)}>{r.ativo ? '👁️' : '👁️‍🗨️'}</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: Depoimentos
// ═══════════════════════════════════════════
function TabDepoimentos({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover, toggleAtivo } = useCrud<Depoimento>('site_depoimentos', showToast)
  const blank: Depoimento = { nome: '', avatar_cor: '#4285F4', texto: '', nota: 5, ordem: 0, ativo: true }
  const [form, setForm] = useState<Depoimento>(blank)
  const [iaLoadingId, setIaLoadingId] = useState<number | null>(null)
  const [iaPreview, setIaPreview] = useState<{ id: number; original: string; melhorado: string } | null>(null)

  useEffect(() => { if (editing) setForm(editing) }, [editing])

  function resetForm() { setForm(blank); setEditing(null) }

  async function melhorarDepoimento(r: Depoimento) {
    if (!r.id) return
    setIaLoadingId(r.id)
    const { resultado, error } = await chamarIA('melhorar_depoimento', { depoimento: r.texto, nome_cliente: r.nome })
    if (error) { showToast('Erro IA: ' + error) }
    else if (typeof resultado === 'string') { setIaPreview({ id: r.id, original: r.texto, melhorado: resultado }) }
    setIaLoadingId(null)
  }

  async function aplicarMelhoria() {
    if (!iaPreview) return
    await supabaseAdmin.from('site_depoimentos').update({ texto: iaPreview.melhorado }).eq('id', iaPreview.id)
    showToast('✨ Depoimento atualizado!')
    setIaPreview(null)
    // reload
    const { data } = await supabaseAdmin.from('site_depoimentos').select('*').order('ordem')
    if (data) rows.splice(0, rows.length, ...(data as Depoimento[]))
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Depoimentos / Avaliações</h3>
        <button className={styles.btnPrimary} onClick={resetForm}>+ Novo</button>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nome</label>
          <input className={styles.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Cor</label>
          <input type="color" value={form.avatar_cor} onChange={e => setForm(f => ({ ...f, avatar_cor: e.target.value }))} style={{ width: 40, height: 34, border: 'none', cursor: 'pointer' }} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Nota</label>
          <input className={styles.input} type="number" min={1} max={5} value={form.nota} onChange={e => setForm(f => ({ ...f, nota: +e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Ordem</label>
          <input className={styles.input} type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} />
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Texto</label>
          <textarea className={styles.textarea} rows={3} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} />
        </div>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th></th><th>Nome</th><th>Texto</th><th>Nota</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td><span className={styles.colorSwatch} style={{ background: r.avatar_cor }} /></td>
              <td>{r.nome}</td>
              <td>{r.texto.length > 80 ? r.texto.slice(0, 80) + '…' : r.texto}</td>
              <td>{'★'.repeat(r.nota)}</td>
              <td><span className={r.ativo ? styles.badgeActive : styles.badgeInactive}>{r.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className={styles.actions}>
                <button className={styles.btnIA} disabled={iaLoadingId === r.id} onClick={() => melhorarDepoimento(r)} title="Melhorar com IA">
                  {iaLoadingId === r.id ? '⏳' : '✨'}
                </button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => toggleAtivo(r.id!, r.ativo)}>{r.ativo ? '👁️' : '👁️‍🗨️'}</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {iaPreview && (
        <div className={styles.iaPreview}>
          <h4 style={{ margin: '0 0 10px' }}>✨ Sugestão de melhoria</h4>
          <div className={styles.iaCompare}>
            <div><strong>Original:</strong><p>{iaPreview.original}</p></div>
            <div><strong>Melhorado:</strong><p>{iaPreview.melhorado}</p></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className={styles.btnPrimary} onClick={aplicarMelhoria}>✓ Aplicar</button>
            <button className={styles.btnSecondary} onClick={() => setIaPreview(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: Etapas do Processo
// ═══════════════════════════════════════════
function TabEtapas({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover, toggleAtivo } = useCrud<Etapa>('site_etapas', showToast)
  const blank: Etapa = { numero: '', titulo: '', descricao: '', ordem: 0, ativo: true }
  const [form, setForm] = useState<Etapa>(blank)

  useEffect(() => { if (editing) setForm(editing) }, [editing])
  function resetForm() { setForm(blank); setEditing(null) }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Etapas do Processo</h3>
        <button className={styles.btnPrimary} onClick={resetForm}>+ Novo</button>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Número</label>
          <input className={styles.input} value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="01" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Título</label>
          <input className={styles.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className={styles.formGroup} style={{ flex: 2 }}>
          <label className={styles.formLabel}>Descrição</label>
          <input className={styles.input} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Ordem</label>
          <input className={styles.input} type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} />
        </div>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th>Nº</th><th>Título</th><th>Descrição</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.numero}</td>
              <td>{r.titulo}</td>
              <td>{r.descricao}</td>
              <td><span className={r.ativo ? styles.badgeActive : styles.badgeInactive}>{r.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className={styles.actions}>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => toggleAtivo(r.id!, r.ativo)}>{r.ativo ? '👁️' : '👁️‍🗨️'}</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: FAQ
// ═══════════════════════════════════════════
function TabFaq({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover, toggleAtivo, load } = useCrud<Faq>('site_faq', showToast)
  const blank: Faq = { pergunta: '', resposta: '', categoria: 'geral', ordem: 0, ativo: true }
  const [form, setForm] = useState<Faq>(blank)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaFaqs, setIaFaqs] = useState<{ pergunta: string; resposta: string; selecionada: boolean }[]>([])
  const [iaCat, setIaCat] = useState('geral')

  useEffect(() => { if (editing) setForm(editing) }, [editing])
  function resetForm() { setForm(blank); setEditing(null) }

  async function gerarFaqs() {
    setIaLoading(true)
    const { resultado, error } = await chamarIA('gerar_faq', { categoria: iaCat, quantidade: 5 })
    if (error) { showToast('Erro IA: ' + error) }
    else if (Array.isArray(resultado)) {
      setIaFaqs(resultado.map((f: { pergunta: string; resposta: string }) => ({ ...f, selecionada: true })))
    }
    setIaLoading(false)
  }

  async function adicionarSelecionadas() {
    const sel = iaFaqs.filter(f => f.selecionada)
    const maxOrdem = rows.length > 0 ? Math.max(...rows.map(r => r.ordem)) : 0
    for (let i = 0; i < sel.length; i++) {
      await supabaseAdmin.from('site_faq').insert({
        pergunta: sel[i].pergunta, resposta: sel[i].resposta,
        categoria: iaCat, ordem: maxOrdem + i + 1, ativo: true,
      })
    }
    showToast(`✨ ${sel.length} FAQ(s) adicionadas!`)
    setIaFaqs([])
    load()
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Perguntas Frequentes</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className={styles.input} value={iaCat} onChange={e => setIaCat(e.target.value)} style={{ fontSize: '0.82rem', padding: '5px 8px' }}>
            <option value="geral">geral</option>
            <option value="fixador">fixador</option>
            <option value="laser">laser</option>
            <option value="produtos">produtos</option>
          </select>
          <button className={styles.btnIA} onClick={gerarFaqs} disabled={iaLoading} style={{ padding: '5px 12px', fontSize: '0.82rem' }}>
            {iaLoading ? '⏳ Gerando...' : '✨ Gerar FAQs'}
          </button>
          <button className={styles.btnPrimary} onClick={resetForm}>+ Nova</button>
        </div>
      </div>

      {iaFaqs.length > 0 && (
        <div className={styles.iaPreview}>
          <h4 style={{ margin: '0 0 10px' }}>✨ FAQs geradas — selecione as que deseja adicionar</h4>
          {iaFaqs.map((f, i) => (
            <label key={i} className={styles.iaFaqItem}>
              <input type="checkbox" checked={f.selecionada}
                onChange={e => setIaFaqs(prev => prev.map((x, j) => j === i ? { ...x, selecionada: e.target.checked } : x))} />
              <div>
                <strong>{f.pergunta}</strong>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>{f.resposta}</p>
              </div>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className={styles.btnPrimary} onClick={adicionarSelecionadas} disabled={!iaFaqs.some(f => f.selecionada)}>
              ✓ Adicionar {iaFaqs.filter(f => f.selecionada).length} selecionadas
            </button>
            <button className={styles.btnSecondary} onClick={() => setIaFaqs([])}>Cancelar</button>
          </div>
        </div>
      )}

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 2 }}>
          <label className={styles.formLabel}>Pergunta</label>
          <input className={styles.input} value={form.pergunta} onChange={e => setForm(f => ({ ...f, pergunta: e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall} style={{ minWidth: 120 }}>
          <label className={styles.formLabel}>Categoria</label>
          <input className={styles.input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Ordem</label>
          <input className={styles.input} type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} />
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Resposta</label>
          <textarea className={styles.textarea} rows={3} value={form.resposta} onChange={e => setForm(f => ({ ...f, resposta: e.target.value }))} />
        </div>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th>Pergunta</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.pergunta}</td>
              <td>{r.categoria}</td>
              <td><span className={r.ativo ? styles.badgeActive : styles.badgeInactive}>{r.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className={styles.actions}>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => toggleAtivo(r.id!, r.ativo)}>{r.ativo ? '👁️' : '👁️‍🗨️'}</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.filter(r => r.ativo).length > 0 && (
        <>
          <h4 style={{ marginTop: 20, marginBottom: 10 }}>Preview</h4>
          {rows.filter(r => r.ativo).map(r => (
            <div key={r.id} className={styles.faqItem}>
              <div className={styles.faqQuestion}>{r.pergunta}</div>
              <div className={styles.faqAnswer}>{r.resposta}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: Vídeos
// ═══════════════════════════════════════════
function TabVideos({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover, toggleAtivo } = useCrud<Video>('site_videos', showToast)
  const blank: Video = { titulo: '', youtube_url: '', secao: 'fabrica', ordem: 0, ativo: true }
  const [form, setForm] = useState<Video>(blank)

  useEffect(() => { if (editing) setForm(editing) }, [editing])
  function resetForm() { setForm(blank); setEditing(null) }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Vídeos</h3>
        <button className={styles.btnPrimary} onClick={resetForm}>+ Novo</button>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Título</label>
          <input className={styles.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className={styles.formGroup} style={{ flex: 2 }}>
          <label className={styles.formLabel}>URL YouTube (embed)</label>
          <input className={styles.input} value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/embed/..." />
        </div>
        <div className={styles.formGroupSmall} style={{ minWidth: 100 }}>
          <label className={styles.formLabel}>Seção</label>
          <input className={styles.input} value={form.secao} onChange={e => setForm(f => ({ ...f, secao: e.target.value }))} />
        </div>
        <div className={styles.formGroupSmall}>
          <label className={styles.formLabel}>Ordem</label>
          <input className={styles.input} type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: +e.target.value }))} />
        </div>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th>Título</th><th>URL</th><th>Seção</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.titulo}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.youtube_url}</td>
              <td>{r.secao}</td>
              <td><span className={r.ativo ? styles.badgeActive : styles.badgeInactive}>{r.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className={styles.actions}>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => toggleAtivo(r.id!, r.ativo)}>{r.ativo ? '👁️' : '👁️‍🗨️'}</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab: SEO por Página
// ═══════════════════════════════════════════
function TabSeo({ showToast }: { showToast: (m: string) => void }) {
  const { rows, editing, setEditing, salvar, remover } = useCrud<SeoRow>('site_seo', showToast, 'rota')
  const blank: SeoRow = { rota: '', titulo: '', descricao: '', og_image: '' }
  const [form, setForm] = useState<SeoRow>(blank)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaAutoLoading, setIaAutoLoading] = useState(false)
  const [iaAutoResults, setIaAutoResults] = useState<{ rota: string; titulo: string; descricao: string; aplicar: boolean }[]>([])

  useEffect(() => { if (editing) setForm(editing) }, [editing])
  function resetForm() { setForm(blank); setEditing(null) }

  async function gerarSeo() {
    if (!form.rota) { showToast('Preencha a rota primeiro'); return }
    setIaLoading(true)
    // Buscar configs da rota como contexto
    const prefix = form.rota === '/' ? 'hero_' : form.rota.replace(/^\//, '').replace(/-/g, '_') + '_'
    const { data: configs } = await supabaseAdmin.from('site_config').select('chave, valor').like('chave', prefix + '%')
    const conteudo: Record<string, string> = {}
    configs?.forEach((c: { chave: string; valor: string }) => { conteudo[c.chave] = c.valor })

    const { resultado, error } = await chamarIA('gerar_seo', { rota: form.rota, conteudo_pagina: conteudo })
    if (error) { showToast('Erro IA: ' + error) }
    else if (resultado && typeof resultado === 'object') {
      const r = resultado as { titulo?: string; descricao?: string }
      setForm(f => ({ ...f, titulo: r.titulo ?? f.titulo, descricao: r.descricao ?? f.descricao }))
      showToast('✨ SEO gerado — revise antes de salvar')
    }
    setIaLoading(false)
  }

  async function autoSeoAll() {
    setIaAutoLoading(true)
    const results: typeof iaAutoResults = []
    for (const row of rows) {
      const prefix = row.rota === '/' ? 'hero_' : row.rota.replace(/^\//, '').replace(/-/g, '_') + '_'
      const { data: configs } = await supabaseAdmin.from('site_config').select('chave, valor').like('chave', prefix + '%')
      const conteudo: Record<string, string> = {}
      configs?.forEach((c: { chave: string; valor: string }) => { conteudo[c.chave] = c.valor })
      const { resultado } = await chamarIA('gerar_seo', { rota: row.rota, conteudo_pagina: conteudo })
      if (resultado && typeof resultado === 'object') {
        const r = resultado as { titulo?: string; descricao?: string }
        results.push({ rota: row.rota, titulo: r.titulo ?? '', descricao: r.descricao ?? '', aplicar: true })
      }
    }
    setIaAutoResults(results)
    setIaAutoLoading(false)
  }

  async function aplicarAutoSeo() {
    const sel = iaAutoResults.filter(r => r.aplicar)
    for (const r of sel) {
      await supabaseAdmin.from('site_seo').update({ titulo: r.titulo, descricao: r.descricao }).eq('rota', r.rota)
    }
    showToast(`✨ SEO atualizado em ${sel.length} página(s)!`)
    setIaAutoResults([])
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>SEO por Página</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnIA} onClick={autoSeoAll} disabled={iaAutoLoading || rows.length === 0}
            style={{ padding: '5px 12px', fontSize: '0.82rem' }}>
            {iaAutoLoading ? '⏳ Gerando...' : '✨ Auto SEO (todas)'}
          </button>
          <button className={styles.btnPrimary} onClick={resetForm}>+ Nova</button>
        </div>
      </div>

      {iaAutoResults.length > 0 && (
        <div className={styles.iaPreview}>
          <h4 style={{ margin: '0 0 10px' }}>✨ SEO gerado — selecione para aplicar</h4>
          {iaAutoResults.map((r, i) => (
            <label key={i} className={styles.iaFaqItem}>
              <input type="checkbox" checked={r.aplicar}
                onChange={e => setIaAutoResults(prev => prev.map((x, j) => j === i ? { ...x, aplicar: e.target.checked } : x))} />
              <div style={{ flex: 1 }}>
                <strong>{r.rota}</strong>
                <div style={{ fontSize: '0.82rem', color: '#0f172a', marginTop: 4 }}>{r.titulo}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.descricao}</div>
              </div>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className={styles.btnPrimary} onClick={aplicarAutoSeo}>✓ Aplicar {iaAutoResults.filter(r => r.aplicar).length} selecionadas</button>
            <button className={styles.btnSecondary} onClick={() => setIaAutoResults([])}>Cancelar</button>
          </div>
        </div>
      )}

      <div className={styles.formRow}>
        <div className={styles.formGroupSmall} style={{ minWidth: 160 }}>
          <label className={styles.formLabel}>Rota</label>
          <input className={styles.input} value={form.rota} onChange={e => setForm(f => ({ ...f, rota: e.target.value }))} placeholder="/" />
        </div>
        <div className={styles.formGroup} style={{ flex: 2 }}>
          <label className={styles.formLabel}>Título</label>
          <input className={styles.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 2 }}>
          <label className={styles.formLabel}>Descrição</label>
          <textarea className={styles.textarea} rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>OG Image URL</label>
          <input className={styles.input} value={form.og_image} onChange={e => setForm(f => ({ ...f, og_image: e.target.value }))} />
        </div>
        <button className={styles.btnIA} onClick={gerarSeo} disabled={iaLoading} style={{ padding: '7px 14px', alignSelf: 'flex-end' }}>
          {iaLoading ? '⏳' : '✨ SEO'}
        </button>
        <button className={styles.btnPrimary} onClick={() => { salvar(form); resetForm() }}>
          {editing ? 'Atualizar' : 'Adicionar'}
        </button>
        {editing && <button className={styles.btnSecondary} onClick={resetForm}>Cancelar</button>}
      </div>

      <table className={styles.table}>
        <thead><tr><th>Rota</th><th>Título</th><th>Descrição</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td><code>{r.rota}</code></td>
              <td>{r.titulo}</td>
              <td>{r.descricao?.length > 60 ? r.descricao.slice(0, 60) + '…' : r.descricao}</td>
              <td className={styles.actions}>
                <button className={styles.btnSecondary + ' ' + styles.btnSmall} onClick={() => setEditing(r)}>✏️</button>
                <button className={styles.btnDanger + ' ' + styles.btnSmall} onClick={() => remover(r.id!)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
