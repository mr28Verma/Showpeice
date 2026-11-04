import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import type { BuyerSection, BuyerUser } from './types'
import { buyerApi } from './buyerApi'
import { clearAuthSession } from '../../lib/authSession'
import { BuyerSidebar } from './components/BuyerSidebar'
import { BuyerProfile } from './components/BuyerProfile'
import { BuyerOrders } from './components/BuyerOrders'
import { BuyerAddresses } from './components/BuyerAddresses'
import { BuyerSettings } from './components/BuyerSettings'
import { BuyerSectionSkeleton } from './components/BuyerLoadingSkeletons'
import { Sidebar } from '../../components/ui/sidebar'
import { toast } from '../../components/ui/toast'
import { GalleryContent } from '../../features/gallery/GalleryPage'
import './BuyerDashboard.css'

function isBuyerUser(user: unknown): user is BuyerUser {
  if (!user || typeof user !== 'object') return false
  const candidate = user as Partial<BuyerUser>
  return Number.isSafeInteger(candidate.id) &&
    candidate.role === 'buyer' &&
    typeof candidate.firstName === 'string' &&
    typeof candidate.lastName === 'string' &&
    typeof candidate.email === 'string'
}

export function BuyerDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [user, setUser] = useState<BuyerUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const token = localStorage.getItem('showpeice_token')
  const requestedSection = searchParams.get('section') as BuyerSection | null
  const validSections: BuyerSection[] = ['gallery', 'orders', 'profile', 'addresses', 'settings']
  const activeSection: BuyerSection = validSections.includes(requestedSection as BuyerSection)
    ? (requestedSection as BuyerSection)
    : 'gallery'

  const handleSelectSection = (section: BuyerSection) => {
    setSearchParams(section === 'gallery' ? {} : { section })
  }

  useEffect(() => {
    if (!token) {
      navigate('/login?role=buyer&returnTo=%2Fbuyer%2Fdashboard')
      return
    }

    let isMounted = true
    const fetchData = async () => {
      try {
        const result = await buyerApi.getProfile(token)
        if (!isBuyerUser(result.user)) {
          throw new Error('The account service returned incomplete buyer profile information.')
        }
        if (isMounted) {
          setUser(result.user)
          setError('')
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!isMounted) return
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          clearAuthSession()
          toast.error('Session expired', 'Please sign in again to access your dashboard.')
          navigate('/login?role=buyer&returnTo=%2Fbuyer%2Fdashboard')
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load buyer account information.')
        setLoading(false)
      }
    }

    void fetchData()
    return () => {
      isMounted = false
    }
  }, [token, navigate])

  const reloadData = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const result = await buyerApi.getProfile(token)
      if (!isBuyerUser(result.user)) {
        throw new Error('The account service returned incomplete buyer profile information.')
      }
      setUser(result.user)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
        clearAuthSession()
        toast.error('Session expired', 'Please sign in again to access your dashboard.')
        navigate('/login?role=buyer&returnTo=%2Fbuyer%2Fdashboard')
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load buyer account information.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuthSession()
    toast.success('Signed out', 'You have been safely signed out.')
    navigate('/login')
  }

  const handleUserUpdated = (updatedUser: BuyerUser) => {
    setUser(updatedUser)
  }

  return (
    <Sidebar open={mobileMenuOpen} setOpen={setMobileMenuOpen}>
      <div className="buyer-dashboard">
      <BuyerSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        user={user}
      />

      <main className="buyer-main">
        <div className={`buyer-container${activeSection === 'gallery' ? ' buyer-container-gallery' : ''}`}>
          {activeSection === 'gallery' ? (
            <GalleryContent embedded />
          ) : loading ? (
            <BuyerSectionSkeleton section={activeSection} />
          ) : error ? (
            <div className="buyer-empty-state">
              <div className="buyer-empty-icon buyer-empty-icon-error">
                <AlertCircle size={24} />
              </div>
              <h3>We encountered an issue</h3>
              <p>{error}</p>
              <button type="button" className="buyer-btn-primary" onClick={reloadData}>
                <RefreshCw size={15} />
                <span>Retry</span>
              </button>
            </div>
          ) : user ? (
            <>
              {activeSection === 'orders' && token && (
                <BuyerOrders token={token} />
              )}

              {activeSection === 'profile' && token && (
                <BuyerProfile
                  user={user}
                  token={token}
                  onUserUpdated={handleUserUpdated}
                />
              )}

              {activeSection === 'addresses' && token && (
                <BuyerAddresses token={token} />
              )}

              {activeSection === 'settings' && token && (
                <BuyerSettings
                  user={user}
                  token={token}
                  onUserUpdated={handleUserUpdated}
                  onLogout={handleLogout}
                />
              )}
            </>
          ) : (
            <div className="buyer-empty-state" role="alert">
              <div className="buyer-empty-icon buyer-empty-icon-error"><AlertCircle size={24} /></div>
              <h3>Account information is unavailable</h3>
              <p>Try loading your buyer account again.</p>
              <button type="button" className="buyer-btn-primary" onClick={reloadData}>
                <RefreshCw size={15} /><span>Retry</span>
              </button>
            </div>
          )}
        </div>
      </main>
      </div>
    </Sidebar>
  )
}
