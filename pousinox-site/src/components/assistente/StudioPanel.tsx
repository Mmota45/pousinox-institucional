import { useState, useCallback, type ReactNode } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import s from './StudioPanel.module.css'

const svgCard = (d: string, color = '#1B3A5C'): ReactNode => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>

interface Slide { titulo: string; bullets: string[]; nota?: string }

function SlideViewer({ content }: { content: string }) {
  const [idx, setIdx] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  let slides: Slide[] = []
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    slides = JSON.parse(cleaned)
  } catch { return <div className={s.outputContent}>{content}</div> }

  if (!slides.length) return <div className={s.outputContent}>{content}</div>

  const slide = slides[idx]
  const isFirst = idx === 0
  const isLast = idx === slides.length - 1

  const viewer = (
    <div className={`${s.slideWrap} ${fullscreen ? s.slideFullscreen : ''}`}>
      <div className={`${s.slide} ${isFirst ? s.slideCover : ''}`}>
        <div className={s.slideTitle}>{slide.titulo}</div>
        <ul className={s.slideBullets}>
          {slide.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        {slide.nota && <div className={s.slideNota}>{slide.nota}</div>}
      </div>
      <div className={s.slideNav}>
        <button disabled={isFirst} onClick={() => setIdx(i => i - 1)} className={s.slideNavBtn}>←</button>
        <span className={s.slideCounter}>{idx + 1} / {slides.length}</span>
        <button disabled={isLast} onClick={() => setIdx(i => i + 1)} className={s.slideNavBtn}>→</button>
        <button onClick={() => setFullscreen(f => !f)} className={s.slideNavBtn} title={fullscreen ? 'Sair' : 'Tela cheia'}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>
    </div>
  )

  if (fullscreen) return <div className={s.slideOverlay} onClick={e => { if (e.target === e.currentTarget) setFullscreen(false) }}>{viewer}</div>
  return viewer
}

interface StudioOutput {
  id: string
  tipo: string
  titulo: string
  conteudo: string
  criado_em: string
}

interface Props {
  fonteCount: number
  onGenerate: (tipo: string, prompt: string) => Promise<string>
  onCollapse?: () => void
  onGuiaSaved?: () => void
}

const CARDS = [
  { tipo: 'resumo', icon: svgCard('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6', '#6366f1'), label: 'Resumo', desc: 'Sintese clara em 3-5 paragrafos', prompt: 'Resuma o conteúdo das fontes de forma clara e objetiva em 3-5 parágrafos. Destaque os pontos principais.' },
  { tipo: 'relatorio', icon: svgCard('M18 20V10M12 20V4M6 20v-6', '#0ea5e9'), label: 'Relatório', desc: 'Documento estruturado com secoes', prompt: 'Gere um relatório estruturado com título, introdução, seções temáticas e conclusão baseado nas fontes.' },
  { tipo: 'mapa', icon: svgCard('M12 3v4M12 7H8M12 7h4M8 7v4M16 7v4M8 11H5M16 11h3M5 11v4M19 11v4M5 15H3M19 15h2', '#ec4899'), label: 'Mapa Mental', desc: 'Hierarquia de topicos e subtopicos', prompt: 'Crie um mapa mental hierárquico usando markdown (# Tema principal, ## Subtemas, ### Detalhes, - itens). Organize as ideias das fontes em tópicos e subtópicos.' },
  { tipo: 'cartoes', icon: svgCard('M2 6h16a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM6 2h14a2 2 0 012 2v1', '#10b981'), label: 'Cartões', desc: 'Flashcards pergunta/resposta', prompt: 'Gere 8-12 flashcards no formato:\n\n**Pergunta:** ...\n**Resposta:** ...\n\n---\n\nBaseados nos conceitos-chave das fontes.' },
  { tipo: 'tabela', icon: svgCard('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18', '#f59e0b'), label: 'Tabela de Dados', desc: 'Dados extraidos em formato tabular', prompt: 'Extraia todos os dados estruturados das fontes e organize em tabela markdown com colunas relevantes. Use | para colunas.' },
  { tipo: 'teste', icon: svgCard('M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3', '#10b981'), label: 'Teste', desc: 'Quiz interativo com respostas', prompt: 'Gere um quiz com 10 perguntas de múltipla escolha (A, B, C, D) baseadas nas fontes. Formato:\n\n**Pergunta N:** texto\nA) ...\nB) ...\nC) ...\nD) ...\n**Resposta:** letra — explicação breve\n\n---' },
  { tipo: 'pontos', icon: svgCard('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z', '#f97316'), label: 'Pontos-Chave', desc: 'Top 10-15 insights ordenados', prompt: 'Liste os 10-15 pontos-chave mais importantes das fontes, ordenados por relevância. Use bullets com explicação breve.' },
  { tipo: 'apresentacao', icon: svgCard('M2 3h20v14H2zM8 21h8M12 17v4', '#8b5cf6'), label: 'Apresentação', desc: 'Slides com tópicos principais', prompt: `Gere uma apresentação de slides baseada nas fontes. Retorne APENAS um JSON array válido (sem markdown, sem \`\`\`), onde cada item é um slide:
[
  { "titulo": "Título do Slide", "bullets": ["Ponto 1", "Ponto 2", "Ponto 3"], "nota": "Nota opcional do apresentador" }
]
Gere 6-10 slides. O primeiro slide deve ser a capa (título principal + subtítulo nos bullets). O último deve ser "Conclusão" ou "Próximos Passos".` },
  { tipo: 'guia', icon: svgCard('M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z', '#3b82f6'), label: 'Criar Guia', desc: 'Guia estruturado para a base de conhecimento', prompt: `Baseado nas fontes, crie um guia de conhecimento estruturado no seguinte formato EXATO (use os marcadores para separar seções):

[TITULO]: (título curto e descritivo)
[CATEGORIA]: (uma de: sql, frontend, backend, deploy, git, lgpd, geral)
[NIVEL]: (um de: iniciante, intermediario, avancado)
[O_QUE_E]: (explicação clara do conceito)
[QUANDO_USAR]: (situações práticas de uso)
[COMO_FAZER]: (código ou passo-a-passo detalhado)
[ONDE_FAZER]: (onde executar — qual ferramenta, arquivo, terminal)
[POR_QUE]: (motivação e benefícios)

Responda APENAS nesse formato, sem texto adicional.` },
]

