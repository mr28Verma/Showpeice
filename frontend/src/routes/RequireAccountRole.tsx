import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../lib/api'

type AccountRole = 'buyer' | 'seller' | 'artist'
type Account = { id: number; role: string }
type AccessState = 'checking' | 'allowed' | 'invalid-role' | 'unavailable'

function isAccountRole(role: string): role is AccountRole {
  return ['buyer', 'seller', 'artist'].includes(role)
}

const dashboardForRole = (role: AccountRole) =>
  role === 'buyer' ? '/buyer/dashboard' : '/artist/dashboard'

export function RequireAccountRole({ role, children }: { role: AccountRole; children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [access, setAccess] = useState<AccessState>('checking')
  const [token, setToken] = useState(() => localStorage.getItem('showpeice_token'))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)
    let current = true

    fetch(apiUrl('/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json().catch(() => ({})) as { user?: Account }
      if (!current) return

      if (response.status === 401) {
        localStorage.removeItem('showpeice_token')
        localStorage.removeItem('showpeice_user')
        setToken(null)
        return
      }

      if (response.status === 403) {
        setAccess('invalid-role')
        return
      }

      if (!response.ok || !result.user || !Number.isSafeInteger(result.user.id)) {
        setAccess('unavailable')
        return
      }

      if (!isAccountRole(result.user.role)) {
        setAccess('invalid-role')
        return
      }

      localStorage.setItem('showpeice_user', JSON.stringify(result.user))
      const hasRequestedRole = result.user.role === role || (role === 'artist' && result.user.role === 'seller')
      if (hasRequestedRole) setAccess('allowed')
      else navigate(dashboardForRole(result.user.role), { replace: true })
    }).catch(() => {
      if (current) setAccess('unavailable')
    }).finally(() => window.clearTimeout(timeoutId))

    return () => {
      current = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [attempt, navigate, role, token])

  if (!token) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  if (access === 'checking') {
    return <main className="dashboard-access-state" role="status">Verifying your Showpeice account…</main>
  }

  if (access === 'invalid-role') {
    const signOut = () => {
      localStorage.removeItem('showpeice_token')
      localStorage.removeItem('showpeice_user')
      setToken(null)
    }
    return <main className="dashboard-access-state" role="alert">
      <h1>Account access could not be verified</h1>
      <p>Your account has an unsupported role. Sign out and contact Showpeice support.</p>
      <button type="button" onClick={signOut}>Sign out</button>
    </main>
  }

  if (access === 'unavailable') {
    return <main className="dashboard-access-state" role="alert">
      <h1>Your account could not be verified</h1>
      <p>Showpeice could not reach the account service. Check your connection and try again.</p>
      <button type="button" onClick={() => { setAccess('checking'); setAttempt((value) => value + 1) }}>Try again</button>
      <Link to="/">Return to gallery</Link>
    </main>
  }

  return <>{children}</>
}
