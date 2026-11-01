import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  IconActivity,
  IconArrowRight,
  IconChartBar,
  IconCoin,
  IconEye,
  IconHome2,
  IconPackage,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShoppingBag,
  IconUserCircle,
  IconUserSquareRounded,
} from '@tabler/icons-react'
import { ArrowRight, Bookmark, Copy, Link as LinkIcon, Pencil, Share2, Trash2, X } from 'lucide-react'
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '../../components/ui/sidebar'
import { lockBodyScroll } from '../../lib/body-scroll-lock'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { SquigglyText } from '../../components/ui/squiggly-text'
import { toast } from '../../components/ui/toast'
import { ExpandableActionBar } from '../../components/motion/expandable-action-bar'
import { ArtworkFileUpload } from './ArtworkFileUpload'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { MonthlyRevenueCard } from './MonthlyRevenueCard'
import { WeeklyActivityCard } from './WeeklyActivityCard'
import { ArtistProfilePage } from './ArtistProfilePage'
import { SettingsToggles } from './SettingsToggles'
import './ArtistDashboard.css'
import './ArtistDashboardPremium.css'
import './ArtistDashboardOverview.css'
import './ArtistDashboardCards.css'

type User = { id: number; slug: string; firstName: string; lastName: string; email: string; role: string; createdAt: string; displayName: string | null; bio: string | null; avatarUrl: string | null; bannerUrl: string | null; medium: string | null; location: string | null; instagramUrl: string | null; websiteUrl: string | null; emailNotifications: boolean; publicProfileVisible: boolean }
type ArtworkItem = { id: number; title: string; description: string; price: number; category: string; imageUrl: string | null; imagePreviewUrl: string | null; isProtected: boolean; available: boolean; status: 'draft' | 'published'; createdAt?: string; updatedAt?: string }
type StudioStats = { totalArtworks: number; publishedArtworks: number; draftArtworks: number; sales: number | null; views: number | null; pendingOrders: number | null }
type StudioData = { user: User; artworks: ArtworkItem[]; stats: StudioStats }
type FormState = { title: string; description: string; price: string; category: string; isProtected: boolean; available: boolean; status: 'draft' | 'published' }
const emptyForm: FormState = { title: '', description: '', price: '', category: '', isProtected: false, available: true, status: 'draft' }
const artistDisplayName = (user: User | null) => user?.displayName?.trim() || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Artist'
const nav = [
  { label: 'Overview', section: 'overview', icon: IconHome2 },
  { label: 'My Artworks', section: 'artworks', icon: IconPhoto },
  { label: 'Orders & Sales', section: 'orders', icon: IconShoppingBag },
  { label: 'Earnings', section: 'earnings', icon: IconCoin },
  { label: 'Analytics', section: 'analytics', icon: IconChartBar },
  { label: 'Artist Profile', section: 'profile', icon: IconUserSquareRounded },
  { label: 'Settings', section: 'settings', icon: IconSettings },
] as const
const api = apiUrl
const money = (amount: number) => `₹ ${new Intl.NumberFormat('en-IN').format(amount)}`
const artworkImage = apiAssetUrl
const profileImage = (imageUrl: string) => imageUrl.startsWith('/')
  ? apiAssetUrl(imageUrl)
  : imageUrl

