// Agente Prospector IA — seleciona prospects e gera abordagens em lote
import { useState, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { aiChat } from '../../lib/aiHelper'
import s from './AgentPanel.module.css'

interface Prospect {
  id: number
  nome: string
  cnpj: string | null
  segmento: string | null
  porte: string | null
  cidade: string | null
  uf: string | null
  score: number | null
  telefone1: string | null
}

interface ProspectItem {
  prospect: Prospect
  mensagemWa: string
  mensagemEmail: string
}

interface Props {
  aberto: boolean
  onClose: () => void
}

const UFS = ['', 'MG', 'SP', 'RJ', 'PR', 'SC', 'RS', 'BA', 'GO', 'ES', 'DF', 'PE', 'CE', 'MT', 'MS', 'PA']

export default function AgentProspector({ aberto, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ProspectItem[]>([])
  const [quantidade, setQuantidade] = useState(10)
  const [ufFiltro, setUfFiltro] = useState('')
  const [scoreMin, setScoreMin] = useState(50)
  const [copiado, setCopiado] = useState<string | null>(null)

  const executar = useCallback(async () => {
    setLoading(true)
    setItems([])
    try {
      let query = supabaseAdmin
        .from('prospeccao')
        .select('id,nome,cnpj,segmento,porte,cidade,uf,score,telefone1')
        .gte('score', scoreMin)
        .is('cliente_ativo', false)
        .order('score', { ascending: false })
        .limit(quantidade)

      if (ufFiltro) query = query.eq('uf', ufFiltro)

      const { data: prospects } = await query

      if (!prospects?.length) {
        setLoading(false)
        return
      }

      // Gerar abordagens em lote
      const resumo = prospects.map(p =>
        `ID:${p.id} | ${p.nome} | Seg: ${p.segmento || 'N/I'} | Porte: ${p.porte || 'N/I'} | ${p.cidade || ''}/${p.uf || ''} | Score: ${p.score}`
      ).join('\n')

      const r = await aiChat({
        prompt: `Prospects para prospecção B2B da Pousinox (fixadores de porcelanato inox):\n\n${resumo}\n\nPara CADA prospect, gere:\n1. Mensagem curta de WhatsApp (2-3 linhas, natural)\n2. Email de apresentação (assunto + corpo curto)\n\nFormato:\n---PROSPECT:ID---\nWA: mensagem whatsapp\nEMAIL_ASSUNTO: assunto\nEMAIL: corpo do email\n---FIM---`,
        system: 'Vendedor consultivo B2B da Pousinox, fabricante de fixadores de porcelanato em aço inox (Pouso Alegre/MG). Personalize por segmento. Português brasileiro. Mensagens naturais e profissionais.',
        model: 'groq',
      })

      if (r.error) {
        setLoading(false)
        return
      }

      const results: ProspectItem[] = []
      for (const prospect of prospects) {
        const regex = new RegExp(`---PROSPECT:${prospect.id}---\\n([\\s\\S]*?)\\n---FIM---`)
        const match = r.content.match(regex)
        const block = match ? match[1] : ''
        const waMatch = block.match(/WA:\s*(.+)/s)
        const emailMatch = block.match(/EMAIL:\s*([\s\S]+?)$/m)

        results.push({
          prospect,
          mensagemWa: waMatch ? waMatch[1].trim() : `Olá! Sou da Pousinox, fabricante de fixadores de porcelanato em aço inox. Gostaria de apresentar nossos produtos para ${prospect.nome}. Podemos conversar?`,
          mensagemEmail: emailMatch ? emailMatch[1].trim() : '',
        })
      }

      setItems(results)
    } catch (err) {
      console.error('AgentProspector:', err)
    } finally {
      setLoading(false)
    }
  }, [quantidade, ufFiltro, scoreMin])

  const copiar = useCallback((texto: string, key: string) => {
    navigator.clipboard.writeText(texto)
    setCopiado(key)
    setTimeout(() => setCopiado(null), 2000)
  }, [])

  if (!aberto) return null

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.drawer} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <span>🎯 Agente Prospector IA</span>
          <button className={s.close} onClick={onClose}>×</button>
        </div>

        <div className={s.config}>
          <label className={s.configLabel}>
            Top
            <input type="number" className={s.configInput} value={quantidade}
              onChange={e => setQuantidade(Number(e.target.value))} min={5} max={30} />
            prospects
          </label>
          <label className={s.configLabel}>
            Score mín:
            <input type="number" className={s.configInput} value={scoreMin}
              onChange={e => setScoreMin(Number(e.target.value))} min={0} max={100} />
          </label>
          <label className={s.configLabel}>
            UF:
            <select className={s.configSelect} value={ufFiltro} onChange={e => setUfFiltro(e.target.value)}>
              {UFS.map(u => <option key={u} value={u}>{u || 'Todas'}</option>)}
            </select>
          </label>
          <button className={s.btnRun} onClick={executar} disabled={loading}>
            {loading ? '⏳ Gerando abordagens...' : '▶ Executar agente'}
          </button>
        </div>

        <div className={s.body}>
          {items.length === 0 && !loading && (
            <div className={s.empty}>Configure os filtros e clique em "Executar" para gerar abordagens personalizadas.</div>
          )}

          {items.map(item => (
            <div key={item.prospect.id} className={s.card}>
              <div className={s.cardHeader}>
                <strong>{item.prospect.nome}</strong>
                <span className={s.badge} style={{ background: '#eff6ff', color: '#2563eb' }}>
                  Score {item.prospect.score}
                </span>
              </div>
              <div className={s.cardMeta}>
                {item.prospect.segmento && <span>🏭 {item.prospect.segmento}</span>}
                {item.prospect.porte && <span>{item.prospect.porte}</span>}
                <span>📍 {item.prospect.cidade}/{item.prospect.uf}</span>
              </div>

              <div className={s.msgLabel}>💬 WhatsApp:</div>
              <div className={s.msgBox}>{item.mensagemWa}</div>
              <div className={s.cardActions}>
                <button className={s.btnCopy} onClick={() => copiar(item.mensagemWa, `wa-${item.prospect.id}`)}>
                  {copiado === `wa-${item.prospect.id}` ? '✓ Copiado' : '📋 Copiar'}
                </button>
                {item.prospect.telefone1 && (
                  <a className={s.btnWa}
                    href={`https://wa.me/55${item.prospect.telefone1.replace(/\D/g, '')}?text=${encodeURIComponent(item.mensagemWa)}`}
                    target="_blank" rel="noopener noreferrer">
                    💬 Enviar
                  </a>
                )}
              </div>

              {item.mensagemEmail && (
                <>
                  <div className={s.msgLabel}>📧 Email:</div>
                  <div className={s.msgBox}>{item.mensagemEmail}</div>
                  <div className={s.cardActions}>
                    <button className={s.btnCopy} onClick={() => copiar(item.mensagemEmail, `em-${item.prospect.id}`)}>
                      {copiado === `em-${item.prospect.id}` ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