function parseGuia(text: string) {
  const get = (key: string) => {
    const re = new RegExp(`\\[${key}\\]:\\s*(.+?)(?=\\n\\[|$)`, 's')
    return re.exec(text)?.[1]?.trim() || ''
  }
  return {
    titulo: get('TITULO'),
    categoria: get('CATEGORIA') || 'geral',
    nivel: get('NIVEL') || 'iniciante',
    o_que_e: get('O_QUE_E'),
    quando_usar: get('QUANDO_USAR'),
    como_fazer: get('COMO_FAZER'),
    onde_fazer: get('ONDE_FAZER'),
    por_que: get('POR_QUE'),
  }
}

export default function StudioPanel({ fonteCount, onGenerate, onCollapse, onGuiaSaved }: Props) {
  const [outputs, setOutputs] = useState<StudioOutput[]>([])
  const [gerando, setGerando] = useState<string | null>(null)
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null)
  const [notas, setNotas] = useState<StudioOutput[]>(() => {
    try { return JSON.parse(localStorage.getItem('pousinox_studio_notas') || '[]') }
    catch { return [] }
  })

  const gerar = useCallback(async (card: typeof CARDS[0]) => {
    if (fonteCount === 0) return
    setGerando(card.tipo)
    try {
      const conteudo = await onGenerate(card.tipo, card.prompt)
      const output: StudioOutput = {
        id: Date.now().toString(),
        tipo: card.tipo,
        titulo: card.label,
        conteudo,
        criado_em: new Date().toLocaleString('pt-BR'),
      }
      setOutputs(prev => [output, ...prev])
      setExpandedOutput(output.id)
    } catch (err) {
      console.error('[Studio] erro:', err)
    } finally {
      setGerando(null)
    }
  }, [fonteCount, onGenerate])

  const salvarNota = useCallback((output: StudioOutput) => {
    const updated = [output, ...notas].slice(0, 30)
    setNotas(updated)
    localStorage.setItem('pousinox_studio_notas', JSON.stringify(updated))
  }, [notas])

  const excluirNota = useCallback((id: string) => {
    const updated = notas.filter(n => n.id !== id)
    setNotas(updated)
    localStorage.setItem('pousinox_studio_notas', JSON.stringify(updated))
  }, [notas])

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.headerTitle}>Estúdio</span>
        {onCollapse && (
          <button className={s.collapseBtn} onClick={onCollapse} title="Fechar painel">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/><path d="M10 9l2 3-2 3"/></svg>
          </button>
        )}
      </div>

      <div className={s.panelScroll}>
      {fonteCount === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
          <p className={s.emptyText}>O resultado do Estúdio será salvo aqui.</p>
          <p className={s.emptySub}>Depois de incluir as fontes, clique para adicionar um Resumo, Relatório, Mapa Mental e muito mais!</p>
        </div>
      ) : (
        <>
          <div className={s.cards}>
            {CARDS.map(card => (
              <button
                key={card.tipo}
                className={`${s.card} ${gerando === card.tipo ? s.cardLoading : ''}`}
                onClick={() => gerar(card)}
                disabled={gerando !== null}
                title={card.desc}
              >
                <span className={s.cardIcon}>{card.icon}</span>
                <span className={s.cardLabel}>{card.label}</span>
                <span className={s.cardDesc}>{card.desc}</span>
                {gerando === card.tipo && <span className={s.cardSpinner} />}
              </button>
            ))}
          </div>

          {outputs.length === 0 && (
            <div className={s.studioHint}>
              <p>Clique em um card acima para gerar conteudo a partir das suas fontes.</p>
            </div>
          )}

          {outputs.length > 0 && (
            <div className={s.outputs}>
              {outputs.map(out => (
                <div key={out.id} className={s.outputItem}>
                  <button
                    className={s.outputHeader}
                    onClick={() => setExpandedOutput(expandedOutput === out.id ? null : out.id)}
                  >
                    <span>{CARDS.find(c => c.tipo === out.tipo)?.icon} {out.titulo}</span>
                    <span className={s.outputDate}>{out.criado_em}</span>
                  </button>
                  {expandedOutput === out.id && (
                    <div className={s.outputBody}>
                      {out.tipo === 'apresentacao'
                        ? <SlideViewer content={out.conteudo} />
                        : <div className={s.outputContent}>{out.conteudo}</div>
                      }
                      <div className={s.outputActions}>
                        <button className={s.outputBtn} onClick={() => navigator.clipboard.writeText(out.conteudo)}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'-1px',marginRight:4}}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copiar</button>
                        <button className={s.outputBtn} onClick={() => salvarNota(out)}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'-1px',marginRight:4}}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>Salvar nota</button>
                        {out.tipo === 'guia' && (
                          <button className={`${s.outputBtn} ${s.outputBtnGuia}`} onClick={async () => {
                            const g = parseGuia(out.conteudo)
                            if (!g.titulo) { alert('Não foi possível extrair o título do guia'); return }
                            const { error } = await supabaseAdmin.from('knowledge_guias').insert(g)
                            if (error) { alert('Erro ao salvar: ' + error.message); return }
                            alert('Guia salvo na base de conhecimento!')
                            onGuiaSaved?.()
                          }}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'-1px',marginRight:4}}><path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>Salvar guia</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className={s.addNotaBar}>
        <button className={s.addNotaBtn} onClick={() => {
          const texto = prompt('Digite sua nota:')
          if (!texto?.trim()) return
          const nota: StudioOutput = { id: Date.now().toString(), tipo: 'manual', titulo: 'Nota manual', conteudo: texto.trim(), criado_em: new Date().toLocaleString('pt-BR') }
          const updated = [nota, ...notas].slice(0, 30)
          setNotas(updated)
          localStorage.setItem('pousinox_studio_notas', JSON.stringify(updated))
        }}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 6 }}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Adicionar nota</button>
      </div>

      {notas.length > 0 && (
        <div className={s.notasSection}>
          <div className={s.notasTitle}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'-2px',marginRight:4}}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>Notas salvas ({notas.length})</div>
          {notas.map(nota => (
            <div key={nota.id} className={s.notaItem}>
              <button
                className={s.notaHeader}
                onClick={() => setExpandedOutput(expandedOutput === `n-${nota.id}` ? null : `n-${nota.id}`)}
              >
                <span>{CARDS.find(c => c.tipo === nota.tipo)?.icon} {nota.titulo}</span>
                <button className={s.notaDel} onClick={e => { e.stopPropagation(); excluirNota(nota.id) }}>✕</button>
              </button>
              {expandedOutput === `n-${nota.id}` && (
                <div className={s.outputBody}>
                  <div className={s.outputContent}>{nota.conteudo}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
