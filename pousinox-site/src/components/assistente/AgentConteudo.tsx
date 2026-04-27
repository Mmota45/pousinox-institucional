// Agente Gerador de Conteúdo — gera posts, artigos e descrições SEO
import { useState, useCallback } from 'react'
import { aiChat } from '../../lib/aiHelper'
import s from './AgentPanel.module.css'

type TipoConteudo = 'instagram' | 'blog' | 'seo' | 'completo'

interface ConteudoGerado {
  tipo: string
  titulo: string
  conteudo: string
}

interface Props {
  aberto: boolean
  onClose: () => void
}

const TIPOS: { key: TipoConteudo; label: string; icon: string }[] = [
  { key: 'completo',  label: 'Pacote completo', icon: '📦' },
  { key: 'instagram', label: 'Post Instagram',  icon: '📸' },
  { key: 'blog',      label: 'Artigo Blog',     icon: '📝' },
  { key: 'seo',       label: 'Descrição SEO',   icon: '🔍' },
]

export default function AgentConteudo({ aberto, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ConteudoGerado[]>([])
  const [tema, setTema] = useState('')
  const [tipo, setTipo] = useState<TipoConteudo>('completo')
  const [copiado, setCopiado] = useState<number | null>(null)

  const executar = useCallback(async () => {
    if (!tema.trim()) return
    setLoading(true)
    setResultado([])
    try {
      const prompts: Record<TipoConteudo, string> = {
        instagram: `Tema: "${tema}"\n\nGere um post para Instagram da Pousinox (fixadores de porcelanato inox):\n- Legenda envolvente (até 200 palavras)\n- 5-8 hashtags relevantes\n- Sugestão de imagem/visual\n- CTA para o site ou WhatsApp`,
        blog: `Tema: "${tema}"\n\nGere um artigo de blog completo para o site da Pousinox (fixadores de porcelanato inox):\n- Título SEO-friendly (até 60 caracteres)\n- Meta description (até 155 caracteres)\n- Artigo com 500-800 palavras, subtítulos H2/H3\n- Inclua benefícios do aço inox, aplicações práticas\n- CTA no final`,
        seo: `Tema: "${tema}"\n\nGere conteúdo SEO para a Pousinox (fixadores de porcelanato inox):\n- Title tag (até 60 chars)\n- Meta description (até 155 chars)\n- H1 e H2s sugeridos\n- 5 keywords long-tail relacionadas\n- Schema markup sugerido (tipo)\n- Snippet otimizado para featured snippet do Google`,
        completo: `Tema: "${tema}"\n\nGere um PACOTE COMPLETO de conteúdo para a Pousinox (fixadores de porcelanato inox). Separe claramente cada seção:\n\n---INSTAGRAM---\nLegenda + hashtags + sugestão visual + CTA\n---FIM_INSTAGRAM---\n\n---BLOG---\nTítulo SEO + meta description + artigo 500-800 palavras com subtítulos\n---FIM_BLOG---\n\n---SEO---\nTitle tag + meta desc + H1/H2 + 5 keywords long-tail + snippet otimizado\n---FIM_SEO---`,
      }

      const r = await aiChat({
        prompt: prompts[tipo],
        system: 'Especialista em marketing digital e SEO para indústria de construção civil. A Pousinox fabrica fixadores de porcelanato em aço inox em Pouso Alegre/MG. Site: pousinox.com.br. Tom: profissional mas acessível. Público: construtoras, revendas, arquitetos, instaladores. Português brasileiro.',
        model: 'gemini',
      })

      if (r.error) {
        setResultado([{ tipo: 'Erro', titulo: '', conteudo: r.error }])
        setLoading(false)
        return
      }

      if (tipo === 'completo') {
        const items: ConteudoGerado[] = []
        const igMatch = r.content.match(/---INSTAGRAM---\n([\s\S]*?)\n---FIM_INSTAGRAM---/)
        const blogMatch = r.content.match(/---BLOG---\n([\s\S]*?)\n---FIM_BLOG---/)
        const seoMatch = r.content.match(/---SEO---\n([\s\S]*?)\n---FIM_SEO---/)
        if (igMatch) items.push({ tipo: '📸 Instagram', titulo: 'Post Instagram', conteudo: igMatch[1].trim() })
        if (blogMatch) items.push({ tipo: '📝 Blog', titulo: 'Artigo Blog', conteudo: blogMatch[1].trim() })
        if (seoMatch) items.push({ tipo: '🔍 SEO', titulo: 'Otimização SEO', conteudo: seoMatch[1].trim() })
        if (items.length === 0) items.push({ tipo: '📦 Completo', titulo: tema, conteudo: r.content })
        setResultado(items)
      } else {
        setResultado([{
          tipo: TIPOS.find(t => t.key === tipo)?.icon + ' ' + TIPOS.find(t => t.key === tipo)?.label || tipo,
          titulo: tema,
          conteudo: r.content,
        }])
      }
    } catch (err) {
      console.error('AgentConteudo:', err)
    } finally {
      setLoading(false)
    }
  }, [tema, tipo])

  const copiar = useCallback((texto: string, idx: number) => {
    navigator.clipboard.writeText(texto)
    setCopiado(idx)
    setTimeout(() => setCopiado(null), 2000)
  }, [])

  if (!aberto) return null

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.drawer} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <span>✍️ Agente Gerador de Conteúdo</span>
          <button className={s.close} onClick={onClose}>×</button>
        </div>

        <div className={s.config}>
          <input
            className={s.configInputWide}
            type="text"
            placeholder="Tema: ex. 'vantagens do fixador inox vs galvanizado' ou 'novo produto FP-200'"
            value={tema}
            onChange={e => setTema(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && executar()}
          />
          <div className={s.tipoRow}>
            {TIPOS.map(t => (
              <button key={t.key}
                className={`${s.tipoPill} ${tipo === t.key ? s.tipoPillAtivo : ''}`}
                onClick={() => setTipo(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button className={s.btnRun} onClick={executar} disabled={loading || !tema.trim()}>
            {loading ? '⏳ Gerando conteúdo...' : '▶ Gerar'}
          </button>
        </div>

        <div className={s.body}>
          {resultado.length === 0 && !loading && (
            <div className={s.empty}>Digite um tema e clique em "Gerar" para criar conteúdo automaticamente.</div>
          )}

          {resultado.map((item, i) => (
            <div key={i} className={s.card}>
              <div className={s.cardHeader}>
                <strong>{item.tipo}</strong>
                <button className={s.btnCopy} onClick={() => copiar(item.conteudo, i)}>
                  {copiado === i ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
              <div className={s.msgBox} style={{ maxHeight: 400 }}>{item.conteudo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
