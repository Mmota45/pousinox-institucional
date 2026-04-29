/**
 * EspecificacaoSection — Especificação Técnica de Materiais (V1)
 * Seção colapsável no editor de orçamento.
 */

import { useState, useEffect } from 'react'
import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import { useEspecificacao } from '../hooks/useEspecificacao'
import type { EspecificacaoInput, ResultadoEspecificacao, StatusAnalise } from '../especificacaoTypes'
import type { Item } from '../types'

interface Props {
  orcamentoId: number | null
  onItensAdded: (novos: Item[]) => void
  styles: Record<string, string>
}

const STATUS_VISUAL: Record<StatusAnalise, { bg: string; border: string; color: string; icon: string; label: string }> = {
  padrao:  { bg: '#f0fdf4', border: '#16a34a', color: '#166534', icon: '✅', label: 'Estimativa padrão' },
  alerta:  { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', icon: '⚠️', label: 'Estimativa com alerta' },
  revisao: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: '🔍', label: 'Revisão técnica obrigatória' },
}

export default function EspecificacaoSection({ orcamentoId, onItensAdded, styles }: Props) {
  const {
    modelos, resultado, especSalva, loading, erro,
    calcular, salvar, adicionarAoOrcamento, setErro,
  } = useEspecificacao({ orcamentoId, onItensAdded })

  // Form state
  const [areaTotal, setAreaTotal] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [pesoPeca, setPesoPeca] = useState('')
  const [pesoM2, setPesoM2] = useState('')
  const [espessura, setEspessura] = useState('')
  const [modeloId, setModeloId] = useState<number | ''>('')
  const [perdaPct, setPerdaPct] = useState('10')
  const [obs, setObs] = useState('')
  const [revisaoManual, setRevisaoManual] = useState(false)
  const [inserido, setInserido] = useState(false)
  const [salvou, setSalvou] = useState(false)

  // Carregar dados salvos
  useEffect(() => {
    if (!especSalva) return
    setAreaTotal(String(especSalva.area_total_m2))
    setLargura(String(especSalva.largura_cm))
    setAltura(String(especSalva.altura_cm))
    setPesoPeca(especSalva.peso_peca_kg ? String(especSalva.peso_peca_kg) : '')
    setPesoM2(especSalva.peso_m2_kg ? String(especSalva.peso_m2_kg) : '')
    setEspessura(especSalva.espessura_mm ? String(especSalva.espessura_mm) : '')
    setModeloId(especSalva.modelo_id || '')
    setPerdaPct(String(especSalva.perda_pct))
    setObs(especSalva.obs || '')
    setRevisaoManual(especSalva.revisao_tecnica)
  }, [especSalva])

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
    const id = await salvar(input, resultado)
    if (id) setSalvou(true)
  }

  function handleAdicionar() {
    if (!resultado) return
    adicionarAoOrcamento(resultado, modeloSel || undefined)
    setInserido(true)
  }

  function handlePdf() {
    const especId = especSalva?.id
    if (especId) {
      window.open(`/print/especificacao/${especId}`, '_blank')
    } else {
      setErro('Salve a especificação antes de gerar o PDF.')
    }
  }

  const badge = resultado
    ? `${resultado.total_fixadores} fixadores`
    : especSalva?.total_fixadores
      ? `${especSalva.total_fixadores} fixadores`
      : undefined

  return (
    <CollapsibleSection title="📐 Especificação Técnica de Materiais" badge={badge}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Modelo do Fixador ── */}
        <div className={styles.fg}>
          <label>Modelo do fixador</label>
          <select className={styles.input} value={modeloId} onChange={e => setModeloId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Selecione o modelo…</option>
            {modelos.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome} — {m.material} {m.espessura_mm ? `(${m.espessura_mm}mm)` : ''}
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
                🔬 Modelo com rastreabilidade técnica do material
                {modeloSel.laudo_laboratorio && ` — ${modeloSel.laudo_laboratorio}`}
              </div>
            )}
          </div>
        )}

        {/* ── Dados da obra / revestimento ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className={styles.fg}>
            <label>Área total (m²) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 274.7" value={areaTotal} onChange={e => setAreaTotal(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Largura da peça (cm) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 20" value={largura} onChange={e => setLargura(e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label>Altura da peça (cm) *</label>
            <input className={styles.input} type="text" inputMode="decimal" placeholder="Ex: 120" value={altura} onChange={e => setAltura(e.target.value)} />
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
            <label>Espessura peça (mm)</label>
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
            📐 Calcular Especificação
          </button>
        </div>

        {/* ── Erro ── */}
        {erro && (
          <div style={{ fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #ef4444' }}>
            {erro}
          </div>
        )}

        {/* ── Resultado ── */}
        {resultado && <ResultadoBloco resultado={resultado} modeloSel={modeloSel} />}

        {/* ── Ações pós-cálculo ── */}
        {resultado && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={handleSalvar} disabled={loading} style={{ ...btnBase, background: '#1a3a5c' }}>
              {loading ? 'Salvando…' : salvou ? '✅ Salvo' : '💾 Salvar Especificação'}
            </button>
            <button type="button" onClick={handleAdicionar} disabled={inserido} style={{ ...btnBase, background: inserido ? '#16a34a' : '#0369a1' }}>
              {inserido ? '✅ Adicionado' : '➕ Adicionar ao Orçamento'}
            </button>
            <button type="button" onClick={handlePdf} disabled={!especSalva?.id} style={{ ...btnBase, background: '#7c3aed' }}>
              📄 Gerar PDF
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// ── Resultado visual ────────────────────────────────────────────────────────

function ResultadoBloco({ resultado, modeloSel }: { resultado: ResultadoEspecificacao; modeloSel: { nome: string; material: string; espessura_mm: number | null; possui_laudo: boolean } | null }) {
  const sv = STATUS_VISUAL[resultado.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status */}
      <div style={{ background: sv.bg, borderLeft: `3px solid ${sv.border}`, borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: sv.color, fontWeight: 600 }}>
        {sv.icon} {sv.label}
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

      {/* Selo técnico */}
      {modeloSel?.possui_laudo && (
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔬 Material de fabricação com ensaio técnico rastreável
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

const btnBase: React.CSSProperties = {
  color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px',
  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  transition: 'opacity 0.15s, transform 0.1s',
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '0.75rem' }
const td: React.CSSProperties = { padding: '8px 12px', color: '#1a1a2e' }
