import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrcData {
  numero: string
  dataEmissao: string
  dataValidade: string
  validadeDias: number
  empresa: {
    nome_fantasia: string; razao_social: string | null; cnpj: string | null
    numero: string | null; endereco: string | null; telefone: string | null; email: string | null
    site: string | null; logo_url: string | null; telefone_is_whatsapp: boolean | null
  } | null
  vendedor: { nome: string; telefone: string | null } | null
  cliente: {
    nome: string; empresa: string; cnpj: string; telefone: string; email: string
    endereco: string; tipo_pessoa: 'pf' | 'pj'; whatsapp: string; cargo: string
    inscricao_estadual: string; cep: string; cidade: string; uf: string; endereco_entrega: string
    logradouro: string; numero: string; complemento: string; bairro: string
    email_nf: string; contatos: { tipo: string; valor: string }[]
    ent_diferente: boolean; ent_cep: string; ent_logradouro: string; ent_numero: string
    ent_complemento: string; ent_bairro: string; ent_cidade: string; ent_uf: string
    ent_responsavel: string; ent_telefone: string; ent_whatsapp: string
  }
  itens: {
    descricao: string; qtd: number; unidade: string; valor_unit: number
    imagem_url: string | null; preco_original: number | null; obs_tecnica: string | null
  }[]
  desconto: number; tipo_desconto: string; condicoes: string[]; prazo_entrega: string; dados_pagamento: string
  observacoes: string; watermark_ativo: boolean; watermark_texto: string; watermark_logo: boolean
  frete: { tipo: string; modalidade: string; valor: number; prazo: string; obs: string }
  instalacao: { inclui: boolean; modalidade: string; texto: string; valor: number }
  exibir: Record<string, boolean>
  anexos: { nome: string; url: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function waHref(v: string) {
  const digits = v.replace(/\D/g, '')
  const num = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${num}`
}

function TelLink({ phone, style }: { phone: string; style?: React.CSSProperties }) {
  return (
    <a href={`tel:${phone.replace(/\D/g, '')}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748b', textDecoration: 'none', ...style }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.4 2 2 0 0 1 3.54 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"/>
      </svg>
      {phone}
    </a>
  )
}

function WaLink({ phone, style }: { phone: string; style?: React.CSSProperties }) {
  return (
    <a href={waHref(phone)} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748b', textDecoration: 'none', ...style }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#25d366" style={{ flexShrink: 0 }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.858L.057 23.5a.5.5 0 0 0 .611.61l5.701-1.494A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.88 9.88 0 0 1-5.031-1.375l-.36-.214-3.733.979.996-3.648-.235-.374A9.877 9.877 0 0 1 2.118 12C2.118 6.549 6.549 2.118 12 2.118c5.451 0 9.882 4.431 9.882 9.882 0 5.451-4.431 9.882-9.882 9.882z"/>
      </svg>
      {phone}
    </a>
  )
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}
function addDias(base: string, dias: number) {
  const parts = base.split('/'); if (parts.length !== 3) return base
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0])
  d.setDate(d.getDate() + dias); return d.toLocaleDateString('pt-BR')
}

