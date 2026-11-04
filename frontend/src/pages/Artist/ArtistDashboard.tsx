import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconActivity,
  IconArrowRight,
  IconEye,
  IconPackage,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { ArrowRight, Bookmark, Copy, Eye, Link as LinkIcon, Pencil, Share2, Trash2, X } from 'lucide-react'
import { lockBodyScroll } from '../../lib/body-scroll-lock'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { clearAuthSession } from '../../lib/authSession'
import { SquigglyText } from '../../components/ui/squiggly-text'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/toast'
import { ExpandableActionBar } from '../../components/motion/expandable-action-bar'
import { ArtworkFileUpload } from './ArtworkFileUpload'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { MonthlyRevenueCard } from './MonthlyRevenueCard'
import { WeeklyActivityCard } from './WeeklyActivityCard'
import { ArtistProfilePage } from './ArtistProfilePage'
import { SettingsToggles } from './SettingsToggles'
import { ArtistDashboardSectionSkeleton } from './ArtistLoadingSkeletons'
import { ArtistDashboardNavigation } from './ArtistDashboardNavigation'
import { artistDashboardNav } from './artistDashboardNav'
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
const api = apiUrl
const money = (amount: number) => `₹ ${new Intl.NumberFormat('en-IN').format(amount)}`
const artworkImage = (imageUrl: string) => imageUrl.startsWith('http')
  ? imageUrl
  : apiAssetUrl(imageUrl)
function readSavedArtworkIds(artistId: number) {
  try {
    const saved = localStorage.getItem(`showpeice_artist_saved_artworks_${artistId}`)
    if (saved === null) return new Set<number>()
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every(id => Number.isSafeInteger(id) && id > 0)) {
      throw new Error('Saved artwork data has an invalid format.')
    }
    return new Set(parsed as number[])
  } catch (cause) {
    toast.error('Saved artworks could not be loaded', cause instanceof Error ? cause.message : 'Check your browser storage settings.')
    return new Set<number>()
  }
}

async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
  } catch {
    // Fall through to the legacy clipboard API when browser permissions deny access.
  }

  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  let copied: boolean
  try {
    field.select()
    copied = document.execCommand('copy')
  } finally {
    field.remove()
  }
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.')
}

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

