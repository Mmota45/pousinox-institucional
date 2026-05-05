/**
 * EspecificacaoSection — Especificação Técnica de Materiais (V1)
 * Seção colapsável no editor de orçamento.
 */

import { useState, useEffect, useMemo } from 'react'
import { Ruler, CheckCircle, AlertTriangle, Search, Microscope, Save, Plus, FileText, ShieldCheck } from 'lucide-react'
import { supabaseAdmin } from '../../../lib/supabase'
import DiagramaFixador from '../../DiagramaFixador/DiagramaFixador'
import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import { useEspecificacao } from '../hooks/useEspecificacao'
import type { EspecificacaoInput, ResultadoEspecificacao, StatusAnalise } from '../especificacaoTypes'
import type { Item } from '../types'

interface Props {
  orcamentoId: number | null
  onItensAdded: (novos: Item[]) => void
  prospectSegmento?: string
  styles: Record<string, string>
}

const STATUS_ICONS: Record<StatusAnalise, React.ReactNode> = {
  padrao:  <CheckCircle size={14} />,
  alerta:  <AlertTriangle size={14} />,
  revisao: <Search size={14} />,
}

const STATUS_VISUAL: Record<StatusAnalise, { bg: string; border: string; color: string; label: string }> = {
  padrao:  { bg: '#f0fdf4', border: '#16a34a', color: '#166534', label: 'Estimativa padrão' },
  alerta:  { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', label: 'Estimativa com alerta' },
  revisao: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', label: 'Revisão técnica obrigatória' },
}

export default function EspecificacaoSection({ orcamentoId, onItensAdded, prospectSegmento, styles }: Props) {
  const {
    modelos, resultado, especsSalvas, loading, erro,
    calcular, salvar, removerEspec, adicionarAoOrcamento, setErro,
  } = useEspecificacao({ orcamentoId, onItensAdded })

  // ID da especificação sendo editada (null = nova)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  // Form state
  const [areaTotal, setAreaTotal] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [pesoPeca, setPesoPeca] = useState('')
  const [pesoM2, setPesoM2] = useState('')
  const [espessura, setEspessura] = useState('')
  const [modeloId, setModeloId] = useState<number | ''>('')
  const [perdaPct, setPerdaPct] = useState('10')
  const [obs, setObs] = useState('Condições do substrato (ref. ABNT NBR 13755): A base deve estar limpa, sem trincas, sem materiais soltos, óleos ou eflorescências, e não apresentar som cavo à percussão. Emboço com cura mínima de 14 dias. Desvio de planeza máximo de 3 mm em régua de 2 m. Superfícies expostas a sol/vento devem ser pré-umedecidas (sem saturar).\n\nNota técnica: Especificação com caráter estimativo. A validação final depende das condições da obra e do responsável técnico. Perda de 10% já inclusa.')
  const [revisaoManual, setRevisaoManual] = useState(false)
  const [inserido, setInserido] = useState(false)
  const [salvou, setSalvou] = useState(false)

  // Toggle externo/interno (mesma lógica da calculadora)
  const [aplicacao, setAplicacao] = useState<'externo' | 'interno'>('externo')

  // Catálogo de revestimentos para autocomplete
  type Revestimento = { id: number; fabricante: string; formato: string; largura_cm: number; altura_cm: number; espessura_mm: number | null; peso_peca_kg: number | null; peso_m2_kg: number | null }
  const [revestimentos, setRevestimentos] = useState<Revestimento[]>([])
  const [revQuery, setRevQuery] = useState('')
  const [revOpen, setRevOpen] = useState(false)

  useEffect(() => {
    supabaseAdmin.from('revestimentos_catalogo').select('id, fabricante, formato, largura_cm, altura_cm, espessura_mm, peso_peca_kg, peso_m2_kg').eq('ativo', true).order('formato')
      .then(({ data }) => { if (data?.length) setRevestimentos(data) })
  }, [])

  const revFiltrados = useMemo(() => {
    if (!revQuery.trim()) return revestimentos.slice(0, 20)
    const q = revQuery.toLowerCase()
    return revestimentos.filter(r => `${r.fabricante} ${r.formato}`.toLowerCase().includes(q)).slice(0, 20)
  }, [revQuery, revestimentos])

  function selecionarRevestimento(r: Revestimento) {
    setLargura(String(r.largura_cm))
    setAltura(String(r.altura_cm))
    if (r.espessura_mm) setEspessura(String(r.espessura_mm))
    if (r.peso_peca_kg) setPesoPeca(String(r.peso_peca_kg))
    else if (r.peso_m2_kg) {
      const area = (r.largura_cm / 100) * (r.altura_cm / 100)
      setPesoPeca((r.peso_m2_kg * area).toFixed(2))
    }
    setRevQuery(`${r.fabricante} ${r.formato}`)
    setRevOpen(false)
  }

  // Auto-selecionar modelo ao alternar externo/interno
  useEffect(() => {
    if (modelos.length === 0 || editandoId) return
    const esp = parseFloat(espessura) || 0
    const abertura = esp > 8 ? 11 : 5
    const mat = aplicacao === 'externo' ? '304' : '430'
    const match = modelos.find(m => m.abertura_aba_mm === abertura && m.material.includes(mat))
      || modelos.find(m => m.material.includes(mat))
    if (match && match.id !== modeloId) setModeloId(match.id)
  }, [aplicacao, modelos, editandoId])

  // Carregar dados ao editar uma especificação existente
  function carregarEspec(espec: typeof especsSalvas[number]) {
    setEditandoId(espec.id)
    setAreaTotal(String(espec.area_total_m2))
    setLargura(String(espec.largura_cm))
    setAltura(String(espec.altura_cm))
    setPesoPeca(espec.peso_peca_kg ? String(espec.peso_peca_kg) : '')
    setPesoM2(espec.peso_m2_kg ? String(espec.peso_m2_kg) : '')
    setEspessura(espec.espessura_mm ? String(espec.espessura_mm) : '')
    setModeloId(espec.modelo_id || '')
    setPerdaPct(String(espec.perda_pct))
    setObs(espec.obs || '')
    setRevisaoManual(espec.revisao_tecnica)
    // Recalcular para mostrar resultado
    const input: EspecificacaoInput = {
      area_total_m2: espec.area_total_m2,
      largura_cm: espec.largura_cm,
      altura_cm: espec.altura_cm,
      peso_peca_kg: espec.peso_peca_kg || undefined,
      peso_m2_kg: espec.peso_m2_kg || undefined,
      espessura_mm: espec.espessura_mm || undefined,
      perda_pct: espec.perda_pct,
      modelo_id: espec.modelo_id || undefined,
      material: modelos.find(m => m.id === espec.modelo_id)?.material || undefined,
      abertura_mm: modelos.find(m => m.id === espec.modelo_id)?.abertura_aba_mm ?? undefined,
      revisao_manual: espec.revisao_tecnica,
      obs: espec.obs || undefined,
    }
    calcular(input)
  }

  function resetForm() {
    setEditandoId(null)
    setAreaTotal('')
    setLargura('')
    setAltura('')
    setPesoPeca('')
    setPesoM2('')
    setEspessura('')
    setModeloId('')
    setPerdaPct('10')
    setObs('Condições do substrato (ref. ABNT NBR 13755): A base deve estar limpa, sem trincas, sem materiais soltos, óleos ou eflorescências, e não apresentar som cavo à percussão. Emboço com cura mínima de 14 dias. Desvio de planeza máximo de 3 mm em régua de 2 m. Superfícies expostas a sol/vento devem ser pré-umedecidas (sem saturar).\n\nNota técnica: Especificação com caráter estimativo. A validação final depende das condições da obra e do responsável técnico. Perda de 10% já inclusa.')
    setRevisaoManual(false)
    setInserido(false)
    setSalvou(false)
  }

  // Pré-preencher valores sugeridos com base no segmento do prospect
  useEffect(() => {
    if (!prospectSegmento || especsSalvas.length > 0 || !modelos.length) return
    const seg = prospectSegmento.toLowerCase()
    // Sugerir primeiro modelo disponível (geralmente FP-10)
    if (!modeloId && modelos.length > 0) setModeloId(modelos[0].id)
    // Valores default por segmento
    if (seg.includes('constru') || seg.includes('fachada') || seg.includes('revestiment')) {
      if (!areaTotal) setAreaTotal('100')
      if (!largura) setLargura('60')
      if (!altura) setAltura('120')
    } else if (seg.includes('cozinha') || seg.includes('restaurante') || seg.includes('food')) {
      if (!areaTotal) setAreaTotal('30')
      if (!largura) setLargura('45')
      if (!altura) setAltura('45')
    }
  }, [prospectSegmento, modelos, especsSalvas])

  // Auto-selecionar modelo baseado na espessura do revestimento
  useEffect(() => {
    const esp = parseFloat(espessura) || 0
    if (esp <= 0 || modelos.length === 0 || editandoId) return
    const abertura = esp > 8 ? 11 : 5
    const mat = aplicacao === 'externo' ? '304' : '430'
    const match = modelos.find(m => m.abertura_aba_mm === abertura && m.material.includes(mat))
      || modelos.find(m => m.material.includes(mat))
    if (match && match.id !== modeloId) setModeloId(match.id)
  }, [espessura, modelos, editandoId, aplicacao])

  const modeloSel = modelos.find(m => m.id === modeloId) || null

  function buildInput(): EspecificacaoInput | null {
    const area = parseFloat(areaTotal.replace(',', '.'))
    const larg = parseFloat(largura.replace(',', '.'))
    const alt = parseFloat(altura.replace(',', '.'))
    if (!area || area <= 0 || !larg || larg <= 0 || !alt || alt <= 0) {
      setErro('Preencha área, largura e altura.')
      return null
    }
    return {
      area_total_m2: area,
      largura_cm: larg,
      altura_cm: alt,
      peso_peca_kg: parseFloat(pesoPeca.replace(',', '.')) || undefined,
      peso_m2_kg: parseFloat(pesoM2.replace(',', '.')) || undefined,
      espessura_mm: parseFloat(espessura.replace(',', '.')) || undefined,
      perda_pct: parseFloat(perdaPct.replace(',', '.')) || 10,
      modelo_id: modeloId || undefined,
      material: modeloSel?.material || undefined,
      abertura_mm: modeloSel?.abertura_aba_mm ?? undefined,
      revisao_manual: revisaoManual,
      obs: obs.trim() || undefined,
    }
  }

  function handleCalcular() {
    const input = buildInput()
    if (!input) return
    calcular(input)
    setInserido(false)
    setSalvou(false)
  }

  async function handleSalvar() {
    const input = buildInput()
    if (!input || !resultado) return
    const id = await salvar(input, resultado, editandoId || undefined)
    if (id) {
      setSalvou(true)
      // Reset form para permitir nova especificação
      setTimeout(() => resetForm(), 800)
    }
  }

  function handleAdicionar() {
    if (!resultado) return
    adicionarAoOrcamento(resultado, modeloSel || undefined)
    setInserido(true)
  }

  function handlePdf(especId?: number) {
    const id = especId || especsSalvas[especsSalvas.length - 1]?.id
    if (id) {
      window.open(`/print/especificacao/${id}`, '_blank')
    } else {
      setErro('Salve a especificação antes de gerar o PDF.')
    }
  }

  const totalFixAll = especsSalvas.reduce((s, e) => s + (e.total_fixadores || 0), 0)
  const badge = especsSalvas.length > 1
    ? `${especsSalvas.length} medidas · ${totalFixAll} fixadores`
    : resultado
      ? `${resultado.total_fixadores} fixadores`
      : totalFixAll > 0
        ? `${totalFixAll} fixadores`
        : undefined

  return (
    <CollapsibleSection title={<><Ruler size={16} /> Especificação Técnica de Materiais</>} badge={badge}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Especificações salvas ── */}
        {especsSalvas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Medidas cadastradas ({especsSalvas.length})
            </div>
            {especsSalvas.map(espec => {
              const modelo = modelos.find(m => m.id === espec.modelo_id)
              return (
                <div key={espec.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a3a5c' }}>
                      {espec.largura_cm}×{espec.altura_cm} cm — {espec.total_fixadores} fixadores
                      {modelo && <span style={{ fontWeight: 400, color: '#64748b' }}> · {modelo.nome}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => carregarEspec(espec)} style={{ ...btnSmall, background: '#0369a1' }}>Editar</button>
                      <button type="button" onClick={() => handlePdf(espec.id)} style={{ ...btnSmall, background: '#7c3aed' }}>PDF</button>
                      <button type="button" onClick={() => removerEspec(espec.id)} style={{ ...btnSmall, background: '#dc2626' }}>Remover</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem', color: '#475569' }}>
                    <div>Area: {espec.area_total_m2} m² · Pecas: {espec.qtd_pecas} · Fix/peca: {espec.fixadores_por_peca}</div>
                    <div>{espec.peso_peca_kg ? `Peso: ${espec.peso_peca_kg} kg` : ''} {espec.espessura_mm ? `· Esp: ${espec.espessura_mm}mm` : ''}</div>
                  </div>
                  {/* Diagrama inline para cada medida */}
                  <DiagramaFixador
                    fixadoresPorPeca={espec.fixadores_por_peca ?? 0}
                    larguraCm={espec.largura_cm}
                    alturaCm={espec.altura_cm}
                    larguraFixadorMm={modelo?.largura_mm ?? undefined}
                    label={`${espec.largura_cm}×${espec.altura_cm} cm`}
                  />
                </div>
              )
            })}

            {/* Totais consolidados */}
            {especsSalvas.length > 1 && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#1d4ed8' }}>
                Total consolidado: {totalFixAll} fixadores em {especsSalvas.length} medidas diferentes
              </div>
            )}
          </div>
        )}

        {/* ── Separador / botão nova medida ── */}
        {especsSalvas.length > 0 && !editandoId && (
          <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} color="#0369a1" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0369a1' }}>Nova medida de revestimento</span>
          </div>
        )}

        {editandoId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '6px 10px' }}>
            <AlertTriangle size={14} /> Editando medida {especsSalvas.find(e => e.id === editandoId)?.largura_cm}×{especsSalvas.find(e => e.id === editandoId)?.altura_cm} cm
            <button type="button" onClick={resetForm} style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
          </div>
        )}

        {/* ── Aplicação: Externo / Interno ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setAplicacao('externo')}
            style={{ ...toggleBtn, ...(aplicacao === 'externo' ? toggleActive : {}) }}>
            Externo (304)
          </button>
          <button type="button" onClick={() => setAplicacao('interno')}
            style={{ ...toggleBtn, ...(aplicacao === 'interno' ? toggleActive : {}) }}>
            Interno (430)
          </button>
        </div>

        {/* ── Revestimento (autocomplete) ── */}
        {revestimentos.length > 0 && (
          <div className={styles.fg} style={{ position: 'relative' }}>
            <label>Revestimento (opcional)</label>
            <input className={styles.input} type="text" placeholder="Digite formato ou fabricante… ex: 90x90"
              value={revQuery} onChange={e => { setRevQuery(e.target.value); setRevOpen(true) }}
              onFocus={() => setRevOpen(true)} />
            {revOpen && revFiltrados.length > 0 && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, maxHeight: 200, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {revFiltrados.map(r => (
                  <li key={r.id} onClick={() => selecionarRevestimento(r)}
                    style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <strong>{r.formato}</strong> <span style={{ color: '#6b7280' }}>— {r.fabricante}</span>
                    {r.espessura_mm && <span style={{ color: '#9ca3af', marginLeft: 6 }}>{r.espessura_mm}mm</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Tipo de Fixador ── */}
        <div className={styles.fg}>
          <label>Tipo de Fixador</label>
          <select className={styles.input} value={modeloId} onChange={e => setModeloId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Selecione o tipo…</option>
            {modelos.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome} · Abertura {m.abertura_aba_mm || '—'} mm · {m.comprimento_mm}×{m.largura_mm}×{m.espessura_mm}mm
              </option>
            ))}
          </select>
        </div>

        {/* Resumo técnico do modelo */}
        {modeloSel && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 600, color: '#1a3a5c' }}>{modeloSel.nome}</div>
            <div>Material: {modeloSel.material} · Espessura: {modeloSel.espessura_mm || '—'}mm · Acabamento: {modeloSel.acabamento || '—'}</div>
            {modeloSel.obs_tecnica && <div style={{ fontStyle: 'italic' }}>{modeloSel.obs_tecnica}</div>}
            {modeloSel.possui_laudo && (
              <div style={{ color: '#16a34a', fontWeight: 500, marginTop: 2 }}>
                <Microscope size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Modelo com rastreabilidade técnica do material
                {modeloSel.laudo_laboratorio && ` — ${modeloSel.laudo_laboratorio}`}
              </div>
            )}
          </div>
        )}

        {/* ── Dados da obra / revestimento ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className={styles.fg}>
            <label>Área total a revestir (m²) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 274.7" value={areaTotal} onChange={e => setAreaTotal(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Largura da peça (cm) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 90" value={largura} onChange={e => setLargura(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Altura da peça (cm) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 90" value={altura} onChange={e => setAltura(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <div className={styles.fg}>
            <label>Peso da peça (kg)</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Opcional" value={pesoPeca} onChange={e => setPesoPeca(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Peso por m² (kg/m²)</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Opcional" value={pesoM2} onChange={e => setPesoM2(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Espessura do revestimento (mm)</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Opcional" value={espessura} onChange={e => setEspessura(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Perda (%)</label>
            <input className={styles.input} type="text" inputMode="decimal" value={perdaPct} onChange={e => setPerdaPct(e.target.value)} />
          </div>
        </div>

        {/* Revisão manual + obs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label className={styles.toggleLabel}>
            <input type="checkbox" checked={revisaoManual} onChange={e => setRevisaoManual(e.target.checked)} />
            <span>Marcar revisão técnica obrigatória</span>
          </label>
        </div>

        <div className={styles.fg}>
          <label>Observações internas</label>
          <textarea className={`${styles.input} ${styles.textarea}`} rows={2} placeholder="Observações sobre a obra, cliente ou condições especiais…" value={obs} onChange={e => setObs(e.target.value)} />
        </div>

        {/* ── Botão calcular ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleCalcular} style={{ ...btnBase, background: 'linear-gradient(135deg, #0a1628, #1a3a5c)' }}>
            <Ruler size={14} /> Calcular Especificação
          </button>
        </div>

        {/* ── Erro ── */}
        {erro && (
          <div style={{ fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #ef4444' }}>
            {erro}
          </div>
        )}

        {/* ── Resultado ── */}
        {resultado && <ResultadoBloco resultado={resultado} modeloSel={modeloSel} larguraCm={parseFloat(largura) || 0} alturaCm={parseFloat(altura) || 0} />}

        {/* ── Ações pós-cálculo ── */}
        {resultado && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={handleSalvar} disabled={loading} style={{ ...btnBase, background: '#1a3a5c' }}>
              {loading ? 'Salvando…' : salvou ? <><CheckCircle size={14} /> Salvo</> : <><Save size={14} /> Salvar Especificação</>}
            </button>
            <button type="button" onClick={handleAdicionar} disabled={inserido} style={{ ...btnBase, background: inserido ? '#16a34a' : '#0369a1' }}>
              {inserido ? <><CheckCircle size={14} /> Adicionado</> : <><Plus size={14} /> Adicionar ao Orçamento</>}
            </button>
            <button type="button" onClick={() => handlePdf()} disabled={especsSalvas.length === 0} style={{ ...btnBase, background: '#7c3aed' }}>
              <FileText size={14} /> Gerar PDF
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// ── Resultado visual ────────────────────────────────────────────────────────

function ResultadoBloco({ resultado, modeloSel, larguraCm, alturaCm }: { resultado: ResultadoEspecificacao; modeloSel: { nome: string; material: string; espessura_mm: number | null; possui_laudo: boolean; largura_mm: number | null } | null; larguraCm: number; alturaCm: number }) {
  const sv = STATUS_VISUAL[resultado.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status */}
      <div style={{ background: sv.bg, borderLeft: `3px solid ${sv.border}`, borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: sv.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {STATUS_ICONS[resultado.status]} {sv.label}
        {resultado.revisao_motivos.length > 0 && (
          <ul style={{ margin: '6px 0 0 18px', fontWeight: 400, fontSize: '0.78rem' }}>
            {resultado.revisao_motivos.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <KpiCard label="Área da peça" value={`${resultado.area_peca_m2.toFixed(4)} m²`} />
        <KpiCard label="Peças (s/ perda)" value={String(resultado.qtd_pecas_bruto)} />
        <KpiCard label="Peças (c/ perda)" value={String(resultado.qtd_pecas)} destaque />
        {resultado.peso_peca_kg && <KpiCard label="Peso da peça" value={`${resultado.peso_peca_kg.toFixed(2)} kg`} />}
        <KpiCard label="Fix./peça" value={String(resultado.fixadores_por_peca)} />
        <KpiCard label="Total fixadores" value={String(resultado.total_fixadores)} destaque />
        <KpiCard label="Regra aplicada" value={resultado.regra_aplicada} small />
      </div>

      {/* Tabela de itens */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={th}>Material</th>
              <th style={{ ...th, textAlign: 'right' }}>Quantidade</th>
              <th style={th}>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {resultado.itens.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>{it.nome}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{it.quantidade.toLocaleString('pt-BR')}</td>
                <td style={td}>{it.unidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Diagrama de posicionamento */}
      {resultado.fixadores_por_peca > 0 && larguraCm > 0 && alturaCm > 0 && (
        <DiagramaFixador
          fixadoresPorPeca={resultado.fixadores_por_peca}
          larguraCm={larguraCm}
          alturaCm={alturaCm}
          larguraFixadorMm={modeloSel?.largura_mm ?? undefined}
        />
      )}

      {/* Selo técnico */}
      {modeloSel?.possui_laudo && (
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Microscope size={14} /> Material de fabricação com ensaio técnico rastreável
        </div>
      )}

      {/* Referência do laudo */}
      {resultado.laudo_referencia && (
        <div style={{ fontSize: '0.75rem', color: '#1a3a5c', background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> {resultado.laudo_referencia}
        </div>
      )}

    </div>
  )
}

function KpiCard({ label, value, destaque, small }: { label: string; value: string; destaque?: boolean; small?: boolean }) {
  return (
    <div style={{ background: destaque ? '#eff6ff' : '#f8fafc', border: `1px solid ${destaque ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? '0.78rem' : '1rem', fontWeight: 700, color: destaque ? '#1d4ed8' : '#1a1a2e' }}>{value}</div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const toggleBtn: React.CSSProperties = {
  flex: 1, padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb',
  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, color: '#6b7280', transition: 'all 0.15s',
}
const toggleActive: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0a1628, #1a3a5c)', color: '#fff', borderColor: '#1a3a5c',
}

const btnBase: React.CSSProperties = {
  color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px',
  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  transition: 'opacity 0.15s, transform 0.1s',
}

const btnSmall: React.CSSProperties = {
  color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px',
  fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '0.75rem' }
const td: React.CSSProperties = { padding: '8px 12px', color: '#1a1a2e' }
