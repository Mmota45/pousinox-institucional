/**
 * AdminFixadores — CRUD de modelos de fixadores, regras de cálculo e consumíveis
 * Rota: /admin/fixadores · Permissão: orcamento
 */

import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminOrcamento.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface Modelo {
  id: number
  nome: string
  material: string
  espessura_mm: number
  descricao: string | null
  laudo: boolean
  ativo: boolean
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
}

type Aba = 'modelos' | 'regras' | 'consumiveis'

const MODELO_VAZIO: Omit<Modelo, 'id'> = { nome: '', material: 'Aço Inox 304', espessura_mm: 0.43, descricao: '', laudo: false, ativo: true }
const REGRA_VAZIA: Omit<Regra, 'id'> = { modelo_id: null, nome: '', lado_max_cm: null, area_max_cm2: null, peso_max_kg: null, fixadores_por_peca: 2, exige_revisao: false, prioridade: 10 }
const CONSUMIVEL_VAZIO: Omit<Consumivel, 'id'> = { nome: '', tipo: 'consumivel', unidade: 'UN', proporcao_por: 1, ordem: 1 }

export default function AdminFixadores() {
  const [aba, setAba] = useState<Aba>('modelos')
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [regras, setRegras] = useState<Regra[]>([])
  const [consumiveis, setConsumiveis] = useState<Consumivel[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [editModelo, setEditModelo] = useState<Partial<Modelo> | null>(null)
  const [editRegra, setEditRegra] = useState<Partial<Regra> | null>(null)
  const [editConsumivel, setEditConsumivel] = useState<Partial<Consumivel> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    setLoading(true)
    const [m, r, c] = await Promise.all([
      supabaseAdmin.from('fixador_modelos').select('*').order('id'),
      supabaseAdmin.from('fixador_regras_calculo').select('*').order('prioridade'),
      supabaseAdmin.from('fixador_consumiveis').select('*').order('ordem'),
    ])
    setModelos(m.data ?? [])
    setRegras(r.data ?? [])
    setConsumiveis(c.data ?? [])
    setLoading(false)
  }

  // ── Modelos CRUD ─────────────────────────────────────────────────────────────

  async function salvarModelo() {
    if (!editModelo?.nome?.trim()) return
    setSaving(true)
    if (editModelo.id) {
      await supabaseAdmin.from('fixador_modelos').update({
        nome: editModelo.nome, material: editModelo.material, espessura_mm: editModelo.espessura_mm,
        descricao: editModelo.descricao || null, laudo: editModelo.laudo ?? false, ativo: editModelo.ativo ?? true,
      }).eq('id', editModelo.id)
    } else {
      await supabaseAdmin.from('fixador_modelos').insert({
        nome: editModelo.nome, material: editModelo.material ?? 'Aço Inox 304',
        espessura_mm: editModelo.espessura_mm ?? 0.43, descricao: editModelo.descricao || null,
        laudo: editModelo.laudo ?? false, ativo: editModelo.ativo ?? true,
      })
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
      ordem: editConsumivel.ordem ?? 1,
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

  if (loading) return <div className={styles.wrap}><p style={{ padding: 24, color: '#64748b' }}>Carregando…</p></div>

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.navHeader}>
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbCurrent}>⚙️ Fixadores — Configuração</span>
        </div>
        <div className={styles.navActions}>
          {(['modelos', 'regras', 'consumiveis'] as Aba[]).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={styles.navLink}
              style={aba === a ? { background: '#0a1628', color: '#fff', borderColor: '#0a1628' } : {}}
            >
              {a === 'modelos' ? '🔩 Modelos' : a === 'regras' ? '📏 Regras' : '🔧 Consumíveis'}
              <span style={{ marginLeft: 6, fontSize: '0.72rem', opacity: 0.7 }}>
                ({a === 'modelos' ? modelos.length : a === 'regras' ? regras.length : consumiveis.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA MODELOS ── */}
      {aba === 'modelos' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Modelos de Fixador</h3>
            <button onClick={() => setEditModelo({ ...MODELO_VAZIO })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Novo Modelo</button>
          </div>

          {/* Form */}
          {editModelo && (
            <div style={{ padding: 18, borderBottom: '2px dashed #e2e8f0', background: '#fafbfc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Descrição</label>
                <input style={inputStyle} value={editModelo.descricao ?? ''} onChange={e => setEditModelo({ ...editModelo, descricao: e.target.value })} placeholder="Descrição curta" />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editModelo.laudo ?? false} onChange={e => setEditModelo({ ...editModelo, laudo: e.target.checked })} /> Possui laudo/ensaio
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nome</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Material</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Esp. (mm)</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Laudo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ativo</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{m.nome}</td>
                  <td style={{ padding: '10px 16px', color: '#475569' }}>{m.material}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{m.espessura_mm}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{m.laudo ? '✅' : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{m.ativo ? '🟢' : '🔴'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setEditModelo({ ...m })} style={{ ...btnSm, background: '#eff6ff', color: '#1d4ed8', marginRight: 6 }}>✏️</button>
                    <button onClick={() => excluirModelo(m.id)} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {modelos.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum modelo cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ABA REGRAS ── */}
      {aba === 'regras' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Regras de Cálculo</h3>
            <button onClick={() => setEditRegra({ ...REGRA_VAZIA })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Nova Regra</button>
          </div>

          {editRegra && (
            <div style={{ padding: 18, borderBottom: '2px dashed #e2e8f0', background: '#fafbfc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
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
              <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
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
      )}

      {/* ── ABA CONSUMÍVEIS ── */}
      {aba === 'consumiveis' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Consumíveis</h3>
            <button onClick={() => setEditConsumivel({ ...CONSUMIVEL_VAZIO })} style={{ ...btnSm, background: '#0a1628', color: '#fff' }}>+ Novo Consumível</button>
          </div>

          {editConsumivel && (
            <div style={{ padding: 18, borderBottom: '2px dashed #e2e8f0', background: '#fafbfc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
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
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditConsumivel(null)} style={{ ...btnSm, background: '#f1f5f9', color: '#475569' }}>Cancelar</button>
                <button onClick={salvarConsumivel} disabled={saving} style={{ ...btnSm, background: '#16a34a', color: '#fff' }}>
                  {saving ? 'Salvando…' : editConsumivel.id ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nome</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Unidade</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Proporção</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Ordem</th>
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
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setEditConsumivel({ ...c })} style={{ ...btnSm, background: '#eff6ff', color: '#1d4ed8', marginRight: 6 }}>✏️</button>
                    <button onClick={() => excluirConsumivel(c.id)} style={{ ...btnSm, background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {consumiveis.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum consumível cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
