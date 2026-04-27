// Agente Follow-up Comercial — detecta deals parados e gera mensagens
import { useState, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { aiChat } from '../../lib/aiHelper'
import s from './AgentPanel.module.css'

interface Deal {
  id: number
  titulo: string
  empresa_nome: string | null
  contato_nome: string | null
  contato_email: string | null
  estagio: string
  valor: number | null
  updated_at: string
}

interface FollowUpItem {
  deal: Deal
  diasParado: number
  mensagem: string
}

interface Props {
  aberto: boolean
  onClose: () => void
}

export default function AgentFollowUp({ aberto, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<FollowUpItem[]>([])
  const [diasMinimo, setDiasMinimo] = useState(5)
  const [copiado, setCopiado] = useState<number | null>(null)

  const executar = useCallback(async () => {
    setLoading(true)
    setItems([])
    try {
      // Buscar deals ativos não atualizados há X dias
      const limite = new Date()
      limite.setDate(limite.getDate() - diasMinimo)

      const { data: deals } = await supabaseAdmin
        .from('pipeline_deals')
        .select('id,titulo,empresa_nome,contato_nome,contato_email,estagio,valor,updated_at')
        .not('estagio', 'in', '("ganho","perdido")')
        .lt('updated_at', limite.toISOString())
        .order('updated_at', { ascending: true })
        .limit(15)

      if (!deals?.length) {
        setItems([])
        setLoading(false)
        return
      }

      // Gerar mensagens em lote (1 chamada IA)
      const resumo = deals.map(d => {
        const dias = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000)
        return `ID:${d.id} | ${d.titulo} | ${d.empresa_nome || 'N/I'} | Contato: ${d.contato_nome || 'N/I'} | Estágio: ${d.estagio} | Valor: R$${d.valor || 0} | Parado há ${dias} dias`
      }).join('\n')

      const r = await aiChat({
        prompt: `Deals parados no pipeline da Pousinox (fixadores de porcelanato inox):\n\n${resumo}\n\nPara CADA deal, gere uma mensagem de follow-up personalizada para WhatsApp (curta, profissional, referenciando o produto/contexto). Formato:\n---DEAL:ID---\nMensagem aqui\n---FIM---`,
        system: 'Vendedor consultivo B2B da Pousinox. Mensagens naturais, sem parecer robô. Sempre mencione o nome do contato se disponível. Português brasileiro.',
        model: 'groq',
      })

      if (r.error) {
        setLoading(false)
        return
      }

      // Parsear resultado
      const results: FollowUpItem[] = []
      for (const deal of deals) {
        const dias = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000)
        const regex = new RegExp(`---DEAL:${deal.id}---\\n([\\s\\S]*?)\\n---FIM---`)
        const match = r.content.match(regex)
        results.push({
          deal,
          diasParado: dias,
          mensagem: match ? match[1].trim() : `Olá ${deal.contato_nome || ''}! Tudo bem? Gostaria de retomar nossa conversa sobre ${deal.titulo}. Posso ajudar com alguma dúvida?`,
        })
      }

      setItems(results)
    } catch (err) {
      console.error('AgentFollowUp:', err)
    } finally {
      setLoading(false)
    }
  }, [diasMinimo])

  const copiar = useCallback((texto: string, id: number) => {
    navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }, [])

  if (!aberto) return null

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.drawer} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <span>🔄 Agente Follow-up Comercial</span>
          <button className={s.close} onClick={onClose}>×</button>
        </div>

        <div className={s.config}>
          <label className={s.configLabel}>
            Deals parados há mais de
            <input type="number" className={s.configInput} value={diasMinimo}
              onChange={e => setDiasMinimo(Number(e.target.value))} min={1} max={90} />
            dias
          </label>
          <button className={s.btnRun} onClick={executar} disabled={loading}>
            {loading ? '⏳ Analisando pipeline...' : '▶ Executar agente'}
          </button>
        </div>

        <div className={s.body}>
          {items.length === 0 && !loading && (
            <div className={s.empty}>
              {items.length === 0 ? 'Clique em "Executar" para buscar deals parados e gerar follow-ups.' : 'Nenhum deal parado encontrado!'}
            </div>
          )}

          {items.map(item => (
            <div key={item.deal.id} className={s.card}>
              <div className={s.cardHeader}>
                <strong>{item.deal.titulo}</strong>
                <span className={s.badge} style={{ background: item.diasParado > 14 ? '#fef2f2' : '#fef3c7', color: item.diasParado > 14 ? '#dc2626' : '#d97706' }}>
                  {item.diasParado}d parado
                </span>
              </div>
              <div className={s.cardMeta}>
                {item.deal.empresa_nome && <span>{item.deal.empresa_nome}</span>}
                {item.deal.contato_nome && <span>👤 {item.deal.contato_nome}</span>}
                <span>📊 {item.deal.estagio}</span>
                {item.deal.valor ? <span>R$ {Number(item.deal.valor).toLocaleString('pt-BR')}</span> : null}
              </div>
              <div className={s.msgBox}>{item.mensagem}</div>
              <div className={s.cardActions}>
                <button className={s.btnCopy} onClick={() => copiar(item.mensagem, item.deal.id)}>
                  {copiado === item.deal.id ? '✓ Copiado' : '📋 Copiar'}
                </button>
                {item.deal.contato_nome && (
                  <a className={s.btnWa}
                    href={`https://wa.me/?text=${encodeURIComponent(item.mensagem)}`}
                    target="_blank" rel="noopener noreferrer">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
