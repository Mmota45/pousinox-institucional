import { useState } from 'react'
import type { FormEvent } from 'react'
import SEO from '../components/SEO/SEO'
import styles from './Contato.module.css'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO WEBHOOK N8N
// Substitua pela URL real do seu webhook no N8N após importar o workflow.
// Exemplo: 'https://n8n.pousinox.com.br/webhook/contato-lead'
// ─────────────────────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = 'https://n8n.pousinox.com.br/webhook/contato-lead'

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento.'

const segments = [
  'Restaurantes e Food Service',
  'Panificação e Confeitaria',
  'Hospitalar e Clínicas',
  'Laboratório Farmacêutico',
  'Hotelaria e Catering',
  'Comércio e Varejo',
  'Arquitetura e Projetos Residenciais',
  'Construção Civil',
  'Outro',
]

type FormState = 'idle' | 'sending' | 'success' | 'error'

export default function Contato() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('sending')
    setErrorMsg('')

    const form = e.currentTarget
    const raw = new FormData(form)

    // Arquivo é enviado separado — por ora, apenas coleta o nome
    const arquivo = raw.get('arquivo') as File | null
    const payload: Record<string, string> = {}
    raw.forEach((val, key) => {
      if (key !== 'arquivo') payload[key] = val as string
    })

    const body = {
      ...payload,
      arquivo_nome: arquivo?.name ?? '',
      produto: 'Inox Geral',
      origem: 'site-contato',
      timestamp: new Date().toISOString(),
    }

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    <div className={styles.page}>
      <SEO
        title="Solicitar Orçamento — POUSINOX® Inox Pouso Alegre, MG"
        description="Solicite orçamento de equipamentos em aço inox sob medida em Pouso Alegre, MG. Bancadas, mesas, coifas, pias e corte a laser para o Sul de Minas Gerais e todo o Brasil. Resposta rápida por WhatsApp ou formulário."
        path="/contato"
      />

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>Orçamento e Contato</h1>
          <p className={styles.pageSubtitle}>
            Fale com a POUSINOX® pelo canal de sua preferência. Respondemos rapidamente.
          </p>
        </div>
      </div>

      <div className={`container ${styles.layout}`}>
        {/* Form */}
        <div className={styles.formSection}>
          <h2 className={styles.formTitle}>Solicitar orçamento</h2>
          <p className={styles.formDesc}>
            Preencha o formulário abaixo com os detalhes do seu projeto.
            Nossa equipe entrará em contato em breve.
          </p>

          {formState === 'success' ? (
            <div className={styles.successBox}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h3>Mensagem enviada!</h3>
              <p>
                Nossa equipe recebeu seu orçamento e entrará em contato em breve.
                Para agilizar, nos chame também pelo WhatsApp.
              </p>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Falar no WhatsApp
              </a>
              <button className={styles.newRequestBtn} onClick={() => setFormState('idle')}>
                Enviar outro orçamento
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="nome">Nome completo *</label>
                  <input id="nome" name="nome" type="text" required placeholder="Seu nome" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="telefone">Telefone / WhatsApp *</label>
                  <input id="telefone" name="telefone" type="tel" required placeholder="(XX) XXXXX-XXXX" className={styles.input} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" placeholder="seu@email.com.br" className={styles.input} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="cidade">Cidade / Estado *</label>
                  <input id="cidade" name="cidade" type="text" required placeholder="Ex: São Paulo, SP" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="prazo">Prazo / urgência</label>
                  <select id="prazo" name="prazo" className={styles.input}>
                    <option value="">Selecione...</option>
                    <option value="Urgente (até 7 dias)">Urgente (até 7 dias)</option>
                    <option value="Curto prazo (até 30 dias)">Curto prazo (até 30 dias)</option>
                    <option value="Médio prazo (1–3 meses)">Médio prazo (1–3 meses)</option>
                    <option value="Sem urgência">Sem urgência</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="segmento">Segmento de atuação</label>
                <select id="segmento" name="segmento" className={styles.input}>
                  <option value="">Selecione...</option>
                  {segments.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="mensagem">Descreva seu projeto / necessidade *</label>
                <textarea
                  id="mensagem"
                  name="mensagem"
                  required
                  rows={5}
                  placeholder="Descreva o que você precisa: tipo de equipamento, dimensões, quantidade, prazo, etc."
                  className={`${styles.input} ${styles.textarea}`}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="arquivo">
                  Anexar arquivo <span className={styles.labelOpcional}>(opcional)</span>
                </label>
                <input
                  id="arquivo"
                  name="arquivo"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg,.dxf"
                  className={styles.fileInput}
                />
                <p className={styles.fileHint}>PDF, imagens, DWG ou DXF — máx. 5 MB</p>
              </div>

              {formState === 'error' && (
                <p className={styles.errorMsg}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {errorMsg}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={formState === 'sending'}>
                {formState === 'sending' ? 'Enviando...' : 'Enviar solicitação'}
              </button>

              <p className={styles.formTrust}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Seus dados estão seguros. Respondemos em até 1 dia útil — sem SPAM, sem lista de e-mails.
              </p>
            </form>
          )}
        </div>

        {/* Sidebar info */}
        <aside className={styles.infoSide}>
          <div className={styles.waCard}>
            <h3 className={styles.waTitle}>Preferir o WhatsApp?</h3>
            <p>Atendemos pelo WhatsApp em horário comercial. Clique e fale diretamente com nossa equipe.</p>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Abrir WhatsApp
            </a>
          </div>

          <div className={styles.contactCard}>
            <h3 className={styles.contactCardTitle}>Informações de contato</h3>
            <ul className={styles.contactList}>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.05 1.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/>
                </svg>
                <div>
                  <strong>Telefone</strong>
                  <span>(35) 3423-8994</span>
                </div>
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <div>
                  <strong>Endereço</strong>
                  <span>Av. Antonio Mariosa, 4545<br />Santa Angelina — Pouso Alegre, MG<br />CEP 37550-360</span>
                </div>
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <div>
                  <strong>Horário de atendimento</strong>
                  <span>Seg–Qui: 7h30–11h30 / 13h15–18h</span>
                  <span>Sex: 7h30–11h30 / 13h15–17h</span>
                  <span>Sáb, Dom e Feriados: fechado</span>
                </div>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
