/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type MarketContextValue = {
  query: string
  setQuery: (query: string) => void
  favorites: number[]
  toggleFavorite: (id: number) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState<number[]>([])
  const value = useMemo<MarketContextValue>(() => ({
    query,
    setQuery,
    favorites,
    toggleFavorite: (id) => setFavorites((current) => current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id]),
  }), [query, favorites])

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const context = useContext(MarketContext)
  if (!context) throw new Error('useMarket must be used within MarketProvider')
  return context
}
