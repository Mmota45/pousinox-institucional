import { useState } from 'react'
import { Package, Sparkles, Loader2, Search, Store, X } from 'lucide-react'
import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import type { Item, ProdutoResult, OutletResult, ExibirProposta } from '../types'
import { UNIDADES, fmtBRL } from '../types'
import { aiChat } from '../../../lib/aiHelper'

interface Props {
  itens: Item[]
  setItens: React.Dispatch<React.SetStateAction<Item[]>>
  exibir: ExibirProposta
  subtotal: number
  desconto: string
  setDesconto: (v: string) => void
  tipoDesc: '%' | 'R$'
  setTipoDesc: (v: '%' | 'R$') => void
  valorDesc: number
  total: number
  fmt: (v: number) => string
  // Busca catálogo
  showBuscaProduto: boolean
  setShowBuscaProduto: (v: boolean | ((p: boolean) => boolean)) => void
  buscaProduto: string
  setBuscaProduto: (v: string) => void
  resultadosProduto: ProdutoResult[]
  loadingProduto: boolean
  adicionarProduto: (p: ProdutoResult) => void
  // Busca outlet
  showBuscaOutlet: boolean
  setShowBuscaOutlet: (v: boolean | ((p: boolean) => boolean)) => void
  buscaOutlet: string
  setBuscaOutlet: (v: string) => void
  resultadosOutlet: OutletResult[]
  loadingOutlet: boolean
  adicionarOutlet: (p: OutletResult) => void
  clienteNome?: string
  styles: Record<string, string>
}

