/**
 * articleParser.tsx — Single source of truth para parsing e renderização de artigos.
 *
 * FORMATO SUPORTADO (mini-markdown editorial):
 *
 * Headings de seção:
 *   **Título da seção**          ← linha inteira entre **, vira h3 + card visual
 *
 * Bold inline:
 *   Texto com **palavra** bold   ← ** dentro de parágrafo, vira <strong>
 *
 * Lista:
 *   Intro do bloco               ← parágrafo antes dos itens (opcional)
 *   - item simples
 *   - **Rótulo**: descrição      ← bold antes de ": " vira <strong>Rótulo</strong>: desc
 *
 * Resumo em bullets (campo `resumo`):
 *   - Ponto 1\n- Ponto 2         ← cada "- " em linha própria vira <li> com ✓
 *
 * Separador de blocos: linha em branco (\n\n).
 * Headings sem \n\n duplo antes são normalizados automaticamente.
 *
 * Seção minimal: heading + 1 parágrafo sem lista → renderizada sem card (só texto).
 * Fallback: conteúdo sem nenhum heading → bloco articleIntro (sem seções).
 *
 * Consumidores: Blog.tsx (blog público) · ArticlePreview.tsx (admin preview).
 */

import React from 'react'
import styles from '../pages/Blog.module.css'

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface ArticleSection {
  /** null = bloco introdutório antes do primeiro heading */
  heading: string | null
  blocks: string[]
}

// ── Parse puro (sem React) ──────────────────────────────────────────────────

/**
 * Transforma a string `conteudo` numa lista de seções.
 * Função pura — não depende de React, totalmente testável.
 */
export function parseArticle(conteudo: string): ArticleSection[] {
  // Normaliza: insere linha em branco antes de qualquer **heading** isolado
  const normalized = conteudo
    .split('\n')
    .map(line => /^\*\*[^*]+\*\*$/.test(line.trim()) ? `\n${line}\n` : line)
    .join('\n')

  const blocks = normalized.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)

  const sections: ArticleSection[] = []
  let current: ArticleSection = { heading: null, blocks: [] }

  for (const block of blocks) {
    if (/^\*\*[^*]+\*\*$/.test(block)) {
      if (current.heading !== null || current.blocks.length > 0) sections.push(current)
      current = { heading: block.replace(/\*\*/g, '').trim(), blocks: [] }
    } else {
      current.blocks.push(block)
    }
  }
  if (current.heading !== null || current.blocks.length > 0) sections.push(current)

  return sections
}

/**
 * Retorna true para seções com apenas 1 parágrafo sem lista.
 * Usada para escolher entre card (articleSection) e texto simples (articleSectionMinimal).
 */
export function isMinimalSection(blocks: string[]): boolean {
  return blocks.length === 1 && !blocks[0].includes('\n- ')
}

/**
 * Extrai os bullets do campo `resumo`.
 * Retorna array de strings se o resumo usar "- item", senão retorna null.
 */
export function parseResumoBullets(resumo: string): string[] | null {
  if (!resumo.includes('\n- ')) return null
  return resumo.split('\n- ').filter(Boolean).map(s => s.replace(/^- /, ''))
}

// ── Render React ─────────────────────────────────────────────────────────────

/** Bold inline: **texto** → <strong>texto</strong> dentro de parágrafo */
export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )
}

/** Renderiza um bloco como parágrafo ou lista */
export function renderBlock(block: string, key: number): React.ReactNode {
  if (block.includes('\n- ')) {
    const [intro, ...items] = block.split('\n- ')
    return (
      <div key={key}>
        {intro && <p className={styles.articleP}>{renderInline(intro)}</p>}
        <ul className={styles.articleList}>
          {items.map((item, j) => {
            const parts = item.split('**: ')
            return (
              <li key={j}>
                {parts.length > 1
                  ? <><strong>{parts[0].replace(/^\*\*/, '')}</strong>: {parts[1]}</>
                  : renderInline(item)}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
  return <p key={key} className={styles.articleP}>{renderInline(block)}</p>
}

/** Renderiza o conteúdo completo do artigo em seções visuais */
export function renderArticleContent(conteudo: string): React.ReactNode {
  return parseArticle(conteudo).map((section, si) => {
    if (section.heading === null) {
      return (
        <div key={si} className={styles.articleIntro}>
          {section.blocks.map((b, bi) => renderBlock(b, bi))}
        </div>
      )
    }
    const minimal = isMinimalSection(section.blocks)
    return (
      <div key={si} className={minimal ? styles.articleSectionMinimal : styles.articleSection}>
        <h3 className={styles.articleH3}>{section.heading}</h3>
        <div className={styles.articleSectionBody}>
          {section.blocks.map((b, bi) => renderBlock(b, bi))}
        </div>
      </div>
    )
  })
}

/** Renderiza o campo `resumo` como parágrafo ou lista de bullets com ✓ */
export function renderResumo(resumo: string): React.ReactNode {
  const bullets = parseResumoBullets(resumo)
  if (bullets) {
    return (
      <ul className={styles.resumoList}>
        {bullets.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    )
  }
  return <p className={styles.resumoText}>{resumo}</p>
}