async function readStudioData(token: string) {
  let response: Response
  let data: (StudioData & { error?: string; message?: string }) | null
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 20000)
  try {
    response = await fetch(api('/artist/dashboard'), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
    data = await response.json().catch(() => null) as (StudioData & { error?: string; message?: string }) | null
  } catch {
    if (controller.signal.aborted) {
      throw new Error('The Showpeice API did not respond within 20 seconds. Check backend health and database connectivity.')
    }
    throw new Error('The Showpeice API could not be reached. Check that the backend is running, CORS allows this site, and VITE_API_URL is correct.')
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (response.status === 401) {
    throw Object.assign(new Error(data?.error || 'Your session has expired. Please sign in again.'), { status: 401 })
  }
  if (!response.ok) {
    if (response.status >= 500) {
      const message = data?.error || data?.message || 'The artist studio service encountered a server error.'
      throw new Error(`${message} (HTTP ${response.status}). Retry in a moment; contact support if it continues.`)
    }
    throw new Error(data?.error || data?.message || `Your studio could not be loaded (HTTP ${response.status}).`)
  }
  if (!data?.user || !Number.isSafeInteger(data.user.id) ||
      typeof data.user.firstName !== 'string' || typeof data.user.lastName !== 'string' ||
      typeof data.user.email !== 'string' || typeof data.user.role !== 'string') {
    throw new Error('Your account details were missing from the studio response. Please try again.')
  }
  if (!Array.isArray(data.artworks) || !data.stats ||
      !Number.isInteger(data.stats.totalArtworks) ||
      !Number.isInteger(data.stats.publishedArtworks) ||
      !Number.isInteger(data.stats.draftArtworks)) {
    throw new Error('Your artwork data could not be loaded completely. Please try again.')
  }
  return data
}

const pendingStudioRequests = new Map<string, Promise<StudioData>>()

function fetchStudioData(token: string) {
  const pending = pendingStudioRequests.get(token)
  if (pending) return pending

  const request = readStudioData(token)
  pendingStudioRequests.set(token, request)
  const clearRequest = () => {
    if (pendingStudioRequests.get(token) === request) pendingStudioRequests.delete(token)
  }
  void request.then(clearRequest, clearRequest)
  return request
}

async function uploadArtworkFile(file: File, token: string): Promise<{ imageUrl: string; previewDataUrl: string | null }> {
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
  const response = await fetch(api('/artist/uploads/artwork'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
    body: file,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || typeof result.imageUrl !== 'string') throw new Error(result.error || 'The selected file could not be uploaded.')
  return { imageUrl: result.imageUrl, previewDataUrl: typeof result.previewDataUrl === 'string' ? result.previewDataUrl : null }
}

export function ArtistDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [artworks, setArtworks] = useState<ArtworkItem[]>([])
  const [stats, setStats] = useState<StudioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkImageUrl, setArtworkImageUrl] = useState<string | null>(null)
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!formOpen) return
    return lockBodyScroll()
  }, [formOpen])

  const token = localStorage.getItem('showpeice_token')
  const requestedSection = searchParams.get('section')
  const activeSection = nav.some(item => item.section === requestedSection) ? requestedSection! : 'overview'
  const active = nav.find(item => item.section === activeSection)?.label ?? 'Overview'

  useEffect(() => {
    if (!token) {
      navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
      return
    }

    let cancelled = false
    const loadStudio = async () => {
      try {
        const data = await fetchStudioData(token)
        if (!cancelled) {
          setUser(data.user)
          setArtworks(data.artworks)
          setStats(data.stats)
          setError('')
        }
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof Error && 'status' in cause && cause.status === 401) {
          localStorage.removeItem('showpeice_token')
          localStorage.removeItem('showpeice_user')
          localStorage.removeItem('showpeice_user')
          toast.error('Session expired', 'Please sign in again to reopen your artist studio.')
          navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        } else {
          setError(cause instanceof Error ? cause.message : 'We could not load your studio.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadStudio()
    return () => { cancelled = true }
  }, [navigate, token])

  const refreshStudio = useCallback(async (force = false) => {
    if (!token) return Promise.resolve()
    const inFlight = refreshInFlightRef.current
    if (inFlight) {
      if (!force) return inFlight
      await inFlight
    }
    if (refreshInFlightRef.current) return refreshInFlightRef.current

    const request = (async () => {
      try {
        const data = await fetchStudioData(token)
        setUser(data.user)
        setArtworks(data.artworks)
        setStats(data.stats)
        setError('')
      } catch (cause) {
        if (cause instanceof Error && 'status' in cause && cause.status === 401) {
          localStorage.removeItem('showpeice_token')
          toast.error('Session expired', 'Please sign in again to reopen your artist studio.')
          navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        } else {
          setError(cause instanceof Error ? cause.message : 'We could not refresh your studio.')
        }
      } finally {
        refreshInFlightRef.current = null
      }
    })()
    refreshInFlightRef.current = request
    return request
  }, [navigate, token])

  const previousSectionRef = useRef(activeSection)
  useEffect(() => {
    const previousSection = previousSectionRef.current
    previousSectionRef.current = activeSection
    if (activeSection === 'overview' && previousSection !== 'overview') void refreshStudio()
  }, [activeSection, refreshStudio])

  useEffect(() => {
    if (activeSection !== 'overview') return
    const refreshOnFocus = () => { void refreshStudio() }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [activeSection, refreshStudio])

  const filtered = useMemo(() => artworks.filter(item => `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [artworks, query])
  const recentArtworks = useMemo(() => artworks
    .map((item, index) => ({ item, index, updatedAt: Date.parse(item.updatedAt ?? item.createdAt ?? '') || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.index - b.index)
    .slice(0, 4)
    .map(({ item }) => item), [artworks])
  const openNew = () => { setEditing(null); setDuplicating(false); setForm(emptyForm); setArtworkFile(null); setArtworkImageUrl(null); setArtworkPreviewUrl(null); setFormOpen(true) }
  const openEdit = (item: ArtworkItem) => { setEditing(item.id); setDuplicating(false); setForm({ title: item.title, description: item.description, price: String(item.price), category: item.category, isProtected: item.isProtected, available: item.available, status: item.status }); setArtworkFile(null); setArtworkImageUrl(item.imageUrl); setArtworkPreviewUrl(item.imagePreviewUrl ? artworkImage(item.imagePreviewUrl) : null); setFormOpen(true) }
  const openDuplicate = (item: ArtworkItem) => {
    const suffix = ' (copy)'
    setEditing(null)
    setDuplicating(true)
    setForm({ title: `${item.title.slice(0, 120 - suffix.length).trimEnd()}${suffix}`, description: item.description, price: String(item.price), category: item.category, isProtected: item.isProtected, available: item.available, status: 'draft' })
    setArtworkFile(null)
    setArtworkImageUrl(item.imageUrl)
    setArtworkPreviewUrl(item.imagePreviewUrl ? artworkImage(item.imagePreviewUrl) : null)
    setFormOpen(true)
  }
  const saveArtwork = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    setSaving(true)
    try {
      let imageUrl = artworkImageUrl
      if (artworkFile) {
        try {
          const uploaded = await uploadArtworkFile(artworkFile, token ?? '')
          imageUrl = uploaded.imageUrl
          setArtworkImageUrl(uploaded.imageUrl)
          setArtworkPreviewUrl(uploaded.previewDataUrl)
        } catch (cause) {
          toast.error('Artwork upload failed', cause instanceof Error ? cause.message : 'The selected file could not be uploaded.')
          return
        }
      }
      const response = await fetch(api(`/artist/artworks${editing ? `/${editing}` : ''}`), { method: editing ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price), imageUrl }) })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        toast.error('Session expired', 'Please sign in again to save your artwork.')
        localStorage.removeItem('showpeice_token')
        localStorage.removeItem('showpeice_user')
        navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        return
      }
      if (!response.ok) throw new Error(result.error || 'Artwork could not be saved.')
      setFormOpen(false)
      toast.success(duplicating ? 'Draft copy created' : editing ? 'Artwork updated' : 'Artwork saved', duplicating ? 'The artwork details were copied into a new draft.' : 'Your changes were saved to your studio.')
      setDuplicating(false)
      await refreshStudio(true)
    } catch (cause) { toast.error('Artwork could not be saved', cause instanceof Error ? cause.message : 'Please try again.') }
    finally { setSaving(false) }
  }
  const removeArtwork = async (id: number) => {
    if (!window.confirm('Delete this artwork? This cannot be undone.')) return
    try {
      const response = await fetch(api(`/artist/artworks/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      if (response.status === 401) {
        toast.error('Session expired', 'Please sign in again to manage your artwork.')
        localStorage.removeItem('showpeice_token')
        localStorage.removeItem('showpeice_user')
        navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        return
      }
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error('Artwork could not be deleted', result.error || 'Please try again.'); return }
      setArtworks(items => items.filter(item => item.id !== id))
      toast.success('Artwork deleted', 'The artwork was removed from your studio.')
      await refreshStudio(true)
    } catch {
      toast.error('Artwork could not be deleted', 'Check your connection and try again.')
    }
  }
  const logout = () => { localStorage.removeItem('showpeice_token'); localStorage.removeItem('showpeice_user'); navigate('/login') }
  const sectionHref = (section: string) => section === 'overview' ? '/artist/dashboard' : `/artist/dashboard?section=${section}`
  const featuredArtwork = recentArtworks.find(item => item.status === 'published') ?? recentArtworks[0] ?? null
  const artistName = artistDisplayName(user)
  const retryLoad = () => {
    if (retrying) return
    setLoading(true)
    setRetrying(true)
    void refreshStudio(true).finally(() => {
      setLoading(false)
      setRetrying(false)
    })
  }

  return <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
    <div className="artist-dashboard">
      <SidebarBody className="studio-sidebar-body">
        <StudioSidebarContent user={user} activeSection={activeSection} />
      </SidebarBody>
      <main className="studio-main">
        <header className="studio-topbar">
          <label className="studio-search"><IconSearch size={18} aria-hidden="true"/><input aria-label="Search your artworks" placeholder="Search your artworks" value={query} onChange={event => setQuery(event.target.value)}/></label>
          {(activeSection !== 'overview' || (!loading && user)) && <button className="studio-add-top" onClick={openNew}><IconPlus size={17} aria-hidden="true"/>Add Artwork</button>}
        </header>
        <div className="studio-content">
          {loading && activeSection === 'overview' ? <ArtistOverviewSkeleton/> : activeSection === 'overview' && user ? <header className="studio-overview-header"><div><span className="studio-kicker">ARTIST STUDIO</span><h1>Good afternoon,{' '}<SquigglyText scale={[1.5, 2.5]}>{artistName}</SquigglyText>.</h1><p>Your creative space, all in one place.</p></div></header> : activeSection === 'overview' ? null : <div className={`studio-heading${activeSection === 'profile' ? ' studio-heading-profile' : ''}`}><div><span className="studio-kicker">ARTIST STUDIO</span><h1>{active}</h1><p>{sectionDescription(activeSection)}</p></div></div>}
          {error && user && <div className="studio-alert" role="alert">{error}<button onClick={retryLoad} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</button><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {loading ? activeSection === 'overview' ? retrying ? <div className="studio-state" role="status"><span className="studio-loading-mark"/>Retrying your studio…</div> : null : <div className="studio-state" role="status"><span className="studio-loading-mark"/>{retrying ? 'Retrying your studio…' : 'Loading your studio…'}</div> : !user && error ? <section className="studio-panel studio-load-error" role="alert"><IconActivity size={25} stroke={1.3} aria-hidden="true"/><h2>Your studio could not be loaded.</h2><p>{error}</p><button className="studio-add-top" onClick={retryLoad} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</button></section> : <>
            {activeSection === 'overview' && <div className="studio-overview">
              {featuredArtwork ? <section className="overview-featured" aria-labelledby="overview-featured-title">
                <div className="overview-featured-image">{featuredArtwork.imagePreviewUrl ? <img src={artworkImage(featuredArtwork.imagePreviewUrl)} alt={featuredArtwork.title}/> : <div className="overview-art-placeholder"><IconPhoto size={34} stroke={1.2}/><span>Artwork image unavailable</span></div>}<span className={`overview-status overview-status-${featuredArtwork.available ? featuredArtwork.status : 'unavailable'}`}>{!featuredArtwork.available ? 'Unavailable' : featuredArtwork.status === 'published' ? 'Published' : 'Draft'}</span></div>
                <div className="overview-featured-copy"><span className="studio-kicker">FEATURED ARTWORK</span><h2 id="overview-featured-title">{featuredArtwork.title}</h2><p className="overview-featured-category">{featuredArtwork.category}</p><p className="overview-featured-description">{featuredArtwork.description}</p><div className="overview-featured-price"><span>Price</span><strong>{money(featuredArtwork.price)}</strong></div><div className="overview-featured-actions"><button type="button" className="overview-secondary-action" onClick={() => openEdit(featuredArtwork)}><IconPencil size={16} aria-hidden="true"/>Edit Artwork</button><Link to={sectionHref('artworks')} className="overview-text-action">View All Artworks <IconArrowRight size={16} aria-hidden="true"/></Link></div></div>
              </section> : <section className="overview-featured overview-featured-empty" aria-labelledby="overview-empty-title"><div className="overview-featured-image"><div className="overview-art-placeholder"><IconPhoto size={38} stroke={1.1} aria-hidden="true"/><span>Your featured artwork will appear here.</span></div></div><div className="overview-featured-copy"><span className="studio-kicker">YOUR COLLECTION BEGINS HERE</span><h2 id="overview-empty-title">Give your next piece a place to be seen.</h2><p>Add your first artwork to start shaping your public collection.</p><button type="button" className="studio-add-top" onClick={openNew}><IconPlus size={17} aria-hidden="true"/>Add Your First Artwork</button></div></section>}

              <section className="overview-stats" aria-label="Studio statistics">{[
                { title: 'Published Artworks', value: stats ? String(stats.publishedArtworks) : '—', note: stats ? `${stats.totalArtworks} total artworks` : 'Artwork counts unavailable', icon: IconPhoto },
                { title: 'Drafts', value: stats ? String(stats.draftArtworks) : '—', note: 'Not yet published', icon: IconPencil },
                { title: 'Artwork Views', value: stats?.views == null ? '—' : String(stats.views), note: stats?.views == null ? 'View tracking unavailable' : 'Total artwork views', icon: IconEye },
                { title: 'Pending Orders', value: stats?.pendingOrders == null ? '—' : String(stats.pendingOrders), note: stats?.pendingOrders == null ? 'Order data unavailable' : 'Awaiting fulfillment', icon: IconPackage },
              ].map(({ title, value, note, icon: Icon }) => <article className="overview-stat" key={title}><div className="overview-stat-label"><Icon size={16} stroke={1.6} aria-hidden="true"/><span>{title}</span></div><strong>{value}</strong><small>{note}</small></article>)}</section>

              <div className="overview-insights-grid">
                <MonthlyRevenueCard data={null} />
                <WeeklyActivityCard data={null} />
              </div>

              {recentArtworks.length > 0 && <section className="overview-recent" aria-labelledby="overview-recent-title"><header className="overview-section-heading"><div><span className="studio-kicker">FROM YOUR COLLECTION</span><h2 id="overview-recent-title">My Recent Artworks</h2></div><Link to={sectionHref('artworks')} className="overview-text-action">View All Artworks <IconArrowRight size={16} aria-hidden="true"/></Link></header>
                <div className="overview-art-grid">{recentArtworks.map(item => <article className="overview-art-card" key={item.id}><div className="overview-art-thumb">{item.imagePreviewUrl ? <img src={artworkImage(item.imagePreviewUrl)} alt={item.title}/> : <div className="overview-art-placeholder"><IconPhoto size={25} stroke={1.2}/></div>}<span className={`overview-status overview-status-${item.available ? item.status : 'unavailable'}`}>{!item.available ? 'Unavailable' : item.status === 'published' ? 'Published' : 'Draft'}</span><button type="button" className="overview-card-edit" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}><IconPencil size={14} aria-hidden="true"/>Edit</button></div><div className="overview-art-details"><h3>{item.title}</h3><span>{money(item.price)}</span></div></article>)}</div>
              </section>}

            </div>}
            {activeSection === 'artworks' && <ArtworkSection items={filtered} onEdit={openEdit} onDuplicate={openDuplicate} onDelete={removeArtwork} onAdd={openNew} empty={artworks.length === 0} filtered={Boolean(query)}/>}
            {activeSection === 'profile' && <ArtistProfilePage user={user} stats={stats} token={token ?? ''} onUserUpdated={setUser} />}
            {activeSection === 'settings' && <SettingsToggles onLogout={logout} />}
            {['orders', 'earnings', 'analytics'].includes(activeSection) && <section className="studio-panel studio-page-empty"><IconActivity size={25} stroke={1.3} aria-hidden="true"/><h2>{active}</h2><p>{sectionDescription(activeSection)}</p><small>This section will be available when its data and tools are connected.</small></section>}
          </>}
        </div>
      </main>
      {formOpen && <div className="studio-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false) }}><section className="studio-form-modal" role="dialog" aria-modal="true" aria-labelledby="artwork-form-title"><header><div><span className="studio-kicker">YOUR STUDIO</span><h2 id="artwork-form-title">{editing ? 'Edit artwork' : duplicating ? 'Duplicate artwork' : 'Add new artwork'}</h2></div><button onClick={() => setFormOpen(false)} aria-label="Close"><X size={18}/></button></header><form onSubmit={saveArtwork}><label>Artwork title<input required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>Description<textarea required rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label><div className="studio-form-row"><label>Price in INR<input required type="number" min="1" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })}/></label><label>Category<input required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}/></label></div><ArtworkFileUpload file={artworkFile} onFileChange={setArtworkFile} existingImageUrl={artworkPreviewUrl}/><label className="studio-checkbox"><input type="checkbox" checked={form.available} onChange={event => setForm({ ...form, available: event.target.checked })}/> Available for purchase</label><label className="studio-checkbox"><input type="checkbox" checked={form.isProtected} onChange={event => setForm({ ...form, isProtected: event.target.checked })}/> Protect this artwork</label><small className="studio-protection-note">Discourages casual saving, but cannot prevent screenshots or all image extraction.</small><label>Publication status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as 'draft' | 'published' })}><option value="draft">Save as draft</option><option value="published">Publish artwork</option></select></label><div className="studio-form-actions"><button className="studio-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : duplicating ? 'Create draft copy' : form.status === 'draft' ? 'Save draft' : 'Publish artwork'} <ArrowRight size={16}/></button></div></form></section></div>}
    </div>
  </Sidebar>
}

function StudioSidebarContent({ user, activeSection }: { user: User | null; activeSection: string }) {
  const { open } = useSidebar()
  return <div className="studio-sidebar-content">
    <Link to="/artist/dashboard" className="studio-wordmark" aria-label="Showpeice artist studio"><img src="/showpeice-logo.svg" alt=""/><motion.span animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }} aria-hidden={!open}>Showpeice<small>ARTIST STUDIO</small></motion.span></Link>
    <nav className="studio-side-nav" aria-label="Artist studio">
      {nav.map(({ label, section, icon: Icon }) => <SidebarLink key={section} link={{ label, href: section === 'overview' ? '/artist/dashboard' : `/artist/dashboard?section=${section}`, icon: <Icon size={19} stroke={1.6} aria-hidden="true"/>, active: activeSection === section }}/>) }
    </nav>
    <div className="studio-sidebar-bottom">
      <div className="studio-account"><StudioSidebarAvatar avatarUrl={user?.avatarUrl} artistName={artistDisplayName(user)} /><span className="studio-account-name"><strong>{user ? artistDisplayName(user) : 'Artist account'}</strong><small>{user?.role === 'artist' ? 'Artist' : user?.email ?? 'Signed in'}</small></span></div>
    </div>
  </div>
}

