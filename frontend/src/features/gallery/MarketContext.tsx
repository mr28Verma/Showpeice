/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiUrl } from '../../lib/api'
import { clearAuthSessionIfCurrent, resolveAuthSession } from '../../lib/authSession'
import { toast } from '../../components/ui/toast'

type MarketContextValue = {
  query: string
  setQuery: (query: string) => void
  favorites: number[]
  favoritesLoading: boolean
  favoritesError: string
  retryFavorites: () => void
  toggleFavorite: (id: number) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)
const GUEST_FAVORITES_KEY = 'showpeice_guest_favorites'
const favoriteLoadRequests = new Map<string, Promise<FavoritesResponse>>()

type FavoritesResponse = { favorites?: Array<{ id: number }>; error?: string }
type FavoritesRequestError = Error & { status?: number }

function readGuestFavorites(): number[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return [...new Set(stored.filter((id): id is number =>
      typeof id === 'number' && Number.isSafeInteger(id) && id > 0))]
  } catch (error) {
    console.error('Unable to restore saved artwork from this device.', error)
    return []
  }
}

function saveGuestFavorites(favorites: number[]) {
  try {
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(favorites))
  } catch (error) {
    console.error('Unable to save guest favorites on this device.', error)
  }
}

async function favoriteRequest(path: string, token: string, method?: string): Promise<FavoritesResponse> {
  const response = await fetch(apiUrl(`/favorites${path}`), {
    method,
    headers: { Authorization: `Bearer ${token}` },
  })
  const result = await response.json().catch((): FavoritesResponse => ({}))
  if (!response.ok) {
    if (response.status === 401) clearAuthSessionIfCurrent(token)
    const error = new Error(result.error || 'Saved artwork could not be updated.') as FavoritesRequestError
    error.status = response.status
    throw error
  }
  return result
}

function loadFavoritesResponse(token: string, guestFavorites: number[]) {
  const key = `${token}:${guestFavorites.join(',')}`
  const existing = favoriteLoadRequests.get(key)
  if (existing) return existing

  const request = (async () => {
    await Promise.all(guestFavorites.map(async (id) => {
      try {
        await favoriteRequest(`/${id}`, token, 'POST')
      } catch (error) {
        if (!(error instanceof Error && 'status' in error && error.status === 404)) throw error
      }
    }))
    return favoriteRequest('', token)
  })()

  favoriteLoadRequests.set(key, request)
  void request.then(
    () => { if (favoriteLoadRequests.get(key) === request) favoriteLoadRequests.delete(key) },
    () => { if (favoriteLoadRequests.get(key) === request) favoriteLoadRequests.delete(key) },
  )
  return request
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState<number[]>(readGuestFavorites)
  const [favoritesLoading, setFavoritesLoading] = useState(() => Boolean(localStorage.getItem('showpeice_token')))
  const [favoritesError, setFavoritesError] = useState('')
  const loadSequenceRef = useRef(0)
  const mutationSequenceRef = useRef(0)
  const itemMutationRef = useRef(new Map<number, number>())
  const pendingFavoriteIdsRef = useRef(new Set<number>())

  const refreshFavorites = useCallback(async () => {
    const sequence = ++loadSequenceRef.current
    const mutationAtStart = mutationSequenceRef.current
    const token = localStorage.getItem('showpeice_token')
    if (!token) {
      setFavorites(readGuestFavorites())
      setFavoritesError('')
      setFavoritesLoading(false)
      return
    }

    setFavoritesLoading(true)
    setFavoritesError('')
    const guestFavorites = readGuestFavorites()
    setFavorites([])
    try {
      const auth = await resolveAuthSession()
      if (sequence !== loadSequenceRef.current || localStorage.getItem('showpeice_token') !== token) return
      if (auth.status === 'anonymous') return
      if (auth.status === 'forbidden') {
        setFavoritesError(auth.message)
        toast.error('Favorites unavailable', auth.message)
        return
      }
      if (auth.status === 'unavailable') {
        setFavoritesError(auth.message)
        console.error('Unable to verify the account before loading saved artwork.', auth.message)
        toast.error('Account service unavailable', auth.message)
        return
      }

      const result = await loadFavoritesResponse(token, guestFavorites)
      const savedIds = Array.isArray(result.favorites)
        ? [...new Set(result.favorites.map((item) => item.id).filter((id) => Number.isSafeInteger(id) && id > 0))]
        : []
      if (sequence === loadSequenceRef.current && mutationAtStart === mutationSequenceRef.current &&
          localStorage.getItem('showpeice_token') === token) {
        setFavorites(savedIds)
        if (guestFavorites.length) localStorage.removeItem(GUEST_FAVORITES_KEY)
      }
    } catch (error) {
      if (sequence === loadSequenceRef.current && localStorage.getItem('showpeice_token') === token) {
        console.error('Unable to load saved artwork.', error)
        const message = error instanceof Error ? error.message : 'Please try again.'
        setFavoritesError(message)
        toast.error('Favorites unavailable', message)
      }
    } finally {
      if (sequence === loadSequenceRef.current) setFavoritesLoading(false)
    }
  }, [])

  const retryFavorites = useCallback(() => { void refreshFavorites() }, [refreshFavorites])

  useEffect(() => {
    const refresh = () => { void refreshFavorites() }
    refresh()
    window.addEventListener('showpeice:auth-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      loadSequenceRef.current += 1
      window.removeEventListener('showpeice:auth-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refreshFavorites])

  useEffect(() => {
    if (localStorage.getItem('showpeice_token')) return
    saveGuestFavorites(favorites)
  }, [favorites])

  const toggleFavorite = useCallback((id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) return
    const token = localStorage.getItem('showpeice_token')
    if (token && pendingFavoriteIdsRef.current.has(id)) return

    const willFavorite = !favorites.includes(id)
    const next = willFavorite ? [...favorites, id] : favorites.filter((favorite) => favorite !== id)
    mutationSequenceRef.current += 1
    const mutation = (itemMutationRef.current.get(id) || 0) + 1
    itemMutationRef.current.set(id, mutation)
    setFavorites(next)
    if (!token) return

    pendingFavoriteIdsRef.current.add(id)
    void resolveAuthSession()
      .then((auth) => {
        if (auth.status === 'authenticated' && auth.token === token) {
          return favoriteRequest(`/${id}`, token, willFavorite ? 'POST' : 'DELETE')
        }
        if (auth.status === 'forbidden') {
          const error = new Error(auth.message) as FavoritesRequestError
          error.status = 403
          throw error
        }
        if (auth.status === 'unavailable') {
          const error = new Error(auth.message) as FavoritesRequestError
          error.status = 503
          throw error
        }
        throw new Error('Your session has ended. Please sign in again.')
      })
      .catch((error: unknown) => {
        if (itemMutationRef.current.get(id) !== mutation || localStorage.getItem('showpeice_token') !== token) return
        setFavorites((current) => willFavorite
          ? current.filter((favorite) => favorite !== id)
          : current.includes(id) ? current : [...current, id])
        toast.error('Favorite could not be saved', error instanceof Error ? error.message : 'Please try again.')
      })
      .finally(() => pendingFavoriteIdsRef.current.delete(id))
  }, [favorites])

  const value = useMemo<MarketContextValue>(() => ({
    query,
    setQuery,
    favorites,
    favoritesLoading,
    favoritesError,
    retryFavorites,
    toggleFavorite,
  }), [query, favorites, favoritesLoading, favoritesError, retryFavorites, toggleFavorite])

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const context = useContext(MarketContext)
  if (!context) throw new Error('useMarket must be used within MarketProvider')
  return context
}
