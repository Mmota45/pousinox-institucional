/**
 * WatermarkPdf — geração de PDF técnico com marca d'água rastreável
 *
 * Uso:
 *   <WatermarkPdf
 *     tipoDoc="ficha-tecnica"
 *     titulo="Ficha Técnica — Fixador FP-10"
 *     conteudo={<FichaTecnicaConteudo />}
 *   />
 *
 * O componente:
 *   1. Exibe formulário com empresa, contato, email, observação
 *   2. Ao confirmar: insere log em docs_enviados (gera watermark_id UUID)
 *   3. Abre janela de impressão com o conteúdo + camada de marca d'água
 */

import { useState } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import styles from './WatermarkPdf.module.css'

interface WatermarkPdfProps {
  tipoDoc: string
  titulo?: string
  /** JSX que será renderizado dentro do PDF */
  conteudo: React.ReactNode
  /** Texto adicional opcional no rodapé */
  rodapeExtra?: string
}

interface FormData {
  empresa: string
  contato: string
  email: string
  observacao: string
}

const EMPTY: FormData = { empresa: '', contato: '', email: '', observacao: '' }

export default function WatermarkPdf({ tipoDoc, titulo, conteudo, rodapeExtra }: WatermarkPdfProps) {
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function campo(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function gerar() {
    if (!form.empresa.trim()) { setErro('Informe a empresa destinatária.'); return }
    setGerando(true)
    setErro(null)

    const { data, error } = await supabaseAdmin
      .from('docs_enviados')
      .insert({
        tipo_doc: tipoDoc,
        titulo: titulo ?? tipoDoc,
        empresa: form.empresa.trim(),
        contato: form.contato.trim() || null,
        email: form.email.trim() || null,
        observacao: form.observacao.trim() || null,
      })
      .select('watermark_id, criado_em')
      .single()

    setGerando(false)

    if (error || !data) {
      setErro('Erro ao registrar envio. Tente novamente.')
      return
    }

    abrirJanelaPdf(data.watermark_id, data.criado_em)
    setAberto(false)
    setForm(EMPTY)
  }

  function abrirJanelaPdf(watermarkId: string, criadoEm: string) {
    const dataFormatada = new Date(criadoEm).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    // Captura o HTML do conteúdo renderizado
    const conteudoEl = document.getElementById('watermark-pdf-content-hidden')
    const conteudoHtml = conteudoEl?.innerHTML ?? ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${titulo ?? tipoDoc}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; }

  /* Marca d'água diagonal */
  .watermark-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 80px;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.045;
    transform: rotate(-35deg);
  }
  .watermark-text {
    font-size: 48pt;
    font-weight: 900;
    color: #000;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .watermark-text-sm {
    font-size: 16pt;
    font-weight: 700;
    color: #000;
    white-space: nowrap;
  }

  /* Rodapé fixo */
  .rodape {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 1px solid #ddd;
    padding: 6px 20px;
    font-size: 7pt;
    color: #666;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
  }
  .rodape strong { color: #333; }

  /* Cabeçalho */
  .cabecalho {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 12px;
    border-bottom: 2px solid #1a3a5c;
    margin-bottom: 20px;
  }
  .logo-txt {
    font-size: 18pt;
    font-weight: 900;
    color: #1a3a5c;
    letter-spacing: -0.02em;
  }
  .cabecalho-meta {
    text-align: right;
    font-size: 8pt;
    color: #666;
    line-height: 1.6;
  }

  /* Destinatário */
  .destinatario {
    background: #f5f7fa;
    border-left: 3px solid #1a3a5c;
    padding: 8px 14px;
    margin: 0 20px 20px;
    font-size: 9pt;
    color: #444;
  }
  .destinatario strong { color: #1a1a2e; display: block; font-size: 10pt; margin-bottom: 2px; }

  .conteudo { padding: 0 20px 80px; }

  @media print {
    @page { margin: 0; size: A4; }
    .watermark-overlay { position: fixed; }
    .rodape { position: fixed; }
  }
</style>
</head>
<body>

<div class="watermark-overlay">
  <div class="watermark-text">CONFIDENCIAL</div>
  <div class="watermark-text-sm">USO RESTRITO · POUSINOX</div>
  <div class="watermark-text">CONFIDENCIAL</div>
</div>

<div class="cabecalho">
  <div class="logo-txt">POUSINOX</div>
  <div class="cabecalho-meta">
    <div>pousinox.com.br · (35) 3422-0600</div>
    <div>Pouso Alegre, MG · CNPJ 00.000.000/0001-00</div>
    <div>Emitido em: ${dataFormatada}</div>
    <div>ID: <strong>${watermarkId}</strong></div>
  </div>
</div>

<div class="destinatario">
  <strong>Destinatário: ${form.empresa}</strong>
  ${form.contato ? `Contato: ${form.contato}` : ''}
  ${form.email ? ` · ${form.email}` : ''}
</div>

<div class="conteudo">
${conteudoHtml}
</div>

<div class="rodape">
  <span>🔒 DOCUMENTO CONFIDENCIAL · uso restrito ao destinatário identificado</span>
  <span>ID rastreável: <strong>${watermarkId}</strong> · ${dataFormatada}${rodapeExtra ? ' · ' + rodapeExtra : ''}</span>
</div>

<script>window.onload = () => { window.print() }<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  return (
    <>
      {/* Conteúdo oculto para capturar o HTML */}
      <div id="watermark-pdf-content-hidden" style={{ display: 'none' }}>
        {conteudo}
      </div>

      <button className={styles.btnGerar} onClick={() => setAberto(true)} type="button">
        🔒 Gerar PDF com marca d'água
      </button>

      {aberto && (
        <div className={styles.overlay} onClick={() => setAberto(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Registrar envio do documento</h3>
              <button onClick={() => setAberto(false)}>✕</button>
            </div>

            <p className={styles.aviso}>
              O PDF será gerado com marca d'água rastreável e o envio ficará registrado com ID único.
            </p>

            <label className={styles.label}>
              Empresa destinatária *
              <input
                className={styles.input}
                value={form.empresa}
                onChange={campo('empresa')}
                placeholder="Nome da empresa"
                autoFocus
              />
            </label>
            <label className={styles.label}>
              Contato
              <input
                className={styles.input}
                value={form.contato}
                onChange={campo('contato')}
                placeholder="Nome do responsável"
              />
            </label>
            <label className={styles.label}>
              E-mail
              <input
                className={styles.input}
                type="email"
                value={form.email}
                onChange={campo('email')}
                placeholder="email@empresa.com"
              />
            </label>
            <label className={styles.label}>
              Observação
              <textarea
                className={styles.input}
                value={form.observacao}
                onChange={campo('observacao')}
                placeholder="Finalidade, reunião, etc."
                rows={2}
              />
            </label>

            {erro && <p className={styles.erro}>{erro}</p>}

            <div className={styles.actions}>
              <button className={styles.btnCancelar} onClick={() => setAberto(false)}>Cancelar</button>
              <button className={styles.btnConfirmar} onClick={gerar} disabled={gerando}>
                {gerando ? 'Registrando…' : '🖨 Gerar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
