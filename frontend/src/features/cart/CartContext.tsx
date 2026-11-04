/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiUrl } from '../../lib/api'
import { clearAuthSessionIfCurrent, resolveAuthSession } from '../../lib/authSession'
import { toast } from '../../components/ui/toast'
import { formatINR } from '../../utils/formatCurrency'

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
  pendingItemIds: number[]
  itemCount: number
  subtotal: number
  loading: boolean
  error: CartLoadError | null
  authenticated: boolean
  retry: () => void
  addItem: (item: Omit<CartItem, 'quantity'>) => Promise<void>
  removeItem: (id: number) => Promise<void>
  setQuantity: (id: number, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
}

type AuthSession = { token: string; identity: string }
type CartLoadError = { status: number; code?: string; message: string }
type CartState = { session: AuthSession | null; items: CartItem[]; pendingItemIds: number[]; loading: boolean; error: CartLoadError | null; loadAttempt: number }
type ApiCartItem = {
  id: number
  title: string
  artist: string
  price: number
  image: string | null
  isProtected: boolean
  quantity: number
}
type ApiResponse = { cart?: { items?: ApiCartItem[] }; error?: string; code?: string }
type CartRequestError = Error & { status: number; code?: string }

const CartContext = createContext<CartContextValue | null>(null)
export const MAX_CART_QUANTITY = 10
const GUEST_CART_STORAGE_KEY = 'showpeice_guest_cart'
const cartLoadRequests = new Map<string, Promise<ApiResponse>>()

function readAuthSession(): AuthSession | null {
  const token = localStorage.getItem('showpeice_token')
  if (!token) return null

  return { token, identity: token }
}

function isCartItem(value: unknown): value is CartItem {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'number'
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && 'title' in value
    && typeof value.title === 'string'
    && 'artist' in value
    && typeof value.artist === 'string'
    && 'price' in value
    && typeof value.price === 'string'
    && 'image' in value
    && typeof value.image === 'string'
    && 'quantity' in value
    && typeof value.quantity === 'number'
    && Number.isSafeInteger(value.quantity)
    && value.quantity >= 1
    && value.quantity <= MAX_CART_QUANTITY
    && (!('isProtected' in value) || typeof value.isProtected === 'boolean')
}

function readGuestCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY)
    if (!stored) return []
    const items: unknown = JSON.parse(stored)
    if (!Array.isArray(items)) throw new Error('Stored guest shopping bag must be an array')
    return items.filter(isCartItem)
  } catch (error) {
    console.error('Unable to restore the guest shopping bag.', error)
    return []
  }
}

function initialCartState(): CartState {
  const session = readAuthSession()
  return { session, items: session ? [] : readGuestCart(), pendingItemIds: [], loading: Boolean(session), error: null, loadAttempt: 0 }
}

function cartItemsFromResponse(response: ApiResponse): CartItem[] {
  if (!Array.isArray(response.cart?.items)) {
    throw new Error('The shopping bag service returned an invalid response.')
  }

  return response.cart.items.map((item) => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    price: formatINR(item.price),
    image: item.image || '',
    isProtected: item.isProtected,
    quantity: item.quantity,
  }))
}

