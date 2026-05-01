/**
 * AdminFixadores — CRUD de modelos de fixadores, regras de cálculo e consumíveis
 * Rota: /admin/fixadores · Permissão: orcamento
 */

import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'
import styles from './AdminOrcamento.module.css'
import fx from './AdminFixadores.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface Modelo {
  id: number
  nome: string
  material: string
  espessura_mm: number
  largura_mm: number | null
  comprimento_mm: number | null
  abertura_aba_mm: number | null
  obs_tecnica: string | null
  imagem_url: string | null
  possui_laudo: boolean
  ativo: boolean
  preco_unitario: number | null
}

interface Regra {
  id: number
  modelo_id: number | null
  nome: string
  lado_max_cm: number | null
  area_max_cm2: number | null
  peso_max_kg: number | null
  fixadores_por_peca: number
  exige_revisao: boolean
  prioridade: number
}

interface Consumivel {
  id: number
  nome: string
  tipo: string
  unidade: string
  proporcao_por: number
  ordem: number
  preco_unitario: number | null
}

type Aba = 'modelos' | 'regras' | 'consumiveis' | 'leads'

interface Lead {
  id: number
  nome: string
  whatsapp: string
  email: string | null
  empresa: string | null
  cep: string | null
  endereco: string | null
  verificado: boolean
  calculos: number
  ultimo_calculo: string | null
  criado_em: string
}

const MODELO_VAZIO: Omit<Modelo, 'id'> = { nome: '', material: 'Aço Inox 304', espessura_mm: 0.8, largura_mm: 40, comprimento_mm: 120, abertura_aba_mm: 5, obs_tecnica: '', imagem_url: null, possui_laudo: false, ativo: true, preco_unitario: null }
const REGRA_VAZIA: Omit<Regra, 'id'> = { modelo_id: null, nome: '', lado_max_cm: null, area_max_cm2: null, peso_max_kg: null, fixadores_por_peca: 2, exige_revisao: false, prioridade: 10 }
const CONSUMIVEL_VAZIO: Omit<Consumivel, 'id'> = { nome: '', tipo: 'consumivel', unidade: 'UN', proporcao_por: 1, ordem: 1, preco_unitario: null }

