import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Cookie } from 'lucide-react'
import { createPortal } from 'react-dom'
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
  const shouldShow = isOpen && !isPrivateSurface

  useEffect(() => {
    if (!shouldShow) return

    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const body = document.body
    const root = document.documentElement
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      boxSizing: body.style.boxSizing,
      paddingRight: body.style.paddingRight,
    }
    const previousRootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    }
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
    const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
    let touchStartY = 0

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.boxSizing = 'border-box'
    body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }
    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        event.preventDefault()
        return
      }

      const dialog = target.closest<HTMLElement>('.cookie-consent-dialog')
      if (!dialog) {
        event.preventDefault()
        return
      }

      const touchY = event.touches[0]?.clientY ?? touchStartY
      const scrollingUp = touchY > touchStartY
      const canScroll = scrollingUp
        ? dialog.scrollTop > 0
        : dialog.scrollTop + dialog.clientHeight < dialog.scrollHeight
      if (!canScroll) event.preventDefault()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      Object.assign(body.style, previousBodyStyles)
      Object.assign(root.style, previousRootStyles)
      window.scrollTo({ top: scrollY, left: scrollX, behavior: 'instant' })
    }
  }, [shouldShow])

  if (!shouldShow) return null

  return createPortal(
    <div className="cookie-consent-overlay">
      <section
        className="cookie-consent-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Cookie consent"
        aria-describedby="cookie-consent-description"
        tabIndex={-1}
      >
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
      </section>
    </div>,
    document.body,
  )
}