function StudioSidebarAvatar({ avatarUrl, artistName }: { avatarUrl: string | null | undefined; artistName: string }) {
  const imageUrl = avatarUrl?.trim() ?? ''

  return <span className="studio-avatar">
    {imageUrl
      ? <StudioSidebarAvatarImage key={imageUrl} imageUrl={imageUrl} artistName={artistName} />
      : <IconUserCircle size={24} aria-hidden="true" />}
  </span>
}

function StudioSidebarAvatarImage({ imageUrl, artistName }: { imageUrl: string; artistName: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  return imageFailed
    ? <IconUserCircle size={24} aria-hidden="true" />
    : <img src={profileImage(imageUrl)} alt={`${artistName} profile`} onError={() => setImageFailed(true)} />
}

function ArtistOverviewSkeleton() {
  return (
    <div className="overview-skeleton-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your studio overview.</span>
      <div className="overview-skeleton-content" aria-hidden="true">
        <header className="studio-overview-header overview-skeleton-header">
          <div>
            <span className="overview-skeleton-block overview-skeleton-kicker" />
            <span className="overview-skeleton-block overview-skeleton-welcome" />
            <span className="overview-skeleton-block overview-skeleton-intro" />
          </div>
          <div className="studio-overview-header-actions">
            <span className="overview-skeleton-block overview-skeleton-action" />
            <span className="overview-skeleton-block overview-skeleton-profile-link" />
          </div>
        </header>

        <div className="studio-overview">
          <section className="overview-featured overview-skeleton-featured">
            <div className="overview-featured-image">
              <span className="overview-skeleton-block overview-skeleton-feature-image" />
              <span className="overview-skeleton-block overview-skeleton-status overview-skeleton-feature-status" />
            </div>
            <div className="overview-featured-copy overview-skeleton-feature-copy">
              <span className="overview-skeleton-block overview-skeleton-kicker" />
              <span className="overview-skeleton-block overview-skeleton-feature-title" />
              <span className="overview-skeleton-block overview-skeleton-feature-title-short" />
              <span className="overview-skeleton-block overview-skeleton-feature-description" />
              <span className="overview-skeleton-block overview-skeleton-feature-description-short" />
              <span className="overview-skeleton-block overview-skeleton-feature-price-label" />
              <span className="overview-skeleton-block overview-skeleton-feature-price" />
              <div className="overview-skeleton-actions">
                <span className="overview-skeleton-block overview-skeleton-action" />
                <span className="overview-skeleton-block overview-skeleton-profile-link" />
              </div>
            </div>
          </section>

          <section className="overview-stats" aria-label="Loading studio statistics">
            {Array.from({ length: 4 }, (_, index) => (
              <article className="overview-stat" key={index}>
                <div className="overview-stat-label"><span className="overview-skeleton-block overview-skeleton-stat-icon" /><span className="overview-skeleton-block overview-skeleton-stat-label" /></div>
                <span className="overview-skeleton-block overview-skeleton-stat-value" />
                <span className="overview-skeleton-block overview-skeleton-stat-note" />
              </article>
            ))}
          </section>

          <div className="overview-insights-grid">
            <section className="monthly-revenue-card overview-skeleton-revenue">
              <header><span className="overview-skeleton-block overview-skeleton-card-title" /><span className="overview-skeleton-block overview-skeleton-card-icon" /></header>
              <span className="overview-skeleton-block overview-skeleton-revenue-value" />
              <span className="overview-skeleton-block overview-skeleton-comparison" />
              <span className="overview-skeleton-block overview-skeleton-trend" />
            </section>
            <section className="weekly-activity-card overview-skeleton-activity">
              <header><div><span className="overview-skeleton-block overview-skeleton-card-title" /><span className="overview-skeleton-block overview-skeleton-comparison" /></div></header>
              <div className="overview-skeleton-week-bars">
                {Array.from({ length: 7 }, (_, index) => <span className="overview-skeleton-block" key={index} />)}
              </div>
              <div className="overview-skeleton-week-labels">
                {Array.from({ length: 7 }, (_, index) => <span className="overview-skeleton-block" key={index} />)}
              </div>
              <span className="overview-skeleton-block overview-skeleton-week-note" />
            </section>
          </div>

          <section className="overview-recent">
            <header className="overview-section-heading">
              <div><span className="overview-skeleton-block overview-skeleton-kicker" /><span className="overview-skeleton-block overview-skeleton-recent-title" /></div>
              <span className="overview-skeleton-block overview-skeleton-view-all" />
            </header>
            <div className="overview-art-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <article className="overview-art-card" key={index}>
                  <div className="overview-art-thumb">
                    <span className="overview-skeleton-block overview-skeleton-art-image" />
                    <span className="overview-skeleton-block overview-skeleton-status" />
                  </div>
                  <div className="overview-art-details">
                    <span className="overview-skeleton-block overview-skeleton-art-title" />
                    <span className="overview-skeleton-block overview-skeleton-art-price" />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function sectionDescription(section: string) {
  const descriptions: Record<string, string> = {
    artworks: 'Manage the pieces in your collection.',
    orders: 'Review purchases and order activity.',
    earnings: 'Review your sales and payouts.',
    analytics: 'Understand how your work is reaching collectors.',
    profile: 'The artist information connected to your account.',
    settings: 'Manage preferences for your artist account.',
  }
  return descriptions[section] ?? 'A considered space for your work and practice.'
}

function ArtworkSection({ items, onEdit, onDuplicate, onDelete, onAdd, empty, filtered }: {
  items: ArtworkItem[]
  onEdit: (item: ArtworkItem) => void
  onDuplicate: (item: ArtworkItem) => void
  onDelete: (id: number) => void
  onAdd: () => void
  empty: boolean
  filtered: boolean
}) {
  return <section className="studio-artworks">
    <header><div><span className="studio-kicker">COLLECTION</span><h2>Your artworks</h2></div><span>{items.length} shown</span></header>
    {empty ? filtered
      ? <div className="studio-art-empty"><IconSearch size={24}/><h3>No artworks match your search.</h3><p>Try another title or category.</p></div>
      : <div className="studio-art-empty"><IconPhoto size={25} stroke={1.4}/><h3>Your collection is ready for its first piece.</h3><p>Add an artwork to begin building your artist profile.</p><button className="studio-add-top" onClick={onAdd}><IconPlus size={16}/>Add Artwork</button></div>
      : <div className="studio-art-grid">
        {items.map(item => {
          const actions = [
            { label: 'Edit', icon: <Pencil size={18}/>, onClick: () => onEdit(item) },
            { label: 'Duplicate', icon: <Copy size={18}/>, onClick: () => onDuplicate(item) },
            { label: 'Copy link', icon: <LinkIcon size={18}/>, onClick: () => toast.info('Artwork link unavailable', 'Public links for artist studio artworks are not connected yet.') },
            { label: 'Share', icon: <Share2 size={18}/>, onClick: () => toast.info('Artwork sharing unavailable', 'A public artwork page is required before this piece can be shared.') },
            { label: 'Save', icon: <Bookmark size={18}/>, badge: true, onClick: () => toast.info('Saving is unavailable', 'Favorites are not connected to artist-owned artworks yet.') },
            { label: 'Delete', icon: <Trash2 size={18}/>, intent: 'danger' as const, onClick: () => onDelete(item.id) },
          ]

          return <article className="studio-art-card" key={item.id}>
            <div className="studio-art-image">
              <div className="studio-art-image-media">{item.imagePreviewUrl ? <ProtectedArtworkImage isProtected={item.isProtected} src={artworkImage(item.imagePreviewUrl)} alt={item.title}/> : <IconPhoto size={27} stroke={1.3}/>}</div>
              <div className="studio-art-actions"><ExpandableActionBar items={actions} ariaLabel={`Actions for ${item.title}`} /></div>
            </div>
            <div className="studio-art-copy"><strong>{item.title}</strong><span>{money(item.price)}</span><small><i className={item.status}/>{item.status === 'published' ? 'Published' : 'Draft'} · {item.available ? 'Available' : 'Unavailable'}</small></div>
          </article>
        })}
        <button className="studio-art-add" onClick={onAdd}><IconPlus size={25}/><strong>Add artwork</strong><span>Share your next piece with the world.</span></button>
      </div>}
  </section>
}
