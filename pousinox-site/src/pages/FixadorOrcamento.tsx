import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import styles from './FixadorOrcamento.module.css'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO WEBHOOK N8N
// Substitua pela URL real do seu webhook no N8N após importar o workflow.
// Exemplo: 'https://n8n.pousinox.com.br/webhook/orcamento-fixador'
// ─────────────────────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = 'https://n8n.pousinox.com.br/webhook/orcamento-fixador'

const WA_LINK =
  'https://wa.me/553534238994?text=Ol%C3%A1%2C%20preciso%20de%20um%20or%C3%A7amento%20do%20Fixador%20de%20Porcelanato%20Pousinox.'

const tiposObra = [
  'Edifício residencial',
  'Edifício comercial / corporativo',
  'Casa / Residência',
  'Fachada',
  'Área de lazer / área externa',
  'Obra industrial',
  'Reforma',
  'Outro',
]

type FormState = 'idle' | 'sending' | 'success' | 'error'

export default function FixadorOrcamento() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('sending')
    setErrorMsg('')

    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    // Adiciona metadata útil para o N8N/Supabase
    const payload = {
      ...data,
      produto: 'Fixador de Porcelanato',
      origem: 'site-fixador-orcamento',
      timestamp: new Date().toISOString(),
    }

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setFormState('success')
      form.reset()
    } catch (err) {
      console.error('Erro ao enviar formulário:', err)
      setErrorMsg('Não foi possível enviar. Tente pelo WhatsApp ou aguarde e tente novamente.')
      setFormState('error')
    }
  }

  return (
    <>
      <SEO
        title="Orçamento — Fixador de Porcelanato Pousinox"
        description="Solicite orçamento do Fixador de Porcelanato em aço inox Pousinox. Atendemos construtoras, empreiteiras e instaladores em todo o Brasil. Resposta rápida por WhatsApp ou formulário."
        path="/fixador-porcelanato/orcamento"
      />

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <div className={styles.breadcrumb}>
            <Link to="/fixador-porcelanato">Fixador de Porcelanato</Link>
            <span>/</span>
            <span>Solicitar Orçamento</span>
          </div>
          <h1 className={styles.pageTitle}>Solicitar Orçamento</h1>
          <p className={styles.pageSubtitle}>
            Preencha o formulário com as informações do seu projeto. Nossa equipe
            responde em até 1 dia útil com proposta detalhada.
          </p>
        </div>
      </div>

      {/* Layout */}
      <div className={`section ${styles.layoutSection}`}>
        <div className="container">
          <div className={styles.layout}>

            {/* Formulário */}
            <div className={styles.formSection}>
              <h2 className={styles.formTitle}>Dados do Projeto</h2>

              {formState === 'success' ? (
                <div className={styles.successBox}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <h3>Solicitação enviada!</h3>
                  <p>
                    Nossa equipe recebeu seu orçamento e entrará em contato em breve.
                    Você também pode nos chamar pelo WhatsApp para agilizar o atendimento.
                  </p>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Falar no WhatsApp
                  </a>
                  <button
                    className={styles.newRequestBtn}
                    onClick={() => setFormState('idle')}
                  >
                    Enviar outro orçamento
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="nome">Nome completo *</label>
                      <input
                        id="nome"
                        name="nome"
                        type="text"
                        required
                        placeholder="Seu nome"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="empresa">Empresa / Construtora</label>
                      <input
                        id="empresa"
                        name="empresa"
                        type="text"
                        placeholder="Ex: Construtora ABC"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="telefone">Telefone / WhatsApp *</label>
                      <input
                        id="telefone"
                        name="telefone"
                        type="tel"
                        required
                        placeholder="(XX) XXXXX-XXXX"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="email">E-mail</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="seu@email.com"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="tipo-obra">Tipo de obra</label>
                      <select id="tipo-obra" name="tipo-obra" className={styles.input}>
                        <option value="">Selecione...</option>
                        {tiposObra.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="quantidade">Quantidade estimada</label>
                      <input
                        id="quantidade"
                        name="quantidade"
                        type="text"
                        placeholder="Ex: 500 peças"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="cidade">Cidade / Estado</label>
                    <input
                      id="cidade"
                      name="cidade"
                      type="text"
                      placeholder="Ex: São Paulo / SP"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="mensagem">Descrição do projeto</label>
                    <textarea
                      id="mensagem"
                      name="mensagem"
                      rows={5}
                      placeholder="Descreva o projeto, tipo de porcelanato, ambiente de aplicação, prazo e qualquer detalhe relevante."
                      className={styles.textarea}
                    />
                  </div>

                  {formState === 'error' && (
                    <p className={styles.errorMsg}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    className={`btn-primary ${styles.submitBtn}`}
                    disabled={formState === 'sending'}
                  >
                    {formState === 'sending' ? 'Enviando...' : 'Enviar solicitação de orçamento'}
                  </button>

                  <p className={styles.formTrust}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Seus dados estão seguros. Respondemos em até 1 dia útil.
                  </p>

                </form>
              )}
            </div>

            {/* Sidebar */}
            <aside className={styles.sidebar}>

              <div className={styles.sideCard}>
                <h3 className={styles.sideTitle}>Falar pelo WhatsApp</h3>
                <p className={styles.sideDesc}>
                  Prefere contato direto? Nossa equipe atende via WhatsApp
                  em horário comercial — resposta rápida para dúvidas e orçamentos.
                </p>
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn-whatsapp ${styles.waBtn}`}
                  data-source="fixador-orcamento"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Iniciar conversa no WhatsApp
                </a>
              </div>

              <div className={styles.sideCard}>
                <h3 className={styles.sideTitle}>Informações do produto</h3>
                <ul className={styles.infoList}>
                  <li><strong>Material:</strong> Aço Inoxidável de alta liga</li>
                  <li><strong>Comprimento:</strong> 120 mm</li>
                  <li><strong>Largura:</strong> 40 mm</li>
                  <li><strong>Fixação:</strong> Bucha Prego 6 × 38 mm</li>
                  <li><strong>Ensaios:</strong> LAMAT/SENAI</li>
                  <li><strong>Entrega:</strong> Todo o Brasil</li>
                  <li><strong>Fabricante:</strong> Pousinox — Pouso Alegre, MG</li>
                </ul>
              </div>

              <div className={styles.sideCard}>
                <h3 className={styles.sideTitle}>Links úteis</h3>
                <div className={styles.sideLinks}>
                  <Link to="/fixador-porcelanato/ensaios" className={styles.sideLink}>
                    Ensaios LAMAT/SENAI
                  </Link>
                  <Link to="/fixador-porcelanato/normas" className={styles.sideLink}>
                    Normas técnicas
                  </Link>
                  <Link to="/fixador-porcelanato/fachadas" className={styles.sideLink}>
                    Aplicações em fachadas
                  </Link>
                  <Link to="/fixador-porcelanato" className={styles.sideLink}>
                    Visão geral do produto
                  </Link>
                </div>
              </div>

            </aside>
          </div>
        </div>
      </div>
    </>
  )
}
