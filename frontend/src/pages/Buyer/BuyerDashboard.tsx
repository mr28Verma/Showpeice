import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import type { BuyerDashboardData, BuyerSection, BuyerUser } from './types'
import { buyerApi } from './buyerApi'
import { BuyerSidebar } from './components/BuyerSidebar'
import { BuyerOverview } from './components/BuyerOverview'
import { BuyerProfile } from './components/BuyerProfile'
import { BuyerOrders } from './components/BuyerOrders'
import { BuyerAddresses } from './components/BuyerAddresses'
import { BuyerSettings } from './components/BuyerSettings'
import { Sidebar } from '../../components/ui/sidebar'
import { toast } from '../../components/ui/toast'
import './BuyerDashboard.css'

export function BuyerDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [dashboardData, setDashboardData] = useState<BuyerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const token = localStorage.getItem('showpeice_token')
  const requestedSection = searchParams.get('section') as BuyerSection | null
  const validSections: BuyerSection[] = ['overview', 'orders', 'profile', 'addresses', 'settings']
  const activeSection: BuyerSection = validSections.includes(requestedSection as BuyerSection)
    ? (requestedSection as BuyerSection)
    : 'overview'

  const handleSelectSection = (section: BuyerSection) => {
    setSearchParams(section === 'overview' ? {} : { section })
  }

  useEffect(() => {
    if (!token) {
      navigate('/login?role=buyer&returnTo=%2Fbuyer%2Fdashboard')
      return
    }

    let isMounted = true
    const fetchData = async () => {
      try {
        const data = await buyerApi.getDashboard(token)
        if (isMounted) {
          setDashboardData(data)
          setError('')
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!isMounted) return
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          localStorage.removeItem('showpeice_token')
          localStorage.removeItem('showpeice_user')
          toast.error('Session expired', 'Please sign in again to access your dashboard.')
          navigate('/login?role=buyer&returnTo=%2Fbuyer%2Fdashboard')
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load buyer dashboard.')
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
      const data = await buyerApi.getDashboard(token)
      setDashboardData(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load buyer dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('showpeice_token')
    localStorage.removeItem('showpeice_user')
    toast.success('Signed out', 'You have been safely signed out.')
    navigate('/login')
  }

  const handleUserUpdated = (updatedUser: BuyerUser) => {
    setDashboardData((prev) => (prev ? { ...prev, user: updatedUser } : null))
  }

  return (
    <Sidebar open={mobileMenuOpen} setOpen={setMobileMenuOpen}>
      <div className="buyer-dashboard">
      <BuyerSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        user={dashboardData?.user || null}
        onLogout={handleLogout}
      />

      <main className="buyer-main">
        <div className="buyer-container">
          {loading ? (
            <div>
              <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '180px', height: '14px' }} />
              <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '320px', height: '36px', margin: '12px 0 24px' }} />
              <div className="buyer-stats-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="buyer-stat-card buyer-skeleton-pulse buyer-skeleton-card" />
                ))}
              </div>
              <div className="buyer-card-panel buyer-skeleton-pulse" style={{ height: '300px' }} />
            </div>
          ) : error ? (
            <div className="buyer-empty-state">
              <div className="buyer-empty-icon buyer-empty-icon-error">
                <AlertCircle size={24} />
              </div>
              <h3>We encountered an issue</h3>
              <p>{error}</p>
              <button type="button" className="buyer-btn-primary" onClick={reloadData}>
                <RefreshCw size={15} />
                <span>Retry Loading Dashboard</span>
              </button>
            </div>
          ) : dashboardData ? (
            <>
              {activeSection === 'overview' && (
                <BuyerOverview
                  data={dashboardData}
                  onNavigateSection={handleSelectSection}
                />
              )}

              {activeSection === 'orders' && token && (
                <BuyerOrders token={token} />
              )}

              {activeSection === 'profile' && token && (
                <BuyerProfile
                  user={dashboardData.user}
                  token={token}
                  onUserUpdated={handleUserUpdated}
                />
              )}

              {activeSection === 'addresses' && token && (
                <BuyerAddresses token={token} />
              )}

              {activeSection === 'settings' && token && (
                <BuyerSettings
                  user={dashboardData.user}
                  token={token}
                  onUserUpdated={handleUserUpdated}
                  onLogout={handleLogout}
                />
              )}
            </>
          ) : null}
        </div>
      </main>
      </div>
    </Sidebar>
  )
}