const FRETE_TIPOS: Record<string, string> = {
  'CIF': 'CIF — Por conta do fornecedor', 'FOB': 'FOB — Por conta do comprador',
  'retirada': 'Retirada na fábrica', 'cliente': 'Por conta do cliente', 'a_combinar': 'A combinar',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontSize: '0.80rem', color: '#1e293b', background: '#fff',
    maxWidth: 860, margin: '0 auto', padding: '0',
  } as React.CSSProperties,
  pageBody: { padding: '16px 28px 24px' } as React.CSSProperties,
  loading: { padding: 48, textAlign: 'center' as const, color: '#64748b' },

  // Header
  headerTopBar: { display: 'none' } as React.CSSProperties,
  headerBand: {
    background: '#ffffff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 24px', gap: 24, borderBottom: '1px solid #e2e8f0',
  } as React.CSSProperties,
  headerLeft: { display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 } as React.CSSProperties,
  logoWrap: {
    height: 120, maxWidth: 280, flexShrink: 0,
    display: 'flex', alignItems: 'center',
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  logo: { height: 120, maxWidth: 280, width: 'auto', objectFit: 'contain' as const },
  logoPlaceholder: { width: 40, height: 40, borderRadius: 6, background: '#1a2f4e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, flexShrink: 0 } as React.CSSProperties,
  empresaInfo: { display: 'flex', flexDirection: 'column' as const, gap: 1, lineHeight: 1.4, minWidth: 0, overflow: 'hidden' },
  empresaNome: { display: 'block', fontSize: '0.95rem', fontWeight: 700, color: '#1a2f4e', letterSpacing: '0', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  empresaSub: { display: 'block', fontSize: '0.75rem', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  empresaDetail: { display: 'block', fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },

  headerDivider: { width: 1, background: '#e2e8f0', alignSelf: 'stretch', flexShrink: 0 } as React.CSSProperties,

  headerRight: {
    textAlign: 'right' as const, display: 'flex', flexDirection: 'column' as const,
    justifyContent: 'center', gap: 2, flexShrink: 0, minWidth: 170,
  } as React.CSSProperties,
  orcTitulo: { fontSize: '0.46rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.25em', textTransform: 'uppercase' as const },
  orcNum: { fontSize: '1.45rem', fontWeight: 900, color: '#1a2f4e', letterSpacing: '-0.02em', lineHeight: 1.0 },
  orcBadge: {} as React.CSSProperties,
  orcData: { fontSize: '0.65rem', color: '#64748b' },

  accentLine: { height: 2, background: '#152d4a', margin: '0 0 14px' } as React.CSSProperties,

  // Cliente
  clienteBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 10 } as React.CSSProperties,
  clienteTitle: { fontSize: '0.60rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 5 },
  clienteGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', fontSize: '0.77rem', color: '#334155' } as React.CSSProperties,
  endEntrega: { background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '3px solid #3b82f6', borderRadius: 6, padding: '7px 12px', marginBottom: 10 } as React.CSSProperties,

  // Table
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 0, fontSize: '0.78rem' },
  th: { background: '#1a2f4e', color: '#fff', padding: '7px 10px', textAlign: 'left' as const, fontWeight: 600, fontSize: '0.70rem', letterSpacing: '0.04em' },
  thRight: { background: '#1a2f4e', color: '#fff', padding: '7px 10px', textAlign: 'right' as const, fontWeight: 600, fontSize: '0.70rem', letterSpacing: '0.04em' },
  thCenter: { background: '#1a2f4e', color: '#fff', padding: '7px 10px', textAlign: 'center' as const, fontWeight: 600, fontSize: '0.70rem', letterSpacing: '0.04em' },
  td: { padding: '7px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' as const },
  tdCenter: { padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' as const, verticalAlign: 'top' as const },
  tdRight: { padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' as const, verticalAlign: 'top' as const },
  trEven: { background: '#f8fafc' },

  // Totais
  totaisWrap: { display: 'flex', justifyContent: 'flex-end', margin: '0 0 10px' } as React.CSSProperties,
  totaisBox: { minWidth: 260, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', display: 'flex', flexDirection: 'column' as const, gap: 5 },
  totaisRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' } as React.CSSProperties,
  totaisTotal: { borderTop: '2px solid #1a2f4e', paddingTop: 6, marginTop: 2, fontWeight: 700, fontSize: '0.95rem', color: '#1a2f4e' } as React.CSSProperties,
  economia: { fontSize: '0.70rem', color: '#152d4a', background: '#f0f4f8', border: '1px solid #c8d8e8', borderLeft: '3px solid #152d4a', borderRadius: 4, padding: '5px 10px', marginTop: 6, display: 'flex', justifyContent: 'space-between' as const },

  // Condições
  condicoes: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', flexWrap: 'wrap' as const, gap: '5px 24px' },
  condicaoItem: { fontSize: '0.73rem', color: '#334155' },

  // Obs
  obsBox: { border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, background: '#fff' } as React.CSSProperties,
  obsTitle: { fontSize: '0.60rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 6 },

  // Assinatura
  assinaturaWrap: { display: 'flex', gap: 40, marginTop: 24, marginBottom: 12 } as React.CSSProperties,
  assinaturaBox: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  assinaturaLinha: { width: '100%', height: 1, background: '#cbd5e1', marginBottom: 6 },
  assinaturaLabel: { fontSize: '0.70rem', color: '#64748b' },

  // Footer
  footer: { borderTop: '1px solid #e2e8f0', paddingTop: 8, textAlign: 'center' as const, fontSize: '0.68rem', color: '#94a3b8' },

  // Watermark
  watermark: {
    position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none' as const, zIndex: 9999,
    fontSize: '5rem', fontWeight: 900, color: 'rgba(200,0,0,0.07)',
    transform: 'rotate(-35deg)', letterSpacing: '0.1em',
    userSelect: 'none' as const,
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintOrcamento() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<OrcData | null>(null)
  const [erro, setErro] = useState('')
  const [viewUrl, setViewUrl] = useState<string | null>(null)
  const params = new URLSearchParams(window.location.search)
  const isPreview = params.get('preview') === '1'

  useEffect(() => {
    if (!id) { setErro('ID não informado.'); return }
    load(Number(id))
  }, [id])

  useEffect(() => {
    document.body.classList.add('print-page')

    // Injeta print CSS no <head> — o engine de impressão do Chrome
    // não processa <style> injetado dentro do body (JSX inline)
    const printStyle = document.createElement('style')
    printStyle.id = 'print-orcamento-styles'
    printStyle.textContent = `
      @media print {
        * { overflow: visible !important; box-shadow: none !important; }
        html, body, #root, main {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          display: block !important;
          overflow: visible !important;
        }
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 12mm 10mm; size: A4; }
        .no-print { display: none !important; visibility: hidden !important; }
        .table-scroll { overflow: visible !important; margin: 0 !important; }
      }
    `
    document.head.appendChild(printStyle)

    return () => {
      document.body.classList.remove('print-page')
      document.getElementById('print-orcamento-styles')?.remove()
    }
  }, [])

  useEffect(() => {
    if (!data) return
    document.title = nomePdf(data)
  }, [data])

  async function load(orcId: number) {
    const [{ data: orc }, { data: itensD }, { data: anexosD }, { data: linkD }] = await Promise.all([
      supabaseAdmin.from('orcamentos').select('*').eq('id', orcId).single(),
      supabaseAdmin.from('itens_orcamento').select('*').eq('orcamento_id', orcId).order('ordem'),
      supabaseAdmin.from('orcamentos_anexos').select('*').eq('orcamento_id', orcId).order('criado_em'),
      supabaseAdmin.from('orcamento_links').select('token, short_code').eq('orcamento_id', orcId).eq('ativo', true).limit(1).maybeSingle(),
    ])
    if (linkD) {
      const l = linkD as any
      setViewUrl(l.short_code
        ? `${window.location.origin}/p/${l.short_code}`
        : `${window.location.origin}/view/orcamento/${l.token}`)
    }
    if (!orc) { setErro('Orçamento não encontrado.'); return }
    const o = orc as any

    // Busca razão social diretamente da empresa (fallback para campo salvo)
    let razaoSocial: string | null = o.empresa_razao_social ?? null
    if (o.empresa_id && !razaoSocial) {
      const { data: empD } = await supabaseAdmin.from('empresas_emissoras')
        .select('razao_social').eq('id', o.empresa_id).single()
      razaoSocial = (empD as any)?.razao_social ?? null
    }

    const emissaoDate = new Date(o.criado_em)
    const emissao = emissaoDate.toLocaleDateString('pt-BR')
    const validade = addDias(emissao, o.validade_dias ?? 7)

    setData({
      numero: o.numero,
      dataEmissao: emissao,
      dataValidade: validade,
      validadeDias: o.validade_dias ?? 7,
      empresa: o.empresa_id ? {
        nome_fantasia: o.empresa_nome ?? '', razao_social: razaoSocial,
        cnpj: o.empresa_cnpj ?? null, numero: o.empresa_numero ?? null, endereco: o.empresa_endereco ?? null,
        telefone: o.empresa_telefone ?? null, email: o.empresa_email ?? null,
        site: o.empresa_site ?? null, logo_url: o.empresa_logo_url ?? null,
        telefone_is_whatsapp: o.empresa_telefone_is_whatsapp ?? null,
      } : null,
      vendedor: o.vendedor_nome ? { nome: o.vendedor_nome, telefone: o.vendedor_telefone ? maskPhone(o.vendedor_telefone) : null } : null,
      cliente: {
        nome: o.cliente_nome ?? '', empresa: o.cliente_empresa ?? '',
        cnpj: o.cliente_cnpj ?? '', telefone: o.cliente_telefone ?? '',
        email: o.cliente_email ?? '', endereco: o.cliente_endereco ?? '',
        tipo_pessoa: o.cliente_tipo_pessoa ?? 'pj',
        whatsapp: o.cliente_whatsapp ?? '', cargo: o.cliente_cargo ?? '',
        inscricao_estadual: o.cliente_inscricao_est ?? '',
        cep: o.cliente_cep ?? '', cidade: o.cliente_cidade ?? '',
        uf: o.cliente_uf ?? '', endereco_entrega: o.cliente_endereco_ent ?? '',
        logradouro: o.cliente_logradouro ?? '',
        numero: o.cliente_numero ?? '',
        complemento: o.cliente_complemento ?? '',
        bairro: o.cliente_bairro ?? '',
        email_nf: o.cliente_email_nf ?? '',
        contatos: Array.isArray(o.cliente_contatos) ? o.cliente_contatos : [],
        ent_diferente: !!(o.cliente_ent_logradouro || o.cliente_ent_cep || o.cliente_ent_responsavel),
        ent_cep: o.cliente_ent_cep ?? '',
        ent_logradouro: o.cliente_ent_logradouro ?? '',
        ent_numero: o.cliente_ent_numero ?? '',
        ent_complemento: o.cliente_ent_complemento ?? '',
        ent_bairro: o.cliente_ent_bairro ?? '',
        ent_cidade: o.cliente_ent_cidade ?? '',
        ent_uf: o.cliente_ent_uf ?? '',
        ent_responsavel: o.cliente_ent_responsavel ?? '',
        ent_telefone: o.cliente_ent_telefone ?? '',
        ent_whatsapp: o.cliente_ent_whatsapp ?? '',
      },
      itens: (itensD ?? []).map((i: any) => ({
        descricao: i.descricao, qtd: Number(i.qtd), unidade: i.unidade,
        valor_unit: Number(i.valor_unit), imagem_url: i.imagem_url ?? null,
        preco_original: i.preco_original ? Number(i.preco_original) : null,
        obs_tecnica: i.obs_tecnica ?? null,
      })),
      desconto: Number(o.desconto ?? 0), tipo_desconto: o.tipo_desconto ?? '%',
      condicoes: (() => { const r = o.condicao_pagamento ?? ''; try { return r ? JSON.parse(r) : [] } catch { return r ? [r] : [] } })(),
      prazo_entrega: o.prazo_entrega ?? '', dados_pagamento: o.dados_pagamento ?? '',
      observacoes: o.observacoes ?? '',
      watermark_ativo: o.watermark_ativo ?? false, watermark_texto: o.watermark_texto ?? 'CONFIDENCIAL', watermark_logo: o.watermark_logo ?? false,
      frete: { tipo: o.frete_tipo ?? '', modalidade: o.frete_modalidade ?? 'cobrar', valor: Number(o.frete_valor ?? 0), prazo: o.frete_prazo ?? '', obs: o.frete_obs ?? '' },
      instalacao: { inclui: o.inst_inclui ?? false, modalidade: o.inst_modalidade ?? 'cobrar', texto: o.inst_texto ?? '', valor: Number(o.inst_valor ?? 0) },
      exibir: { cnpj: false, inscricaoEstadual: false, telefone: true, whatsapp: false, email: false, emailNf: false, contatosAdicionais: false, cargo: false, endereco: false, enderecoEntrega: false, entResponsavel: false, obsTecnicaItens: false, instMontagem: false, anexos: false, detalhesLogistica: false, ...(o.exibir_config ?? {}) },
      anexos: (anexosD ?? []) as { nome: string; url: string }[],
    })
  }

  if (erro) return <div style={S.loading}>{erro}</div>
  if (!data) return <div style={S.loading}>Carregando orçamento…</div>

  return <Sheet d={data} viewUrl={viewUrl} isPreview={isPreview} />
}

function nomePdf(d: OrcData) {
  const cli = d.cliente.empresa || d.cliente.nome || 'Cliente'
  return `Proposta ${d.numero} — ${cli}`
}

function Sheet({ d, viewUrl, isPreview }: { d: OrcData; viewUrl: string | null; isPreview: boolean }) {
  const subtotal = d.itens.reduce((s, i) => s + i.qtd * i.valor_unit, 0)
  const valorDesc = d.tipo_desconto === '%'
    ? subtotal * (d.desconto / 100)
    : Math.min(d.desconto, subtotal)
  const freteMod = d.frete.modalidade ?? 'cobrar'
  const instMod = d.instalacao.modalidade ?? 'cobrar'
  const valorFrete = freteMod === 'cobrar' ? (d.frete.valor ?? 0) : 0
  const valorFreteBruto = d.frete.valor ?? 0
  const valorInst = d.instalacao.inclui ? (instMod === 'cobrar' ? (d.instalacao.valor ?? 0) : 0) : 0
  const valorInstBruto = d.instalacao.inclui ? (d.instalacao.valor ?? 0) : 0
  const total = subtotal - valorDesc + valorFrete + valorInst
  const economiaPorItens = d.itens.reduce((s, i) => {
    if (!i.preco_original || i.preco_original <= i.valor_unit) return s
    return s + (i.preco_original - i.valor_unit) * i.qtd
  }, 0)
  const temFrete = d.frete.tipo !== '' || valorFreteBruto > 0
  const temInst = d.instalacao.inclui && (d.instalacao.texto || valorInstBruto > 0)
  const temEndEnt = d.exibir.enderecoEntrega && !!(d.cliente.ent_logradouro || d.cliente.ent_cep || d.cliente.ent_responsavel)
  const hasImages = d.itens.some(i => i.imagem_url)
  const emp = d.empresa

  return (
    <div style={S.page}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }
        @media print {
          * { overflow: visible !important; box-shadow: none !important; }
          html, body, #root, main {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            display: block !important;
          }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm 10mm; size: A4; }
          .no-print { display: none !important; visibility: hidden !important; }
          .table-scroll { margin: 0 !important; }
        }
        @media (max-width: 520px) {
          /* Header */
          .hdr-band { flex-wrap: wrap !important; padding: 10px 14px !important; gap: 10px !important; }
          .hdr-left { flex: 1 1 100% !important; }
          .hdr-right { flex: 1 1 100% !important; text-align: left !important; border-top: 1px solid #e2e8f0; padding-top: 8px !important; }
          .hdr-divider { display: none !important; }
          .emp-detail { white-space: normal !important; overflow: visible !important; text-overflow: unset !important; }
          /* Destinatário */
          .cli-grid { grid-template-columns: 1fr !important; gap: 4px 0 !important; }
          .cnpj-val { word-break: break-all; }
          /* Tabela — scroll horizontal */
          .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -14px; }
          .table-scroll table { min-width: 480px; }
          /* Totais full width */
          .totais-wrap { justify-content: stretch !important; }
          .totais-box { width: 100% !important; }
        }
      `}</style>

      {d.watermark_ativo && (
        d.watermark_logo && emp?.logo_url
          ? <img src={emp.logo_url} alt="" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-30deg)', opacity: 0.06, maxWidth: '60%', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }} />
          : (d.watermark_texto ? <div style={S.watermark}>{d.watermark_texto}</div> : null)
      )}

      {/* Barra de ações — some na impressão e no preview do admin */}
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: isPreview ? 'none' : 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', width: 220 }}>
        {/* WhatsApp */}
        {viewUrl && (
          <a
            href={`https://wa.me/${(d.cliente.whatsapp || d.cliente.telefone).replace(/\D/g,'')}?text=${encodeURIComponent(`Olá${d.cliente.nome ? ', ' + d.cliente.nome.split(' ')[0] : ''}!\n\nEncaminhamos sua *Proposta Comercial N\u00BA ${d.numero}*, v\u00E1lida at\u00E9 ${d.dataValidade}.\n\nAcesse o link abaixo para visualizar todos os detalhes:\n${viewUrl}\n\nQualquer d\u00FAvida, estamos \u00E0 disposi\u00E7\u00E3o.\n\n_${d.vendedor?.nome ?? (d.empresa?.razao_social ?? d.empresa?.nome_fantasia ?? 'Pousinox')}_`)}`}
            target="_blank" rel="noreferrer"
            style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.20)', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.858L.057 23.5a.5.5 0 0 0 .611.61l5.701-1.494A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.88 9.88 0 0 1-5.031-1.375l-.36-.214-3.733.979.996-3.648-.235-.374A9.877 9.877 0 0 1 2.118 12C2.118 6.549 6.549 2.118 12 2.118c5.451 0 9.882 4.431 9.882 9.882 0 5.451-4.431 9.882-9.882 9.882z"/></svg>
            Enviar pelo WhatsApp
          </a>
        )}
        {/* E-mail */}
        {viewUrl && d.cliente.email && (
          <a
            href={`mailto:${d.cliente.email}?subject=${encodeURIComponent(`Proposta Comercial Nº ${d.numero} — Pousinox`)}&body=${encodeURIComponent(`Olá${d.cliente.nome ? ' ' + d.cliente.nome.split(' ')[0] : ''},\n\nSegue o link da sua Proposta Comercial:\n\n${viewUrl}\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\n${d.vendedor?.nome ?? 'Pousinox'}`)}`}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.20)', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            ✉️ Enviar por E-mail
          </a>
        )}
        {/* PDF */}
        <button onClick={() => window.print()} style={{ background: '#1a2f4e', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.20)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⬇️ Baixar / Imprimir PDF
        </button>
      </div>

      {/* Header */}
      <div style={S.headerBand} className="hdr-band">
        <div style={S.headerLeft} className="hdr-left">
          {emp?.logo_url
            ? <div style={S.logoWrap}><img src={emp.logo_url} alt="Logo" style={S.logo} /></div>
            : <div style={S.logoPlaceholder}>{(emp?.nome_fantasia ?? 'PX').slice(0,2).toUpperCase()}</div>
          }
          <div style={S.empresaInfo}>
            {emp?.logo_url
              ? emp?.razao_social && <strong style={S.empresaNome}>{emp.razao_social}</strong>
              : <strong style={S.empresaNome}>{emp?.nome_fantasia ?? '—'}</strong>
            }
            {emp?.cnpj && <span style={S.empresaDetail} className="emp-detail">CNPJ {emp.cnpj}</span>}
            {emp?.endereco && <span style={S.empresaDetail} className="emp-detail">{(() => {
              if (!emp.numero) return emp.endereco
              if (emp.endereco.includes(emp.numero)) return emp.endereco
              const sep = emp.endereco.includes(' - ') ? ' - ' : ' — '
              const idx = emp.endereco.indexOf(sep)
              if (idx < 0) return `${emp.endereco}, nº ${emp.numero}`
              return `${emp.endereco.slice(0, idx)}, nº ${emp.numero}${emp.endereco.slice(idx)}`
            })()}</span>}
            {(emp?.telefone || emp?.email || emp?.site) && (
              <span style={{ ...S.empresaDetail, display: 'flex', flexWrap: 'wrap' as const, gap: '0 10px' }} className="emp-detail">
                {emp.telefone && (emp.telefone_is_whatsapp
                  ? <WaLink phone={emp.telefone} style={{ color: '#64748b' }} />
                  : <TelLink phone={emp.telefone} style={{ color: '#64748b' }} />)}
                {emp.email && <a href={`mailto:${emp.email}`} style={{ color: '#64748b', textDecoration: 'none' }}>{emp.email}</a>}
                {emp.site && <a href={emp.site.startsWith('http') ? emp.site : `https://${emp.site}`} target="_blank" rel="noreferrer" style={{ color: '#64748b', textDecoration: 'none' }}>{emp.site}</a>}
              </span>
            )}
          </div>
        </div>

        <div style={S.headerDivider} className="hdr-divider" />

        <div style={S.headerRight} className="hdr-right">
          <div style={S.orcTitulo}>PROPOSTA COMERCIAL</div>
          <div style={S.orcNum}>Nº {d.numero}</div>
          <div style={{ height: 1, background: '#e2e8f0', margin: '5px 0' }} />
          <div style={S.orcData}>Emissão {d.dataEmissao} · Validade {d.dataValidade}</div>
        </div>
      </div>

      <div style={S.accentLine} />

      <div style={S.pageBody}>

      {/* Destinatário */}
      <div style={S.clienteBox}>
        <div style={S.clienteTitle}>DESTINATÁRIO</div>
        <div style={S.clienteGrid} className="cli-grid">
          {(() => {
            const isPF = d.cliente.tipo_pessoa === 'pf'
            const nomeExibido = isPF ? (d.cliente.nome || d.cliente.empresa) : d.cliente.empresa
            return nomeExibido ? <div><strong>{nomeExibido}</strong></div> : null
          })()}
          {d.exibir.cnpj && d.cliente.cnpj && <div>{d.cliente.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}: <span className="cnpj-val">{d.cliente.cnpj}</span></div>}
          {d.exibir.inscricaoEstadual && d.cliente.inscricao_estadual && <div>IE: {d.cliente.inscricao_estadual}</div>}
          {d.exibir.telefone && d.cliente.telefone && <div><TelLink phone={d.cliente.telefone} /></div>}
          {d.exibir.whatsapp && d.cliente.whatsapp && <div><WaLink phone={d.cliente.whatsapp} /></div>}
          {d.exibir.email && d.cliente.email && <div>E-mail: {d.cliente.email}</div>}
          {d.exibir.emailNf && d.cliente.email_nf && <div>E-mail NFs/Boletos: {d.cliente.email_nf}</div>}
          {d.exibir.contatosAdicionais && d.cliente.contatos.map((ct, i) => (
            <div key={i}>{ct.tipo === 'telefone' ? 'Tel.' : ct.tipo === 'whatsapp' ? 'WhatsApp' : 'E-mail'}: {ct.valor}</div>
          ))}
          {d.cliente.nome && d.cliente.tipo_pessoa !== 'pf' && (
            <div>A/C.: {d.exibir.cargo && d.cliente.cargo ? `${d.cliente.nome} — ${d.cliente.cargo}` : d.cliente.nome}</div>
          )}
          {d.exibir.endereco && (d.cliente.logradouro || d.cliente.endereco) && (
            <div style={{ gridColumn: '1 / -1' }}>
              {d.cliente.logradouro
                ? [d.cliente.logradouro, d.cliente.numero, d.cliente.complemento].filter(Boolean).join(', ') + (d.cliente.bairro ? ` — ${d.cliente.bairro}` : '') + (d.cliente.cidade ? ` · ${d.cliente.cidade}` : '') + (d.cliente.uf ? `/${d.cliente.uf}` : '') + (d.cliente.cep ? ` · CEP ${d.cliente.cep}` : '')
                : d.cliente.endereco + (d.cliente.cidade ? ` — ${d.cliente.cidade}` : '') + (d.cliente.uf ? `/${d.cliente.uf}` : '')
              }
            </div>
          )}
        </div>
      </div>

      {/* Endereço entrega */}
      {temEndEnt && (
        <div style={S.endEntrega}>
          <div style={S.clienteTitle}>LOCAL DE ENTREGA</div>
          {d.exibir.entResponsavel && d.cliente.ent_responsavel && (
            <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 4 }}>
              <strong>Resp.:</strong> {d.cliente.ent_responsavel}
              {d.cliente.ent_telefone ? ` · Tel. ${d.cliente.ent_telefone}` : ''}
              {d.cliente.ent_whatsapp ? ` · WhatsApp ${d.cliente.ent_whatsapp}` : ''}
            </div>
          )}
          {(d.cliente.ent_logradouro || d.cliente.ent_complemento || d.cliente.ent_bairro || d.cliente.ent_cidade) && (
            <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 4 }}>
              {[d.cliente.ent_logradouro, d.cliente.ent_numero, d.cliente.ent_complemento].filter(Boolean).join(', ')}
              {d.cliente.ent_bairro ? ` — ${d.cliente.ent_bairro}` : ''}
              {d.cliente.ent_cidade ? ` · ${d.cliente.ent_cidade}` : ''}
              {d.cliente.ent_uf ? `/${d.cliente.ent_uf}` : ''}
              {d.cliente.ent_cep ? ` · CEP ${d.cliente.ent_cep}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Itens */}
      <div className="table-scroll">
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 24, color: 'rgba(255,255,255,0.35)', fontSize: '0.60rem' }}>#</th>
            {hasImages && <th style={{ ...S.th, width: 52 }} />}
            <th style={S.th}>Descrição</th>
            <th style={S.thCenter}>Qtd</th>
            <th style={S.thCenter}>Un</th>
            <th style={S.thRight}>Vl. Unit.</th>
            <th style={S.thRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {d.itens.filter(i => i.descricao.trim()).map((item, idx) => (
            <tr key={idx} style={idx % 2 === 1 ? S.trEven : undefined}>
              <td style={{ ...S.td, color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</td>
              {hasImages && (
                <td style={{ ...S.td, padding: '4px 6px' }}>
                  {item.imagem_url
                    ? <img src={item.imagem_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'block' }} />
                    : <div style={{ width: 44, height: 44 }} />}
                </td>
              )}
              <td style={S.td}>
                <div>{item.descricao}</div>
                {d.exibir.obsTecnicaItens && item.obs_tecnica && (
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>{item.obs_tecnica}</div>
                )}
              </td>
              <td style={S.tdCenter}>{item.qtd}</td>
              <td style={S.tdCenter}>{item.unidade}</td>
              <td style={S.tdRight}>
                {item.preco_original && item.preco_original > item.valor_unit && (
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', textDecoration: 'line-through', lineHeight: 1 }}>{fmtBRL(item.preco_original)}</div>
                )}
                {item.valor_unit > 0 ? fmtBRL(item.valor_unit) : '—'}
              </td>
              <td style={{ ...S.tdRight, fontWeight: 600 }}>
                {item.qtd > 0 && item.valor_unit > 0 ? fmtBRL(item.qtd * item.valor_unit) : '—'}
              </td>
            </tr>
          ))}
          {d.itens.filter(i => i.descricao.trim()).length === 0 && (
            <tr><td colSpan={hasImages ? 7 : 6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: 16 }}>Sem itens</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Totais */}
      <div style={S.totaisWrap} className="totais-wrap">
        <div style={S.totaisBox} className="totais-box">
          <div style={S.totaisRow}><span>Subtotal</span><span>{fmtBRL(subtotal)}</span></div>
          {valorDesc > 0 && (
            <div style={{ ...S.totaisRow, color: '#64748b' }}>
              <span>Desconto</span>
              <s style={{ color: '#94a3b8', fontWeight: 400 }}>−{fmtBRL(valorDesc)}</s>
            </div>
          )}
          {economiaPorItens > 0 && (
            <div style={{ ...S.totaisRow, color: '#64748b' }}>
              <span>Desconto nos itens</span>
              <s style={{ color: '#94a3b8', fontWeight: 400 }}>{fmtBRL(economiaPorItens)}</s>
            </div>
          )}
          {temFrete && freteMod === 'cobrar' && valorFrete > 0 && (
            <div style={S.totaisRow}>
              <span>Frete{d.frete.tipo ? ` (${FRETE_TIPOS[d.frete.tipo] ?? d.frete.tipo})` : ''}</span>
              <span>{fmtBRL(valorFrete)}</span>
            </div>
          )}
          {temFrete && freteMod === 'bonus' && valorFreteBruto > 0 && (
            <div style={{ ...S.totaisRow, color: '#64748b' }}>
              <span>Frete Bonificado</span>
              <s style={{ color: '#94a3b8', fontWeight: 400 }}>{fmtBRL(valorFreteBruto)}</s>
            </div>
          )}
          {temInst && instMod === 'cobrar' && valorInst > 0 && (
            <div style={S.totaisRow}><span>Instalação/Montagem</span><span>{fmtBRL(valorInst)}</span></div>
          )}
          {temInst && instMod === 'bonus' && valorInstBruto > 0 && (
            <div style={{ ...S.totaisRow, color: '#64748b' }}>
              <span>Instalação Bonificada</span>
              <s style={{ color: '#94a3b8', fontWeight: 400 }}>{fmtBRL(valorInstBruto)}</s>
            </div>
          )}
          <div style={{ ...S.totaisRow, ...S.totaisTotal }}><span>TOTAL</span><span>{fmtBRL(total)}</span></div>
          {(() => {
            const totalEconomia = valorDesc + economiaPorItens
              + (freteMod === 'bonus' ? valorFreteBruto : 0)
              + (temInst && instMod === 'bonus' ? valorInstBruto : 0)
            return totalEconomia > 0 ? (
              <div style={S.economia}>
                <span>Economia total nesta proposta</span>
                <strong>{fmtBRL(totalEconomia)}</strong>
              </div>
            ) : null
          })()}
        </div>
      </div>

      {/* Condições */}
      {(d.condicoes.length > 0 || d.prazo_entrega || d.validadeDias || (temFrete && d.exibir.detalhesLogistica) || (temInst && d.instalacao.texto)) && (
        <div style={S.condicoes}>
          {d.condicoes.length > 0 && (
            <div style={S.condicaoItem}>
              <strong>Pagamento:</strong> {d.condicoes.join(' · ')}
            </div>
          )}
          {d.dados_pagamento && (
            <div style={{ ...S.condicaoItem, whiteSpace: 'pre-line' }}>
              <strong>Dados para pagamento:</strong> {d.dados_pagamento}
            </div>
          )}
          {d.prazo_entrega && (
            <div style={S.condicaoItem}><strong>Prazo de Entrega:</strong> {d.prazo_entrega}</div>
          )}
          {temFrete && d.exibir.detalhesLogistica && d.frete.prazo && (
            <div style={S.condicaoItem}><strong>Prazo do Frete:</strong> {d.frete.prazo}</div>
          )}
          {temFrete && d.exibir.detalhesLogistica && d.frete.obs && (
            <div style={S.condicaoItem}><strong>Logística:</strong> {d.frete.obs}</div>
          )}
          {temInst && d.instalacao.texto && (
            <div style={S.condicaoItem}><strong>Instalação:</strong> {d.instalacao.texto}</div>
          )}
          <div style={S.condicaoItem}><strong>Validade:</strong> {d.validadeDias} dias — até {d.dataValidade}</div>
        </div>
      )}

      {/* Observações */}
      {d.observacoes && (
        <div style={S.obsBox}>
          <div style={S.obsTitle}>OBSERVAÇÕES</div>
          <div style={{ whiteSpace: 'pre-line', fontSize: '0.72rem', color: '#475569', lineHeight: 1.6 }}>{d.observacoes}</div>
        </div>
      )}

      {/* Anexos */}
      {d.exibir.anexos && d.anexos.length > 0 && (
        <div style={S.obsBox}>
          <div style={S.obsTitle}>ANEXOS</div>
          {d.anexos.map((a, i) => <div key={i} style={{ fontSize: '0.72rem', color: '#1d4ed8' }}>📎 {a.nome} — {a.url}</div>)}
        </div>
      )}

      {/* Assinatura */}
      <div style={S.assinaturaWrap}>
        <div style={S.assinaturaBox}>
          <div style={S.assinaturaLinha} />
          <span style={{ ...S.assinaturaLabel, display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const }}>
            <span>
              {emp?.nome_fantasia
                ? (emp.nome_fantasia.toLowerCase().includes('pousinox') ? emp.nome_fantasia.replace(/Pousinox(?!®)/g, 'Pousinox®') : emp.nome_fantasia)
                : 'Fornecedor'}
              {d.vendedor && ` · ${d.vendedor.nome}`}
            </span>
            {d.vendedor?.telefone && <><span>·</span><WaLink phone={d.vendedor.telefone} style={{ fontSize: '0.70rem' }} /></>}
          </span>
        </div>
        <div style={S.assinaturaBox}>
          <div style={S.assinaturaLinha} />
          <span style={S.assinaturaLabel}>{d.cliente.empresa || d.cliente.nome || 'Cliente'}</span>
        </div>
      </div>

      <div style={{ ...S.footer, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
        {emp?.email && <a href={`mailto:${emp.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{emp.email}</a>}
        {emp?.email && (emp?.site || emp?.telefone) && <span>·</span>}
        {emp?.site && <a href={emp.site.startsWith('http') ? emp.site : `https://${emp.site}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{emp.site}</a>}
        {emp?.site && emp?.telefone && <span>·</span>}
        {emp?.telefone && <WaLink phone={emp.telefone} style={{ color: '#94a3b8', fontSize: '0.68rem' }} />}
      </div>

      </div>{/* /pageBody */}
    </div>
  )
}
