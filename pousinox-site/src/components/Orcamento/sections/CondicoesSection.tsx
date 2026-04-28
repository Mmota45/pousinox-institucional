import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import type { DadoBancario } from '../types'
import { COND_PAGAMENTO, formatarDadoBancario } from '../types'

interface Props {
  condicoes: string[]
  setCondicoes: React.Dispatch<React.SetStateAction<string[]>>
  dadosBancarios: DadoBancario[]
  dadosBancariosSel: number[]
  setDadosBancariosSel: React.Dispatch<React.SetStateAction<number[]>>
  dadosPagamento: string
  setDadosPagamento: (v: string) => void
  prazoEntrega: string
  setPrazoEntrega: (v: string) => void
  validadeDias: string
  setValidadeDias: (v: string) => void
  dataEmissao: string
  onOpenConfig: () => void
  styles: Record<string, string>
}

export default function CondicoesSection({
  condicoes, setCondicoes, dadosBancarios, dadosBancariosSel, setDadosBancariosSel,
  dadosPagamento, setDadosPagamento, prazoEntrega, setPrazoEntrega,
  validadeDias, setValidadeDias, dataEmissao, onOpenConfig, styles,
}: Props) {
  return (
    <CollapsibleSection title="💰 Condições Comerciais">
      <div className={styles.fg}>
        <label>Pagamento <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.78em' }}>(selecione uma ou mais)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
          {COND_PAGAMENTO.map(c => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 400 }}>
              <input type="checkbox" checked={condicoes.includes(c)}
                onChange={e => setCondicoes(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))} />
              {c}
            </label>
          ))}
        </div>
        {condicoes.length > 0 && (
          <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
            O envio será realizado após a confirmação do pagamento.
          </div>
        )}
      </div>

      {(condicoes.includes('PIX') || condicoes.includes('Depósito/Transferência') || condicoes.includes('Boleto bancário')) && (
        <div className={styles.fg}>
          <label>Dados bancários para pagamento</label>
          {dadosBancarios.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {dadosBancarios.map(d => (
                <label key={d.id} style={{
                  display: 'flex', gap: 10, padding: '10px 12px', cursor: 'pointer',
                  background: dadosBancariosSel.includes(d.id) ? '#f0f7ff' : '#f8fafc',
                  border: `1.5px solid ${dadosBancariosSel.includes(d.id) ? '#1a5fa8' : '#e2e8f0'}`,
                  borderRadius: 8, transition: 'border-color 0.15s',
                }}>
                  <input type="checkbox" checked={dadosBancariosSel.includes(d.id)}
                    onChange={e => setDadosBancariosSel(prev =>
                      e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id)
                    )}
                    style={{ marginTop: 2, accentColor: '#1a5fa8' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>{d.apelido}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-line', marginTop: 2 }}>
                      {formatarDadoBancario(d)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
              Nenhuma conta cadastrada.
            </div>
          )}
          <button className={styles.btnAddItem} style={{ marginTop: 6, fontSize: '0.75rem' }} onClick={onOpenConfig}>
            + Gerenciar contas (⚙️ Config)
          </button>

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Informações adicionais de pagamento (texto livre)</label>
            <textarea className={`${styles.input} ${styles.textarea}`} rows={2}
              placeholder="Ex: observações sobre pagamento, condições especiais..."
              value={dadosPagamento} onChange={e => setDadosPagamento(e.target.value)} />
          </div>
        </div>
      )}

      <div className={styles.row2}>
        <div className={styles.fg}><label>Prazo de entrega</label><input className={styles.input} placeholder="Ex: 10 dias úteis" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} /></div>
      </div>
      <div className={styles.row2}>
        <div className={styles.fg}><label>Validade (dias)</label><input className={styles.input} type="number" min="1" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} /></div>
        <div className={styles.fg}><label>Emissão</label><input className={styles.input} value={dataEmissao} readOnly style={{ background: '#f8fafc' }} /></div>
      </div>
    </CollapsibleSection>
  )
}
