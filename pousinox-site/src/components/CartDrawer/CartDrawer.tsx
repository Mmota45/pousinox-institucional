import { useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import styles from './CartDrawer.module.css'

function CartDrawer() {
  const { items, removeItem, updateQtd, totalItens, totalPreco, drawerOpen, setDrawerOpen } = useCart()
  const navigate = useNavigate()

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

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
