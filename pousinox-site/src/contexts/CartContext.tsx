import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface CartItem {
  produtoId: string | number
  titulo: string
  preco: number
  quantidade: number
  imagem: string
  peso_kg: number
  altura_cm: number
  comprimento_cm: number
  largura_cm: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (produtoId: string | number) => void
  updateQtd: (produtoId: string | number, qtd: number) => void
  clearCart: () => void
  totalItens: number
  totalPreco: number
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | null>(null)

const STORAGE_KEY = 'pousinox_cart'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const match = (a: string | number, b: string | number) => String(a) === String(b)

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => match(i.produtoId, item.produtoId))
      if (existing) {
        return prev.map(i => match(i.produtoId, item.produtoId)
          ? { ...i, quantidade: i.quantidade + item.quantidade }
          : i
        )
      }
      return [...prev, item]
    })
    setDrawerOpen(true)
  }, [])

  const removeItem = useCallback((produtoId: string | number) => {
    setItems(prev => prev.filter(i => !match(i.produtoId, produtoId)))
  }, [])

  const updateQtd = useCallback((produtoId: string | number, qtd: number) => {
    if (qtd <= 0) {
      setItems(prev => prev.filter(i => !match(i.produtoId, produtoId)))
      return
    }
    setItems(prev => prev.map(i => match(i.produtoId, produtoId) ? { ...i, quantidade: qtd } : i))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const totalItens = items.reduce((s, i) => s + i.quantidade, 0)
  const totalPreco = items.reduce((s, i) => s + i.preco * i.quantidade, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQtd, clearCart, totalItens, totalPreco, drawerOpen, setDrawerOpen }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve estar dentro de CartProvider')
  return ctx
}
