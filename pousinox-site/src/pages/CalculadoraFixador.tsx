/**
 * CalculadoraFixador — Página pública para cálculo de materiais
 * Rota: /fixador-porcelanato/calculadora
 * Login obrigatório via WhatsApp OTP antes de ver resultado.
 * Feature flag: calculadora_fixador
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { usePublicFlag } from '../hooks/useFeatureFlags'
import { supabase } from '../lib/supabase'
import { calcularEspecificacao, REGRAS_PADRAO, CONSUMIVEIS_PADRAO } from '../lib/calcularEspecificacao'
import type { ResultadoEspecificacao, StatusAnalise } from '../components/Orcamento/especificacaoTypes'
import s from './CalculadoraFixador.module.css'

const WA_NUMERO = '5535999619463'

// GA4 event helper
const track = (name: string, params?: Record<string, unknown>) => {
  window.gtag?.('event', name, params)
}

// Lightbox state type
type LightboxImg = { src: string; alt: string } | null

type ModeloCalc = {
  id: number; nome: string; material: string; espessura: string
  largura_mm: number | null; comprimento_mm: number | null
  laudo: boolean; desc: string; imagem_url: string | null; abertura_mm: number | null
  preco_unitario: number | null
}

const MODELOS_FALLBACK: ModeloCalc[] = [
  { id: 1, nome: 'Fixador de Porcelanato Aço Inox 304', material: 'Aço Inox 304', espessura: '0.8mm', largura_mm: 40, comprimento_mm: 120, laudo: true, desc: 'Previne queda de porcelanato em fachadas com ancoragem mecânica em inox 304 — resistente à corrosão em áreas externas e ambientes úmidos. Para revestimentos de 5 a 8 mm.', imagem_url: '/images/fixadores/fixador-porcelanato-5mm.png', abertura_mm: 5, preco_unitario: null },
  { id: 2, nome: 'Fixador de Porcelanato Aço Inox 304', material: 'Aço Inox 304', espessura: '0.8mm', largura_mm: 40, comprimento_mm: 120, laudo: true, desc: 'Previne queda de porcelanato em fachadas com ancoragem mecânica em inox 304 — resistente à corrosão em áreas externas e ambientes úmidos. Para revestimentos de 9 a 14 mm.', imagem_url: '/images/fixadores/fixador-porcelanato-11mm.png', abertura_mm: 11, preco_unitario: null },
  { id: 3, nome: 'Fixador de Porcelanato Aço Inox 430', material: 'Aço Inox 430', espessura: '0.8mm', largura_mm: 40, comprimento_mm: 120, laudo: true, desc: 'Previne queda de porcelanato com ancoragem mecânica em inox 430 — solução econômica para áreas internas sem exposição à umidade. Para revestimentos de 5 a 8 mm.', imagem_url: '/images/fixadores/fixador-porcelanato-5mm.png', abertura_mm: 5, preco_unitario: null },
  { id: 4, nome: 'Fixador de Porcelanato Aço Inox 430', material: 'Aço Inox 430', espessura: '0.8mm', largura_mm: 40, comprimento_mm: 120, laudo: true, desc: 'Previne queda de porcelanato com ancoragem mecânica em inox 430 — solução econômica para áreas internas sem exposição à umidade. Para revestimentos de 9 a 14 mm.', imagem_url: '/images/fixadores/fixador-porcelanato-11mm.png', abertura_mm: 11, preco_unitario: null },
]

const STATUS_VISUAL: Record<StatusAnalise, { bg: string; border: string; color: string; icon: string; label: string }> = {
  padrao:  { bg: '#f0fdf4', border: '#16a34a', color: '#166534', icon: '✅', label: 'Estimativa padrão — dados dentro da faixa técnica' },
  alerta:  { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', icon: '⚠️', label: 'Estimativa com alerta — recomendamos contato técnico' },
  revisao: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: '🔍', label: 'Revisão técnica recomendada — entre em contato' },
}

const ESPESSURAS_COMUNS = [
  { value: '', label: 'Não sei / informar depois' },
  { value: '7', label: '7 mm — Padrão econômico' },
  { value: '8', label: '8 mm — Padrão comercial' },
  { value: '9', label: '9 mm — Padrão residencial' },
  { value: '10', label: '10 mm — Retificado' },
  { value: '11', label: '11 mm — Grande formato' },
  { value: '12', label: '12 mm — Grande formato reforçado' },
  { value: '14', label: '14 mm — Porcelanato técnico' },
  { value: '20', label: '20 mm — Externo / sobre-elevado' },
]

// Sessão salva em localStorage
const STORAGE_KEY = 'pousinox_calc_session'

interface CalcSession {
  nome: string
  whatsapp: string
  verificado: boolean
  lead_id?: number
}

function loadSession(): CalcSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const sess = JSON.parse(raw)
    if (sess.verificado) return sess
  } catch { /* ignore */ }
  return null
}

function saveSession(sess: CalcSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sess))
}

// ── Componente principal ────────────────────────────────────────────────────

