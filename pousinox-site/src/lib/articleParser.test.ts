import { describe, it, expect } from 'vitest'
import { parseArticle, isMinimalSection, parseResumoBullets } from './articleParser'

// ── parseArticle ─────────────────────────────────────────────────────────────

describe('parseArticle', () => {
  it('conteúdo sem heading vira uma única seção intro (heading null)', () => {
    const result = parseArticle('Texto simples sem heading.')
    expect(result).toHaveLength(1)
    expect(result[0].heading).toBeNull()
    expect(result[0].blocks).toContain('Texto simples sem heading.')
  })

  it('heading **...** gera seção com heading extraído', () => {
    const conteudo = '**Como funciona**\nExplicação do funcionamento.'
    const result = parseArticle(conteudo)
    expect(result).toHaveLength(1)
    expect(result[0].heading).toBe('Como funciona')
    expect(result[0].blocks[0]).toBe('Explicação do funcionamento.')
  })

  it('intro antes do heading + seção com heading', () => {
    const conteudo = 'Parágrafo intro.\n\n**Seção 1**\nConteúdo da seção.'
    const result = parseArticle(conteudo)
    expect(result).toHaveLength(2)
    expect(result[0].heading).toBeNull()
    expect(result[1].heading).toBe('Seção 1')
  })

  it('múltiplos headings geram múltiplas seções', () => {
    const conteudo = '**Seção A**\nBloco A.\n\n**Seção B**\nBloco B.\n\n**Seção C**\nBloco C.'
    const result = parseArticle(conteudo)
    expect(result).toHaveLength(3)
    expect(result.map(s => s.heading)).toEqual(['Seção A', 'Seção B', 'Seção C'])
  })

  it('heading sem \\n\\n duplo antes é normalizado corretamente', () => {
    // heading colado ao parágrafo anterior com \n simples
    const conteudo = 'Intro.\n**Heading colado**\nConteúdo.'
    const result = parseArticle(conteudo)
    const headings = result.filter(s => s.heading !== null)
    expect(headings).toHaveLength(1)
    expect(headings[0].heading).toBe('Heading colado')
  })

  it('bloco com lista (\\n- ) fica no mesmo block string', () => {
    const conteudo = '**Diferenciais**\nIntro da lista.\n- Item 1\n- Item 2'
    const result = parseArticle(conteudo)
    expect(result[0].heading).toBe('Diferenciais')
    expect(result[0].blocks[0]).toContain('\n- Item 1')
  })
})

// ── isMinimalSection ─────────────────────────────────────────────────────────

describe('isMinimalSection', () => {
  it('1 parágrafo sem lista → minimal', () => {
    expect(isMinimalSection(['Parágrafo único sem lista.'])).toBe(true)
  })

  it('múltiplos blocos → não minimal', () => {
    expect(isMinimalSection(['Bloco 1.', 'Bloco 2.'])).toBe(false)
  })

  it('1 bloco com lista → não minimal', () => {
    expect(isMinimalSection(['Intro.\n- item 1\n- item 2'])).toBe(false)
  })
})

// ── parseResumoBullets ───────────────────────────────────────────────────────

describe('parseResumoBullets', () => {
  it('resumo sem \\n- retorna null (fallback parágrafo)', () => {
    expect(parseResumoBullets('Resumo em parágrafo corrido.')).toBeNull()
  })

  it('resumo com \\n- retorna array de strings', () => {
    const resumo = '- Ponto 1\n- Ponto 2\n- Ponto 3'
    const result = parseResumoBullets(resumo)
    expect(result).toEqual(['Ponto 1', 'Ponto 2', 'Ponto 3'])
  })

  it('remove prefixo "- " residual dos itens', () => {
    const resumo = '\n- Item com prefixo\n- Outro item'
    const result = parseResumoBullets(resumo)
    expect(result?.every(s => !s.startsWith('- '))).toBe(true)
  })
})
