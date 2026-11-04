import { apiUrl } from './api'

type StoredUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

export type AuthResolution =
  | { status: 'authenticated'; token: string; user: StoredUser }
  | { status: 'forbidden'; message: string }
  | { status: 'anonymous' }
  | { status: 'unavailable'; message: string }

const resolvedSessions = new Map<string, StoredUser>()
const pendingResolutions = new Map<string, Promise<AuthResolution>>()
const AUTH_REQUEST_TIMEOUT_MS = 15_000

function isStoredUser(value: unknown): value is StoredUser {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'number'
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && 'firstName' in value
    && typeof value.firstName === 'string'
    && 'lastName' in value
    && typeof value.lastName === 'string'
    && 'email' in value
    && typeof value.email === 'string'
    && 'role' in value
    && typeof value.role === 'string'
}

export function getStoredAccountRole(): 'buyer' | 'artist' | null {
  if (!localStorage.getItem('showpeice_token')) return null

  try {
    const storedUser = localStorage.getItem('showpeice_user')
    const user: unknown = storedUser ? JSON.parse(storedUser) : null
    const role = isStoredUser(user) ? user.role : null
    if (role === 'buyer') return 'buyer'
    if (role === 'seller' || role === 'artist') return 'artist'
  } catch {
    return null
  }

  return null
}

export function resolveAuthSession(): Promise<AuthResolution> {
  const token = localStorage.getItem('showpeice_token')
  if (!token) return Promise.resolve({ status: 'anonymous' })

  const cachedUser = resolvedSessions.get(token)
  if (cachedUser) return Promise.resolve({ status: 'authenticated', token, user: cachedUser })

  const pending = pendingResolutions.get(token)
  if (pending) return pending

  const request = (async (): Promise<AuthResolution> => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      const result: unknown = await response.json().catch(() => null)

      if (localStorage.getItem('showpeice_token') !== token) return { status: 'anonymous' }
      if (response.status === 401) {
        clearAuthSessionIfCurrent(token)
        return { status: 'anonymous' }
      }
      if (response.status === 403) {
        const message = typeof result === 'object' && result !== null &&
          'error' in result && typeof result.error === 'string'
          ? result.error
          : 'This account does not have access to this area.'
        return { status: 'forbidden', message }
      }

      const user = typeof result === 'object' && result !== null && 'user' in result
        ? result.user
        : null
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null &&
          'error' in result && typeof result.error === 'string'
          ? result.error
          : 'The account service is temporarily unavailable. Please try again.'
        return { status: 'unavailable', message }
      }
      if (!isStoredUser(user)) {
        return { status: 'unavailable', message: 'The account service returned an invalid response.' }
      }

      localStorage.setItem('showpeice_user', JSON.stringify(user))
      resolvedSessions.set(token, user)
      return { status: 'authenticated', token, user }
    } catch (error) {
      if (localStorage.getItem('showpeice_token') !== token) return { status: 'anonymous' }
      return {
        status: 'unavailable',
        message: error instanceof Error && error.name === 'AbortError'
          ? 'The account service took too long to respond. Please try again.'
          : 'Could not reach the account service. Check your connection and try again.',
      }
    } finally {
      window.clearTimeout(timeoutId)
    }
  })()

  pendingResolutions.set(token, request)
  void request.then(
    () => { if (pendingResolutions.get(token) === request) pendingResolutions.delete(token) },
    () => { if (pendingResolutions.get(token) === request) pendingResolutions.delete(token) },
  )
  return request
}

export function saveAuthSession(token: string, user: StoredUser) {
  localStorage.setItem('showpeice_user', JSON.stringify(user))
  localStorage.setItem('showpeice_token', token)
  resolvedSessions.set(token, user)
  window.dispatchEvent(new Event('showpeice:auth-changed'))
}

export function clearAuthSession() {
  const token = localStorage.getItem('showpeice_token')
  if (token) resolvedSessions.delete(token)
  localStorage.removeItem('showpeice_token')
  localStorage.removeItem('showpeice_user')
  window.dispatchEvent(new Event('showpeice:auth-changed'))
}

export function clearAuthSessionIfCurrent(token: string) {
  if (localStorage.getItem('showpeice_token') !== token) return false
  clearAuthSession()
  return true
}
