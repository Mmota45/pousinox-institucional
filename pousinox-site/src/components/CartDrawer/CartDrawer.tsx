import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { supabase } from '../../lib/supabase'
import styles from './CartDrawer.module.css'

interface OpcaoFrete {
  servico: string
  codigo: string
  preco: number
  prazo: number
  prazo_texto?: string
  erro: string | null
}

function CartDrawer() {
  const { items, removeItem, updateQtd, totalItens, totalPreco, drawerOpen, setDrawerOpen } = useCart()
  const navigate = useNavigate()

  const [cep, setCep] = useState('')
  const [freteLoading, setFreteLoading] = useState(false)
  const [freteOpcoes, setFreteOpcoes] = useState<OpcaoFrete[]>([])
  const [freteErro, setFreteErro] = useState<string | null>(null)
  const [freteSel, setFreteSel] = useState(-1)

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  const calcularFrete = async () => {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) { setFreteErro('CEP inválido'); return }
    setFreteLoading(true)
    setFreteErro(null)
    setFreteOpcoes([])
    setFreteSel(-1)

    const pesoTotal = items.reduce((s, i) => s + (i.peso_kg || 0) * i.quantidade, 0)
    const maxDim = (campo: 'comprimento_cm' | 'largura_cm' | 'altura_cm') =>
      Math.max(...items.map(i => i[campo] || 0))

    try {
      const { data, error } = await supabase.functions.invoke('calcular-frete', {
        body: {
          cep_destino: cepLimpo,
          peso_kg: pesoTotal || 1,
          comprimento_cm: maxDim('comprimento_cm') || 20,
          largura_cm: maxDim('largura_cm') || 15,
          altura_cm: maxDim('altura_cm') || 10,
        }
      })
      if (error) throw error
      const validas = (data?.opcoes || []).filter((o: OpcaoFrete) => !o.erro)
      if (validas.length === 0) { setFreteErro('Sem opções de frete para este CEP'); return }
      setFreteOpcoes(validas)
      setFreteSel(0)
    } catch {
      setFreteErro('Erro ao calcular frete')
    } finally {
      setFreteLoading(false)
    }
  }

  return (
    <>
      <div className={`${styles.overlay} ${drawerOpen ? styles.overlayOpen : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.titulo}>
            Carrinho {totalItens > 0 && <span className={styles.badge}>{totalItens}</span>}
          </h2>
          <button className={styles.fechar} onClick={() => setDrawerOpen(false)} title="Fechar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.vazio}>
              <span className={styles.vazioIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                </svg>
              </span>
              Seu carrinho está vazio
            </div>
          ) : (
            items.map(item => (
              <div key={item.produtoId} className={styles.item}>
                <img src={item.imagem} alt={item.titulo} className={styles.itemImg} />
                <div className={styles.itemInfo}>
                  <div className={styles.itemTitulo}>{item.titulo}</div>
                  <div className={styles.itemPreco}>R$ {fmtBRL(item.preco)} un.</div>
                  <div className={styles.qtdRow}>
                    <button className={styles.qtdBtn} onClick={() => updateQtd(item.produtoId, item.quantidade - 1)}>−</button>
                    <span className={styles.qtdVal}>{item.quantidade}</span>
                    <button className={styles.qtdBtn} onClick={() => updateQtd(item.produtoId, item.quantidade + 1)}>+</button>
                  </div>
                  <div className={styles.itemSubtotal}>R$ {fmtBRL(item.preco * item.quantidade)}</div>
                  <button className={styles.remover} onClick={() => removeItem(item.produtoId)}>Remover</button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Subtotal</span>
              <span>R$ {fmtBRL(totalPreco)}</span>
            </div>

            <div className={styles.freteBox}>
              <label className={styles.freteLabel}>Calcular frete</label>
              <div className={styles.freteInputRow}>
                <input
                  className={styles.freteInput}
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  maxLength={9}
                  value={cep}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '')
                    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8)
                    setCep(v)
                  }}
                  onKeyDown={e => e.key === 'Enter' && calcularFrete()}
                />
                <button className={styles.freteBtn} onClick={calcularFrete} disabled={freteLoading}>
                  {freteLoading ? '...' : 'OK'}
                </button>
              </div>
              {freteErro && <div className={styles.freteErro}>{freteErro}</div>}
              {freteOpcoes.length > 0 && (
                <div className={styles.freteOpcoes}>
                  {freteOpcoes.map((op, i) => (
                    <label key={op.codigo} className={`${styles.freteOpcao} ${freteSel === i ? styles.freteOpcaoSel : ''}`}>
                      <input type="radio" name="frete" checked={freteSel === i} onChange={() => setFreteSel(i)} />
                      <span className={styles.freteServico}>{op.servico}</span>
                      <span className={styles.fretePrazo}>{op.prazo_texto || `${op.prazo} dias úteis`}</span>
                      <span className={styles.fretePreco}>R$ {fmtBRL(op.preco)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {freteSel >= 0 && (
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total</span>
                <span className={styles.totalGrand}>R$ {fmtBRL(totalPreco + freteOpcoes[freteSel].preco)}</span>
              </div>
            )}

            <button className={styles.btnFinalizar} onClick={() => { setDrawerOpen(false); navigate('/checkout') }}>
              Finalizar compra
            </button>
            <button className={styles.btnContinuar} onClick={() => setDrawerOpen(false)}>
              Continuar comprando
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default CartDrawer