export function ArtistDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [pendingDeletion, setPendingDeletion] = useState<ArtworkItem | null>(null)
  const [deletingArtworkId, setDeletingArtworkId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkImageUrl, setArtworkImageUrl] = useState<string | null>(null)
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedArtworkIds, setSavedArtworkIds] = useState<Set<number>>(() => new Set())
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [pendingSettingsSection, setPendingSettingsSection] = useState<{ section?: string; to?: string } | null>(null)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)
  const deleteDialogRef = useRef<HTMLElement | null>(null)
  const modalTriggerRef = useRef<HTMLElement | null>(null)
  const deletingRef = useRef(false)
  const savedArtworkStorageKey = user ? `showpeice_artist_saved_artworks_${user.id}` : null

  useEffect(() => {
    if (!formOpen && !pendingDeletion) return
    return lockBodyScroll()
  }, [formOpen, pendingDeletion])

  useEffect(() => {
    if (!formOpen && !pendingDeletion) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = pendingDeletion ? deleteDialogRef.current : modalRef.current
    if (!dialog) return
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
    const initialFocus = formOpen
      ? dialog.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="file"])')
      : dialog.querySelector<HTMLElement>('button:not(:disabled)')
    initialFocus?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (deletingRef.current) return
        if (pendingDeletion) setPendingDeletion(null)
        else setFormOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      modalTriggerRef.current?.focus()
      if (!modalTriggerRef.current) previousFocus?.focus()
    }
  }, [formOpen, pendingDeletion])

  const token = localStorage.getItem('showpeice_token')
  const requestedSection = searchParams.get('section')
  const activeSection = artistDashboardNav.some(item => item.section === requestedSection) ? requestedSection! : 'overview'
  const active = artistDashboardNav.find(item => item.section === activeSection)?.label ?? 'Overview'

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
          setSavedArtworkIds(readSavedArtworkIds(data.user.id))
          setUser(data.user)
          setArtworks(data.artworks)
          setStats(data.stats)
          setError('')
        }
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof Error && 'status' in cause && cause.status === 401) {
          clearAuthSession()
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
        setSavedArtworkIds(readSavedArtworkIds(data.user.id))
        setUser(data.user)
        setArtworks(data.artworks)
        setStats(data.stats)
        setError('')
      } catch (cause) {
        if (cause instanceof Error && 'status' in cause && cause.status === 401) {
          clearAuthSession()
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

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => artworks.filter(item =>
    `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(normalizedQuery),
  ), [artworks, normalizedQuery])
  const recentArtworks = useMemo(() => artworks
    .map((item, index) => ({ item, index, updatedAt: Date.parse(item.updatedAt ?? item.createdAt ?? '') || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.index - b.index)
    .slice(0, 4)
    .map(({ item }) => item), [artworks])
  const rememberModalTrigger = () => {
    modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  const openNew = () => { rememberModalTrigger(); setEditing(null); setDuplicating(false); setForm(emptyForm); setArtworkFile(null); setArtworkImageUrl(null); setArtworkPreviewUrl(null); setFormOpen(true) }
  const openEdit = (item: ArtworkItem) => { rememberModalTrigger(); setEditing(item.id); setDuplicating(false); setForm({ title: item.title, description: item.description, price: String(item.price), category: item.category, isProtected: item.isProtected, available: item.available, status: item.status }); setArtworkFile(null); setArtworkImageUrl(item.imageUrl); setArtworkPreviewUrl(item.imagePreviewUrl ? artworkImage(item.imagePreviewUrl) : null); setFormOpen(true) }
  const openDuplicate = (item: ArtworkItem) => {
    const suffix = ' (copy)'
    rememberModalTrigger()
    setEditing(null)
    setDuplicating(true)
    setForm({ title: `${item.title.slice(0, 120 - suffix.length).trimEnd()}${suffix}`, description: item.description, price: String(item.price), category: item.category, isProtected: item.isProtected, available: item.available, status: 'draft' })
    setArtworkFile(null)
    setArtworkImageUrl(item.imageUrl)
    setArtworkPreviewUrl(item.imagePreviewUrl ? artworkImage(item.imagePreviewUrl) : null)
    setFormOpen(true)
  }
  const saveArtwork = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const title = form.title.trim()
    const description = form.description.trim()
    const category = form.category.trim()
    const price = Number(form.price)
    if (!title || !description || !category) {
      toast.warning('Complete the required details', 'Add a title, description, and category before saving.')
      return
    }
    if (title.length > 120) {
      toast.warning('Artwork title is too long', 'Use 120 characters or fewer for the title.')
      return
    }
    if (!Number.isSafeInteger(price) || price < 1 || price > 2147483647) {
      toast.warning('Enter a valid price', 'Price must be a whole number between ₹1 and ₹2,147,483,647.')
      return
    }
    if (!artworkFile && !artworkImageUrl) {
      toast.error('Artwork image required', 'Choose a PNG, JPEG, or WebP image before saving this artwork.')
      return
    }
    setSaving(true)
    try {
      const body = new FormData()
      body.set('title', title)
      body.set('description', description)
      body.set('price', String(price))
      body.set('category', category)
      body.set('available', String(form.available))
      body.set('isProtected', String(form.isProtected))
      body.set('status', form.status)
      if (artworkFile) body.set('image', artworkFile)
      else if (artworkImageUrl) body.set('imageUrl', artworkImageUrl)
      const response = await fetch(api(`/artist/artworks${editing ? `/${editing}` : ''}`), {
        method: editing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        toast.error('Session expired', 'Please sign in again to save your artwork.')
        clearAuthSession()
        navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        return
      }
      if (!response.ok) throw new Error(result.error || 'Artwork could not be saved.')
      if (!result.artwork || typeof result.artwork.imageUrl !== 'string') {
        throw new Error('The server did not confirm that the artwork and image were saved.')
      }
      setFormOpen(false)
      toast.success(duplicating ? 'Draft copy created' : editing ? 'Artwork updated' : 'Artwork saved', duplicating ? 'The artwork details were copied into a new draft.' : 'Your changes were saved to your studio.')
      setDuplicating(false)
      await refreshStudio(true)
    } catch (cause) { toast.error('Artwork could not be saved', cause instanceof Error ? cause.message : 'Please try again.') }
    finally { setSaving(false) }
  }
  const requestArtworkDeletion = (item: ArtworkItem) => {
    rememberModalTrigger()
    setPendingDeletion(item)
  }
  const removeArtwork = async (id: number) => {
    deletingRef.current = true
    setDeletingArtworkId(id)
    try {
      const response = await fetch(api(`/artist/artworks/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      if (response.status === 401) {
        toast.error('Session expired', 'Please sign in again to manage your artwork.')
        clearAuthSession()
        navigate('/login?role=artist&returnTo=%2Fartist%2Fdashboard')
        return
      }
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error('Artwork could not be deleted', result.error || 'Please try again.'); return }
      setArtworks(items => items.filter(item => item.id !== id))
      if (savedArtworkStorageKey && savedArtworkIds.has(id)) {
        const nextSavedIds = new Set(savedArtworkIds)
        nextSavedIds.delete(id)
        setSavedArtworkIds(nextSavedIds)
        try {
          localStorage.setItem(savedArtworkStorageKey, JSON.stringify([...nextSavedIds]))
        } catch {
          toast.error('Saved state could not be updated', 'The artwork was deleted, but browser storage could not be updated.')
        }
      }
      toast.success('Artwork deleted', 'The artwork was removed from your studio.')
      await refreshStudio(true)
    } catch {
      toast.error('Artwork could not be deleted', 'Check your connection and try again.')
    } finally {
      deletingRef.current = false
      setDeletingArtworkId(null)
      setPendingDeletion(null)
    }
  }
  const toggleSavedArtwork = (item: ArtworkItem) => {
    if (!savedArtworkStorageKey) {
      toast.error('Artwork could not be saved', 'Your artist account is still loading. Try again in a moment.')
      return
    }
    const nextSavedIds = new Set(savedArtworkIds)
    const isSaved = nextSavedIds.has(item.id)
    if (isSaved) nextSavedIds.delete(item.id)
    else nextSavedIds.add(item.id)
    try {
      localStorage.setItem(savedArtworkStorageKey, JSON.stringify([...nextSavedIds]))
      setSavedArtworkIds(nextSavedIds)
      toast.success(isSaved ? 'Removed from saved artworks' : 'Artwork saved', item.title)
    } catch {
      toast.error('Saved state could not be updated', 'Allow browser storage for this site and try again.')
    }
  }
  const viewArtwork = (item: ArtworkItem) => {
    if (item.status !== 'published') {
      toast.info('Artwork is a draft', 'Publish this artwork to make its public page available.')
      return
    }
    navigate(`/artwork/${item.id}`)
  }
  const copyArtworkLink = async (item: ArtworkItem) => {
    const url = `${window.location.origin}/artwork/${item.id}`
    try {
      await copyToClipboard(url)
      toast.success('Artwork link copied', item.status === 'draft' ? `${url} (publish this draft to make it publicly viewable)` : url)
    } catch (cause) {
      toast.error('Could not copy artwork link', cause instanceof Error ? cause.message : 'Allow clipboard access and try again.')
    }
  }
  const shareArtwork = async (item: ArtworkItem) => {
    const url = `${window.location.origin}/artwork/${item.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: item.description, url })
        toast.success('Artwork shared', item.title)
        return
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
      }
    }
    try {
      await copyToClipboard(url)
      toast.success('Artwork link copied', 'Sharing is unavailable here, so the link was copied instead.')
    } catch (cause) {
      toast.error('Could not share artwork', cause instanceof Error ? cause.message : 'Sharing and clipboard access are unavailable.')
    }
  }
  const logout = () => { clearAuthSession(); navigate('/login') }
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

  return <div className="artist-dashboard">
      <ArtistDashboardNavigation
        activeSection={activeSection}
        artistName={artistName}
        artistSlug={user?.slug ?? ''}
        avatarUrl={user?.avatarUrl ?? null}
        settingsDirty={settingsDirty}
        onLeaveSettings={setPendingSettingsSection}
      />
      <main className="studio-main">
        <header className="studio-topbar">
          <label className="studio-search"><IconSearch size={18} aria-hidden="true"/><input aria-label="Search your artworks" placeholder="Search your artworks" value={query} onChange={event => setQuery(event.target.value)}/></label>
          {(activeSection !== 'overview' || (!loading && user)) && <button className="studio-add-top" onClick={openNew}><IconPlus size={17} aria-hidden="true"/>Add Artwork</button>}
        </header>
        <div className="studio-content">
          {loading && activeSection === 'overview' ? <ArtistOverviewSkeleton/> : activeSection === 'overview' && user ? <header className="studio-overview-header"><div><h1>Good afternoon,{' '}<SquigglyText scale={[1.5, 2.5]}>{artistName}</SquigglyText>.</h1><p>Your creative space, all in one place.</p></div></header> : activeSection === 'overview' ? null : <div className={`studio-heading${activeSection === 'profile' ? ' studio-heading-profile' : ''}`}><div><h1>{active}</h1><p>{sectionDescription(activeSection)}</p></div></div>}
          {error && user && <div className="studio-alert" role="alert">{error}<button onClick={retryLoad} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</button><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {loading ? activeSection === 'overview' ? null : <ArtistDashboardSectionSkeleton section={activeSection}/> : !user && error ? <section className="studio-panel studio-load-error" role="alert"><IconActivity size={25} stroke={1.3} aria-hidden="true"/><h2>Your studio could not be loaded.</h2><p>{error}</p><button className="studio-add-top" onClick={retryLoad} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</button></section> : <>
            {activeSection === 'overview' && <div className="studio-overview">
              {featuredArtwork ? <section className="overview-featured" aria-labelledby="overview-featured-title">
                <div className="overview-featured-image">{featuredArtwork.imagePreviewUrl ? <img src={artworkImage(featuredArtwork.imagePreviewUrl)} alt={featuredArtwork.title}/> : <div className="overview-art-placeholder"><IconPhoto size={34} stroke={1.2}/><span>Artwork image unavailable</span></div>}<span className={`overview-status overview-status-${featuredArtwork.available ? featuredArtwork.status : 'unavailable'}`}>{!featuredArtwork.available ? 'Sold' : featuredArtwork.status === 'published' ? 'Published' : 'Draft'}</span></div>
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
                <div className="overview-art-grid">{recentArtworks.map(item => <article className="overview-art-card" key={item.id}><div className="overview-art-thumb">{item.imagePreviewUrl ? <img src={artworkImage(item.imagePreviewUrl)} alt={item.title}/> : <div className="overview-art-placeholder"><IconPhoto size={25} stroke={1.2}/></div>}<span className={`overview-status overview-status-${item.available ? item.status : 'unavailable'}`}>{!item.available ? 'Sold' : item.status === 'published' ? 'Published' : 'Draft'}</span><button type="button" className="overview-card-edit" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}><IconPencil size={14} aria-hidden="true"/>Edit</button></div><div className="overview-art-details"><h3>{item.title}</h3><span>{money(item.price)}</span></div></article>)}</div>
              </section>}

            </div>}
            {activeSection === 'artworks' && <ArtworkSection
              items={filtered}
              onEdit={openEdit}
              onDuplicate={openDuplicate}
              onDelete={requestArtworkDeletion}
              onView={viewArtwork}
              onCopyLink={copyArtworkLink}
              onShare={shareArtwork}
              onToggleSaved={toggleSavedArtwork}
              savedArtworkIds={savedArtworkIds}
              deletingArtworkId={deletingArtworkId}
              onAdd={openNew}
              empty={artworks.length === 0}
              filtered={Boolean(normalizedQuery)}
            />}
            {activeSection === 'profile' && <ArtistProfilePage user={user} stats={stats} token={token ?? ''} onUserUpdated={setUser} />}
            {activeSection === 'settings' && <SettingsToggles
              token={token ?? ''}
              onLogout={logout}
              onDirtyChange={setSettingsDirty}
              onUserUpdated={updated => setUser(current => current ? { ...current, ...updated } : current)}
            />}
            {['orders', 'earnings', 'analytics'].includes(activeSection) && <section className="studio-panel studio-page-empty"><IconActivity size={25} stroke={1.3} aria-hidden="true"/><h2>{active}</h2><p>{sectionDescription(activeSection)}</p><small>This section will be available when its data and tools are connected.</small></section>}
          </>}
        </div>
      </main>
      {pendingSettingsSection && <div className="artist-confirmation-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPendingSettingsSection(null) }}>
        <section className="artist-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-settings-title" aria-describedby="unsaved-settings-description">
          <h2 id="unsaved-settings-title">Discard unsaved settings?</h2>
          <p id="unsaved-settings-description">Your settings changes have not been saved. Leave this page and discard them?</p>
          <div className="artist-confirmation-dialog-actions">
            <button type="button" className="artist-confirmation-cancel" onClick={() => setPendingSettingsSection(null)}>Stay on settings</button>
            <button type="button" className="artist-confirmation-danger" onClick={() => {
              const destination = pendingSettingsSection
              setPendingSettingsSection(null)
              setSettingsDirty(false)
              if (destination.to) navigate(destination.to)
              else setSearchParams(destination.section === 'overview' ? {} : { section: destination.section ?? 'overview' })
            }}>Discard and leave</button>
          </div>
        </section>
      </div>}
      {pendingDeletion && <div className="artist-confirmation-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !deletingRef.current) setPendingDeletion(null) }}>
        <section ref={deleteDialogRef} className="artist-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-artwork-title" aria-describedby="delete-artwork-description">
          <h2 id="delete-artwork-title">Are you sure you want to delete this artwork?</h2>
          <p id="delete-artwork-description">“{pendingDeletion.title}” will be removed from your collection. This action cannot be undone.</p>
          <div className="artist-confirmation-dialog-actions">
            <button type="button" className="artist-confirmation-cancel" disabled={deletingArtworkId === pendingDeletion.id} onClick={() => setPendingDeletion(null)}>Cancel</button>
            <button type="button" className="artist-confirmation-danger" disabled={deletingArtworkId === pendingDeletion.id} onClick={() => void removeArtwork(pendingDeletion.id)}>{deletingArtworkId === pendingDeletion.id ? 'Deleting…' : 'Delete Artwork'}</button>
          </div>
        </section>
      </div>}
      {formOpen && <div className="studio-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false) }}><section ref={modalRef} className="studio-form-modal" role="dialog" aria-modal="true" aria-labelledby="artwork-form-title"><header><div><span className="studio-kicker">YOUR STUDIO</span><h2 id="artwork-form-title">{editing ? 'Edit artwork' : duplicating ? 'Duplicate artwork' : 'Add new artwork'}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Close"><X size={18}/></button></header><form onSubmit={saveArtwork}><label>Artwork title<input required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>Description<textarea required rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label><div className="studio-form-row"><label>Price in INR<input required type="number" min="1" max="2147483647" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })}/></label><label>Category<input required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}/></label></div><ArtworkFileUpload file={artworkFile} onFileChange={setArtworkFile} existingImageUrl={artworkPreviewUrl} disabled={saving} uploading={saving && Boolean(artworkFile)}/><label>Availability<select value={String(form.available)} onChange={event => setForm({ ...form, available: event.target.value === 'true' })}><option value="true">Available</option><option value="false">Sold</option></select></label><label className="studio-checkbox"><input type="checkbox" checked={form.isProtected} onChange={event => setForm({ ...form, isProtected: event.target.checked })}/> Protect this artwork</label><small className="studio-protection-note">Discourages casual saving, but cannot prevent screenshots or all image extraction.</small><label>Publication status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value === 'published' ? 'published' : 'draft' })}><option value="draft">Save as draft</option><option value="published">Publish artwork</option></select></label><div className="studio-form-actions"><button className="studio-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : duplicating ? 'Create draft copy' : form.status === 'draft' ? 'Save draft' : 'Publish artwork'} <ArrowRight size={16}/></button></div></form></section></div>}
    </div>
}

function ArtistOverviewSkeleton() {
  return (
    <div className="overview-skeleton-screen" role="status" aria-label="Loading artist studio overview" aria-busy="true">
      <div className="overview-skeleton-content">
        <header className="studio-overview-header overview-skeleton-header">
          <div>
            <Skeleton shape="text" className="overview-skeleton-kicker" />
            <Skeleton className="overview-skeleton-welcome" />
            <Skeleton shape="text" className="overview-skeleton-intro" />
          </div>
          <div className="studio-overview-header-actions">
            <Skeleton className="overview-skeleton-action" />
            <Skeleton shape="text" className="overview-skeleton-profile-link" />
          </div>
        </header>

        <div className="studio-overview">
          <section className="overview-featured overview-skeleton-featured">
            <div className="overview-featured-image">
              <Skeleton className="overview-skeleton-feature-image" />
              <Skeleton className="overview-skeleton-status overview-skeleton-feature-status" />
            </div>
            <div className="overview-featured-copy overview-skeleton-feature-copy">
              <Skeleton shape="text" className="overview-skeleton-kicker" />
              <Skeleton className="overview-skeleton-feature-title" />
              <Skeleton className="overview-skeleton-feature-title-short" />
              <Skeleton shape="text" className="overview-skeleton-feature-description" />
              <Skeleton shape="text" className="overview-skeleton-feature-description-short" />
              <Skeleton shape="text" className="overview-skeleton-feature-price-label" />
              <Skeleton className="overview-skeleton-feature-price" />
              <div className="overview-skeleton-actions">
                <Skeleton className="overview-skeleton-action" />
                <Skeleton shape="text" className="overview-skeleton-profile-link" />
              </div>
            </div>
          </section>

          <section className="overview-stats" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <article className="overview-stat" key={index}>
                <div className="overview-stat-label"><Skeleton shape="circle" className="overview-skeleton-stat-icon" /><Skeleton shape="text" className="overview-skeleton-stat-label" /></div>
                <Skeleton className="overview-skeleton-stat-value" />
                <Skeleton shape="text" className="overview-skeleton-stat-note" />
              </article>
            ))}
          </section>

          <div className="overview-insights-grid">
            <section className="monthly-revenue-card overview-skeleton-revenue">
              <header><Skeleton className="overview-skeleton-card-title" /><Skeleton shape="circle" className="overview-skeleton-card-icon" /></header>
              <Skeleton className="overview-skeleton-revenue-value" />
              <Skeleton shape="text" className="overview-skeleton-comparison" />
              <Skeleton className="overview-skeleton-trend" />
            </section>
            <section className="weekly-activity-card overview-skeleton-activity">
              <header><div><Skeleton className="overview-skeleton-card-title" /><Skeleton shape="text" className="overview-skeleton-comparison" /></div></header>
              <div className="overview-skeleton-week-bars">
                {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} />)}
              </div>
              <div className="overview-skeleton-week-labels">
                {Array.from({ length: 7 }, (_, index) => <Skeleton shape="text" key={index} />)}
              </div>
              <Skeleton shape="text" className="overview-skeleton-week-note" />
            </section>
          </div>

          <section className="overview-recent">
            <header className="overview-section-heading">
              <div><Skeleton shape="text" className="overview-skeleton-kicker" /><Skeleton className="overview-skeleton-recent-title" /></div>
              <Skeleton shape="text" className="overview-skeleton-view-all" />
            </header>
            <div className="overview-art-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <article className="overview-art-card" key={index}>
                  <div className="overview-art-thumb">
                    <Skeleton className="overview-skeleton-art-image" />
                    <Skeleton className="overview-skeleton-status" />
                  </div>
                  <div className="overview-art-details">
                    <Skeleton className="overview-skeleton-art-title" />
                    <Skeleton shape="text" className="overview-skeleton-art-price" />
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

function ArtworkSection({ items, onEdit, onDuplicate, onDelete, onView, onCopyLink, onShare, onToggleSaved, savedArtworkIds, deletingArtworkId, onAdd, empty, filtered }: {
  items: ArtworkItem[]
  onEdit: (item: ArtworkItem) => void
  onDuplicate: (item: ArtworkItem) => void
  onDelete: (item: ArtworkItem) => void
  onView: (item: ArtworkItem) => void
  onCopyLink: (item: ArtworkItem) => void
  onShare: (item: ArtworkItem) => void
  onToggleSaved: (item: ArtworkItem) => void
  savedArtworkIds: Set<number>
  deletingArtworkId: number | null
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
          const isSaved = savedArtworkIds.has(item.id)
          const isDeleting = deletingArtworkId === item.id
          const actions = [
            { label: 'View', icon: <Eye size={18}/>, onClick: () => onView(item) },
            { label: 'Edit', icon: <Pencil size={18}/>, onClick: () => onEdit(item) },
            { label: 'Duplicate', icon: <Copy size={18}/>, onClick: () => onDuplicate(item) },
            { label: 'Copy link', icon: <LinkIcon size={18}/>, onClick: () => onCopyLink(item) },
            { label: 'Share', icon: <Share2 size={18}/>, onClick: () => onShare(item) },
            { label: isSaved ? 'Saved' : 'Save', icon: <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'}/>, pressed: isSaved, onClick: () => onToggleSaved(item) },
            { label: 'Delete', icon: <Trash2 size={18}/>, intent: 'danger' as const, disabled: isDeleting, onClick: () => onDelete(item) },
          ]

          return <article className="studio-art-card" key={item.id}>
            <div className="studio-art-image">
              <div className="studio-art-image-media">{item.imagePreviewUrl ? <ProtectedArtworkImage isProtected={item.isProtected} src={artworkImage(item.imagePreviewUrl)} alt={item.title}/> : <IconPhoto size={27} stroke={1.3}/>}</div>
              <div className="studio-art-actions"><ExpandableActionBar items={actions} ariaLabel={`Actions for ${item.title}`} /></div>
            </div>
            <div className="studio-art-copy"><strong>{item.title}</strong><span>{money(item.price)}</span><small><i className={item.status}/>{item.status === 'published' ? 'Published' : 'Draft'} · {item.available ? 'Available' : 'Sold'}</small></div>
          </article>
        })}
        <button className="studio-art-add" onClick={onAdd}><IconPlus size={25}/><strong>Add artwork</strong><span>Share your next piece with the world.</span></button>
      </div>}
  </section>
}
