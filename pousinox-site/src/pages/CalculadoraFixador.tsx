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

type ModeloCalc = {
  id: number; nome: string; material: string; espessura: string
  laudo: boolean; desc: string; imagem_url: string | null; abertura_mm: number | null
  preco_unitario: number | null
}

const MODELOS_FALLBACK: ModeloCalc[] = [
  { id: 1, nome: 'Fixador de Porcelanato Aço Inox 304', material: 'Aço Inox 304', espessura: '0.8mm', laudo: true, desc: 'Ideal para fachadas, áreas externas e ambientes sujeitos a variação térmica. Compatível com revestimentos de 5 a 8 mm de espessura.', imagem_url: null, abertura_mm: 5, preco_unitario: null },
  { id: 2, nome: 'Fixador de Porcelanato Aço Inox 304', material: 'Aço Inox 304', espessura: '0.8mm', laudo: true, desc: 'Ideal para fachadas, áreas externas e ambientes sujeitos a variação térmica. Compatível com revestimentos de 9 a 14 mm de espessura.', imagem_url: null, abertura_mm: 11, preco_unitario: null },
  { id: 3, nome: 'Fixador de Porcelanato Aço Inox 430', material: 'Aço Inox 430', espessura: '0.8mm', laudo: false, desc: 'Indicado para áreas internas e ambientes sem exposição direta à umidade. Compatível com revestimentos de 5 a 8 mm de espessura.', imagem_url: null, abertura_mm: 5, preco_unitario: null },
  { id: 4, nome: 'Fixador de Porcelanato Aço Inox 430', material: 'Aço Inox 430', espessura: '0.8mm', laudo: false, desc: 'Indicado para áreas internas e ambientes sem exposição direta à umidade. Compatível com revestimentos de 9 a 14 mm de espessura.', imagem_url: null, abertura_mm: 11, preco_unitario: null },
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

  // Modelos dinâmicos do banco
  const [modelos, setModelos] = useState<ModeloCalc[]>(MODELOS_FALLBACK)
  const [consumiveisDb, setConsumiveisDb] = useState<{ nome: string; preco_unitario: number | null; proporcao_por: number }[]>([])
  useEffect(() => {
    supabase.from('fixador_modelos').select('id, nome, material, espessura_mm, obs_tecnica, possui_laudo, imagem_url, abertura_aba_mm, preco_unitario').eq('ativo', true).order('id')
      .then(({ data }) => {
        if (data?.length) {
          setModelos(data.map(m => ({
            id: m.id,
            nome: m.nome,
            material: m.material,
            espessura: m.espessura_mm + 'mm',
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

  // Agrupar modelos por material para UI de cards
  const grupos = useMemo(() => {
    const map = new Map<string, { material: string; imagem_url: string | null; laudo: boolean; aberturas: { mm: number; idx: number; desc: string; preco: number | null }[] }>()
    modelos.forEach((m, i) => {
      const key = m.material
      if (!map.has(key)) map.set(key, { material: key, imagem_url: m.imagem_url, laudo: m.laudo, aberturas: [] })
      const g = map.get(key)!
      if (!g.imagem_url && m.imagem_url) g.imagem_url = m.imagem_url
      if (m.laudo) g.laudo = true
      g.aberturas.push({ mm: m.abertura_mm || 0, idx: i, desc: m.desc, preco: m.preco_unitario })
    })
    return Array.from(map.values())
  }, [modelos])

  // Material selecionado (índice do grupo)
  const [grupoIdx, setGrupoIdx] = useState(0)

  // Collapsible form
  const [formOpen, setFormOpen] = useState(true)

  // Calculator state
  const [areaTotal, setAreaTotal] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [espessura, setEspessura] = useState('')

  // Auto-selecionar modelo (abertura) baseado na espessura do revestimento
  const modeloIdx = useMemo(() => {
    const grupo = grupos[grupoIdx]
    if (!grupo) return 0
    const esp = parseFloat(espessura) || 0
    // espessura <= 8mm → abertura menor (5mm), > 8mm → abertura maior (11mm)
    if (esp > 0 && esp > 8) {
      const maior = grupo.aberturas.reduce((a, b) => b.mm > a.mm ? b : a)
      return maior.idx
    }
    // padrão: abertura menor
    const menor = grupo.aberturas.reduce((a, b) => b.mm < a.mm ? b : a)
    return menor.idx
  }, [grupos, grupoIdx, espessura])
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
      },
      REGRAS_PADRAO,
      CONSUMIVEIS_PADRAO,
    )
    setResultado(res)
    setEtapa('resultado')
    setFormOpen(false)
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
    return encodeURIComponent(
      `Olá! Fiz uma simulação na calculadora de materiais do site:\n\n` +
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
        title="Calculadora de Materiais — Fixador de Porcelanato POUSINOX®"
        description="Calcule a quantidade de fixadores, parafusos, buchas e consumíveis para sua obra. Ferramenta gratuita da POUSINOX® para especificação técnica de materiais."
        path="/fixador-porcelanato/calculadora"
      />
      <div className={s.page}>
        {/* Hero — orientado a acao */}
        <section className={s.hero}>
          <div className={s.heroInner}>
            <div className={s.heroBadge}>Ferramenta gratuita · Direto do fabricante · POUSINOX®</div>
            <h1 className={s.heroTitle}>Especificação técnica<br />de fixadores de porcelanato</h1>
            <p className={s.heroSub}>
              Calcule a quantidade exata de fixadores, parafusos e consumíveis
              para fachada e revestimento. Orçamento na hora, direto do fabricante.
            </p>
            <button type="button" className={s.heroCta} onClick={() => {
              document.getElementById('calc-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
              Calcular Materiais
            </button>

            {/* Trust bar */}
            <div className={s.trustBar}>
              <div className={s.trustItem}>
                <span className={s.trustIcon}>🔬</span>
                Ensaio técnico SENAI
              </div>
              <div className={s.trustItem}>
                <span className={s.trustIcon}>🏭</span>
                Direto do fabricante
              </div>
              <div className={s.trustItem}>
                <span className={s.trustIcon}>⚡</span>
                Pix instantâneo
              </div>
              <div className={s.trustItem}>
                <span className={s.trustIcon}>🚚</span>
                Frete calculado
              </div>
            </div>

            <div className={s.heroSteps}>
              {[
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, label: 'Dados da obra' },
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, label: 'Resultado' },
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, label: 'Orçamento' },
              ].map((st, i) => {
                const stepIdx = etapa === 'form' ? 0 : session?.verificado ? 2 : 1
                const done = i < stepIdx
                const active = i === stepIdx
                return (
                  <div key={i} className={`${s.step} ${done ? s.stepDone : ''} ${active ? s.stepActive : ''}`}>
                    <span className={s.stepNum}>{done ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : st.icon}</span> {st.label}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Degradê de transição hero → conteúdo */}
        <div className={s.heroFade} />

        <div className={s.container}>
          {/* ── Formulário ── */}
          <form className={s.card} id="calc-form" onSubmit={handleCalcular}>
            {/* Toggle do form colapsado */}
            {!formOpen && (
              <button type="button" className={s.formToggle} onClick={() => setFormOpen(true)}>
                <span>{modelo.nome} · {areaTotal} m² · {largura}×{altura} cm</span>
                <span className={s.formToggleEdit}>Editar dados</span>
                <svg className={s.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )}

            <div className={`${s.collapseBody} ${formOpen ? s.collapseOpen : ''}`}>
            {/* Dados da obra — PRIMEIRO para capturar espessura antes do modelo */}
            <div className={s.cardSection}>
              <div className={s.sectionIcon}>📐</div>
              <div className={s.sectionContent}>
                <h2 className={s.sectionTitle}>Dados da Obra e Revestimento</h2>

                <div className={s.field}>
                  <label>Área total a revestir (m²) <span className={s.req}>*</span></label>
                  <input className={s.input} type="text" inputMode="decimal" placeholder="Ex: 274.7" value={areaTotal} onChange={e => setAreaTotal(e.target.value)} />
                  <span className={s.hint}>Área total de parede ou fachada onde o porcelanato será instalado</span>
                </div>

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
                    <select className={s.input} value={espessura} onChange={e => setEspessura(e.target.value)}>
                      {ESPESSURAS_COMUNS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <span className={s.hint}>Usada para selecionar o fixador compatível automaticamente</span>
                  </div>
                  <div className={s.field}>
                    <label>Peso da peça (kg)</label>
                    <input className={s.input} type="text" inputMode="decimal" placeholder="Se souber, informe aqui" value={pesoPeca} onChange={e => setPesoPeca(e.target.value)} />
                    <span className={s.hint}>Opcional — prevalece sobre a estimativa por espessura</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modelo — DEPOIS dos dados, abertura já calculada */}
            <div className={s.cardSection}>
              <div className={s.sectionIcon}>📌</div>
              <div className={s.sectionContent}>
                <h2 className={s.sectionTitle}>Modelo do Fixador</h2>
                <div className={s.modelGrid}>
                  {grupos.map((g, gi) => {
                    const isActive = gi === grupoIdx
                    const selectedAb = isActive ? g.aberturas.find(a => a.idx === modeloIdx) : null
                    return (
                      <div key={g.material} className={`${s.modelCard} ${isActive ? s.modelActive : ''}`} onClick={() => setGrupoIdx(gi)}>
                        {g.imagem_url && <img src={g.imagem_url} alt={g.material} className={s.modelImg} loading="lazy" />}
                        <div className={s.modelName}>{modelos[g.aberturas[0].idx].nome.replace(/\s*—\s*\d+\s*mm$/i, '')}</div>
                        <div className={g.laudo ? s.modelSeloLaudo : s.modelSeloEcon}>{g.laudo ? '🔬 Possui laudo/ensaios' : '💰 Econômico'}</div>
                        {isActive && (
                          <div className={s.aberturaAuto}>
                            {espessura
                              ? <>Revestimento de <strong>{espessura} mm</strong> — fixador compatível selecionado</>
                              : <>Informe a espessura acima para seleção automática do fixador ideal</>
                            }
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className={s.modelNota}>Precisa de dimensões sob medida? <a href="https://wa.me/5535999619463?text=Ol%C3%A1%2C%20preciso%20de%20um%20fixador%20sob%20medida." target="_blank" rel="noopener noreferrer">Fale conosco</a></p>
              </div>
            </div>

            {erro && <div className={s.erro}>{erro}</div>}

            <button type="submit" className={s.btnCalc}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/></svg>
              Calcular Materiais
            </button>
            </div>
          </form>

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

              {/* Disclaimer — aberto */}
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
                            <select className={s.input} value={loginSegmento} onChange={e => setLoginSegmento(e.target.value)}>
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
                        {resultado.itens.map((it, i) => (
                          <tr key={i}>
                            <td>
                              <span className={s.materialIcon}>
                                {it.tipo === 'fixador' ? '🔩' : it.tipo === 'consumivel' ? '🔧' : '📦'}
                              </span>
                              {it.nome}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.quantidade.toLocaleString('pt-BR')}</td>
                            <td>{it.unidade}</td>
                          </tr>
                        ))}
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
                    const fixTotal = modelo.preco_unitario ? modelo.preco_unitario * resultado.total_fixadores : 0
                    const consLinhas = consumiveisDb.filter(c => c.preco_unitario).map(c => {
                      const qtd = Math.ceil(resultado.total_fixadores / (c.proporcao_por || 1))
                      return { nome: c.nome, qtd, total: c.preco_unitario! * qtd, unitario: c.preco_unitario! }
                    })
                    const consTotal = consLinhas.reduce((acc, c) => acc + c.total, 0)
                    const grandTotal = fixTotal + consTotal
                    return (
                      <div className={s.orcamentoBox}>
                        <div className={s.orcamentoTitle}>Estimativa de Investimento</div>
                        <div className={s.orcamentoGrid}>
                          {modelo.preco_unitario && (
                            <div className={s.orcamentoItem}>
                              <span>Fixadores ({resultado.total_fixadores.toLocaleString('pt-BR')} un. x R$ {modelo.preco_unitario.toFixed(2).replace('.', ',')})</span>
                              <strong>R$ {fixTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {consLinhas.map((c, i) => (
                            <div key={i} className={s.orcamentoItem}>
                              <span>{c.nome} ({c.qtd.toLocaleString('pt-BR')} un. x R$ {c.unitario.toFixed(2).replace('.', ',')})</span>
                              <strong>R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          ))}
                          {(fixTotal > 0 && consLinhas.length > 0) && (
                            <div className={`${s.orcamentoItem} ${s.orcamentoTotal}`}>
                              <span>Total estimado</span>
                              <strong>R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
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
    </>
  )
}
