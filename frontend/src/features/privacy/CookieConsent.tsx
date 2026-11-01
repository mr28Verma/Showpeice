import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Cookie } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import './CookieConsent.css'

const CONSENT_STORAGE_KEY = 'showpeice_cookie_consent_v1'

type AnalyticsConsent = 'granted' | 'denied'

type ConsentContextValue = {
  choice: AnalyticsConsent | null
  isOpen: boolean
  choose: (choice: AnalyticsConsent) => void
}

const CookieConsentContext = createContext<ConsentContextValue | null>(null)

function readStoredChoice(): AnalyticsConsent | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!stored) return null

    const record = JSON.parse(stored) as { version?: number; analytics?: string }
    if (record.version !== 1 || (record.analytics !== 'granted' && record.analytics !== 'denied')) return null
    return record.analytics
  } catch {
    return null
  }
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const choice = readStoredChoice()
    return { choice, isOpen: choice === null }
  })

  const choose = useCallback((choice: AnalyticsConsent) => {
    const record = { version: 1, analytics: choice, savedAt: new Date().toISOString() }
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
    } catch {
      // Keep the choice for this visit if browser storage is unavailable.
    }
    setState({ choice, isOpen: false })
  }, [])

  const value = useMemo(() => ({ ...state, choose }), [state, choose])

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}

function useCookieConsent() {
  const context = useContext(CookieConsentContext)
  if (!context) throw new Error('useCookieConsent must be used within CookieConsentProvider')
  return context
}

export function CookieConsentBanner() {
  const { isOpen, choose } = useCookieConsent()
  const { pathname } = useLocation()
  const isPrivateSurface = ['/login', '/register', '/forgot-password', '/artist/dashboard', '/buyer/dashboard'].includes(pathname)

  if (!isOpen || isPrivateSurface) return null

  return (
    <aside className="cookie-consent-banner" aria-label="Cookie consent" aria-describedby="cookie-consent-description">
      <div className="cookie-consent-message">
        <span className="cookie-consent-icon" aria-hidden="true"><Cookie size={21} strokeWidth={1.8} /></span>
        <div className="cookie-consent-copy">
          <h2>We use cookies</h2>
          <p id="cookie-consent-description">Analytics cookies help us understand how the product is used.</p>
          <small>Analytics tracking isn’t configured on this site yet. Your preference will be saved for when it is.</small>
        </div>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="cookie-consent-reject" aria-label="Reject optional analytics cookies" onClick={() => choose('denied')}>
          Reject
        </button>
        <button type="button" className="cookie-consent-accept" aria-label="Accept analytics cookies" onClick={() => choose('granted')}>
          Accept all
        </button>
      </div>
    </aside>
  )
}

