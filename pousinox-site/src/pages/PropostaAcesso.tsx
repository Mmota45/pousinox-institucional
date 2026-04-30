/**
 * PropostaAcesso — Página pública para visualização de proposta comercial protegida
 * Rota: /proposta/:id
 *
 * Fluxo:
 * 1. Destinatário acessa o link recebido
 * 2. Digita a senha
 * 3. Edge function valida e retorna dados do orçamento
 * 4. Renderiza proposta completa com watermark overlay
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'

interface OrcResult {
  orcamento: any
  itens: any[]
  anexos: any[]
  dados_bancarios: any[]
  watermark: { empresa: string; cnpj: string; watermark_id: string }
  downloads_restantes: number
}

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function PropostaAcesso() {
  const { id } = useParams<{ id: string }>()
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<OrcResult | null>(null)

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (!senha.trim()) { setErro('Digite a senha.'); return }
    setLoading(true)
    setErro(null)

    try {
      const res = await supabaseAdmin.functions.invoke('proteger-pdf', {
        body: { action: 'verificar_proposta', watermark_id: id, senha: senha.trim() },
      })
      if (res.error || !res.data?.ok) {
        setErro(res.data?.error || 'Erro ao verificar')
        return
      }
      setDados(res.data as OrcResult)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de senha ──
  if (!dados) {
    return (
      <div style={page}>
        <div style={card}>
          <div style={logoArea}>
            <div style={logoTxt}>POUSINOX</div>
            <div style={subtitle}>Proposta Comercial Protegida</div>
          </div>
          <p style={desc}>
            Este documento é protegido e rastreável.<br />
            Digite a senha fornecida para acessar.
          </p>
          <form onSubmit={verificar} style={formStyle}>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="Senha de acesso" style={inputStyle} autoFocus disabled={loading} />
            {erro && <p style={erroStyle}>{erro}</p>}
            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Verificando…' : '🔓 Acessar Proposta'}
            </button>
          </form>
          <p style={footerText}>
            🔒 Documento confidencial com marca d'água rastreável.<br />O acesso é registrado e auditável.
          </p>
          <div style={footer}>
            <span>pousinox.com.br</span>
            <span>ID: {id?.slice(0, 8)}…</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Renderização da proposta ──
  const o = dados.orcamento
  const itens = dados.itens
  const wm = dados.watermark
  const proposta = o.proposta_comercial
  const modoProposta = o.modo_proposta

  const subtotal = itens.reduce((s: number, i: any) => s + Number(i.qtd) * Number(i.valor_unit), 0)
  const descValor = o.tipo_desconto === '%' ? subtotal * (Number(o.desconto || 0) / 100) : Number(o.desconto || 0)
  const total = subtotal - descValor + Number(o.frete_valor || 0) + (o.inst_inclui ? Number(o.inst_valor || 0) : 0)

  const emissao = new Date(o.criado_em).toLocaleDateString('pt-BR')
  const valDate = new Date(o.criado_em)
  valDate.setDate(valDate.getDate() + (o.validade_dias ?? 7))
  const validade = valDate.toLocaleDateString('pt-BR')

  // Dados bancários formatados
  const bancarios = (dados.dados_bancarios || []).map((d: any) => {
    const parts: string[] = []
    if (d.pix_chave) parts.push(`PIX: ${d.pix_chave}${d.pix_tipo ? ` (${d.pix_tipo})` : ''}`)
    if (d.banco) {
      let line = `Banco: ${d.banco}`
      if (d.agencia) line += ` · Ag: ${d.agencia}`
      if (d.conta) line += ` · ${d.tipo_conta === 'poupanca' ? 'CP' : 'CC'}: ${d.conta}`
      parts.push(line)
    }
    if (d.titular) parts.push(`Favorecido: ${d.titular}`)
    return parts.join('\n')
  })

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      {/* Watermark overlay */}
      <div style={wmOverlay}>
        <div style={wmText}>{`CONFIDENCIAL · ${wm.empresa}`}</div>
        <div style={wmTextSm}>USO RESTRITO · POUSINOX</div>
        <div style={wmText}>{`CONFIDENCIAL · ${wm.empresa}`}</div>
      </div>

      {/* Banner de aviso */}
      <div style={avisoBanner}>
        🔒 Documento protegido — Destinatário: <strong>{wm.empresa}</strong>
        {wm.cnpj && <> · CNPJ: {wm.cnpj}</>}
        {dados.downloads_restantes >= 0 && <> · Acessos restantes: {dados.downloads_restantes}</>}
      </div>

      <div style={docContainer}>
        {/* Header */}
        <div style={{ height: 4, background: `linear-gradient(90deg, #1B3A5C 0%, #2C5F8A 60%, #b8860b 100%)` }} />
        <div style={headerBand}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B3A5C' }}>POUSINOX</div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, color: '#8896a6', letterSpacing: '0.28em', textTransform: 'uppercase' as const }}>
              {modoProposta ? 'PROPOSTA COMERCIAL' : 'ORÇAMENTO'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B3A5C' }}>{o.numero}</div>
            <div style={{ fontSize: '0.7rem', color: '#5a6578' }}>Emissão: {emissao} · Validade: {validade}</div>
          </div>
        </div>

        <div style={{ padding: '20px 16px 40px' }}>
          {/* Destinatário */}
          <SectionTitle label="DESTINATÁRIO" />
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1B3A5C' }}>
              {o.cliente_empresa || o.cliente_nome}
              {o.cliente_nome_fantasia && <span style={{ fontWeight: 400, color: '#5a6578' }}> ({o.cliente_nome_fantasia})</span>}
            </div>
            {o.cliente_cnpj && <div style={metaLine}>CNPJ: {o.cliente_cnpj}</div>}
            {o.cliente_email && <div style={metaLine}>E-mail: {o.cliente_email}</div>}
            {o.cliente_telefone && <div style={metaLine}>Telefone: {o.cliente_telefone}</div>}
            {o.cliente_cidade && <div style={metaLine}>{o.cliente_cidade}{o.cliente_uf ? `/${o.cliente_uf}` : ''}</div>}
          </div>

          {/* Seções da proposta (se modo proposta) */}
          {modoProposta && proposta && (
            <>
              {proposta.apresentacao && <PropostaBlock titulo="Apresentação" conteudo={proposta.apresentacao} />}
              {proposta.problema && <PropostaBlock titulo="Entendimento da Necessidade e Solução" conteudo={proposta.problema} />}
              {proposta.escopo && <PropostaBlock titulo="Escopo Técnico" conteudo={proposta.escopo} />}
            </>
          )}

          {/* Itens */}
          <SectionTitle label="ITENS" />
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>Descrição</th>
                <th style={th}>Qtd</th>
                <th style={th}>Un</th>
                <th style={th}>Vlr Unit</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item: any, i: number) => (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{item.descricao}</td>
                  <td style={td}>{item.qtd}</td>
                  <td style={td}>{item.unidade}</td>
                  <td style={td}>{fmtBRL(Number(item.valor_unit))}</td>
                  <td style={td}>{fmtBRL(Number(item.qtd) * Number(item.valor_unit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Totais */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ minWidth: 220 }}>
              <div style={totalLine}><span>Subtotal:</span><span>{fmtBRL(subtotal)}</span></div>
              {descValor > 0 && <div style={totalLine}><span>Desconto:</span><span style={{ color: '#dc2626' }}>-{fmtBRL(descValor)}</span></div>}
              {Number(o.frete_valor || 0) > 0 && <div style={totalLine}><span>Frete:</span><span>{fmtBRL(Number(o.frete_valor))}</span></div>}
              {o.inst_inclui && Number(o.inst_valor || 0) > 0 && <div style={totalLine}><span>Instalação:</span><span>{fmtBRL(Number(o.inst_valor))}</span></div>}
              <div style={{ ...totalLine, fontWeight: 800, fontSize: '1rem', color: '#1B3A5C', borderTop: '2px solid #1B3A5C', paddingTop: 6, marginTop: 4 }}>
                <span>Total:</span><span>{fmtBRL(total)}</span>
              </div>
            </div>
          </div>

          {/* Seções da proposta pós-itens */}
          {modoProposta && proposta && (
            <>
              {proposta.cronograma && <PropostaBlock titulo="Cronograma Estimado" conteudo={proposta.cronograma} />}
              {proposta.garantias && <PropostaBlock titulo="Garantias e Condições" conteudo={proposta.garantias} />}
              {proposta.encerramento && <PropostaBlock titulo="Encerramento" conteudo={proposta.encerramento} />}
            </>
          )}

          {/* Condições de pagamento */}
          {(o.dados_pagamento || bancarios.length > 0) && (
            <>
              <SectionTitle label="CONDIÇÕES DE PAGAMENTO" />
              <div style={cardStyle}>
                {o.dados_pagamento && <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.6 }}>{o.dados_pagamento}</div>}
                {bancarios.map((b: string, i: number) => (
                  <div key={i} style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#5a6578', marginTop: 6, paddingTop: 6, borderTop: i > 0 ? '1px solid #eee' : undefined }}>{b}</div>
                ))}
              </div>
            </>
          )}

          {/* Observações */}
          {o.observacoes && (
            <>
              <SectionTitle label="OBSERVAÇÕES" />
              <div style={{ ...cardStyle, whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.6 }}>{o.observacoes}</div>
            </>
          )}

          {/* Rodapé rastreável */}
          <div style={rodape}>
            <span>🔒 DOCUMENTO CONFIDENCIAL · uso restrito ao destinatário identificado</span>
            <span>ID rastreável: <strong>{wm.watermark_id.slice(0, 8)}</strong> · {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-componentes ── */

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2C5F8A' }} />
      <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#2C5F8A', letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  )
}

