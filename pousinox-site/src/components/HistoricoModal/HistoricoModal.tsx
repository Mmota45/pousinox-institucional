import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import styles from './HistoricoModal.module.css'

interface Interacao {
  id: number
  prospect_id: number
  data: string
  canal: string
  resultado: string
  anotacao: string | null
}

interface Props {
  prospectId: number
  prospectNome: string
  onClose: () => void
  onInteracaoSalva?: () => void
}

const CANAIS = ['WhatsApp', 'Telefone', 'Email', 'Visita']

const RESULTADOS = [
  'Interessado',
  'Aguardando',
  'Retornar',
  'Orçamento enviado',
  'Venda fechada',
  'Sem interesse',
]

const RESULTADO_STYLE: Record<string, { bg: string; color: string }> = {
  'Interessado':       { bg: '#dcfce7', color: '#15803d' },
  'Aguardando':        { bg: '#fef9c3', color: '#92400e' },
  'Retornar':          { bg: '#dbeafe', color: '#1d4ed8' },
  'Orçamento enviado': { bg: '#fce7f3', color: '#9d174d' },
  'Venda fechada':     { bg: '#ede9fe', color: '#6d28d9' },
  'Sem interesse':     { bg: '#f1f5f9', color: '#64748b' },
}

const CANAL_ICON: Record<string, string> = {
  'WhatsApp': '💬',
  'Telefone': '📞',
  'Email':    '📧',
  'Visita':   '🚗',
}

function formatarData(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoricoModal({ prospectId, prospectNome, onClose, onInteracaoSalva }: Props) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)

  // Formulário nova interação
  const [canal, setCanal]         = useState('WhatsApp')
  const [resultado, setResultado] = useState('Interessado')
  const [anotacao, setAnotacao]   = useState('')

  useEffect(() => {
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId])

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('prospeccao_historico')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('data', { ascending: false })
    setInteracoes((data ?? []) as Interacao[])
    setLoading(false)
  }

  async function salvar() {
    setSalvando(true)
    const { error } = await supabaseAdmin
      .from('prospeccao_historico')
      .insert({
        prospect_id: prospectId,
        canal,
        resultado,
        anotacao: anotacao.trim() || null,
      })
    if (!error) {
      setAnotacao('')
      await carregar()
      onInteracaoSalva?.()
    }
    setSalvando(false)
  }

  async function excluir(id: number) {
    await supabaseAdmin.from('prospeccao_historico').delete().eq('id', id)
    setInteracoes(prev => prev.filter(i => i.id !== id))
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>

        <div className={styles.header}>
          <div>
            <div className={styles.titulo}>Histórico de interações</div>
            <div className={styles.subtitulo}>{prospectNome}</div>
          </div>
          <button className={styles.fechar} onClick={onClose}>✕</button>
        </div>

        {/* ── Formulário nova interação ── */}
        <div className={styles.form}>
          <div className={styles.formTitulo}>Nova interação</div>
          <div className={styles.formRow}>
            <div className={styles.formGrupo}>
              <label className={styles.formLabel}>Canal</label>
              <select className={styles.formSelect} value={canal} onChange={e => setCanal(e.target.value)}>
                {CANAIS.map(c => <option key={c} value={c}>{CANAL_ICON[c]} {c}</option>)}
              </select>
            </div>
            <div className={styles.formGrupo}>
              <label className={styles.formLabel}>Resultado</label>
              <select className={styles.formSelect} value={resultado} onChange={e => setResultado(e.target.value)}>
                {RESULTADOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.formLabel}>Anotação (opcional)</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Detalhes da conversa, próximos passos..."
              value={anotacao}
              onChange={e => setAnotacao(e.target.value)}
              rows={2}
            />
          </div>
          <button
            className={styles.salvarBtn}
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : '+ Registrar interação'}
          </button>
        </div>

        {/* ── Timeline ── */}
        <div className={styles.timeline}>
          {loading ? (
            <div className={styles.vazio}>Carregando...</div>
          ) : interacoes.length === 0 ? (
            <div className={styles.vazio}>Nenhuma interação registrada ainda.</div>
          ) : (
            interacoes.map((it, idx) => {
              const estilo = RESULTADO_STYLE[it.resultado] ?? { bg: '#f1f5f9', color: '#64748b' }
              return (
                <div key={it.id} className={styles.item}>
                  <div className={styles.itemLinha}>
                    <div className={styles.itemDot} style={{ background: estilo.color }} />
                    {idx < interacoes.length - 1 && <div className={styles.itemFio} />}
                  </div>
                  <div className={styles.itemConteudo}>
                    <div className={styles.itemTopo}>
                      <span className={styles.itemCanal}>{CANAL_ICON[it.canal] ?? '•'} {it.canal}</span>
                      <span className={styles.itemResultado} style={{ background: estilo.bg, color: estilo.color }}>
                        {it.resultado}
                      </span>
                      <span className={styles.itemData}>{formatarData(it.data)}</span>
                      <button className={styles.excluirBtn} onClick={() => excluir(it.id)} title="Excluir">✕</button>
                    </div>
                    {it.anotacao && (
                      <div className={styles.itemAnotacao}>{it.anotacao}</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </>
  )
}
