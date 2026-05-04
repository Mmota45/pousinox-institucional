/**
 * PrintEspecificacao — PDF técnico-comercial da Especificação de Materiais
 * Rota: /admin/print-especificacao/:id
 * Abre em nova aba → Ctrl+P para imprimir/salvar PDF.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DiagramaFixador from '../components/DiagramaFixador/DiagramaFixador'
import { supabaseAdmin } from '../lib/supabase'

interface EspecData {
  area_total_m2: number
  largura_cm: number
  altura_cm: number
  peso_peca_kg: number | null
  peso_m2_kg: number | null
  espessura_mm: number | null
  perda_pct: number
  qtd_pecas: number
  fixadores_por_peca: number
  total_fixadores: number
  revisao_tecnica: boolean
  revisao_motivos: string[]
  obs: string | null
  criado_em: string
  modelo: {
    nome: string; material: string; espessura_mm: number | null; largura_mm: number | null
    acabamento: string | null; obs_tecnica: string | null
    possui_laudo: boolean; laudo_laboratorio: string | null; laudo_resumo: string | null
  } | null
  itens: { nome: string; quantidade: number; unidade: string; tipo: string }[]
  empresa: { nome_fantasia: string; razao_social: string | null; cnpj: string | null; telefone: string | null; email: string | null; site: string | null; logo_url: string | null } | null
  cliente_empresa: string | null
  orcamento_numero: string | null
}

export default function PrintEspecificacao() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EspecData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      // Especificação
      const { data: espec } = await supabaseAdmin
        .from('orcamento_especificacoes')
        .select('*, fixador_modelos(*)')
        .eq('id', Number(id))
        .single()
      if (!espec) { setLoading(false); return }

      // Itens
      const { data: itens } = await supabaseAdmin
        .from('orcamento_especificacao_itens')
        .select('nome, quantidade, unidade, tipo')
        .eq('especificacao_id', espec.id)
        .order('criado_em')

      // Orçamento (empresa emissora + cliente)
      const { data: orc } = await supabaseAdmin
        .from('orcamentos')
        .select('numero, empresa_id, cliente_empresa')
        .eq('id', espec.orcamento_id)
        .single()

      let empresa = null
      if (orc?.empresa_id) {
        const { data: emp } = await supabaseAdmin
          .from('empresas_emissoras')
          .select('nome_fantasia, razao_social, cnpj, telefone, email, site, logo_url')
          .eq('id', orc.empresa_id)
          .single()
        empresa = emp
      }

      setData({
        ...espec,
        modelo: espec.fixador_modelos || null,
        itens: itens || [],
        empresa,
        cliente_empresa: orc?.cliente_empresa || null,
        orcamento_numero: orc?.numero || null,
      })
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (data) document.title = `Especificação Técnica — ${data.orcamento_numero || id}`
  }, [data, id])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Carregando…</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Especificação não encontrada.</div>

  const areaPeca = (data.largura_cm / 100) * (data.altura_cm / 100)

  return (
    <div style={page}>
      <div style={sheet}>
        {/* ── Cabeçalho ── */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {data.empresa?.logo_url && <img src={data.empresa.logo_url} alt="" style={{ height: 48, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0a1628' }}>{data.empresa?.nome_fantasia || 'POUSINOX'}</div>
              {data.empresa?.razao_social && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{data.empresa.razao_social}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#64748b' }}>
            {data.empresa?.cnpj && <div>CNPJ: {data.empresa.cnpj}</div>}
            {data.empresa?.telefone && <div>Tel: {data.empresa.telefone}</div>}
            {data.empresa?.email && <div>{data.empresa.email}</div>}
            {data.empresa?.site && <div>{data.empresa.site}</div>}
          </div>
        </div>

        {/* ── Título ── */}
        <div style={{ textAlign: 'center', margin: '16px 0 12px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0a1628', letterSpacing: '-0.01em' }}>
            ESPECIFICAÇÃO TÉCNICA DE MATERIAIS
          </div>
          {data.orcamento_numero && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Ref. Orçamento {data.orcamento_numero}</div>}
          {data.cliente_empresa && <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>Cliente: {data.cliente_empresa}</div>}
        </div>

        {/* ── Dados da obra ── */}
        <SectionTitle>Dados da Obra / Revestimento</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', fontSize: '0.78rem', marginBottom: 12 }}>
          <Field label="Área total" value={`${data.area_total_m2} m²`} />
          <Field label="Dimensão da peça" value={`${data.largura_cm} × ${data.altura_cm} cm`} />
          <Field label="Área da peça" value={`${areaPeca.toFixed(4)} m²`} />
          {data.peso_peca_kg && <Field label="Peso da peça" value={`${data.peso_peca_kg} kg`} />}
          {data.espessura_mm && <Field label="Espessura" value={`${data.espessura_mm} mm`} />}
          <Field label="Perda aplicada" value={`${data.perda_pct}%`} />
        </div>

        {/* ── Modelo do fixador ── */}
        {data.modelo && (
          <>
            <SectionTitle>Modelo do Fixador</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', fontSize: '0.78rem', marginBottom: 12 }}>
              <Field label="Modelo" value={data.modelo.nome} />
              <Field label="Material" value={data.modelo.material} />
              <Field label="Espessura chapa" value={data.modelo.espessura_mm ? `${data.modelo.espessura_mm} mm` : '—'} />
              {data.modelo.acabamento && <Field label="Acabamento" value={data.modelo.acabamento} />}
            </div>
            {data.modelo.obs_tecnica && (
              <div style={{ fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', marginBottom: 8 }}>{data.modelo.obs_tecnica}</div>
            )}
            {data.modelo.possui_laudo && (
              <div style={{ fontSize: '0.7rem', color: '#16a34a', marginBottom: 12 }}>
                🔬 Modelo com rastreabilidade técnica do material{data.modelo.laudo_laboratorio ? ` — ${data.modelo.laudo_laboratorio}` : ''}
              </div>
            )}
          </>
        )}

        {/* ── Resumo do cálculo ── */}
        <SectionTitle>Resumo do Cálculo</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', fontSize: '0.78rem', marginBottom: 12 }}>
          <Field label="Qtd. estimada de peças" value={`${data.qtd_pecas}`} />
          <Field label="Fixadores por peça" value={`${data.fixadores_por_peca}`} />
          <Field label="Total de fixadores" value={`${data.total_fixadores}`} bold />
        </div>

        {/* ── Diagrama de posicionamento ── */}
        {data.fixadores_por_peca > 0 && data.largura_cm && data.altura_cm && (
          <DiagramaFixador
            fixadoresPorPeca={data.fixadores_por_peca}
            larguraCm={data.largura_cm}
            alturaCm={data.altura_cm}
            larguraFixadorMm={data.modelo?.largura_mm ?? undefined}
          />
        )}

        {/* ── Status da análise ── */}
        {data.revisao_tecnica && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', fontSize: '0.75rem', color: '#991b1b', marginBottom: 12 }}>
            <strong>⚠️ Revisão técnica recomendada</strong>
            {data.revisao_motivos?.length > 0 && (
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {data.revisao_motivos.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* ── Tabela de materiais ── */}
        <SectionTitle>Quantitativos de Materiais</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>Material</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Quantidade</th>
              <th style={thStyle}>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {data.itens.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdStyle}>{it.nome}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{it.quantidade.toLocaleString('pt-BR')}</td>
                <td style={tdStyle}>{it.unidade}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Observações ── */}
        {data.obs && (
          <>
            <SectionTitle>Observações</SectionTitle>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{data.obs}</div>
          </>
        )}

        {/* ── Disclaimers ── */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 'auto' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', lineHeight: 1.7 }}>
            <strong>Nota importante:</strong><br />
            • Esta especificação possui caráter técnico-comercial e estimativo.<br />
            • A validação final depende das condições reais da obra e da análise do responsável técnico.<br />
            • Laudos informados referem-se ao material / amostra ensaiada e não substituem validação completa do sistema instalado.<br />
            • Casos fora da faixa padrão exigem revisão técnica.
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
          <span>{data.empresa?.nome_fantasia || 'POUSINOX'} — {data.empresa?.site || 'pousinox.com.br'}</span>
          <span>Emitido em {new Date(data.criado_em).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0a1628', borderBottom: '2px solid #1a3a5c', paddingBottom: 3, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{label}</div>
      <div style={{ fontWeight: bold ? 700 : 400, color: '#1a1a2e' }}>{value}</div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  background: '#f1f5f9', minHeight: '100vh', display: 'flex', justifyContent: 'center',
  padding: '24px 0', fontFamily: "'Inter', sans-serif",
}

const sheet: React.CSSProperties = {
  background: '#fff', width: '210mm', minHeight: '297mm', padding: '24px 32px',
  boxShadow: '0 2px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column',
}

const header: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: '2px solid #1a3a5c', paddingBottom: 12,
}

const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '0.72rem' }
const tdStyle: React.CSSProperties = { padding: '7px 10px', color: '#1a1a2e' }
