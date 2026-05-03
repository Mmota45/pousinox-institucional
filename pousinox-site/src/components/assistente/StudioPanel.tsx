import { useState, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import s from './StudioPanel.module.css'

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
  onGuiaSaved?: () => void
}

const CARDS = [
  { tipo: 'resumo', icon: '📝', label: 'Resumo', desc: 'Síntese clara em 3-5 parágrafos', prompt: 'Resuma o conteúdo das fontes de forma clara e objetiva em 3-5 parágrafos. Destaque os pontos principais.' },
  { tipo: 'relatorio', icon: '📊', label: 'Relatório', desc: 'Documento estruturado com seções', prompt: 'Gere um relatório estruturado com título, introdução, seções temáticas e conclusão baseado nas fontes.' },
  { tipo: 'mapa', icon: '🧠', label: 'Mapa Mental', desc: 'Hierarquia de tópicos e subtópicos', prompt: 'Crie um mapa mental hierárquico usando markdown (# Tema principal, ## Subtemas, ### Detalhes, - itens). Organize as ideias das fontes em tópicos e subtópicos.' },
  { tipo: 'cartoes', icon: '🃏', label: 'Cartões', desc: 'Flashcards pergunta/resposta', prompt: 'Gere 8-12 flashcards no formato:\n\n**Pergunta:** ...\n**Resposta:** ...\n\n---\n\nBaseados nos conceitos-chave das fontes.' },
  { tipo: 'tabela', icon: '📋', label: 'Tabela de Dados', desc: 'Dados extraídos em formato tabular', prompt: 'Extraia todos os dados estruturados das fontes e organize em tabela markdown com colunas relevantes. Use | para colunas.' },
  { tipo: 'teste', icon: '✅', label: 'Teste', desc: 'Quiz interativo com respostas', prompt: 'Gere um quiz com 10 perguntas de múltipla escolha (A, B, C, D) baseadas nas fontes. Formato:\n\n**Pergunta N:** texto\nA) ...\nB) ...\nC) ...\nD) ...\n**Resposta:** letra — explicação breve\n\n---' },
  { tipo: 'pontos', icon: '🎯', label: 'Pontos-Chave', desc: 'Top 10-15 insights ordenados', prompt: 'Liste os 10-15 pontos-chave mais importantes das fontes, ordenados por relevância. Use bullets com explicação breve.' },
  { tipo: 'guia', icon: '📘', label: 'Criar Guia', desc: 'Guia estruturado para a base de conhecimento', prompt: `Baseado nas fontes, crie um guia de conhecimento estruturado no seguinte formato EXATO (use os marcadores para separar seções):

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

export default function StudioPanel({ fonteCount, onGenerate, onGuiaSaved }: Props) {
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
      </div>

      {fonteCount === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>✨</div>
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
                      <div className={s.outputContent}>{out.conteudo}</div>
                      <div className={s.outputActions}>
                        <button className={s.outputBtn} onClick={() => navigator.clipboard.writeText(out.conteudo)}>📋 Copiar</button>
                        <button className={s.outputBtn} onClick={() => salvarNota(out)}>📌 Salvar nota</button>
                        {out.tipo === 'guia' && (
                          <button className={`${s.outputBtn} ${s.outputBtnGuia}`} onClick={async () => {
                            const g = parseGuia(out.conteudo)
                            if (!g.titulo) { alert('Não foi possível extrair o título do guia'); return }
                            const { error } = await supabaseAdmin.from('knowledge_guias').insert(g)
                            if (error) { alert('Erro ao salvar: ' + error.message); return }
                            alert('Guia salvo na base de conhecimento!')
                            onGuiaSaved?.()
                          }}>📘 Salvar guia</button>
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
        }}>📝 Adicionar nota</button>
      </div>

      {notas.length > 0 && (
        <div className={s.notasSection}>
          <div className={s.notasTitle}>📌 Notas salvas ({notas.length})</div>
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
  )
}
