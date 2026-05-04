import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import QRCode from 'qrcode'
import DiagramaFixador from '../components/DiagramaFixador/DiagramaFixador'
import type { EspecificacaoSalva, ItemCalculado } from '../components/Orcamento/especificacaoTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrcData {
  numero: string
  dataEmissao: string
  dataValidade: string
  validadeDias: number
  empresa: Record<string, any> | null
  vendedor: { nome: string; telefone: string | null } | null
  cliente: {
    nome: string; empresa: string; nome_fantasia?: string; cnpj: string; telefone: string; email: string
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
  desconto: number; tipo_desconto: string; condicoes: string[]; prazo_entrega: string; dados_pagamento: string; dados_bancarios_texto: string[]
  observacoes: string; watermark_ativo: boolean; watermark_texto: string; watermark_logo: boolean
  frete: { tipo: string; modalidade: string; valor: number; prazo: string; obs: string; provedor: string; servico: string }
  instalacao: { inclui: boolean; modalidade: string; texto: string; valor: number }
  exibir: Record<string, boolean>
  anexos: { nome: string; url: string }[]
  modoProposta?: boolean
  proposta?: { apresentacao: string; problema: string; escopo: string; cronograma: string; garantias: string; encerramento: string }
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

// Cores do tema
const C = {
  navy: '#1B3A5C',
  navyLight: '#2C5F8A',
  accent: '#2C5F8A',
  accentSoft: '#dbeafe',
  gold: '#b8860b',
  text: '#3A3F47',
  textMuted: '#5a6578',
  textLight: '#8896a6',
  border: '#dfe4ea',
  borderLight: '#eef1f5',
  bg: '#ffffff',
  bgSoft: '#f7f8fa',
  bgCard: '#fafbfc',
}

const S = {
  page: {
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontSize: '0.82rem', color: C.text, background: C.bg,
    maxWidth: 860, margin: '0 auto', padding: '0',
  } as React.CSSProperties,
  pageBody: { padding: '16px 32px 24px' } as React.CSSProperties,
  loading: { padding: 48, textAlign: 'center' as const, color: C.textMuted },

  // Header
  headerTopBar: {
    height: 4, background: `linear-gradient(90deg, ${C.navy} 0%, ${C.accent} 60%, ${C.gold} 100%)`,
  } as React.CSSProperties,
  headerBand: {
    background: C.bg,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 32px', borderBottom: `2.5px solid ${C.navy}`,
  } as React.CSSProperties,
  logoWrap: {
    height: 80, maxWidth: 240, flexShrink: 0,
    display: 'flex', alignItems: 'center',
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  logo: { height: 80, maxWidth: 240, width: 'auto', objectFit: 'contain' as const },
  logoPlaceholder: { width: 52, height: 52, borderRadius: 10, background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, flexShrink: 0, letterSpacing: '-0.02em' } as React.CSSProperties,
  empresaInfo: {} as React.CSSProperties,
  empresaNome: {} as React.CSSProperties,
  empresaSub: {} as React.CSSProperties,
  empresaDetail: { display: 'block', fontSize: '0.72rem', color: C.textMuted, lineHeight: 1.6 },
  hdrLabel: { color: C.textLight, fontWeight: 600, fontSize: '0.60rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const },

  headerRight: {
    textAlign: 'right' as const, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'flex-end', gap: 2,
  } as React.CSSProperties,
  orcTitulo: { fontSize: '0.56rem', fontWeight: 700, color: C.textLight, letterSpacing: '0.28em', textTransform: 'uppercase' as const },
  orcNum: { fontSize: '1.65rem', fontWeight: 900, color: C.navy, letterSpacing: '-0.02em', lineHeight: 1.1 },
  orcBadge: {} as React.CSSProperties,
  orcData: { fontSize: '0.64rem', color: C.textMuted },

  // Section
  sectionLabel: {
    fontSize: '0.58rem', fontWeight: 700, color: C.accent, letterSpacing: '0.16em',
    textTransform: 'uppercase' as const, marginBottom: 8,
  } as React.CSSProperties,
  sectionDot: { width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 } as React.CSSProperties,

  // Cards
  card: {
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '10px 14px',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '0.56rem', fontWeight: 700, color: C.accent, letterSpacing: '0.14em',
    textTransform: 'uppercase' as const, marginBottom: 6, paddingBottom: 4,
    borderBottom: `1.5px solid ${C.borderLight}`,
  } as React.CSSProperties,
  cardName: { fontSize: '0.84rem', fontWeight: 700, color: C.navy, lineHeight: 1.3, marginBottom: 2 } as React.CSSProperties,

  // Field
  fieldLabel: { fontSize: '0.56rem', color: C.textLight, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 0 } as React.CSSProperties,
  fieldValue: { fontSize: '0.74rem', color: C.text, fontWeight: 500, lineHeight: 1.35 } as React.CSSProperties,
  fieldMono: { fontSize: '0.74rem', color: C.text, fontWeight: 500, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '0.04em' } as React.CSSProperties,

  // Info strip (dados adicionais / entrega)
  infoStrip: {
    background: C.bgSoft, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 8px 8px 0',
    padding: '8px 14px',
  } as React.CSSProperties,
  infoStripTitle: {
    fontSize: '0.54rem', fontWeight: 700, color: C.accent, letterSpacing: '0.12em',
    textTransform: 'uppercase' as const, marginBottom: 4,
  } as React.CSSProperties,

  // Entrega
  entregaStrip: {
    background: '#f0f5ff', borderLeft: `3px solid ${C.navy}`, borderRadius: '0 8px 8px 0',
    padding: '8px 14px', marginBottom: 10,
  } as React.CSSProperties,

  // Divider
  divider: { height: 1, background: C.borderLight, margin: '16px 0' } as React.CSSProperties,

  // Table
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 0, fontSize: '0.78rem' },
  th: { background: C.navy, color: '#fff', padding: '9px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  thRight: { background: C.navy, color: '#fff', padding: '9px 12px', textAlign: 'right' as const, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  thCenter: { background: C.navy, color: '#fff', padding: '9px 12px', textAlign: 'center' as const, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  td: { padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}`, verticalAlign: 'top' as const, color: C.text },
  tdCenter: { padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}`, textAlign: 'center' as const, verticalAlign: 'top' as const, color: C.text },
  tdRight: { padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}`, textAlign: 'right' as const, verticalAlign: 'top' as const, color: C.text, fontVariantNumeric: 'tabular-nums' },
  trEven: { background: C.bgSoft },

  // Totais
  totaisWrap: { display: 'flex', justifyContent: 'flex-end', margin: '6px 0 16px' } as React.CSSProperties,
  totaisBox: { minWidth: 300, background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '14px 20px', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  totaisRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.80rem', color: C.textMuted, fontVariantNumeric: 'tabular-nums' as const } as React.CSSProperties,
  totaisTotal: { borderTop: `3px solid ${C.navy}`, paddingTop: 10, marginTop: 6, fontWeight: 900, fontSize: '1.10rem', color: C.navy } as React.CSSProperties,
  economia: { fontSize: '0.72rem', color: C.navy, background: C.accentSoft, border: `1px solid #93c5fd`, borderRadius: 6, padding: '7px 12px', marginTop: 8, display: 'flex', justifyContent: 'space-between' as const, fontWeight: 600 },

  // Condições
  condicoes: { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  condicaoItem: { fontSize: '0.76rem', color: C.text, lineHeight: 1.6 },

  // Obs
  obsBox: { border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 12, background: C.bg } as React.CSSProperties,
  obsTitle: { fontSize: '0.58rem', fontWeight: 700, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 },

  // Kept for compatibility
  clienteBox: {} as React.CSSProperties,
  clienteTitle: { fontSize: '0.58rem', fontWeight: 700, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 } as React.CSSProperties,
  clienteGrid: {} as React.CSSProperties,
  endEntrega: {} as React.CSSProperties,
  vendedorBar: {} as React.CSSProperties,
  sectionTitle: {} as React.CSSProperties,

  // Assinatura
  assinaturaWrap: { display: 'flex', gap: 56, marginTop: 32, marginBottom: 16 } as React.CSSProperties,
  assinaturaBox: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 0 },
  assinaturaLinha: { width: '100%', height: 1, background: C.navy, marginBottom: 10, opacity: 0.3 },
  assinaturaLabel: { fontSize: '0.72rem', color: C.textMuted, fontWeight: 600 },

  // Footer
  footer: { borderTop: `1.5px solid ${C.borderLight}`, paddingTop: 12, textAlign: 'center' as const, fontSize: '0.66rem', color: C.textLight, letterSpacing: '0.02em' },

  // Watermark
  watermark: {
    position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none' as const, zIndex: 9999,
    fontSize: '5rem', fontWeight: 900, color: 'rgba(200,0,0,0.06)',
    transform: 'rotate(-35deg)', letterSpacing: '0.1em',
    userSelect: 'none' as const,
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintOrcamento() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<OrcData | null>(null)
  const [especificacoes, setEspecificacoes] = useState<EspecificacaoSalva[]>([])
  const [modeloNomes, setModeloNomes] = useState<Record<number, string>>({})
  const [precosMateriais, setPrecosMateriais] = useState<Record<string, number>>({}) // nome → preco_unitario
  const [precosModelo, setPrecosModelo] = useState<Record<number, number>>({}) // modelo_id → preco_unitario
  const [qrCalcUrl, setQrCalcUrl] = useState<string | null>(null)
  const [mapaFreteUrl, setMapaFreteUrl] = useState<string | null>(null)
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

  // Gerar QR code da calculadora quando há especificações
  useEffect(() => {
    if (especificacoes.length === 0) return
    QRCode.toDataURL('https://fixadorporcelanato.com.br/fixador-porcelanato/calculadora', { width: 100, margin: 1 })
      .then(url => setQrCalcUrl(url))
      .catch(() => {})
  }, [especificacoes])

  // Gerar mapa estático de frete (origem → destino) via Canvas + OSM tiles
  useEffect(() => {
    if (!data?.cliente.cidade) return
    const ORIG: [number, number] = [-22.23, -45.94] // Pouso Alegre/MG

    async function gerarMapa() {
      const q = `${data!.cliente.cidade}, ${data!.cliente.uf}, Brazil`
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'PousinoxPDF/1.0' }
        })
        const results = await r.json()
        if (!results.length) return
        const dest: [number, number] = [parseFloat(results[0].lat), parseFloat(results[0].lon)]

        // Calcular centro e zoom
        const centerLat = (ORIG[0] + dest[0]) / 2
        const centerLon = (ORIG[1] + dest[1]) / 2
        const maxDiff = Math.max(Math.abs(ORIG[0] - dest[0]), Math.abs(ORIG[1] - dest[1]))
        const zoom = maxDiff > 15 ? 3 : maxDiff > 8 ? 4 : maxDiff > 4 ? 5 : 6

        const W = 700, H = 350
        const canvas = document.createElement('canvas')
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext('2d')!

        // Converter lat/lon para pixel no tile system
        const n = Math.pow(2, zoom)
        const lonToX = (lon: number) => ((lon + 180) / 360) * n
        const latToY = (lat: number) => {
          const r = Math.PI / 180 * lat
          return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n
        }
        const cx = lonToX(centerLon), cy = latToY(centerLat)

        // Tiles necessários
        const tileSize = 256
        const offsetX = W / 2 - (cx % 1) * tileSize
        const offsetY = H / 2 - (cy % 1) * tileSize
        const baseTileX = Math.floor(cx), baseTileY = Math.floor(cy)

        const tilesX = Math.ceil(W / tileSize) + 1
        const tilesY = Math.ceil(H / tileSize) + 1
        const startTX = baseTileX - Math.floor(tilesX / 2)
        const startTY = baseTileY - Math.floor(tilesY / 2)

        // Carregar tiles
        const tilePromises: Promise<void>[] = []
        for (let dy = 0; dy < tilesY; dy++) {
          for (let dx = 0; dx < tilesX; dx++) {
            const tx = startTX + dx, ty = startTY + dy
            if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue
            const px = offsetX + (tx - baseTileX) * tileSize
            const py = offsetY + (ty - baseTileY) * tileSize
            tilePromises.push(new Promise<void>(resolve => {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.onload = () => { ctx.drawImage(img, px, py, tileSize, tileSize); resolve() }
              img.onerror = () => resolve()
              img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`
            }))
          }
        }
        await Promise.all(tilePromises)

        // Converter coords para pixel no canvas
        const toPixel = (lat: number, lon: number): [number, number] => {
          const x = W / 2 + (lonToX(lon) - cx) * tileSize
          const y = H / 2 + (latToY(lat) - cy) * tileSize
          return [x, y]
        }
        const [ox, oy] = toPixel(ORIG[0], ORIG[1])
        const [dx, dy] = toPixel(dest[0], dest[1])

        // Linha tracejada entre os pontos
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = '#1B3A5C'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(dx, dy); ctx.stroke()
        ctx.setLineDash([])

        // Pin origem (azul)
        ctx.fillStyle = '#2563eb'
        ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
        // Pin destino (vermelho)
        ctx.fillStyle = '#dc2626'
        ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()

        setMapaFreteUrl(canvas.toDataURL('image/png'))
      } catch {}
    }
    gerarMapa()
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
        nome_fantasia: o.cliente_nome_fantasia ?? '',
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
      prazo_entrega: o.prazo_entrega ?? '', dados_pagamento: o.dados_pagamento ?? '', dados_bancarios_texto: [] as string[],
      observacoes: o.observacoes ?? '',
      watermark_ativo: o.watermark_ativo ?? false, watermark_texto: o.watermark_texto ?? 'CONFIDENCIAL', watermark_logo: o.watermark_logo ?? false,
      frete: { tipo: o.frete_tipo ?? '', modalidade: o.frete_modalidade ?? 'cobrar', valor: Number(o.frete_valor ?? 0), prazo: o.frete_prazo ?? '', obs: o.frete_obs ?? '', provedor: o.frete_provedor ?? '', servico: o.frete_servico ?? '' },
      instalacao: { inclui: o.inst_inclui ?? false, modalidade: o.inst_modalidade ?? 'cobrar', texto: o.inst_texto ?? '', valor: Number(o.inst_valor ?? 0) },
      exibir: { cnpj: false, inscricaoEstadual: false, telefone: true, whatsapp: false, email: false, emailNf: false, contatosAdicionais: false, cargo: false, endereco: false, enderecoEntrega: false, entResponsavel: false, obsTecnicaItens: false, instMontagem: false, anexos: false, detalhesLogistica: false, ...(o.exibir_config ?? {}) },
      anexos: (anexosD ?? []) as { nome: string; url: string }[],
      modoProposta: o.modo_proposta ?? false,
      proposta: o.proposta_comercial ?? null,
    })

    // Carregar especificações técnicas
    const { data: especsD } = await supabaseAdmin
      .from('orcamento_especificacoes').select('*')
      .eq('orcamento_id', orcId).order('criado_em')
    if (especsD && especsD.length > 0) {
      // Carregar itens de cada especificação
      const especIds = especsD.map((e: any) => e.id)
      const { data: itensEspec } = await supabaseAdmin
        .from('orcamento_especificacao_itens').select('*')
        .in('especificacao_id', especIds).order('id')
      const itensPorEspec: Record<number, ItemCalculado[]> = {}
      for (const it of (itensEspec ?? []) as any[]) {
        if (!itensPorEspec[it.especificacao_id]) itensPorEspec[it.especificacao_id] = []
        itensPorEspec[it.especificacao_id].push({ nome: it.nome, quantidade: Number(it.quantidade), unidade: it.unidade, tipo: it.tipo })
      }
      const mapped = (especsD as any[]).map(e => ({ ...e, itens: itensPorEspec[e.id] ?? [] })) as EspecificacaoSalva[]
      setEspecificacoes(mapped)
      const precos: Record<string, number> = {}
      // Buscar nomes + preços dos modelos e consumíveis
      const modeloIds = [...new Set(mapped.filter(e => e.modelo_id).map(e => e.modelo_id!))]
      const [modRes, consRes] = await Promise.all([
        modeloIds.length > 0
          ? supabaseAdmin.from('fixador_modelos').select('id, nome, preco_unitario').in('id', modeloIds)
          : Promise.resolve({ data: [] }),
        supabaseAdmin.from('fixador_consumiveis').select('nome, preco_unitario').eq('ativo', true),
      ])
      const precosM: Record<number, number> = {}
      if (modRes.data) {
        setModeloNomes(Object.fromEntries((modRes.data as any[]).map(m => [m.id, m.nome])))
        for (const m of modRes.data as any[]) {
          if (m.preco_unitario) {
            precos[m.nome] = m.preco_unitario
            precosM[m.id] = m.preco_unitario
          }
        }
      }
      setPrecosModelo(precosM)
      if (consRes.data) {
        for (const c of consRes.data as any[]) {
          if (c.preco_unitario) precos[c.nome] = c.preco_unitario
        }
      }
      setPrecosMateriais(precos)
    }

    // Carregar dados bancários selecionados
    const ids: number[] = Array.isArray(o.dados_bancarios_ids) ? o.dados_bancarios_ids : []
    if (ids.length > 0) {
      const { data: bancos } = await supabaseAdmin.from('dados_bancarios').select('*').in('id', ids)
      if (bancos && bancos.length > 0) {
        const textos = (bancos as any[]).map(d => {
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
        setData(prev => prev ? { ...prev, dados_bancarios_texto: textos } : prev)
      }
    }
  }

  if (erro) return <div style={S.loading}>{erro}</div>
  if (!data) return <div style={S.loading}>Carregando orçamento…</div>

  return <Sheet d={data} viewUrl={viewUrl} isPreview={isPreview} especificacoes={especificacoes} modeloNomes={modeloNomes} precosMateriais={precosMateriais} precosModelo={precosModelo} qrCalcUrl={qrCalcUrl} mapaFreteUrl={mapaFreteUrl} />
}

function nomePdf(d: OrcData) {
  const cli = d.cliente.empresa || d.cliente.nome || 'Cliente'
  return `Proposta ${d.numero} — ${cli}`
}

function Sheet({ d, viewUrl, isPreview, especificacoes, modeloNomes, precosMateriais, precosModelo, qrCalcUrl, mapaFreteUrl }: { d: OrcData; viewUrl: string | null; isPreview: boolean; especificacoes: EspecificacaoSalva[]; modeloNomes: Record<number, string>; precosMateriais: Record<string, number>; precosModelo: Record<number, number>; qrCalcUrl: string | null; mapaFreteUrl: string | null }) {
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
          .emp-cli-grid { grid-template-columns: 1fr !important; }
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
        <button onClick={() => window.print()} style={{ background: '#1B3A5C', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.20)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⬇️ Baixar / Imprimir PDF
        </button>
      </div>

      {/* Barra colorida no topo */}
      <div style={S.headerTopBar} />

      {/* Header */}
      <div style={S.headerBand} className="hdr-band">
        {emp?.logo_url
          ? <div style={S.logoWrap}><img src={emp.logo_url} alt="Logo" style={S.logo} /></div>
          : <div style={S.logoPlaceholder}>{(emp?.nome_fantasia ?? 'PX').slice(0,2).toUpperCase()}</div>
        }
        <div style={S.headerRight}>
          <div style={S.orcTitulo}>PROPOSTA COMERCIAL</div>
          <div style={S.orcNum}>Nº {d.numero}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
            <div style={{ fontSize: '0.62rem', color: C.textMuted }}><span style={{ ...S.hdrLabel, marginRight: 3 }}>EMISSÃO</span> {d.dataEmissao}</div>
            <div style={{ fontSize: '0.62rem', color: C.textMuted }}><span style={{ ...S.hdrLabel, marginRight: 3 }}>VALIDADE</span> {d.dataValidade}</div>
          </div>
        </div>
      </div>

      <div style={S.pageBody}>

      {/* ══ QUALIFICAÇÃO — Empresa + Cliente ══ */}
      {(() => {
        const isPF = d.cliente.tipo_pessoa === 'pf'
        const nomeExibido = isPF ? (d.cliente.nome || d.cliente.empresa) : d.cliente.empresa
        const FL = S.fieldLabel, FV = S.fieldValue, FM = S.fieldMono


        return <>
          {/* Blocos unificados — Empresa + Cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }} className="emp-cli-grid">
            {/* ── Empresa ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>Empresa Emissora</div>
              <div style={S.cardName}>{emp?.razao_social || emp?.nome_fantasia || '—'}</div>
              {emp?.razao_social && emp?.nome_fantasia && emp.nome_fantasia !== emp.razao_social && (
                <div style={{ marginBottom: 2 }}><div style={FL}>Nome Fantasia</div><div style={FV}>{emp.nome_fantasia}</div></div>
              )}
              {emp?.cnpj && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                  <div><div style={FL}>CNPJ</div><div style={FM}>{emp.cnpj}</div></div>
                </div>
              )}
              {/* Endereço com campos separados (igual cliente) */}
              {emp?.logradouro ? (
                <>
                  <div style={{ marginBottom: 2 }}><div style={FL}>Endereço</div><div style={FV}>
                    {[emp.logradouro, emp.numero ? `nº ${emp.numero}` : '', emp.complemento].filter(Boolean).join(', ')}
                    {emp.bairro ? ` — ${emp.bairro}` : ''}
                  </div></div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                    {emp.cidade && <div><div style={FL}>Cidade</div><div style={FV}>{emp.cidade}</div></div>}
                    {emp.uf && <div><div style={FL}>UF</div><div style={FV}>{emp.uf}</div></div>}
                    {emp.cep && <div><div style={FL}>CEP</div><div style={FM}>{emp.cep}</div></div>}
                  </div>
                </>
              ) : emp?.endereco ? (
                <div style={{ marginBottom: 2 }}><div style={FL}>Endereço</div><div style={FV}>
                  {(() => {
                    if (!emp.numero) return emp.endereco
                    if (emp.endereco.includes(emp.numero)) return emp.endereco
                    const sep = emp.endereco.includes(' - ') ? ' - ' : ' — '
                    const idx = emp.endereco.indexOf(sep)
                    if (idx < 0) return `${emp.endereco}, nº ${emp.numero}`
                    return `${emp.endereco.slice(0, idx)}, nº ${emp.numero}${emp.endereco.slice(idx)}`
                  })()}
                </div></div>
              ) : null}
              {(emp?.telefone || emp?.email) && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                  {emp?.telefone && <div><div style={FL}>{emp.telefone_is_whatsapp ? 'WhatsApp' : 'Telefone'}</div><div style={FV}>{emp.telefone_is_whatsapp ? <WaLink phone={emp.telefone} style={FV} /> : <TelLink phone={emp.telefone} style={FV} />}</div></div>}
                  {emp?.email && <div><div style={FL}>E-mail</div><div style={FV}><a href={`mailto:${emp.email}`} style={{ ...FV, textDecoration: 'none' }}>{emp.email}</a></div></div>}
                </div>
              )}
              {(emp?.site || d.vendedor) && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
                  {emp?.site && <div><div style={FL}>Site</div><div style={FV}><a href={emp.site.startsWith('http') ? emp.site : `https://${emp.site}`} target="_blank" rel="noreferrer" style={{ ...FV, textDecoration: 'none' }}>{emp.site}</a></div></div>}
                  {d.vendedor && <div><div style={FL}>Consultor</div><div style={FV}>{d.vendedor.nome}{d.vendedor.telefone && <> · <WaLink phone={d.vendedor.telefone} style={FV} /></>}</div></div>}
                </div>
              )}
            </div>

            {/* ── Cliente ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>Cliente</div>
              {nomeExibido && <div style={S.cardName}>{nomeExibido}</div>}
              {d.cliente.nome_fantasia && d.cliente.nome_fantasia !== d.cliente.empresa && (
                <div style={{ marginBottom: 2 }}><div style={FL}>Nome Fantasia</div><div style={FV}>{d.cliente.nome_fantasia}</div></div>
              )}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                {d.exibir.cnpj && d.cliente.cnpj && <div><div style={FL}>{isPF ? 'CPF' : 'CNPJ'}</div><div style={FM}>{d.cliente.cnpj}</div></div>}
                {d.exibir.inscricaoEstadual && d.cliente.inscricao_estadual && <div><div style={FL}>Insc. Estadual</div><div style={FM}>{d.cliente.inscricao_estadual}</div></div>}
              </div>
              {d.exibir.endereco && d.cliente.logradouro && (
                <>
                  <div style={{ marginBottom: 2 }}><div style={FL}>Endereço</div><div style={FV}>
                    {[d.cliente.logradouro, d.cliente.numero ? `nº ${d.cliente.numero}` : '', d.cliente.complemento].filter(Boolean).join(', ')}
                    {d.cliente.bairro ? ` — ${d.cliente.bairro}` : ''}
                  </div></div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                    <div><div style={FL}>Cidade</div><div style={FV}>{d.cliente.cidade || '—'}</div></div>
                    <div><div style={FL}>UF</div><div style={FV}>{d.cliente.uf || '—'}</div></div>
                    {d.cliente.cep && <div><div style={FL}>CEP</div><div style={FM}>{d.cliente.cep}</div></div>}
                  </div>
                </>
              )}
              {d.exibir.endereco && !d.cliente.logradouro && d.cliente.endereco && (
                <div style={{ marginBottom: 2 }}><div style={FL}>Endereço</div><div style={FV}>{d.cliente.endereco}{d.cliente.cidade ? ` — ${d.cliente.cidade}` : ''}{d.cliente.uf ? `/${d.cliente.uf}` : ''}</div></div>
              )}
              {d.cliente.nome && !isPF && (
                <div style={{ marginBottom: 2 }}><div style={FL}>Contato</div><div style={FV}>{d.exibir.cargo && d.cliente.cargo ? `${d.cliente.nome} — ${d.cliente.cargo}` : d.cliente.nome}</div></div>
              )}
              {(d.exibir.telefone || d.exibir.whatsapp || d.exibir.email) && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                  {d.exibir.telefone && d.cliente.telefone && <div><div style={FL}>Telefone</div><div style={FV}><TelLink phone={d.cliente.telefone} style={FV} /></div></div>}
                  {d.exibir.whatsapp && d.cliente.whatsapp && <div><div style={FL}>WhatsApp</div><div style={FV}><WaLink phone={d.cliente.whatsapp} style={FV} /></div></div>}
                  {d.exibir.email && d.cliente.email && <div><div style={FL}>E-mail</div><div style={FV}><a href={`mailto:${d.cliente.email}`} style={{ ...FV, textDecoration: 'none' }}>{d.cliente.email}</a></div></div>}
                </div>
              )}
              {d.exibir.emailNf && d.cliente.email_nf && <div style={{ marginBottom: 2 }}><div style={FL}>E-mail NFs/Boletos</div><div style={FV}>{d.cliente.email_nf}</div></div>}
              {d.exibir.contatosAdicionais && d.cliente.contatos.length > 0 && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
                  {d.cliente.contatos.map((ct, i) => (
                    <div key={i}>
                      <div style={FL}>{{ telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail', email_nf: 'E-mail NFs', email_financeiro: 'E-mail Financeiro', email_compras: 'E-mail Compras', email_engenharia: 'E-mail Engenharia' }[ct.tipo] || 'Contato'}</div>
                      <div style={FV}>{ct.valor}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Local de Entrega */}
          {temEndEnt && (
            <div style={S.entregaStrip}>
              <div style={{ ...S.infoStripTitle, color: C.navy }}>Local de Entrega</div>
              {d.exibir.entResponsavel && d.cliente.ent_responsavel && (
                <div style={{ ...FV, marginBottom: 4 }}>
                  <strong>Resp.:</strong> {d.cliente.ent_responsavel}
                  {d.cliente.ent_telefone ? ` · Tel. ${d.cliente.ent_telefone}` : ''}
                  {d.cliente.ent_whatsapp ? ` · WhatsApp ${d.cliente.ent_whatsapp}` : ''}
                </div>
              )}
              {(d.cliente.ent_logradouro || d.cliente.ent_complemento || d.cliente.ent_bairro || d.cliente.ent_cidade) && (
                <div style={FV}>
                  {[d.cliente.ent_logradouro, d.cliente.ent_numero, d.cliente.ent_complemento].filter(Boolean).join(', ')}
                  {d.cliente.ent_bairro ? ` — ${d.cliente.ent_bairro}` : ''}
                  {d.cliente.ent_cidade ? ` · ${d.cliente.ent_cidade}` : ''}
                  {d.cliente.ent_uf ? `/${d.cliente.ent_uf}` : ''}
                  {d.cliente.ent_cep ? ` · CEP ${d.cliente.ent_cep}` : ''}
                </div>
              )}
            </div>
          )}
        </>
      })()}

      {/* ═══ Seções da Proposta Comercial ═══ */}
      {d.modoProposta && d.proposta && (
        <>
          {d.proposta.apresentacao && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>🏭 Apresentação</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }} dangerouslySetInnerHTML={{ __html: d.proposta.apresentacao.replace(/Construção Civil/g, '<strong>Construção Civil</strong>') }} />
            </div>
          )}
          {d.proposta.problema && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>🎯 Problema e Solução</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }}>{d.proposta.problema}</div>
            </div>
          )}
          {d.proposta.escopo && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>📐 Escopo Técnico</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }}>{d.proposta.escopo}</div>
            </div>
          )}
        </>
      )}

      {/* Itens — oculta tabela vazia quando toggle desligado */}
      {(d.itens.filter(i => i.descricao.trim()).length > 0 || d.exibir.descricaoItensVazios) && (<>
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
            <tr><td colSpan={hasImages ? 7 : 6} style={{ ...S.td, textAlign: 'center', padding: '20px 16px', border: 'none' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                Os itens desta proposta serão detalhados após alinhamento técnico.
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Totais — oculta quando sem itens */}
      {d.itens.filter(i => i.descricao.trim()).length > 0 && (
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
      )}
      </>)}

      {/* Especificação Técnica */}
      {especificacoes.length > 0 && (
        <div style={{ marginBottom: 18, pageBreakInside: 'avoid' }}>
          <div style={{ ...S.clienteTitle, marginBottom: 8 }}><div style={S.sectionDot} />ESPECIFICAÇÃO TÉCNICA DE MATERIAIS</div>
          {especificacoes.map((esp, idx) => {
            const modelo = esp.modelo_id ? modeloNomes[esp.modelo_id] : null
            const findPreco = (nome: string, tipo?: string) => {
              // Fixador/Grampo → usar preço do modelo da especificação
              if ((tipo === 'fixador' || /fixador|grampo/i.test(nome)) && esp.modelo_id && precosModelo[esp.modelo_id]) {
                return precosModelo[esp.modelo_id]
              }
              if (precosMateriais[nome]) return precosMateriais[nome]
              const lower = nome.toLowerCase()
              for (const [k, v] of Object.entries(precosMateriais)) {
                if (k.toLowerCase() === lower) return v
                if (k.toLowerCase().startsWith(lower.split(/[\s(]/)[0]) || lower.startsWith(k.toLowerCase().split(/[\s(]/)[0])) return v
              }
              return 0
            }
            const hasPrecos = esp.itens?.some(i => findPreco(i.nome, i.tipo) > 0) ?? false
            return (
              <div key={esp.id} style={{ ...S.card, marginBottom: 10, pageBreakInside: 'avoid' }}>
                {especificacoes.length > 1 && (
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: C.accent, marginBottom: 6 }}>
                    Medida {idx + 1} — {esp.largura_cm} x {esp.altura_cm} cm
                  </div>
                )}
                <div>
                  {/* KPIs + Tabela */}
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px', marginBottom: 10 }}>
                      {modelo && (
                        <div><div style={S.fieldLabel}>Modelo</div><div style={{ ...S.fieldValue, fontWeight: 600, color: C.navy }}>{modelo}</div></div>
                      )}
                      <div><div style={S.fieldLabel}>Área Total</div><div style={S.fieldValue}>{esp.area_total_m2} m²</div></div>
                      <div><div style={S.fieldLabel}>Dimensões</div><div style={S.fieldValue}>{esp.largura_cm} x {esp.altura_cm} cm</div></div>
                      <div><div style={S.fieldLabel}>Peças</div><div style={S.fieldValue}>{esp.qtd_pecas ?? '—'} un ({esp.perda_pct}% perda)</div></div>
                      <div><div style={S.fieldLabel}>Fixadores/Peça</div><div style={{ ...S.fieldValue, fontWeight: 700, color: C.navy }}>{esp.fixadores_por_peca ?? '—'}</div></div>
                      <div><div style={S.fieldLabel}>Total Fixadores</div><div style={{ ...S.fieldValue, fontWeight: 700, color: C.navy }}>{esp.total_fixadores ?? '—'}</div></div>
                    </div>
                    {/* Tabela de materiais */}
                    {esp.itens && esp.itens.length > 0 && (() => {
                      let subtotalEspec = 0
                      return (
                      <table style={{ ...S.table, fontSize: '0.72rem' }}>
                        <thead>
                          <tr>
                            <th style={{ ...S.th, padding: '6px 10px', fontSize: '0.62rem' }}>Material</th>
                            <th style={{ ...S.thCenter, padding: '6px 10px', fontSize: '0.62rem', width: 70 }}>Qtd</th>
                            <th style={{ ...S.thCenter, padding: '6px 10px', fontSize: '0.62rem', width: 40 }}>Un</th>
                            {hasPrecos && <th style={{ ...S.thRight, padding: '6px 10px', fontSize: '0.62rem', width: 80 }}>Vl. est.</th>}
                            {hasPrecos && <th style={{ ...S.thRight, padding: '6px 10px', fontSize: '0.62rem', width: 90 }}>Total est.</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {esp.itens.map((item, i) => {
                            const preco = findPreco(item.nome, item.tipo)
                            const qtd = Math.ceil(item.quantidade)
                            const totalItem = preco * qtd
                            subtotalEspec += totalItem
                            return (
                            <tr key={i} style={i % 2 === 1 ? S.trEven : undefined}>
                              <td style={{ ...S.td, padding: '5px 10px' }}>{item.nome}</td>
                              <td style={{ ...S.tdCenter, padding: '5px 10px', fontWeight: 600 }}>{qtd.toLocaleString('pt-BR')}</td>
                              <td style={{ ...S.tdCenter, padding: '5px 10px' }}>{item.unidade}</td>
                              {hasPrecos && <td style={{ ...S.tdRight, padding: '5px 10px', fontSize: '0.68rem' }}>{preco > 0 ? fmtBRL(preco) : '—'}</td>}
                              {hasPrecos && <td style={{ ...S.tdRight, padding: '5px 10px', fontWeight: 600 }}>{totalItem > 0 ? fmtBRL(totalItem) : '—'}</td>}
                            </tr>
                            )
                          })}
                          {hasPrecos && subtotalEspec > 0 && (
                            <tr style={{ background: C.bgSoft }}>
                              <td colSpan={3} style={{ ...S.tdRight, padding: '6px 10px', fontWeight: 700, fontSize: '0.70rem', color: C.navy }}>Subtotal estimado</td>
                              <td colSpan={2} style={{ ...S.tdRight, padding: '6px 10px', fontWeight: 800, fontSize: '0.76rem', color: C.navy }}>{fmtBRL(subtotalEspec)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      )
                    })()}
                    {esp.revisao_tecnica && (
                      <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '4px 8px' }}>
                        {esp.revisao_motivos?.length ? esp.revisao_motivos.join(', ') : 'Revisão do responsável técnico recomendada'}
                      </div>
                    )}
                  </div>
                  {/* Diagrama */}
                  {esp.fixadores_por_peca && esp.fixadores_por_peca > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, maxWidth: 160, marginLeft: 'auto', marginRight: 'auto' }}>
                      <DiagramaFixador
                        fixadoresPorPeca={esp.fixadores_por_peca}
                        larguraCm={esp.largura_cm}
                        alturaCm={esp.altura_cm}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {/* Totais consolidados quando múltiplas medidas */}
          {especificacoes.length > 1 && (
            <div style={{ ...S.infoStrip, marginTop: 4, display: 'flex', gap: 24, fontSize: '0.74rem' }}>
              <span><strong>Total geral:</strong> {especificacoes.reduce((s, e) => s + (e.total_fixadores ?? 0), 0).toLocaleString('pt-BR')} fixadores</span>
              <span>{especificacoes.length} medidas de revestimento</span>
              <span>{especificacoes.reduce((s, e) => s + e.area_total_m2, 0).toFixed(1)} m² total</span>
            </div>
          )}
          {/* QR Code da calculadora */}
          {qrCalcUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 12px', background: C.bgSoft, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>
              <img src={qrCalcUrl} alt="QR Calculadora" style={{ width: 64, height: 64, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.70rem', fontWeight: 700, color: C.navy }}>Calculadora de Materiais</div>
                <div style={{ fontSize: '0.64rem', color: C.textMuted, lineHeight: 1.5 }}>
                  Simule outras dimensões de revestimento com nossa ferramenta online gratuita.
                </div>
                <div style={{ fontSize: '0.58rem', color: C.textLight, marginTop: 2 }}>fixadorporcelanato.com.br</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Condições */}
      {(d.condicoes.length > 0 || d.prazo_entrega || d.validadeDias || (temFrete && d.exibir.detalhesLogistica) || (temInst && d.instalacao.texto) || d.observacoes) && (
        <div style={S.condicoes}>
          <div style={{ ...S.clienteTitle, marginBottom: 4 }}><div style={S.sectionDot} />CONDIÇÕES COMERCIAIS</div>
          {d.condicoes.length > 0 && (
            <div style={S.condicaoItem}>
              <strong>Pagamento:</strong> {d.condicoes.join(' · ')}
            </div>
          )}
          {d.dados_bancarios_texto.length > 0 && (
            <div style={{ ...S.condicaoItem, whiteSpace: 'pre-line' }}>
              <strong>Dados para pagamento:</strong>
              {d.dados_bancarios_texto.map((t, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 4 : 8, paddingLeft: 8, borderLeft: '2px solid #e2e8f0' }}>{t}</div>
              ))}
            </div>
          )}
          {d.dados_pagamento && (
            <div style={{ ...S.condicaoItem, whiteSpace: 'pre-line' }}>
              {d.dados_bancarios_texto.length === 0 && <strong>Dados para pagamento:</strong>} {d.dados_pagamento}
            </div>
          )}
          {d.prazo_entrega && (
            <div style={S.condicaoItem}><strong>Prazo de Entrega:</strong> {d.prazo_entrega}</div>
          )}
          {temInst && d.instalacao.texto && (
            <div style={S.condicaoItem}><strong>Instalação:</strong> {d.instalacao.texto}</div>
          )}
          {d.observacoes && (
            <div style={{ ...S.condicaoItem, whiteSpace: 'pre-line' }}>
              <strong>Observações:</strong> {d.observacoes}
            </div>
          )}
        </div>
      )}

      {/* Frete & Logística */}
      {temFrete && d.exibir.detalhesLogistica && (
        <div style={{ ...S.condicoes, pageBreakInside: 'avoid' }}>
          <div style={{ ...S.clienteTitle, marginBottom: 4 }}><div style={S.sectionDot} />FRETE & LOGÍSTICA</div>
          {d.frete.tipo && (
            <div style={S.condicaoItem}><strong>Frete:</strong> {FRETE_TIPOS[d.frete.tipo] ?? d.frete.tipo} — {d.frete.modalidade === 'cobrar' ? 'Cobrar do cliente' : 'Bonificado'}</div>
          )}
          {d.frete.provedor && (
            <div style={S.condicaoItem}><strong>Transportadora:</strong> {d.frete.provedor}{d.frete.servico ? ` — ${d.frete.servico}` : ''}</div>
          )}
          {d.frete.prazo && (
            <div style={S.condicaoItem}><strong>Prazo do Frete:</strong> {d.frete.prazo}</div>
          )}
          {d.frete.obs && (
            <div style={S.condicaoItem}><strong>Observações de Logística:</strong> {d.frete.obs}</div>
          )}
          {mapaFreteUrl && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.navy, marginBottom: 4 }}>Origem: 37550-360 → Destino: {d.cliente.cep}</div>
              <img src={mapaFreteUrl} alt="Mapa de rota" style={{ maxWidth: '100%', borderRadius: 6, border: `1px solid ${C.borderLight}` }} />
            </div>
          )}
        </div>
      )}

      {/* ═══ Cronograma & Garantias (Proposta) ═══ */}
      {d.modoProposta && d.proposta && (
        <>
          {d.proposta.cronograma && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>📅 Cronograma</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }}>{d.proposta.cronograma}</div>
            </div>
          )}
          {d.proposta.garantias && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>🛡️ Garantias</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }}>{d.proposta.garantias}</div>
            </div>
          )}
          {d.proposta.encerramento && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...S.sectionTitle, background: C.navy, color: '#fff', padding: '8px 14px', borderRadius: '6px 6px 0 0', margin: 0 }}>🤝 Encerramento</div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem' }}>{d.proposta.encerramento}</div>
            </div>
          )}
        </>
      )}

      {/* Anexos */}
      {d.exibir.anexos && d.anexos.length > 0 && (
        <div style={S.obsBox}>
          <div style={S.obsTitle}><div style={S.sectionDot} />ANEXOS</div>
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
        {emp?.email && emp?.site && <span>·</span>}
        {emp?.site && <a href={emp.site.startsWith('http') ? emp.site : `https://${emp.site}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{emp.site}</a>}
      </div>

      </div>{/* /pageBody */}
    </div>
  )
}