async function cartRequest(session: AuthSession, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  if (options.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(apiUrl(`/cart${path}`), { ...options, headers })
  const result = await response.json().catch((): ApiResponse => ({}))
  if (!response.ok) {
    const apiResult = result as ApiResponse
    if (response.status === 401) clearAuthSessionIfCurrent(session.token)
    const serverMessage = apiResult.error || 'The shopping bag request could not be completed.'
    const message = response.status === 401
      ? 'Your session has expired. Please sign in again.'
      : response.status >= 500
        ? `The shopping bag service is temporarily unavailable. ${serverMessage}`
        : serverMessage
    const error = new Error(message) as CartRequestError
    error.status = response.status
    error.code = apiResult.code
    if (import.meta.env.DEV) {
      error.message += ` (HTTP ${response.status}${apiResult.code ? ` · ${apiResult.code}` : ''})`
    }
    throw error
  }
  return result as ApiResponse
}

function guestItemsForMerge(items: CartItem[]) {
  return items.map(({ id: artworkId, quantity }) => ({ artworkId, quantity }))
}

function loadCartResponse(session: AuthSession, guestItems: CartItem[]) {
  const mergeItems = guestItemsForMerge(guestItems)
  const key = `${session.identity}:${guestItems.length ? `merge:${JSON.stringify(mergeItems)}` : 'get'}`
  const existing = cartLoadRequests.get(key)
  if (existing) return existing

  const request = guestItems.length
    ? cartRequest(session, '/merge', { method: 'POST', body: JSON.stringify({ items: mergeItems }) })
    : cartRequest(session, '')
  cartLoadRequests.set(key, request)
  request.then(
    () => { if (cartLoadRequests.get(key) === request) cartLoadRequests.delete(key) },
    () => { if (cartLoadRequests.get(key) === request) cartLoadRequests.delete(key) },
  )
  return request
}

function cartLoadError(error: unknown): CartLoadError {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    const requestError = error as CartRequestError
    return { status: requestError.status, code: requestError.code, message: requestError.message }
  }
  return { status: 0, message: error instanceof Error ? error.message : 'The shopping bag could not be loaded. Please try again.' }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(initialCartState)
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const cartRevisionRef = useRef(0)
  const pendingMutationCountRef = useRef(0)
  const mutationSequenceRef = useRef(0)
  const lastReconciledMutationRef = useRef(0)
  const pendingItemMutationsRef = useRef(new Set<string>())

  useEffect(() => {
    try {
      localStorage.removeItem('showpeice_cart')
    } catch (error) {
      console.error('Unable to remove the previous shared shopping bag.', error)
    }
  }, [])

  useEffect(() => {
    const syncAuthSession = () => {
      const nextSession = readAuthSession()
      setState((current) => {
        if (current.session?.identity === nextSession?.identity) return current
        return {
          session: nextSession,
          items: nextSession ? [] : readGuestCart(),
          pendingItemIds: [],
          loading: Boolean(nextSession),
          error: null,
          loadAttempt: current.loadAttempt + 1,
        }
      })
    }

    window.addEventListener('showpeice:auth-changed', syncAuthSession)
    window.addEventListener('storage', syncAuthSession)
    return () => {
      window.removeEventListener('showpeice:auth-changed', syncAuthSession)
      window.removeEventListener('storage', syncAuthSession)
    }
  }, [])

  useEffect(() => {
    if (state.session) return
    try {
      localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(state.items))
    } catch (error) {
      console.error('Unable to save the guest shopping bag on this device.', error)
    }
  }, [state.items, state.session])

  useEffect(() => {
    const session = state.session
    if (!session) return

    const loadRevision = cartRevisionRef.current
    let active = true
    const loadCart = async () => {
      setState((current) => current.session?.identity === session.identity
        ? { ...current, loading: true, error: null }
        : current)
      const auth = await resolveAuthSession()
      if (!active || readAuthSession()?.identity !== session.identity) return
      if (auth.status === 'anonymous') return
      if (auth.status === 'forbidden') {
        const failure = { status: 403, message: auth.message }
        setState((current) => current.session?.identity === session.identity
          ? { ...current, loading: false, error: failure }
          : current)
        return
      }
      if (auth.status === 'unavailable') {
        const failure = { status: 503, message: auth.message }
        toast.error('Account service unavailable', auth.message)
        setState((current) => current.session?.identity === session.identity
          ? { ...current, loading: false, error: failure }
          : current)
        return
      }

      const guestItems = readGuestCart()
      try {
        const response = await loadCartResponse(session, guestItems)
        if (active && readAuthSession()?.identity === session.identity &&
            cartRevisionRef.current === loadRevision && pendingMutationCountRef.current === 0) {
          setState((current) => current.session?.identity === session.identity
            ? { ...current, items: cartItemsFromResponse(response), loading: false, error: null }
            : current)
          if (guestItems.length) localStorage.removeItem(GUEST_CART_STORAGE_KEY)
        }
      } catch (error) {
        if (!active) return
        if (error instanceof Error && 'status' in error && error.status === 401) {
          toast.warning('Sign in again', error.message)
          return
        }
        if (readAuthSession()?.identity !== session.identity) return

        if (guestItems.length) {
          console.error('Unable to merge the guest shopping bag.', error)
          toast.warning('Guest bag not merged', 'Some guest selections may be unavailable. They remain saved on this device.')
          try {
            const response = await cartRequest(session, '')
            if (!active || readAuthSession()?.identity !== session.identity ||
                cartRevisionRef.current !== loadRevision || pendingMutationCountRef.current > 0) return
            setState((current) => current.session?.identity === session.identity
              ? { ...current, items: cartItemsFromResponse(response), loading: false, error: null }
              : current)
          } catch (loadError) {
            if (!active || readAuthSession()?.identity !== session.identity) return
            console.error('Unable to load the authenticated shopping bag.', loadError)
            const failure = cartLoadError(loadError)
            toast.error('Shopping bag unavailable', failure.message)
            setState((current) => current.session?.identity === session.identity
              ? { ...current, loading: false, error: failure }
              : current)
          }
          return
        }

        console.error('Unable to load the authenticated shopping bag.', error)
        const failure = cartLoadError(error)
        toast.error('Shopping bag unavailable', failure.message)
        setState((current) => current.session?.identity === session.identity
          ? { ...current, loading: false, error: failure }
          : current)
      }
    }

    void loadCart()
    return () => {
      active = false
    }
  }, [state.session, state.loadAttempt])

  const value = useMemo<CartContextValue>(() => {
    const updateGuestItems = (update: (items: CartItem[]) => CartItem[]) => {
      setState((current) => current.session
        ? current
        : { ...current, items: update(current.items) })
    }

    const applyResponse = (session: AuthSession, response: ApiResponse) => {
      if (readAuthSession()?.identity !== session.identity) {
        throw new Error('Your account changed before the shopping bag update completed.')
      }
      const items = cartItemsFromResponse(response)
      setState((current) => current.session?.identity === session.identity
        ? { ...current, items, loading: false, error: null }
        : current)
    }

    const queueCartMutation = (session: AuthSession, path: string, options: RequestInit = {}) => {
      const mutationId = ++mutationSequenceRef.current
      cartRevisionRef.current += 1
      pendingMutationCountRef.current += 1
      const operation = async () => {
        const auth = await resolveAuthSession()
        if (auth.status !== 'authenticated' || auth.token !== session.token) {
          const error = new Error(auth.status === 'anonymous'
            ? 'Your session has expired. Please sign in again.'
            : auth.status === 'authenticated'
              ? 'Your account changed before the shopping bag update completed.'
              : auth.message) as CartRequestError
          error.status = auth.status === 'anonymous' || auth.status === 'authenticated'
            ? 401
            : auth.status === 'forbidden' ? 403 : 503
          throw error
        }
        const response = await cartRequest(session, path, options)
        if (pendingMutationCountRef.current === 1) {
          applyResponse(session, response)
          lastReconciledMutationRef.current = mutationId
        }
      }
      const queued = mutationQueueRef.current.then(operation, operation)
      mutationQueueRef.current = queued.then(() => undefined, () => undefined)
      const promise = queued.finally(() => {
        pendingMutationCountRef.current -= 1
        cartRevisionRef.current += 1
      })
      return { mutationId, promise }
    }

    const rollbackOptimisticAdd = (session: AuthSession, artworkId: number) => {
      setState((current) => {
        if (current.session?.identity !== session.identity) return current
        const currentItem = current.items.find((item) => item.id === artworkId)
        const items = currentItem
          ? currentItem.quantity > 1
            ? current.items.map((item) => item.id === artworkId ? { ...item, quantity: item.quantity - 1 } : item)
            : current.items.filter((item) => item.id !== artworkId)
          : current.items
        return { ...current, items, loading: false, error: null, loadAttempt: current.loadAttempt + 1 }
      })
    }

    const reloadAfterMutationFailure = (session: AuthSession) => {
      setState((current) => current.session?.identity === session.identity
        ? { ...current, loading: true, error: null, loadAttempt: current.loadAttempt + 1 }
        : current)
    }

    const mutateItem = async (
      id: number,
      path: string,
      options: RequestInit,
      updateItems: (items: CartItem[]) => CartItem[],
    ) => {
      const session = state.session
      if (!session) return

      const key = `${session.identity}:${id}`
      if (pendingItemMutationsRef.current.has(key)) return

      const previousIndex = state.items.findIndex((item) => item.id === id)
      const previousItem = previousIndex >= 0 ? state.items[previousIndex] : null
      pendingItemMutationsRef.current.add(key)
      setState((current) => current.session?.identity === session.identity
        ? {
          ...current,
          items: updateItems(current.items),
          pendingItemIds: current.pendingItemIds.includes(id) ? current.pendingItemIds : [...current.pendingItemIds, id],
          error: null,
        }
        : current)

      const mutation = queueCartMutation(session, path, options)
      try {
        await mutation.promise
      } catch (error) {
        if (mutation.mutationId > lastReconciledMutationRef.current) {
          setState((current) => {
            if (current.session?.identity !== session.identity) return current
            const withoutItem = current.items.filter((item) => item.id !== id)
            const items = previousItem
              ? [
                ...withoutItem.slice(0, Math.min(previousIndex, withoutItem.length)),
                previousItem,
                ...withoutItem.slice(Math.min(previousIndex, withoutItem.length)),
              ]
              : withoutItem
            return { ...current, items }
          })
        }
        throw error
      } finally {
        pendingItemMutationsRef.current.delete(key)
        setState((current) => current.session?.identity === session.identity
          ? { ...current, pendingItemIds: current.pendingItemIds.filter((itemId) => itemId !== id) }
          : current)
      }
    }

    return {
      items: state.items,
      pendingItemIds: state.pendingItemIds,
      itemCount: state.items.reduce((total, item) => total + item.quantity, 0),
      subtotal: state.items.reduce((total, item) => total + (Number(item.price.replace(/[^\d]/g, '')) || 0) * item.quantity, 0),
      loading: state.loading,
      error: state.error,
      authenticated: Boolean(state.session),
      retry: () => setState((current) => current.session
        ? { ...current, loading: true, error: null, loadAttempt: current.loadAttempt + 1 }
        : current),
      addItem: async (item) => {
        if (!state.session) {
          updateGuestItems((items) => {
            const existing = items.find((line) => line.id === item.id)
            return existing
              ? items.map((line) => line.id === item.id
                ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + 1) }
                : line)
              : [...items, { ...item, quantity: 1 }]
          })
          return
        }

        const session = state.session
        const existingItem = state.items.find((line) => line.id === item.id)
        const optimisticAdd = !existingItem || existingItem.quantity < MAX_CART_QUANTITY
        setState((current) => current.session?.identity === session.identity
          ? {
            ...current,
            error: null,
            items: current.items.some((line) => line.id === item.id)
              ? current.items.map((line) => line.id === item.id
                ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + 1) }
                : line)
              : [...current.items, { ...item, quantity: 1 }],
          }
          : current)

        const mutation = queueCartMutation(session, '/items', {
            method: 'POST',
            body: JSON.stringify({ artworkId: item.id }),
          })
        try {
          await mutation.promise
        } catch (error) {
          if (mutation.mutationId > lastReconciledMutationRef.current) {
            if (optimisticAdd) rollbackOptimisticAdd(session, item.id)
            else reloadAfterMutationFailure(session)
          }
          throw error
        }
      },
      removeItem: async (id) => {
        if (!state.session) {
          updateGuestItems((items) => items.filter((item) => item.id !== id))
          return
        }

        await mutateItem(id, `/items/${id}`, { method: 'DELETE' }, (items) => items.filter((item) => item.id !== id))
      },
      setQuantity: async (id, quantity) => {
        const boundedQuantity = Math.min(MAX_CART_QUANTITY, Math.max(1, quantity))
        if (!state.session) {
          updateGuestItems((items) => items.map((item) => item.id === id
            ? { ...item, quantity: boundedQuantity }
            : item))
          return
        }

        await mutateItem(id, `/items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: boundedQuantity }),
        }, (items) => items.map((item) => item.id === id ? { ...item, quantity: boundedQuantity } : item))
      },
      clearCart: async () => {
        if (!state.session) {
          updateGuestItems(() => [])
          return
        }

        const session = state.session
        await queueCartMutation(session, '', { method: 'DELETE' }).promise
      },
    }
  }, [state])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
