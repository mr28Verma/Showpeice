/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type CartItem = {
  id: number
  title: string
  artist: string
  price: string
  image: string
  isProtected?: boolean
  quantity: number
}

type CartContextValue = {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: number) => void
  setQuantity: (id: number, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const priceValue = (price: string) => Number(price.replace(/[^\d]/g, '')) || 0
export const MAX_CART_QUANTITY = 10

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + priceValue(item.price) * item.quantity, 0),
    addItem: (item) => setItems((current) => {
      const existing = current.find((line) => line.id === item.id)
      return existing
        ? current.map((line) => line.id === item.id ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + 1) } : line)
        : [...current, { ...item, quantity: 1 }]
    }),
    removeItem: (id) => setItems((current) => current.filter((item) => item.id !== id)),
    setQuantity: (id, quantity) => setItems((current) => current.map((item) => item.id === id
      ? { ...item, quantity: Math.min(MAX_CART_QUANTITY, Math.max(1, quantity)) }
      : item)),
    clearCart: () => setItems([]),
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}