export default function AdminFixadores() {
  const [aba, setAba] = useState<Aba>('modelos')
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [regras, setRegras] = useState<Regra[]>([])
  const [consumiveis, setConsumiveis] = useState<Consumivel[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(4)

  // Form state
  const [editModelo, setEditModelo] = useState<Partial<Modelo> | null>(null)
  const [editRegra, setEditRegra] = useState<Partial<Regra> | null>(null)
  const [editConsumivel, setEditConsumivel] = useState<Partial<Consumivel> | null>(null)
  const [saving, setSaving] = useState(false)
  const [gerandoDesc, setGerandoDesc] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { carregarTudo() }, [])

  async function gerarDescricaoIA() {
    if (!editModelo) return
    setGerandoDesc(true)
    try {
      const prompt = `Gere um título SEO e uma descrição técnica-comercial para este fixador de porcelanato:
- Nome atual: ${editModelo.nome || '(não definido)'}
- Material: ${editModelo.material || 'Aço Inox'}
- Espessura: ${editModelo.espessura_mm || '—'} mm
- Largura: ${editModelo.largura_mm || '—'} mm
- Comprimento: ${editModelo.comprimento_mm || '—'} mm
- Abertura da aba: ${editModelo.abertura_aba_mm || '—'} mm

Regras:
1. TÍTULO: COMEÇAR com "Fixador de Porcelanato" + diferencial técnico (material, aplicação). Máximo 60 caracteres. Formato: "Fixador de Porcelanato [Diferencial] — [Aplicação]". O título NÃO deve mencionar a abertura da aba — o mesmo título serve para variantes 5mm e 11mm do mesmo material.
2. DESCRIÇÃO: máximo 2 frases curtas. NÃO repetir informações que já aparecem no card (material, abertura, laudo). Focar APENAS em: (a) aplicação recomendada e (b) faixa de espessura de revestimento compatível (5mm = placas de 5-8mm, 11mm = placas de 9-14mm). NÃO usar palavras como "ancoragem mecânica", "aço inox" ou mencionar o fabricante — essas informações já estão visíveis no card.
3. Use APENAS as dimensões informadas acima. Se um campo estiver "—" NÃO invente valor.
4. Tom direto e objetivo — sem marketing excessivo
5. NUNCA invente dados, certificações, normas ou números que não foram fornecidos
6. Exemplo de descrição ideal: "Ideal para fachadas, áreas externas e ambientes sujeitos a variação térmica. Compatível com revestimentos de 5 a 8 mm de espessura."

Responda EXATAMENTE neste formato (sem aspas):
TITULO: ...
DESCRICAO: ...`
      const { data, error } = await supabaseAdmin.functions.invoke('ai-hub', {
        body: {
          action: 'chat',
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `Você é um redator técnico-comercial especializado em SEO para produtos industriais.
CONTEXTO TÉCNICO DO PRODUTO:
- Fixador = insert metálico de ancoragem mecânica complementar à argamassa colante
- NÃO substitui argamassa — é segunda linha de segurança contra desprendimento
- "Abertura da aba" = espessura da placa cerâmica compatível (5mm = placas de 5-8mm, 11mm = placas de 9-14mm). NÃO é sobre facilidade de instalação
- Aplicação: fachadas externas, revestimentos de grande formato, áreas sujeitas a variação térmica
- Fixado com bucha prego na alvenaria, oculto após instalação
Responda exatamente no formato solicitado.` },
            { role: 'user', content: prompt },
          ],
        },
      })
      if (error || !data?.ok) {
        alert('Erro IA: ' + (data?.error || error?.message || 'Erro desconhecido'))
      } else if (data?.response) {
        const resp = data.response.trim()
        console.log('IA resp bruta:', resp)
        const tituloMatch = resp.match(/T[IÍ]TULO:\s*(.+)/i)
        const descMatch = resp.match(/DESCRI[CÇ][AÃ]O:\s*(.+)/i)
        setEditModelo(prev => {
          if (!prev) return prev
          return {
            ...prev,
            nome: tituloMatch?.[1]?.trim() || prev.nome,
            obs_tecnica: descMatch?.[1]?.trim() || prev.obs_tecnica,
          }
        })
      }
    } catch (e) {
      console.error('Erro IA:', e)
      alert('Erro ao chamar IA: ' + (e as Error).message)
    }
    setGerandoDesc(false)
  }

  async function uploadImagem(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `modelos/${Date.now()}.${ext}`
      const { error } = await supabaseAdmin.storage.from('fixadores').upload(path, file, { upsert: true })
      if (error) { alert('Erro upload: ' + error.message); return }
      const { data: urlData } = supabaseAdmin.storage.from('fixadores').getPublicUrl(path)
      setEditModelo(prev => prev ? { ...prev, imagem_url: urlData.publicUrl } : prev)
    } catch (e) {
      alert('Erro: ' + (e as Error).message)
    }
    setUploading(false)
  }

  async function carregarTudo() {
    setLoading(true)
    lp.reset()

    const m = await supabaseAdmin.from('fixador_modelos').select('*').order('id')
    setModelos(m.data ?? []); lp.step()

    const r = await supabaseAdmin.from('fixador_regras_calculo').select('*').order('prioridade')
    setRegras(r.data ?? []); lp.step()

    const c = await supabaseAdmin.from('fixador_consumiveis').select('*').order('ordem')
    setConsumiveis(c.data ?? []); lp.step()

    const l = await supabaseAdmin.from('calculadora_leads').select('*').order('criado_em', { ascending: false }).limit(100)
    setLeads(l.data ?? []); lp.step()

    setLoading(false)
  }

  // ── Modelos CRUD ─────────────────────────────────────────────────────────────

  async function salvarModelo() {
    if (!editModelo?.nome?.trim()) return
    setSaving(true)
    const payload = {
      nome: editModelo.nome, material: editModelo.material ?? 'Aço Inox 304',
      espessura_mm: editModelo.espessura_mm ?? 0.43,
      largura_mm: editModelo.largura_mm || null,
      comprimento_mm: editModelo.comprimento_mm || null,
      abertura_aba_mm: editModelo.abertura_aba_mm || null,
      obs_tecnica: editModelo.obs_tecnica || null,
      imagem_url: editModelo.imagem_url || null,
      possui_laudo: editModelo.possui_laudo ?? false, ativo: editModelo.ativo ?? true,
      preco_unitario: editModelo.preco_unitario || null,
    }
    if (editModelo.id) {
      await supabaseAdmin.from('fixador_modelos').update(payload).eq('id', editModelo.id)
    } else {
      await supabaseAdmin.from('fixador_modelos').insert(payload)
    }
    setEditModelo(null)
    setSaving(false)
    carregarTudo()
  }

  async function excluirModelo(id: number) {
    if (!confirm('Excluir este modelo?')) return
    await supabaseAdmin.from('fixador_modelos').delete().eq('id', id)
    carregarTudo()
  }

  // ── Regras CRUD ──────────────────────────────────────────────────────────────

  async function salvarRegra() {
    if (!editRegra?.nome?.trim()) return
    setSaving(true)
    const payload = {
      modelo_id: editRegra.modelo_id || null, nome: editRegra.nome,
      lado_max_cm: editRegra.lado_max_cm || null, area_max_cm2: editRegra.area_max_cm2 || null,
      peso_max_kg: editRegra.peso_max_kg || null, fixadores_por_peca: editRegra.fixadores_por_peca ?? 2,
      exige_revisao: editRegra.exige_revisao ?? false, prioridade: editRegra.prioridade ?? 10,
    }
    if (editRegra.id) {
      await supabaseAdmin.from('fixador_regras_calculo').update(payload).eq('id', editRegra.id)
    } else {
      await supabaseAdmin.from('fixador_regras_calculo').insert(payload)
    }
    setEditRegra(null)
    setSaving(false)
    carregarTudo()
  }

  async function excluirRegra(id: number) {
    if (!confirm('Excluir esta regra?')) return
    await supabaseAdmin.from('fixador_regras_calculo').delete().eq('id', id)
    carregarTudo()
  }

  // ── Consumíveis CRUD ─────────────────────────────────────────────────────────

  async function salvarConsumivel() {
    if (!editConsumivel?.nome?.trim()) return
    setSaving(true)
    const payload = {
      nome: editConsumivel.nome, tipo: editConsumivel.tipo ?? 'consumivel',
      unidade: editConsumivel.unidade ?? 'UN', proporcao_por: editConsumivel.proporcao_por ?? 1,
      ordem: editConsumivel.ordem ?? 1, preco_unitario: editConsumivel.preco_unitario || null,
    }
    if (editConsumivel.id) {
      await supabaseAdmin.from('fixador_consumiveis').update(payload).eq('id', editConsumivel.id)
    } else {
      await supabaseAdmin.from('fixador_consumiveis').insert(payload)
    }
    setEditConsumivel(null)
    setSaving(false)
    carregarTudo()
  }

  async function excluirConsumivel(id: number) {
    if (!confirm('Excluir este consumível?')) return
    await supabaseAdmin.from('fixador_consumiveis').delete().eq('id', id)
    carregarTudo()
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1.5px solid #d0d7de', borderRadius: 8,
    fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', width: '100%',
  }
  const btnSm: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: '0.78rem',
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
  const thStyle: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', color: '#334155' }

  if (loading) return <div className={styles.wrap}><AdminLoading total={lp.total} current={lp.current} label="Carregando fixadores..." /></div>

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.navHeader}>
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbCurrent}>⚙️ Fixadores — Configuração</span>
        </div>
        <div className={styles.navActions}>
          {(['modelos', 'regras', 'consumiveis', 'leads'] as Aba[]).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={styles.navLink}
              style={aba === a ? { background: '#0a1628', color: '#fff', borderColor: '#0a1628' } : {}}
            >
              {a === 'modelos' ? '🔩 Modelos' : a === 'regras' ? '📏 Regras' : a === 'consumiveis' ? '🔧 Consumíveis' : '📋 Leads'}
              <span style={{ marginLeft: 6, fontSize: '0.72rem', opacity: 0.7 }}>
                ({a === 'modelos' ? modelos.length : a === 'regras' ? regras.length : a === 'consumiveis' ? consumiveis.length : leads.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA MODELOS ── */}
      {aba === 'modelos' && (
        <div className={fx.secao}>
          <div className={fx.secaoHeader}>
            <h3>Modelos de Fixador</h3>
            <button onClick={() => setEditModelo({ ...MODELO_VAZIO })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Novo Modelo</button>
          </div>

          {/* Form */}
          {editModelo && (
            <div className={fx.formWrap}>
              <div className={fx.formGrid3}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Nome *</label>
                  <input style={inputStyle} value={editModelo.nome ?? ''} onChange={e => setEditModelo({ ...editModelo, nome: e.target.value })} placeholder="Ex: Fixador Padrão 304" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Material</label>
                  <input style={inputStyle} value={editModelo.material ?? ''} onChange={e => setEditModelo({ ...editModelo, material: e.target.value })} placeholder="Aço Inox 304" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Espessura (mm)</label>
                  <input style={inputStyle} type="number" step="0.01" value={editModelo.espessura_mm ?? ''} onChange={e => setEditModelo({ ...editModelo, espessura_mm: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className={fx.formGrid3} style={{ marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Largura (mm)</label>
                  <input style={inputStyle} type="number" step="0.1" value={editModelo.largura_mm ?? ''} onChange={e => setEditModelo({ ...editModelo, largura_mm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: 40" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Comprimento (mm)</label>
                  <input style={inputStyle} type="number" step="0.1" value={editModelo.comprimento_mm ?? ''} onChange={e => setEditModelo({ ...editModelo, comprimento_mm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: 120" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Abertura da aba (mm)</label>
                  <input style={inputStyle} type="number" step="0.1" value={editModelo.abertura_aba_mm ?? ''} onChange={e => setEditModelo({ ...editModelo, abertura_aba_mm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: 5 ou 11" />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Descrição</label>
                  <button
                    onClick={gerarDescricaoIA}
                    disabled={gerandoDesc}
                    style={{ ...btnSm, background: '#7c3aed', color: '#fff', fontSize: '0.7rem', padding: '3px 10px' }}
                  >
                    {gerandoDesc ? '⏳ Gerando…' : '✨ Gerar com IA'}
                  </button>
                </div>
                <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={editModelo.obs_tecnica ?? ''} onChange={e => setEditModelo({ ...editModelo, obs_tecnica: e.target.value })} placeholder="Descrição técnica comercial" />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Imagem do produto</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  {editModelo.imagem_url && (
                    <img src={editModelo.imagem_url} alt="Preview" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ ...btnSm, background: '#f1f5f9', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      {uploading ? '⏳ Enviando…' : '📷 Upload'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadImagem(e.target.files[0]) }} />
                    </label>
                    {editModelo.imagem_url && (
                      <button onClick={() => setEditModelo({ ...editModelo, imagem_url: null })} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626', fontSize: '0.7rem' }}>✕ Remover</button>
                    )}
                  </div>
                </div>
              </div>
              <div className={fx.formRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Preço unitário (R$)</label>
                  <input style={{ ...inputStyle, width: 120 }} type="number" step="0.01" min="0" value={editModelo.preco_unitario ?? ''} onChange={e => setEditModelo({ ...editModelo, preco_unitario: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0,00" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editModelo.possui_laudo ?? false} onChange={e => setEditModelo({ ...editModelo, possui_laudo: e.target.checked })} /> Possui laudo/ensaio
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editModelo.ativo ?? true} onChange={e => setEditModelo({ ...editModelo, ativo: e.target.checked })} /> Ativo
                </label>
                <div style={{ flex: 1 }} />
                <button onClick={() => setEditModelo(null)} style={{ ...btnSm, background: '#f1f5f9', color: '#475569' }}>Cancelar</button>
                <button onClick={salvarModelo} disabled={saving} style={{ ...btnSm, background: '#16a34a', color: '#fff' }}>
                  {saving ? 'Salvando…' : editModelo.id ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className={fx.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nome</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Material</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Dimensões (mm)</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Abertura</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Preço</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Laudo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ativo</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {m.imagem_url && <img src={m.imagem_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.nome}</div>
                        {m.obs_tecnica && <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400, marginTop: 2, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{m.obs_tecnica}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#475569' }}>{m.material}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.78rem' }}>
                    {m.comprimento_mm && m.largura_mm ? `${m.comprimento_mm}×${m.largura_mm}×${m.espessura_mm}` : m.espessura_mm + ' esp.'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {m.abertura_aba_mm ? `${m.abertura_aba_mm} mm` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: m.preco_unitario ? '#16a34a' : '#94a3b8' }}>{m.preco_unitario ? `R$ ${m.preco_unitario.toFixed(2).replace('.', ',')}` : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{m.possui_laudo ? '✅' : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{m.ativo ? '🟢' : '🔴'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setEditModelo({ ...m })} style={{ ...btnSm, background: '#eff6ff', color: '#1d4ed8', marginRight: 6 }}>✏️</button>
                    <button onClick={() => excluirModelo(m.id)} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {modelos.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum modelo cadastrado</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── ABA REGRAS ── */}
      {aba === 'regras' && (
        <div className={fx.secao}>
          <div className={fx.secaoHeader}>
            <h3>Regras de Cálculo</h3>
            <button onClick={() => setEditRegra({ ...REGRA_VAZIA })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Nova Regra</button>
          </div>

          {editRegra && (
            <div className={fx.formWrap}>
              <div className={fx.formGrid4}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Nome *</label>
                  <input style={inputStyle} value={editRegra.nome ?? ''} onChange={e => setEditRegra({ ...editRegra, nome: e.target.value })} placeholder="Ex: Peça padrão (até 60×60)" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Modelo</label>
                  <select style={inputStyle} value={editRegra.modelo_id ?? ''} onChange={e => setEditRegra({ ...editRegra, modelo_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Genérica (todos)</option>
                    {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Fixadores/peça</label>
                  <input style={inputStyle} type="number" value={editRegra.fixadores_por_peca ?? 2} onChange={e => setEditRegra({ ...editRegra, fixadores_por_peca: parseInt(e.target.value) || 2 })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Prioridade</label>
                  <input style={inputStyle} type="number" value={editRegra.prioridade ?? 10} onChange={e => setEditRegra({ ...editRegra, prioridade: parseInt(e.target.value) || 10 })} />
                </div>
              </div>
              <div className={fx.formGrid3} style={{ marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Lado máx (cm)</label>
                  <input style={inputStyle} type="number" value={editRegra.lado_max_cm ?? ''} onChange={e => setEditRegra({ ...editRegra, lado_max_cm: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Área máx (cm²)</label>
                  <input style={inputStyle} type="number" value={editRegra.area_max_cm2 ?? ''} onChange={e => setEditRegra({ ...editRegra, area_max_cm2: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Peso máx (kg)</label>
                  <input style={inputStyle} type="number" step="0.1" value={editRegra.peso_max_kg ?? ''} onChange={e => setEditRegra({ ...editRegra, peso_max_kg: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" />
                </div>
              </div>
              <div className={fx.formRow}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editRegra.exige_revisao ?? false} onChange={e => setEditRegra({ ...editRegra, exige_revisao: e.target.checked })} /> Exige revisão técnica
                </label>
                <div style={{ flex: 1 }} />
                <button onClick={() => setEditRegra(null)} style={{ ...btnSm, background: '#f1f5f9', color: '#475569' }}>Cancelar</button>
                <button onClick={salvarRegra} disabled={saving} style={{ ...btnSm, background: '#16a34a', color: '#fff' }}>
                  {saving ? 'Salvando…' : editRegra.id ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          )}

          <div className={fx.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nome</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Modelo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Fix/peça</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Lado máx</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Área máx</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Prior.</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Revisão</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.nome}</td>
                  <td style={{ padding: '10px 16px', color: '#475569' }}>{r.modelo_id ? modelos.find(m => m.id === r.modelo_id)?.nome ?? `#${r.modelo_id}` : 'Genérica'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700 }}>{r.fixadores_por_peca}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{r.lado_max_cm ?? '∞'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{r.area_max_cm2 ?? '∞'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{r.prioridade}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{r.exige_revisao ? '⚠️' : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setEditRegra({ ...r })} style={{ ...btnSm, background: '#eff6ff', color: '#1d4ed8', marginRight: 6 }}>✏️</button>
                    <button onClick={() => excluirRegra(r.id)} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {regras.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhuma regra cadastrada</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── ABA CONSUMÍVEIS ── */}
      {aba === 'consumiveis' && (
        <div className={fx.secao}>
          <div className={fx.secaoHeader}>
            <h3>Consumíveis</h3>
            <button onClick={() => setEditConsumivel({ ...CONSUMIVEL_VAZIO })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Novo Consumível</button>
          </div>

          {editConsumivel && (
            <div className={fx.formWrap}>
              <div className={fx.formGrid5}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Nome *</label>
                  <input style={inputStyle} value={editConsumivel.nome ?? ''} onChange={e => setEditConsumivel({ ...editConsumivel, nome: e.target.value })} placeholder="Ex: Parafuso" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Tipo</label>
                  <select style={inputStyle} value={editConsumivel.tipo ?? 'consumivel'} onChange={e => setEditConsumivel({ ...editConsumivel, tipo: e.target.value })}>
                    <option value="fixador">Fixador</option>
                    <option value="consumivel">Consumível</option>
                    <option value="acessorio">Acessório</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Unidade</label>
                  <input style={inputStyle} value={editConsumivel.unidade ?? 'UN'} onChange={e => setEditConsumivel({ ...editConsumivel, unidade: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Proporção (1:N)</label>
                  <input style={inputStyle} type="number" value={editConsumivel.proporcao_por ?? 1} onChange={e => setEditConsumivel({ ...editConsumivel, proporcao_por: parseInt(e.target.value) || 1 })} />
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>1 = 1:1 com fixador</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Ordem</label>
                  <input style={inputStyle} type="number" value={editConsumivel.ordem ?? 1} onChange={e => setEditConsumivel({ ...editConsumivel, ordem: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Preço (R$)</label>
                  <input style={inputStyle} type="number" step="0.01" min="0" value={editConsumivel.preco_unitario ?? ''} onChange={e => setEditConsumivel({ ...editConsumivel, preco_unitario: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0,00" />
                </div>
              </div>
              <div className={fx.formActions}>
                <button onClick={() => setEditConsumivel(null)} style={{ ...btnSm, background: '#f1f5f9', color: '#475569' }}>Cancelar</button>
                <button onClick={salvarConsumivel} disabled={saving} style={{ ...btnSm, background: '#16a34a', color: '#fff' }}>
                  {saving ? 'Salvando…' : editConsumivel.id ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          )}

          <div className={fx.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nome</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Unidade</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Proporção</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ordem</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Preço</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {consumiveis.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: c.tipo === 'fixador' ? '#eff6ff' : c.tipo === 'acessorio' ? '#fef3c7' : '#f0fdf4', color: c.tipo === 'fixador' ? '#1d4ed8' : c.tipo === 'acessorio' ? '#92400e' : '#166534' }}>
                      {c.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{c.unidade}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{c.proporcao_por === 1 ? '1:1' : `1:${c.proporcao_por}`}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{c.ordem}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: c.preco_unitario ? '#16a34a' : '#94a3b8' }}>{c.preco_unitario ? `R$ ${c.preco_unitario.toFixed(2).replace('.', ',')}` : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setEditConsumivel({ ...c })} style={{ ...btnSm, background: '#eff6ff', color: '#1d4ed8', marginRight: 6 }}>✏️</button>
                    <button onClick={() => excluirConsumivel(c.id)} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {consumiveis.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum consumível cadastrado</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── ABA LEADS ── */}
      {aba === 'leads' && (
        <div className={fx.secao}>
          <div className={fx.secaoHeader}>
            <h3>Leads da Calculadora</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Últimos 100 leads</span>
          </div>
          <div className={fx.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>WhatsApp</th>
                <th style={thStyle}>Empresa</th>
                <th style={thStyle}>E-mail</th>
                <th style={thStyle}>CEP</th>
                <th style={thStyle}>Cálculos</th>
                <th style={thStyle}>Verificado</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{l.nome}</td>
                  <td style={tdStyle}>
                    <a href={`https://wa.me/55${l.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
                      {l.whatsapp}
                    </a>
                  </td>
                  <td style={tdStyle}>{l.empresa || '—'}</td>
                  <td style={tdStyle}>{l.email || '—'}</td>
                  <td style={tdStyle}>{l.cep || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{l.calculos || 0}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{l.verificado ? '✅' : '⏳'}</td>
                  <td style={tdStyle}>{new Date(l.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td style={tdStyle}>
                    <a href={`https://wa.me/55${l.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${l.nome}, tudo bem? Vi que você usou nossa calculadora de materiais. Posso ajudar com o orçamento?`)}`} target="_blank" rel="noopener noreferrer" style={{ ...btnSm, background: '#16a34a', color: '#fff', textDecoration: 'none', display: 'inline-block' }}>
                      💬 WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum lead registrado ainda</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
