import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, resolveAuthSession } from '../lib/authSession'

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
    const syncAuthSession = () => {
      setToken(localStorage.getItem('showpeice_token'))
      setAccess('checking')
    }

    window.addEventListener('showpeice:auth-changed', syncAuthSession)
    window.addEventListener('storage', syncAuthSession)
    return () => {
      window.removeEventListener('showpeice:auth-changed', syncAuthSession)
      window.removeEventListener('storage', syncAuthSession)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true

    void resolveAuthSession().then((result) => {
      if (!active) return
      if (result.status === 'anonymous') {
        setToken(null)
        return
      }
      if (result.status === 'forbidden') {
        setAccess('invalid-role')
        return
      }
      if (result.status === 'unavailable') {
        setAccess('unavailable')
        return
      }

      const account: Account = result.user
      if (!isAccountRole(account.role)) {
        setAccess('invalid-role')
        return
      }

      const hasRequestedRole = account.role === role || (role === 'artist' && account.role === 'seller')
      if (hasRequestedRole) setAccess('allowed')
      else navigate(dashboardForRole(account.role), { replace: true })
    }).catch((error: unknown) => {
      if (!active) return
      console.error('[auth] Account verification failed:', error)
      setAccess('unavailable')
    })

    return () => {
      active = false
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
      clearAuthSession()
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