export default function CalculadoraFixador() {
  const enabled = usePublicFlag('calculadora_fixador')
  if (!enabled) return <Navigate to="/fixador-porcelanato" replace />

  // Auth state
  const [session, setSession] = useState<CalcSession | null>(loadSession)
  const [etapa, setEtapa] = useState<'form' | 'resultado'>('form')
  const [showGate, setShowGate] = useState<'none' | 'login' | 'otp' | 'complemento'>('none')
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const [loginNome, setLoginNome] = useState('')
  const [loginWa, setLoginWa] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginEmpresa, setLoginEmpresa] = useState('')
  const [loginCep, setLoginCep] = useState('')
  const [loginEndereco, setLoginEndereco] = useState('')
  const [loginCnpj, setLoginCnpj] = useState('')
  const [loginRazaoSocial, setLoginRazaoSocial] = useState('')
  const [loginSegmento, setLoginSegmento] = useState('')
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf')
  const [otpCodigo, setOtpCodigo] = useState('')
  const [waMasked, setWaMasked] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authErro, setAuthErro] = useState<string | null>(null)
  const [reenvioTimer, setReenvioTimer] = useState(0)

  // Catálogo de revestimentos para autocomplete
  type Revestimento = { id: number; fabricante: string; formato: string; largura_cm: number; altura_cm: number; espessura_mm: number | null; peso_peca_kg: number | null; peso_m2_kg: number | null }
  const [revestimentos, setRevestimentos] = useState<Revestimento[]>([])
  const [revQuery, setRevQuery] = useState('')
  const [revOpen, setRevOpen] = useState(false)
  useEffect(() => {
    supabase.from('revestimentos_catalogo').select('id, fabricante, formato, largura_cm, altura_cm, espessura_mm, peso_peca_kg, peso_m2_kg').eq('ativo', true).order('formato')
      .then(({ data }) => { if (data?.length) setRevestimentos(data) })
  }, [])
  const revFiltrados = useMemo(() => {
    if (!revQuery.trim()) return revestimentos.slice(0, 15)
    const q = revQuery.toLowerCase()
    return revestimentos.filter(r =>
      r.formato.toLowerCase().includes(q) ||
      r.fabricante.toLowerCase().includes(q) ||
      `${r.largura_cm}x${r.altura_cm}`.includes(q)
    ).slice(0, 15)
  }, [revestimentos, revQuery])
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

  // Modelos dinâmicos do banco
  const [modelos, setModelos] = useState<ModeloCalc[]>(MODELOS_FALLBACK)
  const [consumiveisDb, setConsumiveisDb] = useState<{ nome: string; preco_unitario: number | null; proporcao_por: number }[]>([])
  useEffect(() => {
    supabase.from('fixador_modelos').select('id, nome, material, espessura_mm, largura_mm, comprimento_mm, obs_tecnica, possui_laudo, imagem_url, abertura_aba_mm, preco_unitario').eq('ativo', true).order('id')
      .then(({ data }) => {
        if (data?.length) {
          setModelos(data.map(m => ({
            id: m.id,
            nome: m.nome,
            material: m.material,
            espessura: m.espessura_mm + 'mm',
            largura_mm: m.largura_mm,
            comprimento_mm: m.comprimento_mm,
            laudo: m.possui_laudo,
            desc: m.obs_tecnica || '',
            imagem_url: m.imagem_url,
            abertura_mm: m.abertura_aba_mm,
            preco_unitario: m.preco_unitario,
          })))
        }
      })
    supabase.from('fixador_consumiveis').select('nome, preco_unitario, proporcao_por').order('ordem')
      .then(({ data }) => { if (data) setConsumiveisDb(data) })
  }, [])

  // Modelo selecionado (índice direto no array modelos)
  const [modeloIdx, setModeloIdx] = useState(0)
  const [lightbox, setLightbox] = useState<LightboxImg>(null)

  // Collapsible form
  const [formOpen, setFormOpen] = useState(true)

  // Calculator state
  const [aplicacao, setAplicacao] = useState<'externo' | 'interno'>('externo')
  const [areaTotal, setAreaTotal] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [espessura, setEspessura] = useState('')

  // Auto-selecionar modelo baseado na espessura do revestimento
  useEffect(() => {
    const esp = parseFloat(espessura) || 0
    if (esp <= 0 || modelos.length === 0) return
    // espessura <= 8mm → abertura 5mm (304 primeiro), > 8mm → abertura 11mm (304 primeiro)
    const abertura = esp > 8 ? 11 : 5
    const idx = modelos.findIndex(m => m.abertura_mm === abertura && m.material.includes('304'))
    if (idx >= 0 && idx !== modeloIdx) setModeloIdx(idx)
  }, [espessura, modelos])
  const [pesoPeca, setPesoPeca] = useState('')
  const [resultado, setResultado] = useState<ResultadoEspecificacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackTipo, setFeedbackTipo] = useState<'sugestao' | 'problema' | 'elogio'>('sugestao')
  const [feedbackEnviado, setFeedbackEnviado] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  // Timer para reenvio
  useEffect(() => {
    if (reenvioTimer <= 0) return
    const t = setTimeout(() => setReenvioTimer(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [reenvioTimer])

  function handleCalcular(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const area = parseFloat(areaTotal.replace(',', '.'))
    const larg = parseFloat(largura.replace(',', '.'))
    const alt = parseFloat(altura.replace(',', '.'))

    if (!area || area <= 0) { setErro('Informe a área total da obra.'); return }
    if (!larg || larg <= 0 || !alt || alt <= 0) { setErro('Informe as dimensões da peça (largura e altura).'); return }

    const res = calcularEspecificacao(
      {
        area_total_m2: area,
        largura_cm: larg,
        altura_cm: alt,
        espessura_mm: parseFloat(espessura) || undefined,
        peso_peca_kg: parseFloat(pesoPeca.replace(',', '.')) || undefined,
        perda_pct: 10,
        modelo_id: modelos[modeloIdx].id,
        abertura_mm: modelos[modeloIdx].abertura_mm ?? undefined,
        material: modelos[modeloIdx].material,
      },
      REGRAS_PADRAO,
      CONSUMIVEIS_PADRAO,
    )
    setResultado(res)
    setEtapa('resultado')
    setFormOpen(false)
    track('calculator_submit', { formato: `${larg}x${alt}`, area, modelo: modelos[modeloIdx].nome })
    setTimeout(() => {
      document.getElementById('resultado-calc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  async function enviarOtp() {
    if (!loginNome.trim()) { setAuthErro('Informe seu nome.'); return }
    if (!loginWa.trim() || loginWa.replace(/\D/g, '').length < 10) { setAuthErro('Informe um WhatsApp válido com DDD.'); return }

    setAuthLoading(true)
    setAuthErro(null)

    try {
      const res = await supabase.functions.invoke('calculadora-otp', {
        body: {
          action: 'enviar',
          nome: loginNome.trim(),
          whatsapp: loginWa.trim(),
          email: loginEmail.trim() || undefined,
          empresa: tipoPessoa === 'pj' ? loginRazaoSocial.trim() : (loginEmpresa.trim() || undefined),
          cep: loginCep.replace(/\D/g, ''),
          endereco: loginEndereco.trim() || undefined,
          cnpj: tipoPessoa === 'pj' ? loginCnpj.replace(/\D/g, '') : undefined,
          razao_social: tipoPessoa === 'pj' ? loginRazaoSocial.trim() : undefined,
          segmento: tipoPessoa === 'pj' ? loginSegmento.trim() : undefined,
          tipo_pessoa: tipoPessoa,
        },
      })

      if (res.error || !res.data?.ok) {
        setAuthErro(res.data?.error || res.error?.message || 'Erro ao enviar código.')
        return
      }

      setWaMasked(res.data.whatsapp_masked || '')
      setShowGate('otp')
      setReenvioTimer(60)
      track('calculator_otp_sent', { whatsapp_masked: res.data.whatsapp_masked })
    } catch (err) {
      setAuthErro((err as Error).message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function verificarOtp() {
    if (!otpCodigo.trim() || otpCodigo.trim().length !== 6) { setAuthErro('Digite o código de 6 dígitos.'); return }

    setAuthLoading(true)
    setAuthErro(null)

    try {
      const res = await supabase.functions.invoke('calculadora-otp', {
        body: {
          action: 'verificar',
          whatsapp: loginWa.trim(),
          codigo: otpCodigo.trim(),
        },
      })

      if (res.error || !res.data?.ok) {
        setAuthErro(res.data?.error || res.error?.message || 'Código inválido.')
        return
      }

      const sess: CalcSession = {
        nome: loginNome.trim(),
        whatsapp: loginWa.trim(),
        verificado: true,
        lead_id: res.data.lead_id,
      }
      setSession(sess)
      saveSession(sess)
      setShowConfirmacao(true)
      track('calculator_otp_verified', { lead_id: res.data.lead_id })
      setShowGate('complemento')

      setTimeout(() => {
        setShowConfirmacao(false)
      }, 3000)
      setTimeout(() => {
        document.getElementById('detalhe-completo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    } catch (err) {
      setAuthErro((err as Error).message)
    } finally {
      setAuthLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setShowGate('none')
    setOtpCodigo('')
    setLoginNome('')
    setLoginWa('')
  }

  async function salvarComplemento() {
    // Salva dados extras no lead após verificação
    if (!session?.lead_id) { setShowGate('none'); return }
    const updates: Record<string, string | undefined> = {}
    if (loginCep.trim()) updates.cep = loginCep.replace(/\D/g, '')
    if (loginEmail.trim()) updates.email = loginEmail.trim()
    if (loginEmpresa.trim()) updates.empresa = loginEmpresa.trim()
    if (loginEndereco.trim()) updates.endereco = loginEndereco.trim()
    if (tipoPessoa === 'pj') {
      if (loginCnpj.trim()) updates.cnpj = loginCnpj.replace(/\D/g, '')
      if (loginRazaoSocial.trim()) updates.razao_social = loginRazaoSocial.trim()
      if (loginSegmento.trim()) updates.segmento = loginSegmento.trim()
      updates.tipo_pessoa = 'pj'
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('calculadora_leads').update(updates).eq('id', session.lead_id)
      track('calculator_lead_complete', { segmento: updates.segmento, tipo_pessoa: tipoPessoa })
    }
    setShowGate('none')
  }

  async function enviarFeedback() {
    if (!feedbackMsg.trim()) return
    setFeedbackLoading(true)
    try {
      await supabase.from('calculadora_feedback').insert({
        lead_id: session?.lead_id || null,
        tipo: feedbackTipo,
        mensagem: feedbackMsg.trim(),
      })
      setFeedbackEnviado(true)
      setFeedbackMsg('')
    } catch { /* ignore */ }
    setFeedbackLoading(false)
  }

  function gerarMsgWa() {
    if (!resultado) return ''
    const modelo = modelos[modeloIdx]
    const precoLine = modelo.preco_unitario
      ? `• Estimativa fixadores: R$ ${(modelo.preco_unitario * resultado.total_fixadores).toFixed(2).replace('.', ',')}\n`
      : ''
    const nome = session?.nome || loginNome.trim() || ''
    return encodeURIComponent(
      `Olá${nome ? `, meu nome é ${nome}` : ''}! Fiz uma simulação na calculadora de materiais do site:\n\n` +
      `• Aplicação: ${aplicacao === 'externo' ? 'Fachada / Externo' : 'Parede Interna'}\n` +
      `• Área: ${areaTotal} m²\n` +
      `• Peça: ${largura} × ${altura} cm${espessura ? ` (${espessura}mm)` : ''}\n` +
      `• Modelo: ${modelo.nome}\n` +
      `• Peças estimadas: ${resultado.qtd_pecas}\n` +
      `• Total fixadores: ${resultado.total_fixadores}\n` +
      `${resultado.peso_peca_kg ? `• Peso estimado/peça: ${resultado.peso_peca_kg.toFixed(2)} kg\n` : ''}` +
      precoLine +
      `\nGostaria de solicitar um orçamento com esses materiais.`
    )
  }

  const modelo = modelos[modeloIdx]

  return (
    <>
      <SEO
        title="Calculadora de Fixador de Porcelanato — Quantos Fixadores por m²"
        description="Calcule quantos fixadores de porcelanato são necessários para sua fachada ou parede. Ferramenta gratuita com base em ensaio técnico SENAI/LAMAT. Especificação de materiais: fixadores, parafusos, buchas e adesivo PU."
        path="/fixador-porcelanato/calculadora"
        keywords="fixador de porcelanato, calculadora fixador porcelanato, quantos fixadores por m2, fixador para fachada, grampo porcelanato, fixador inox 304, fixador inox 430, queda de porcelanato fachada, ancoragem mecânica porcelanato, fixador POUSINOX, especificação técnica fixador, NBR 13755, fixador porcelanato preço"
        extraSchema={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Calculadora de Fixadores de Porcelanato POUSINOX®',
            description: 'Ferramenta gratuita para calcular a quantidade de fixadores de porcelanato, parafusos, buchas e consumíveis para fachadas e paredes.',
            url: 'https://pousinox.com.br/fixador-porcelanato/calculadora',
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
            creator: { '@type': 'Organization', name: 'POUSINOX®', url: 'https://pousinox.com.br' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Quantos fixadores de porcelanato por m²?',
                acceptedAnswer: { '@type': 'Answer', text: 'A quantidade varia conforme o peso e dimensão da peça. Em média, são necessários 2 a 3 fixadores por peça. Use a calculadora POUSINOX para obter a quantidade exata com base no seu revestimento.' },
              },
              {
                '@type': 'Question',
                name: 'Qual a diferença entre fixador inox 304 e 430?',
                acceptedAnswer: { '@type': 'Answer', text: 'O inox 304 contém cromo e níquel, sendo resistente à corrosão — ideal para fachadas e áreas externas. O inox 430 é mais econômico e indicado para áreas internas sem exposição à umidade.' },
              },
              {
                '@type': 'Question',
                name: 'Como funciona o fixador de porcelanato?',
                acceptedAnswer: { '@type': 'Answer', text: 'O fixador é um grampo em aço inox que fornece ancoragem mecânica ao porcelanato. A peça recebe argamassa colante normalmente e uma incisão é feita na borda com disco diamantado. Aplica-se adesivo PU na incisão, o fixador é parafusado na parede e sua aba encaixa na incisão, prevenindo a queda do revestimento.' },
              },
              {
                '@type': 'Question',
                name: 'O fixador substitui a argamassa colante?',
                acceptedAnswer: { '@type': 'Answer', text: 'Não. A argamassa colante é aplicada na peça toda normalmente. O fixador é um sistema complementar de segurança mecânica — parafusado na parede, sua aba encaixa na incisão do porcelanato com adesivo PU, criando dupla ancoragem contra o desprendimento.' },
              },
            ],
          },
        ]}
      />
      <div className={s.page}>
        {/* Hero — orientado a acao */}
        <section className={s.hero}>
          <div className={s.heroInner}>
            <div className={s.heroBadge}>Ferramenta gratuita · Direto do fabricante · POUSINOX®</div>
            <h1 className={s.heroTitle}>Especificação técnica<br />de fixadores de porcelanato</h1>
            <p className={s.heroSub}>
              Fixadores, parafusos e consumíveis para paredes e fachadas.<br />
              Calcule a quantidade ideal e receba o orçamento na hora.
            </p>
            <button type="button" className={s.heroCta} onClick={() => {
              document.getElementById('calc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}>
              Calcular Materiais
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>

            {/* Trust bar */}
            <div className={s.trustBar}>
              <div className={s.trustItem}>
                <span className={s.trustIcon}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                Direto do fabricante
              </div>
              <div className={s.trustItem}>
                <span className={s.trustIcon}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg></span>
                Envio para todo Brasil
              </div>
              <div className={s.trustItem}>
                <span className={s.trustIcon}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
                Pix instantâneo
              </div>
            </div>

          </div>
        </section>

        <div className={s.heroFade} />

        <div className={s.container}>
          {/* ── Formulário ── */}
          <form className={s.card} id="calc-form" onSubmit={handleCalcular}>
            {/* Header do card — identidade */}
            <div className={s.cardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
              <div>
                <div className={s.cardHeaderTitle}>Calculadora de Materiais POUSINOX®</div>
                <div className={s.cardHeaderSub}>Especificação técnica para fixação de porcelanato</div>
              </div>
            </div>

            {/* Toggle do form colapsado */}
            {!formOpen && (
              <button type="button" className={s.formToggle} onClick={() => setFormOpen(true)}>
                <span>{modelo.nome} · {areaTotal} m² · {largura}×{altura} cm</span>
                <span className={s.formToggleEdit}>Editar dados</span>
                <svg className={s.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )}

            <div className={`${s.collapseBody} ${formOpen ? s.collapseOpen : ''}`}>
            {/* Stepper */}
            <div className={s.formStepper}>
              <div className={s.formStep}>
                <span className={s.formStepNum}>1</span>
                <span className={s.formStepLabel}>Dados da obra</span>
              </div>
              <div className={s.formStepLine} />
              <div className={s.formStep}>
                <span className={s.formStepNum}>2</span>
                <span className={s.formStepLabel}>Modelo</span>
              </div>
              <div className={s.formStepLine} />
              <div className={s.formStep}>
                <span className={s.formStepNum}>3</span>
                <span className={s.formStepLabel}>Resultado</span>
              </div>
            </div>

            {/* Etapa 1 — Dados da obra */}
            <div className={s.cardSection}>
              <div className={s.sectionContent}>
                <h2 className={s.sectionTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  Dados da Obra e Revestimento
                </h2>

                <div className={s.field}>
                  <label>Aplicação</label>
                  <div className={s.toggleGroup}>
                    <button type="button" className={`${s.toggleBtn} ${aplicacao === 'externo' ? s.toggleActive : ''}`} onClick={() => { setAplicacao('externo'); const idx = modelos.findIndex(m => m.material.includes('304')); if (idx >= 0) setModeloIdx(idx) }}>Externo</button>
                    <button type="button" className={`${s.toggleBtn} ${aplicacao === 'interno' ? s.toggleActive : ''}`} onClick={() => { setAplicacao('interno'); const idx = modelos.findIndex(m => m.material.includes('430')); if (idx >= 0) setModeloIdx(idx) }}>Interno</button>
                  </div>
                  <span className={s.hint}>{aplicacao === 'externo' ? 'Recomendado Inox 304 — resistente à corrosão' : 'Inox 430 — solução econômica para áreas internas'}</span>
                </div>

                <div className={s.field}>
                  <label>Área total a revestir (m²) <span className={s.req}>*</span></label>
                  <input className={s.input} type="text" inputMode="decimal" placeholder="Ex: 274.7" value={areaTotal} onChange={e => setAreaTotal(e.target.value)} />
                  <span className={s.hint}>Área total de parede ou fachada onde o porcelanato será instalado</span>
                </div>

                {revestimentos.length > 0 && (
                  <div className={s.field} style={{ position: 'relative' }}>
                    <label>Revestimento (opcional)</label>
                    <input
                      className={s.input}
                      type="text"
                      placeholder="Digite o formato da peça — ex: 60×120, 90×90"
                      value={revQuery}
                      onChange={e => { setRevQuery(e.target.value); setRevOpen(true) }}
                      onFocus={() => setRevOpen(true)}
                    />
                    <span className={s.hint}>Preenche largura, altura, espessura e peso automaticamente</span>
                    {revOpen && revFiltrados.length > 0 && (
                      <>
                        <div className={s.acBackdrop} onClick={() => setRevOpen(false)} />
                        <ul className={s.acList}>
                          {revFiltrados.map(r => (
                            <li key={r.id} className={s.acItem} onClick={() => selecionarRevestimento(r)}>
                              <strong>{r.formato}</strong>
                              <span className={s.acFab}>{r.fabricante}</span>
                              <span className={s.acMeta}>
                                {r.espessura_mm && `${r.espessura_mm}mm`}
                                {r.peso_m2_kg && ` · ${r.peso_m2_kg} kg/m²`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                <div className={s.grid2}>
                  <div className={s.field}>
                    <label>Largura da peça (cm) <span className={s.req}>*</span></label>
                    <input className={s.input} type="text" inputMode="decimal" placeholder="Ex: 20" value={largura} onChange={e => setLargura(e.target.value)} />
                  </div>
                  <div className={s.field}>
                    <label>Altura da peça (cm) <span className={s.req}>*</span></label>
                    <input className={s.input} type="text" inputMode="decimal" placeholder="Ex: 120" value={altura} onChange={e => setAltura(e.target.value)} />
                  </div>
                </div>

                <div className={s.grid2}>
                  <div className={s.field}>
                    <label>Espessura do revestimento (mm)</label>
                    <select className={s.input} value={espessura} onChange={e => setEspessura(e.target.value)} aria-label="Espessura do revestimento">
                      {ESPESSURAS_COMUNS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <span className={s.hint}>Seleciona o fixador compatível automaticamente</span>
                  </div>
                  <div className={s.field}>
                    <label>Peso da peça (kg)</label>
                    <input className={s.input} type="text" inputMode="decimal" placeholder="Se souber, informe aqui" value={pesoPeca} onChange={e => setPesoPeca(e.target.value)} />
                    <span className={s.hint}>Opcional — prevalece sobre a estimativa por espessura</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Etapa 2 — Modelo (vitrine) */}
            <div className={s.cardSection}>
              <div className={s.sectionContent}>
                <h2 className={s.sectionTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Tipo de Fixador
                </h2>
                <div className={s.modelGroups}>
                  {(['Aço Inox 304', 'Aço Inox 430'] as const).map(mat => {
                    const items = modelos.map((m, i) => ({ ...m, _idx: i })).filter(m => m.material === mat)
                    if (!items.length) return null
                    const hasActive = items.some(m => m._idx === modeloIdx)
                    const isRecomendado = (aplicacao === 'externo' && mat.includes('304')) || (aplicacao === 'interno' && mat.includes('430'))
                    const desc = items[0]?.desc || ''
                    return (
                      <div key={mat} className={`${s.modelGroup} ${hasActive ? s.modelGroupActive : ''} ${isRecomendado ? s.modelGroupRecomendado : ''}`}>
                        {isRecomendado && <span className={s.recomendadoBadge}>Recomendado para {aplicacao === 'externo' ? 'externo' : 'interno'}</span>}
                        <div className={s.modelGroupCards}>
                          {items.map(m => {
                            const isActive = m._idx === modeloIdx
                            return (
                              <div key={m._idx} className={`${s.modelCard} ${isActive ? s.modelActive : ''}`} onClick={() => setModeloIdx(m._idx)}>
                                {isActive && <span className={s.modelCheck}>✓</span>}
                                {m.imagem_url ? (
                                  <div className={s.modelImgWrap} onClick={e => { e.stopPropagation(); setLightbox({ src: m.imagem_url!, alt: m.nome }) }}>
                                    <img src={m.imagem_url} alt={m.nome} className={s.modelImg} loading="lazy" width="280" height="140" />
                                    <span className={s.modelZoom}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></span>
                                  </div>
                                ) : (
                                  <div className={s.modelImgPlaceholder}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                                  </div>
                                )}
                                <div className={s.modelInfo}>
                                  <div className={s.modelAbertura}>Abertura {m.abertura_mm || '—'} mm</div>
                                  <div className={s.modelMaterial}>{m.comprimento_mm && m.largura_mm ? `${m.comprimento_mm}×${m.largura_mm}×${m.espessura}` : m.espessura}</div>
                                  {m.preco_unitario != null && m.preco_unitario > 0 && (
                                    <div className={s.modelPreco}>R$ {m.preco_unitario.toFixed(2).replace('.', ',')} <span>/un.</span></div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className={s.modelGroupInfo}>
                          <div className={s.modelGroupHeader}>
                            <span className={s.modelName}>{mat}</span>
                            <div className={items[0]?.laudo ? s.modelSeloLaudo : s.modelSeloEcon}>
                              {items[0]?.laudo ? (
                                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Validação técnica</>
                              ) : (
                                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> Econômico</>
                              )}
                            </div>
                          </div>
                          <div className={s.modelDesc}>{desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className={s.modelNota}>Precisa de dimensões sob medida? <a href="https://wa.me/5535999619463?text=Ol%C3%A1%2C%20preciso%20de%20um%20fixador%20sob%20medida." target="_blank" rel="noopener noreferrer">Fale conosco</a></p>
              </div>
            </div>

            {erro && <div className={s.erro}>{erro}</div>}

            <div className={s.btnCalcWrap}>
              <button type="submit" className={s.btnCalc}>
                Calcular Materiais
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <div className={s.btnCalcHint}>Cálculo técnico POUSINOX® · Resultado imediato</div>
            </div>
            </div>
          </form>

          <div className={s.ctaConsultor}>
            <div className={s.ctaConsultorTexto}>
              <strong>Dúvidas sobre o seu projeto?</strong>
              <span>Fale direto com nosso consultor técnico</span>
            </div>
            <a href={`https://wa.me/${WA_NUMERO}?text=${encodeURIComponent('Olá, estou usando a calculadora e gostaria de tirar uma dúvida sobre meu projeto.')}`} target="_blank" rel="noopener noreferrer" className={s.ctaConsultorBtn} onClick={() => track('calculator_whatsapp_click', { modelo: modelos[modeloIdx]?.nome, source: 'consultor' })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.124 1.527 5.855L.06 23.488a.5.5 0 00.608.631l5.845-1.39A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.94 0-3.76-.562-5.295-1.53a.5.5 0 00-.38-.058l-3.736.889.94-3.548a.5.5 0 00-.063-.396A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              Falar com consultor
            </a>
          </div>

          {/* ── Resultado (sempre visível após calcular) ── */}
          {etapa === 'resultado' && resultado && (
            <div className={s.card} id="resultado-calc" style={{ marginTop: 20 }}>
              {/* Resumo vivo */}
              <div className={s.resultHeader}>
                <h2 className={s.resultTitle}>Resultado da Simulação</h2>
                <div className={s.resultSubtitle}>
                  {modelo.nome} · {areaTotal} m² · Peça {largura}×{altura} cm
                  {espessura ? ` · ${espessura}mm` : ''}
                </div>
              </div>

              {/* Status — aberto */}
              {(() => {
                const sv = STATUS_VISUAL[resultado.status]
                return (
                  <div className={s.statusBox} style={{ background: sv.bg, borderLeftColor: sv.border, color: sv.color }}>
                    {sv.icon} {sv.label}
                    {resultado.revisao_motivos.length > 0 && resultado.status !== 'padrao' && (
                      <ul className={s.statusMotivos}>
                        {resultado.revisao_motivos.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                  </div>
                )
              })()}

              {/* KPIs — aberto (valor entregue sem login) */}
              <div className={s.kpiGrid}>
                <div className={`${s.kpi} ${s.kpiDestaque}`}>
                  <div className={s.kpiLabel}>Peças (c/ 10% perda)</div>
                  <div className={s.kpiValue}>{resultado.qtd_pecas.toLocaleString('pt-BR')}</div>
                </div>
                <div className={`${s.kpi} ${s.kpiDestaque}`}>
                  <div className={s.kpiLabel}>Total de fixadores</div>
                  <div className={s.kpiValue}>{resultado.total_fixadores.toLocaleString('pt-BR')}</div>
                </div>
                <div className={s.kpi}>
                  <div className={s.kpiLabel}>Fixadores / peça</div>
                  <div className={s.kpiValue}>{resultado.fixadores_por_peca}</div>
                </div>
                {resultado.peso_peca_kg && (
                  <div className={s.kpi}>
                    <div className={s.kpiLabel}>Peso da peça {resultado.peso_estimado ? '(estimado)' : ''}</div>
                    <div className={s.kpiValue}>{resultado.peso_peca_kg.toFixed(2)} kg</div>
                  </div>
                )}
              </div>

              {/* Diagrama de posicionamento dos grampos */}
              {(() => {
                const n = resultado.fixadores_por_peca
                const larg_cm = parseFloat(largura) || 60
                const alt_cm = parseFloat(altura) || 60
                const isVertical = alt_cm > larg_cm * 1.5 // peça estreita vertical (ex: 20×120)
                // Escala proporcional
                const maxW = 160, maxH = 200
                const ratio = alt_cm / larg_cm
                let w = maxW, h = maxW * ratio
                if (h > maxH) { h = maxH; w = maxH / ratio }
                const pad = 30 // padding para cotas
                const ox = pad + (maxW - w) / 2 + 10 // offset x
                const oy = pad + 5
                const margin = w * 0.06 // 5-6% margem da borda
                const svgW = maxW + pad * 2 + 20
                const svgH = h + pad * 2 + 30

                // Posições dos grampos — distribuídos nas bordas laterais
                const grampos: [number, number][] = []
                const xLeft = ox + margin
                const xRight = ox + w - margin
                const xCenter = ox + w / 2

                if (isVertical) {
                  // Peça estreita: grampos ao longo do centro vertical
                  for (let i = 0; i < n; i++) {
                    const y = n === 1 ? oy + h / 2 : oy + margin + (h - 2 * margin) * i / (n - 1)
                    grampos.push([xCenter, y])
                  }
                } else if (n === 2) {
                  grampos.push([xLeft, oy + margin], [xRight, oy + margin])
                } else if (n === 3) {
                  grampos.push([xLeft, oy + margin], [xRight, oy + margin], [xCenter, oy + h - margin])
                } else {
                  // 4+: distribuir nas bordas esquerda e direita
                  const perSide = Math.ceil(n / 2)
                  for (let i = 0; i < perSide; i++) {
                    const y = perSide === 1 ? oy + h / 2 : oy + margin + (h - 2 * margin) * i / (perSide - 1)
                    grampos.push([xLeft, y])
                  }
                  const rightSide = n - perSide
                  for (let i = 0; i < rightSide; i++) {
                    const y = rightSide === 1 ? oy + h / 2 : oy + margin + (h - 2 * margin) * i / (rightSide - 1)
                    grampos.push([xRight, y])
                  }
                }

                // Cotas
                const cotaGap = margin + w * 0.05
                const cotaEntreX = (w - 2 * cotaGap).toFixed(2)
                const cotaMargemX = (larg_cm * 0.06 + larg_cm * 0.05).toFixed(2)

                return (
                  <div className={s.diagramaWrap}>
                    <div className={s.diagramaLabel}>Posicionamento dos grampos POUSINOX®</div>
                    <svg className={s.diagramaSvg} viewBox={`0 0 ${svgW} ${svgH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Peça */}
                      <rect x={ox} y={oy} width={w} height={h} rx="3" fill="#f2f0ec" stroke="#c8c3b8" strokeWidth="1.5" />

                      {/* Cota horizontal — topo */}
                      <line x1={ox} y1={oy - 10} x2={ox + w} y2={oy - 10} stroke="#9ca3af" strokeWidth="0.7" />
                      <line x1={ox} y1={oy - 14} x2={ox} y2={oy - 6} stroke="#9ca3af" strokeWidth="0.7" />
                      <line x1={ox + w} y1={oy - 14} x2={ox + w} y2={oy - 6} stroke="#9ca3af" strokeWidth="0.7" />
                      <text x={ox + w / 2} y={oy - 14} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="Inter, sans-serif" fontWeight="600">{(larg_cm / 100).toFixed(2)}m</text>

                      {/* Cota vertical — esquerda */}
                      <line x1={ox - 10} y1={oy} x2={ox - 10} y2={oy + h} stroke="#9ca3af" strokeWidth="0.7" />
                      <line x1={ox - 14} y1={oy} x2={ox - 6} y2={oy} stroke="#9ca3af" strokeWidth="0.7" />
                      <line x1={ox - 14} y1={oy + h} x2={ox - 6} y2={oy + h} stroke="#9ca3af" strokeWidth="0.7" />
                      <text x={ox - 16} y={oy + h / 2} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="Inter, sans-serif" fontWeight="600" transform={`rotate(-90 ${ox - 16} ${oy + h / 2})`}>{(alt_cm / 100).toFixed(2)}m</text>

                      {/* Cota margem — entre grampos (topo, se 2+ no topo) */}
                      {!isVertical && n >= 2 && (
                        <>
                          <line x1={grampos[0][0]} y1={oy - 3} x2={grampos[0][0]} y2={oy + margin + 4} stroke="#0b1520" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />
                          <line x1={grampos[1][0]} y1={oy - 3} x2={grampos[1][0]} y2={oy + margin + 4} stroke="#0b1520" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />
                        </>
                      )}

                      {/* Fixadores POUSINOX® — 40×120mm, 3 furos, aba na base */}
                      {grampos.map(([cx, cy], i) => {
                        const isTopo = cy < oy + h / 2
                        // Corpo fora da peça, aba dentro
                        const fw = 6, fh = 20 // proporção ~1:3 (40×120mm)
                        const bodyY = isTopo ? cy - fh : cy
                        const abaY = isTopo ? cy : cy - 3
                        return (
                          <g key={i}>
                            {/* Corpo do fixador (na parede) */}
                            <rect x={cx - fw / 2} y={bodyY} width={fw} height={fh} rx="1" fill="#d4d4d4" stroke="#999" strokeWidth="0.7" />
                            {/* 3 furos de parafuso */}
                            <circle cx={cx} cy={bodyY + fh * 0.2} r="1.3" fill="#888" />
                            <circle cx={cx} cy={bodyY + fh * 0.5} r="1.3" fill="#888" />
                            <circle cx={cx} cy={bodyY + fh * 0.8} r="1.3" fill="#888" />
                            {/* Aba (encaixe na incisão) */}
                            <rect x={cx - fw / 2 - 2} y={abaY} width={fw + 4} height={3} rx="0.5" fill="#b0b0b0" stroke="#999" strokeWidth="0.5" />
                          </g>
                        )
                      })}

                      {/* Legenda */}
                      <g transform={`translate(${ox}, ${oy + h + 14})`}>
                        <rect x="0" y="0" width="5" height="14" rx="1" fill="#d4d4d4" stroke="#999" strokeWidth="0.5" />
                        <circle cx={2.5} cy={3} r="0.8" fill="#888" />
                        <circle cx={2.5} cy={7} r="0.8" fill="#888" />
                        <circle cx={2.5} cy={11} r="0.8" fill="#888" />
                        <text x="10" y="10" fontSize="8.5" fill="#6b7280" fontFamily="Inter, sans-serif">= Fixador POUSINOX® ({n} por peça)</text>
                      </g>
                    </svg>
                  </div>
                )
              })()}

              {/* Social proof — sempre visivel */}
              <div className={s.socialProof}>
                <div className={s.proofCard}>
                  <span className={s.proofIcon}>🔬</span>
                  <div>
                    <div className={s.proofLabel}>Ensaio técnico</div>
                    <div className={s.proofSub}>Validado SENAI LAMAT</div>
                  </div>
                </div>
                <div className={s.proofCard}>
                  <span className={s.proofIcon}>🏭</span>
                  <div>
                    <div className={s.proofLabel}>Fabricante direto</div>
                    <div className={s.proofSub}>Sem intermediário</div>
                  </div>
                </div>
                <div className={s.proofCard}>
                  <span className={s.proofIcon}>🛡️</span>
                  <div>
                    <div className={s.proofLabel}>Garantia de fábrica</div>
                    <div className={s.proofSub}>Aço inox 304 ou 430</div>
                  </div>
                </div>
              </div>

              {/* Referência do laudo */}
              {resultado.laudo_referencia && (
                <div className={s.laudoRef}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {resultado.laudo_referencia}
                </div>
              )}

              {/* Alerta — condições da parede */}
              <div className={s.alertaParede}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <strong>Condições do substrato (ref. ABNT NBR 13755):</strong> A base deve estar limpa, sem trincas, sem materiais soltos, óleos ou eflorescências, e não apresentar som cavo à percussão. Emboço com cura mínima de 14 dias. Desvio de planeza máximo de 3 mm em régua de 2 m. Superfícies expostas a sol/vento devem ser pré-umedecidas (sem saturar).
                </div>
              </div>

              {/* Disclaimer */}
              <div className={s.disclaimer}>
                <strong>Nota técnica:</strong> Especificação com caráter estimativo.
                A validação final depende das condições da obra e do responsável técnico.
                Perda de 10% já inclusa.
              </div>

              {/* ══ GATE — detalhamento protegido ══ */}
              {!session?.verificado ? (
                <>
                  {/* Prévia borrada do que está atrás do gate */}
                  <div className={s.gatePreview}>
                    <div className={s.gatePreviewBlur}>
                      <div className={s.gatePreviewItem}>Tabela completa de materiais e consumíveis</div>
                      <div className={s.gatePreviewItem}>Estimativa de investimento detalhada</div>
                      <div className={s.gatePreviewItem}>Envio de orçamento via WhatsApp</div>
                      {modelo.laudo && <div className={s.gatePreviewItem}>Rastreabilidade técnica</div>}
                    </div>
                  </div>

                  {showGate === 'none' && (
                    <div className={s.gateBox}>
                      <div className={s.gateTitle}>Receba o detalhamento completo</div>
                      <div className={s.gateText}>
                        Memorial de materiais, estimativa de investimento e contato direto com nosso consultor.
                      </div>
                      <button type="button" onClick={() => setShowGate('login')} className={s.btnLogin}>
                        Continuar com WhatsApp
                      </button>
                    </div>
                  )}

                  {showGate === 'login' && (
                    <div className={s.gateBox} id="login-gate">
                      <div className={s.gateTitle}>Identifique-se para continuar</div>


                      <div className={s.grid2}>
                        <div className={s.field}>
                          <label>Seu nome <span className={s.req}>*</span></label>
                          <input className={s.input} type="text" placeholder="Nome completo" value={loginNome} onChange={e => setLoginNome(e.target.value)} />
                        </div>
                        <div className={s.field}>
                          <label>WhatsApp com DDD <span className={s.req}>*</span></label>
                          <input className={s.input} type="tel" placeholder="(35) 99961-0111" value={loginWa} onChange={e => setLoginWa(e.target.value)} />
                        </div>
                      </div>

                      <div className={s.tipoPessoaToggle}>
                        <button type="button" className={`${s.tipoPessoaBtn} ${tipoPessoa === 'pf' ? s.tipoPessoaAtivo : ''}`} onClick={() => setTipoPessoa('pf')}>
                          Pessoa Física
                        </button>
                        <button type="button" className={`${s.tipoPessoaBtn} ${tipoPessoa === 'pj' ? s.tipoPessoaAtivo : ''}`} onClick={() => setTipoPessoa('pj')}>
                          Pessoa Jurídica
                        </button>
                      </div>

                      {authErro && <div className={s.erro}>{authErro}</div>}

                      <button type="button" onClick={enviarOtp} disabled={authLoading} className={s.btnLogin}>
                        {authLoading ? 'Enviando...' : 'Enviar código via WhatsApp'}
                      </button>

                      <div className={s.loginHint}>
                        Você receberá um código de 6 dígitos no WhatsApp informado.
                      </div>
                    </div>
                  )}

                  {showGate === 'otp' && (
                    <div className={s.gateBox} id="login-gate">
                      <div className={s.gateTitle}>Digite o código</div>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', margin: '0 0 16px' }}>
                        Enviamos um código de 6 dígitos para {waMasked || 'seu WhatsApp'}.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <input
                          className={s.otpInput}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCodigo}
                          onChange={e => setOtpCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          autoFocus
                        />

                        {authErro && <div className={s.erro} style={{ width: '100%' }}>{authErro}</div>}

                        <button type="button" onClick={verificarOtp} disabled={authLoading || otpCodigo.length !== 6} className={s.btnLogin}>
                          {authLoading ? 'Verificando...' : 'Verificar e liberar detalhamento'}
                        </button>

                        <div className={s.otpActions}>
                          <button type="button" onClick={enviarOtp} disabled={reenvioTimer > 0 || authLoading} className={s.otpReenviar}>
                            {reenvioTimer > 0 ? `Reenviar em ${reenvioTimer}s` : 'Reenviar código'}
                          </button>
                          <button type="button" onClick={() => setShowGate('login')} className={s.otpVoltar}>
                            Alterar número
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ══ Conteúdo completo (verificado) ══ */
                <div id="detalhe-completo">
                  {/* Confirmação */}
                  {showConfirmacao && (
                    <div className={s.confirmacao}>
                      Verificação concluída. Detalhamento liberado.
                    </div>
                  )}

                  {/* Complemento pós-verificação */}
                  {showGate === 'complemento' && (
                    <div className={s.gateBox}>
                      <div className={s.gateTitle}>Complete seu perfil (opcional)</div>
                      <div className={s.gateText}>Dados adicionais para um orçamento mais preciso.</div>

                      <div className={s.grid2}>
                        <div className={s.field}>
                          <label>CEP</label>
                          <input className={s.input} type="text" inputMode="numeric" placeholder="37550-000" maxLength={9} value={loginCep} onChange={e => {
                            let v = e.target.value.replace(/\D/g, '').slice(0, 8)
                            if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5)
                            setLoginCep(v)
                          }} />
                        </div>
                        <div className={s.field}>
                          <label>E-mail</label>
                          <input className={s.input} type="email" placeholder="Opcional" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                        </div>
                      </div>

                      {tipoPessoa === 'pj' && (
                        <>
                          <div className={s.grid2}>
                            <div className={s.field}>
                              <label>CNPJ</label>
                              <input className={s.input} type="text" inputMode="numeric" placeholder="00.000.000/0001-00" maxLength={18} value={loginCnpj} onChange={e => {
                                let v = e.target.value.replace(/\D/g, '').slice(0, 14)
                                if (v.length > 12) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12)
                                else if (v.length > 8) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8)
                                else if (v.length > 5) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5)
                                else if (v.length > 2) v = v.slice(0,2)+'.'+v.slice(2)
                                setLoginCnpj(v)
                              }} />
                            </div>
                            <div className={s.field}>
                              <label>Razão Social</label>
                              <input className={s.input} type="text" placeholder="Nome da empresa" value={loginRazaoSocial} onChange={e => setLoginRazaoSocial(e.target.value)} />
                            </div>
                          </div>
                          <div className={s.field}>
                            <label>Segmento</label>
                            <select className={s.input} value={loginSegmento} onChange={e => setLoginSegmento(e.target.value)} aria-label="Segmento de atuação">
                              <option value="">Selecione...</option>
                              <option value="construcao">Construção Civil</option>
                              <option value="revestimentos">Revestimentos</option>
                              <option value="arquitetura">Arquitetura / Engenharia</option>
                              <option value="alimenticio">Alimentício</option>
                              <option value="hospitalar">Hospitalar</option>
                              <option value="hotelaria">Hotelaria</option>
                              <option value="supermercado">Supermercado</option>
                              <option value="laboratorio">Laboratório</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
                        </>
                      )}

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button type="button" onClick={salvarComplemento} className={s.btnLogin}>
                          Salvar e continuar
                        </button>
                        <button type="button" onClick={() => setShowGate('none')} className={s.otpVoltar} style={{ padding: '12px 20px' }}>
                          Pular
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sessão ativa */}
                  <div className={s.sessionBar}>
                    <span>Logado como <strong>{session.nome}</strong></span>
                    <button type="button" onClick={logout} className={s.sessionLogout}>Sair</button>
                  </div>

                  {/* Tabela de materiais completa */}
                  <div className={s.tabelaWrap}>
                    <table className={s.tabela}>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th style={{ textAlign: 'right' }}>Quantidade</th>
                          <th>Un.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.itens.map((it, i) => {
                          return (
                          <tr key={i}>
                            <td>{it.nome}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.quantidade.toLocaleString('pt-BR')}</td>
                            <td>{it.unidade}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Selo */}
                  {modelo.laudo && (
                    <div className={s.seloBox}>
                      <div className={s.seloIcon}>🔬</div>
                      <div>
                        <div className={s.seloTitle}>Rastreabilidade técnica</div>
                        <div className={s.seloText}>Material com ensaio técnico rastreável — POUSINOX®.</div>
                      </div>
                    </div>
                  )}

                  {/* Orçamento estimado */}
                  {(modelo.preco_unitario || consumiveisDb.some(c => c.preco_unitario)) && (() => {
                    const linhas: { nome: string; qtd: number; unitario: number; total: number }[] = []
                    // Fixador
                    if (modelo.preco_unitario) {
                      linhas.push({ nome: 'Fixador / Grampo', qtd: resultado.total_fixadores, unitario: modelo.preco_unitario, total: modelo.preco_unitario * resultado.total_fixadores })
                    }
                    // Consumíveis do banco
                    consumiveisDb.forEach(c => {
                      if (!c.preco_unitario) return
                      const qtd = c.proporcao_por === 1 ? resultado.total_fixadores : Math.ceil(resultado.total_fixadores / c.proporcao_por)
                      linhas.push({ nome: c.nome, qtd, unitario: c.preco_unitario, total: c.preco_unitario * qtd })
                    })
                    const grandTotal = linhas.reduce((acc, l) => acc + l.total, 0)
                    return (
                      <div className={s.orcamentoBox}>
                        <div className={s.orcamentoTitle}>Estimativa de Investimento</div>
                        <div className={s.orcamentoGrid}>
                          <div className={s.orcamentoHeader}>
                            <span>Material</span>
                            <span>Qtd</span>
                            <span>Vl. Unit.</span>
                            <span>Total</span>
                          </div>
                          {linhas.map((l, i) => (
                            <div key={i} className={s.orcamentoItem}>
                              <span>{l.nome}</span>
                              <span>{l.qtd.toLocaleString('pt-BR')}</span>
                              <span>R$ {l.unitario.toFixed(2).replace('.', ',')}</span>
                              <strong>R$ {l.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          ))}
                          <div className={`${s.orcamentoItem} ${s.orcamentoTotal}`}>
                            <span>Total estimado</span>
                            <span />
                            <span />
                            <strong>R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                          </div>
                        </div>
                        <div className={s.orcamentoNota}>
                          Valores estimados para referência. O orçamento final pode variar conforme volume e condições de pagamento.
                        </div>
                      </div>
                    )
                  })()}

                  {/* CTA */}
                  <div className={s.ctaBox}>
                    <div className={s.ctaTitle}>Solicite um orçamento completo</div>
                    <div className={s.ctaText}>
                      Nossa equipe técnica retorna com proposta comercial incluindo fixadores, consumíveis e frete.
                    </div>
                    <div className={s.ctaActions}>
                      <a href={`https://wa.me/${WA_NUMERO}?text=${gerarMsgWa()}`} target="_blank" rel="noopener noreferrer" className={s.ctaBtnWa}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        Solicitar via WhatsApp
                      </a>
                      <Link to="/contato" className={s.ctaBtnForm}>
                        Formulário de Orçamento
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Feedback ── */}
          {etapa === 'resultado' && (
            <div className={s.feedbackBox}>
              {feedbackEnviado ? (
                <div className={s.feedbackSucesso}>Obrigado pelo seu feedback!</div>
              ) : (
                <>
                  <div className={s.feedbackTitle}>Sugestão ou problema?</div>
                  <div className={s.feedbackTipos}>
                    {([['sugestao', 'Sugestão'], ['problema', 'Problema'], ['elogio', 'Elogio']] as const).map(([t, label]) => (
                      <button key={t} type="button" className={`${s.feedbackTipoBtn} ${feedbackTipo === t ? s.feedbackTipoAtivo : ''}`} onClick={() => setFeedbackTipo(t)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea className={s.feedbackInput} placeholder="Conte-nos como podemos melhorar..." value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)} rows={3} />
                  <button type="button" onClick={enviarFeedback} disabled={feedbackLoading || !feedbackMsg.trim()} className={s.feedbackBtn}>
                    {feedbackLoading ? 'Enviando...' : 'Enviar Feedback'}
                  </button>
                </>
              )}
            </div>
          )}
        {/* ── Comparativo + FAQ ── */}
        <div className={s.card} style={{ marginTop: 20, padding: '24px 28px' }}>
          <h2 className={s.secaoTitulo}>
            Inox 304 vs 430
          </h2>
          <div className={s.comparativoWrap}>
            <div className={`${s.comparativoCard} ${s.comparativoCard304}`}>
              <div className={s.comparativoCardHeader}>
                <div className={s.comparativoCardTitle}>Aço Inox 304</div>
                <span className={s.comparativoBadge}>Fachadas</span>
              </div>
              <div className={s.comparativoLista}>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Composição</span><span className={s.comparativoValor}>Cromo + Níquel</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Corrosão</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Superior</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Aplicação</span><span className={s.comparativoValor}>Fachadas, externas, piscinas</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Umidade</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Resistente</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Resistência mecânica</span><span className={s.comparativoValor}>Alta</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Laudo SENAI</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Validado</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Perfil</span><span className={s.comparativoValor}>Premium</span></div>
              </div>
            </div>
            <div className={`${s.comparativoCard} ${s.comparativoCard430}`}>
              <div className={s.comparativoCardHeader}>
                <div className={s.comparativoCardTitle}>Aço Inox 430</div>
                <span className={s.comparativoBadge}>Internas</span>
              </div>
              <div className={s.comparativoLista}>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Composição</span><span className={s.comparativoValor}>Cromo</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Corrosão</span><span className={s.comparativoValor}>Moderada</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Aplicação</span><span className={s.comparativoValor}>Áreas internas</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Umidade</span><span className={s.comparativoValor}>Não recomendado</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Resistência mecânica</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Superior</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Laudo SENAI</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Validado</span></div>
                <div className={s.comparativoItem}><span className={s.comparativoLabel}>Perfil</span><span className={`${s.comparativoValor} ${s.comparativoDestaque}`}>Econômico</span></div>
              </div>
            </div>
          </div>

          <div className={s.secaoDivider} />
          <h2 className={s.secaoTitulo} style={{ marginTop: 4 }}>
            Perguntas frequentes
          </h2>
          <div className={s.faqList}>
            {[
              { q: 'Quantos fixadores de porcelanato por m²?', a: 'A quantidade varia conforme o peso e dimensão da peça. Em média, são necessários 2 a 3 fixadores por peça. Use a calculadora acima para obter a quantidade exata com base no seu revestimento.' },
              { q: 'Qual a diferença entre fixador inox 304 e 430?', a: 'O inox 304 contém cromo e níquel, sendo resistente à corrosão — ideal para fachadas e áreas externas. O inox 430 é mais econômico e indicado para áreas internas sem exposição à umidade.' },
              { q: 'Como funciona o fixador de porcelanato?', a: 'A peça recebe argamassa colante normalmente. Uma incisão é feita na borda com disco diamantado, aplica-se adesivo PU na incisão, o fixador é parafusado na parede e sua aba encaixa na incisão — criando ancoragem mecânica que previne a queda do revestimento.' },
              { q: 'O fixador substitui a argamassa colante?', a: 'Não. A argamassa colante é aplicada na peça toda normalmente. O fixador é um sistema complementar de segurança mecânica que cria dupla ancoragem — química (argamassa) e mecânica (fixador) — contra o desprendimento.' },
              { q: 'Para quais revestimentos o fixador é indicado?', a: 'O fixador é indicado para porcelanatos, cerâmicas e revestimentos de grande formato em fachadas e paredes. Quanto maior e mais pesada a peça, mais crítica é a ancoragem mecânica complementar.' },
              { q: 'O fixador tem laudo técnico?', a: 'Sim. Os fixadores POUSINOX® em aço inox 304 e 430 foram ensaiados pelo SENAI/LAMAT com resultados de força máxima (Fm) documentados. A calculadora utiliza esses dados para dimensionar a quantidade correta com fator de segurança 4×.' },
            ].map((item, i) => (
              <details key={i} className={s.faqItem}>
                <summary className={s.faqQuestion}>{item.q}</summary>
                <div className={s.faqAnswer}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
        </div>

        {/* Sticky CTA mobile — aparece apos resultado */}
        {etapa === 'resultado' && resultado && (
          <div className={s.stickyCtaMobile}>
            <a href={`https://wa.me/${WA_NUMERO}?text=${gerarMsgWa()}`} target="_blank" rel="noopener noreferrer" className={s.stickyWa}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              WhatsApp
            </a>
            <a href="tel:+5535999619463" className={s.stickyCall}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              Ligar
            </a>
          </div>
        )}
      </div>

      {lightbox && (
        <div className={s.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={s.lightboxClose} onClick={() => setLightbox(null)} aria-label="Fechar">✕</button>
          <img src={lightbox.src} alt={lightbox.alt} className={s.lightboxImg} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
