import styles from '../../pages/Blog.module.css'
import { renderArticleContent, renderResumo } from '../../lib/articleParser'

// ── CTA simplificado (sem busca Supabase — apenas visual) ───────────────────
const WA = '5535999619463'

function PreviewCTA({ ctaTipo, fabricanteParceiro, titulo }: {
  ctaTipo: string
  fabricanteParceiro?: string
  titulo: string
}) {
  if (ctaTipo === 'nenhum') return null

  if (ctaTipo === 'parceiro') {
    return (
      <div style={{ margin: '2rem 0 1rem', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #fcd34d', background: '#fffbeb' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#92400e', marginBottom: '0.75rem' }}>Nota sobre este produto</p>
        <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
          {fabricanteParceiro
            ? <>Este produto é fabricado pela <strong>{fabricanteParceiro}</strong> e comercializado pela <strong>POUSINOX®</strong>.</>
            : <>Este produto é comercializado pela <strong>POUSINOX®</strong>.</>}
        </p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
          Falar com a POUSINOX®
        </span>
      </div>
    )
  }

  if (ctaTipo === 'pronta_entrega') {
    return (
      <div style={{ margin: '2rem 0 1rem', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', marginBottom: '0.75rem' }}>Disponível em pronta entrega</p>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', background: '#1e3f6e', color: '#fff', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
          Ver na Pronta Entrega →
        </span>
      </div>
    )
  }

  // orcamento (default)
  return (
    <div style={{ margin: '2rem 0 1rem', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe', background: '#f0f6ff' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1e3f6e', marginBottom: '0.5rem' }}>Gostou? Fale com a POUSINOX®</p>
      <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
        Desenvolvemos soluções em inox sob medida para restaurantes, hospitais, hotéis e indústria.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a
          href={`https://wa.me/${WA}?text=${encodeURIComponent(`Olá! Vi o artigo sobre ${titulo} e gostaria de um orçamento.`)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
        >
          Solicitar orçamento pelo WhatsApp
        </a>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', background: '#fff', color: '#1e3f6e', border: '1px solid #1e3f6e', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
          Formulário de contato
        </span>
      </div>
    </div>
  )
}

// ── Props ───────────────────────────────────────────────────────────────────
export interface ArticlePreviewProps {
  titulo: string
  subtitulo?: string
  categoria: string
  resumo?: string
  conteudo: string
  imagemDestaque?: string
  tipoPost?: string
  ctaTipo?: string
  fabricanteParceiro?: string
  tempoLeitura?: string
}

const TIPO_LABEL: Record<string, string> = {
  solucao: 'Solução', guia: 'Guia', aplicacao: 'Aplicação', institucional: 'Institucional',
}

// ── Componente principal ────────────────────────────────────────────────────
export default function ArticlePreview({
  titulo, subtitulo, categoria, resumo, conteudo,
  imagemDestaque, tipoPost, ctaTipo = 'orcamento', fabricanteParceiro, tempoLeitura,
}: ArticlePreviewProps) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  const minutos = tempoLeitura ?? `${Math.max(1, Math.round(conteudo.split(/\s+/).length / 200))} min`

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Meta */}
      <div className={styles.articleMeta}>
        <span className={styles.postCategory}>{categoria || 'Categoria'}</span>
        <span className={styles.postDate}>{hoje}</span>
        <span className={styles.postReadTime}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {minutos} de leitura
        </span>
      </div>

      {/* Título */}
      <h1 className={styles.articleTitle}>{titulo || 'Título do artigo'}</h1>

      {/* Subtítulo */}
      {subtitulo && <p className={styles.articleSubtitulo}>{subtitulo}</p>}

      {/* Badge tipo + share placeholder */}
      <div className={styles.shareRow}>
        {tipoPost && TIPO_LABEL[tipoPost] && (
          <span className={styles.tipoPostBadge}>{TIPO_LABEL[tipoPost]}</span>
        )}
      </div>

      {/* Hero image */}
      {imagemDestaque && (
        <div className={styles.articleHeroImage}>
          <img src={imagemDestaque} alt={titulo} />
        </div>
      )}

      {/* Resumo rápido */}
      {resumo && (
        <div className={styles.resumoBox}>
          <div className={styles.resumoLabel}>✦ Resumo rápido</div>
          {renderResumo(resumo)}
        </div>
      )}

      {/* Corpo do artigo */}
      <div className={styles.articleBody}>
        {conteudo.trim() ? renderArticleContent(conteudo) : (
          <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>O conteúdo do artigo aparecerá aqui…</p>
        )}
      </div>

      {/* CTA */}
      <PreviewCTA ctaTipo={ctaTipo} fabricanteParceiro={fabricanteParceiro} titulo={titulo} />

      {/* Newsletter — versão discreta */}
      <div className={styles.ctaBlock} style={{ marginTop: '1.5rem' }}>
        <div className={styles.newsletterContent}>
          <h3>Receba novidades da POUSINOX®</h3>
          <p>Dicas de manutenção, tendências do setor e informações sobre nossos produtos no seu e-mail.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="email"
            placeholder="seu@email.com.br"
            className={styles.newsletterInput}
            disabled
            style={{ background: '#fff', border: '1px solid #cbd5e1', opacity: 0.7 }}
          />
          <button className="btn-primary" disabled style={{ opacity: 0.7 }}>Cadastrar</button>
        </div>
      </div>
    </div>
  )
}