function PropostaBlock({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <>
      <div style={{ marginTop: 20, marginBottom: 6, padding: '6px 14px', background: '#1B3A5C', borderRadius: '6px 6px 0 0' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.04em' }}>{titulo}</span>
      </div>
      <div style={{ border: '1px solid #dfe4ea', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '12px 14px', whiteSpace: 'pre-wrap', fontSize: '0.84rem', lineHeight: 1.7, color: '#3A3F47' }}>
        {conteudo}
      </div>
    </>
  )
}

/* ── Styles ── */

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', sans-serif",
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '32px 20px', width: 420, maxWidth: '95vw',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 20,
}
const logoArea: React.CSSProperties = { textAlign: 'center', borderBottom: '2px solid #1a3a5c', paddingBottom: 16 }
const logoTxt: React.CSSProperties = { fontSize: '1.6rem', fontWeight: 900, color: '#1a3a5c', letterSpacing: '-0.02em' }
const subtitle: React.CSSProperties = { fontSize: '0.82rem', color: '#64748b', marginTop: 4 }
const desc: React.CSSProperties = { fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, textAlign: 'center' }
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const inputStyle: React.CSSProperties = { padding: '12px 14px', border: '1px solid #d0d7de', borderRadius: 10, fontSize: '1rem', fontFamily: 'inherit', outline: 'none', textAlign: 'center', letterSpacing: '0.1em' }
const erroStyle: React.CSSProperties = { fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }
const btnStyle: React.CSSProperties = { background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }
const footerText: React.CSSProperties = { fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#cbd5e1', borderTop: '1px solid #f1f5f9', paddingTop: 10 }

// Proposta renderizada
const wmOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 80, pointerEvents: 'none', zIndex: 9999, opacity: 0.04, transform: 'rotate(-35deg)',
}
const wmText: React.CSSProperties = { fontSize: 'clamp(1.2rem, 5vw, 3rem)', fontWeight: 900, color: '#000', letterSpacing: '0.05em', whiteSpace: 'nowrap' }
const wmTextSm: React.CSSProperties = { fontSize: '1.2rem', fontWeight: 700, color: '#000', whiteSpace: 'nowrap' }

const avisoBanner: React.CSSProperties = {
  background: '#1B3A5C', color: '#fff', textAlign: 'center', padding: '10px 16px',
  fontSize: '0.78rem', position: 'sticky' as const, top: 0, zIndex: 100,
}

const docContainer: React.CSSProperties = {
  maxWidth: 860, margin: '20px auto', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  borderRadius: 4, overflow: 'hidden', marginLeft: 8, marginRight: 8,
}

const headerBand: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 16px', borderBottom: '2.5px solid #1B3A5C',
  flexWrap: 'wrap', gap: 8,
}

const cardStyle: React.CSSProperties = {
  background: '#fafbfc', border: '1px solid #dfe4ea', borderRadius: 8, padding: '10px 14px',
}

const metaLine: React.CSSProperties = { fontSize: '0.78rem', color: '#5a6578', marginTop: 2 }

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem',
}
const th: React.CSSProperties = {
  background: '#f7f8fa', border: '1px solid #dfe4ea', padding: '8px 10px',
  fontSize: '0.7rem', fontWeight: 700, color: '#5a6578', textAlign: 'center',
}
const td: React.CSSProperties = {
  border: '1px solid #dfe4ea', padding: '7px 10px', textAlign: 'center',
}

const totalLine: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0',
}

const rodape: React.CSSProperties = {
  marginTop: 32, borderTop: '1px solid #dfe4ea', paddingTop: 8,
  display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#8896a6',
  flexWrap: 'wrap', gap: 4,
}