export default function ItensSection({
  itens, setItens, exibir, subtotal, desconto, setDesconto, tipoDesc, setTipoDesc,
  valorDesc, total, fmt,
  showBuscaProduto, setShowBuscaProduto, buscaProduto, setBuscaProduto,
  resultadosProduto, loadingProduto, adicionarProduto,
  showBuscaOutlet, setShowBuscaOutlet, buscaOutlet, setBuscaOutlet,
  resultadosOutlet, loadingOutlet, adicionarOutlet, clienteNome, styles,
}: Props) {

  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null)

  async function sugerirDescricao(i: number) {
    const item = itens[i]
    if (!item.descricao.trim()) return
    setAiLoadingIdx(i)
    try {
      const r = await aiChat({
        prompt: `Produto: "${item.descricao}"\nQuantidade: ${item.qtd} ${item.unidade}\nCliente: ${clienteNome || 'N/I'}\n\nReescreva a descrição do item para um orçamento comercial profissional. Seja técnico e objetivo. Máx 2 linhas. Retorne APENAS o texto da descrição, sem aspas.`,
        system: 'Redator técnico-comercial da Pousinox (fabricante de equipamentos em aço inox). Descreva produtos com acabamento profissional para orçamentos B2B. Português brasileiro.',
        model: 'groq',
      })
      if (!r.error && r.content) {
        setItens(prev => prev.map((it, idx) => idx === i ? { ...it, descricao: r.content.trim() } : it))
      }
    } finally {
      setAiLoadingIdx(null)
    }
  }

  function addItem() { setItens(prev => [...prev, { produto_id: null, descricao: '', qtd: '1', unidade: 'UN', valorUnit: '', obs_tecnica: '' }]) }
  function removeItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof Item, val: string) {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  return (
    <CollapsibleSection title={<><Package size={16} /> Itens</>} defaultOpen>
      <div className={styles.itensHeader}>
        <span className={styles.itemDesc}>Descrição</span>
        <span className={styles.itemQtd}>Qtd</span>
        <span className={styles.itemUn}>Un</span>
        <span className={styles.itemVu}>Vl. Unit.</span>
        <span className={styles.itemTotal}>Total</span>
        <span style={{ width: 28 }} />
      </div>
      {itens.map((item, i) => {
        const q = parseFloat(item.qtd.replace(',', '.')) || 0
        const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
        return (
          <div key={i} className={styles.itemRow}>
            <div className={styles.itemDesc} style={{display:'flex',flexDirection:'column',gap:2}}>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input className={styles.input} style={{flex:1}} placeholder="Produto / serviço" value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} />
                {item.descricao.trim() && (
                  <button
                    onClick={() => sugerirDescricao(i)}
                    disabled={aiLoadingIdx !== null}
                    title="Sugerir descrição com IA"
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, opacity: aiLoadingIdx === i ? 0.5 : 1, padding: '2px 4px', flexShrink: 0 }}
                  >{aiLoadingIdx === i ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}</button>
                )}
              </div>
              {exibir.obsTecnicaItens && (
                <input className={styles.input} style={{fontSize:'0.75rem',color:'#64748b'}} placeholder="Obs. técnica (opcional)" value={item.obs_tecnica ?? ''} onChange={e => updateItem(i,'obs_tecnica',e.target.value)} />
              )}
            </div>
            <input className={`${styles.input} ${styles.itemQtd}`} type="number" min="0" step="any" value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)} />
            <select className={`${styles.input} ${styles.itemUn}`} value={item.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
            <input className={`${styles.input} ${styles.itemVu}`} type="number" min="0" step="any" placeholder="0,00" value={item.valorUnit} onChange={e => updateItem(i, 'valorUnit', e.target.value)} />
            <span className={styles.itemTotal}>{q > 0 && v > 0 ? fmtBRL(q * v) : '—'}</span>
            <button className={styles.btnRemoveItem} onClick={() => removeItem(i)}><X size={14} /></button>
          </div>
        )
      })}
      {showBuscaProduto && (
        <div className={styles.buscaProdWrap}>
          <input className={styles.input} autoFocus placeholder="Nome do produto cadastrado..."
            value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
          {loadingProduto && <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>Buscando...</div>}
          {resultadosProduto.length > 0 && (
            <div className={styles.dropdown} style={{ position: 'static', boxShadow: 'none', border: '1px solid #e2e8f0', borderTop: 'none' }}>
              {resultadosProduto.map(p => (
                <div key={p.id} className={styles.dropItem} onClick={() => adicionarProduto(p)}>
                  <strong>{p.nome_padronizado}</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}> · {p.familia} · {p.unidade}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showBuscaOutlet && (
        <div className={styles.buscaProdWrap}>
          <input className={styles.input} autoFocus placeholder="Buscar no Pronta Entrega..."
            value={buscaOutlet} onChange={e => setBuscaOutlet(e.target.value)} />
          {loadingOutlet && <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>Buscando...</div>}
          {resultadosOutlet.length > 0 && (
            <div className={styles.dropdown} style={{ position: 'static', boxShadow: 'none', border: '1px solid #e2e8f0', borderTop: 'none' }}>
              {resultadosOutlet.map(p => (
                <div key={p.id} className={styles.dropItem} onClick={() => adicionarOutlet(p)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.fotos?.[0] && <img src={p.fotos[0]} alt={p.titulo} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e2e8f0' }} />}
                  <div>
                    <strong>{p.titulo}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {p.preco_original && p.preco_original > p.preco
                        ? <><s style={{ color: '#94a3b8' }}>{fmtBRL(p.preco_original)}</s> {fmtBRL(p.preco)}</>
                        : fmtBRL(p.preco)
                      } · {p.quantidade} un. disponível
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loadingOutlet && buscaOutlet.length >= 2 && resultadosOutlet.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '4px 0' }}>Nenhum produto disponível encontrado</div>
          )}
        </div>
      )}
      <div className={styles.itensActions}>
        <button className={styles.btnAddItem} onClick={addItem}>+ Linha manual</button>
        <button className={styles.btnAddItem} onClick={() => { setShowBuscaProduto(v => !v); setShowBuscaOutlet(false) }}><Search size={14} /> Catálogo</button>
        <button className={styles.btnAddItem} onClick={() => { setShowBuscaOutlet(v => !v); setShowBuscaProduto(false) }}><Store size={14} /> Pronta Entrega</button>
      </div>
      <div className={styles.totaisWrap}>
        <div className={styles.totaisRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
        {subtotal > 0 && (
          <div className={styles.totaisRow}>
            <span>Desconto</span>
            <div className={styles.descontoGroup}>
              <input className={`${styles.input} ${styles.descontoInput}`} type="number" min="0" step="any" placeholder="0" value={desconto} onChange={e => setDesconto(e.target.value)} />
              <select className={`${styles.input} ${styles.descontoTipo}`} value={tipoDesc} onChange={e => setTipoDesc(e.target.value as '%' | 'R$')}><option>%</option><option>R$</option></select>
              {valorDesc > 0 && <span className={styles.descontoValor}>−{fmt(valorDesc)}</span>}
            </div>
          </div>
        )}
        <div className={`${styles.totaisRow} ${styles.totaisTotal}`}><span>Total</span><span>{fmt(total)}</span></div>
      </div>
    </CollapsibleSection>
  )
}
