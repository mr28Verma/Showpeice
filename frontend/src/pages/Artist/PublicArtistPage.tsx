import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  PencilLine,
  Plus,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import { toast } from '../../components/ui/toast'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { clearAuthSession } from '../../lib/authSession'
import { formatINR } from '../../utils/formatCurrency'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { ArtworkCardSkeleton, Skeleton } from '../../components/ui/Skeleton'
import './PublicArtistPage.css'

export type PublicArtwork = {
  id: number
  title: string
  description: string
  price: number
  category: string
  imageUrl: string | null
  isProtected?: boolean
  available?: boolean
  createdAt?: string
}

export type PublicArtist = {
  id: number | string
  slug: string
  firstName: string
  lastName: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  medium: string | null
  location: string | null
  instagramUrl: string | null
  websiteUrl: string | null
  shopAnnouncement?: string | null
  publicEmail?: string | null
  artworks: PublicArtwork[]
  followerCount: number
  isFollowing: boolean
  isOwnProfile: boolean
  createdAt?: string
  bannerUrl: string | null
}

type FollowResponse = {
  error?: string
  isFollowing?: boolean
  followerCount?: number
}

type PublicProfileState = {
  requestKey: string
  artist: PublicArtist | null
  loading: boolean
  error: string
}

function resolveImageUrl(url: string | null | undefined, fallback = ''): string {
  if (!url) return fallback
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  return apiAssetUrl(url)
}

function formatPrice(price: number | undefined): string {
  if (typeof price === 'number' && Number.isFinite(price)) {
    return formatINR(price)
  }
  return 'Price on inquiry'
}

function artworkDetailPath(artist: PublicArtist, item: PublicArtwork): string {
  return artist.slug === 'elena-moreau'
    ? `/artwork/${item.id}`
    : `/artwork/${item.id}?artist=${encodeURIComponent(artist.slug)}`
}

// Curated high-resolution fallback visuals
const fallbackHeroImage =
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=85&w=1920'
const fallbackPortraitImage =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=85&w=800'

// -----------------------------------------------------------------------------
// Sample Artist Profile (Elena Moreau) — Provides a rich interactive preview
// -----------------------------------------------------------------------------
const initialSampleArtist: PublicArtist = {
  id: 'elena-moreau',
  slug: 'elena-moreau',
  firstName: 'Elena',
  lastName: 'Moreau',
  displayName: 'Elena Moreau',
  bio: 'Contemporary artist exploring the relationship between light, architectural texture, and human silence. Her practice blends layered oil pigments with minimalist forms to capture intimate, contemplative moments that resonate across modern living spaces.',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=85&w=800',
  bannerUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=85&w=1920',
  medium: 'Contemporary Oil Painting',
  location: 'Paris, France',
  instagramUrl: 'https://instagram.com/showpeice',
  websiteUrl: 'https://showpeice.art',
  followerCount: 14280,
  isFollowing: false,
  isOwnProfile: false,
  createdAt: '2023-04-12T00:00:00.000Z',
  artworks: [
    {
      id: 101,
      title: 'Symphony of Gold & Shadow No. IV',
      description: 'Layered raw pigments, cold wax, and gold dust on Belgian linen.',
      price: 185000,
      category: 'Oil on Linen',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=85&w=1000',
      isProtected: true,
      available: true,
      createdAt: '2024-02-15T00:00:00.000Z',
    },
    {
      id: 102,
      title: 'Ephemeral Horizon in Champagne',
      description: 'Study of dawn mist over Montmartre rooftops with mineral pigments.',
      price: 142000,
      category: 'Mixed Media',
      imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=85&w=1000',
      available: true,
      createdAt: '2024-01-20T00:00:00.000Z',
    },
    {
      id: 103,
      title: 'Whispers of Parisian Dawn',
      description: 'Intimate monochromatic composition inspired by early autumn fog.',
      price: 98000,
      category: 'Oil on Canvas',
      imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=85&w=1000',
      available: true,
      createdAt: '2023-11-10T00:00:00.000Z',
    },
    {
      id: 104,
      title: 'Nocturne in Obsidian & Ochre',
      description: 'Textured canvas exploring nocturnal stillness and warm earthen undertones.',
      price: 215000,
      category: 'Abstract Expressionism',
      imageUrl: 'https://images.unsplash.com/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&q=85&w=1000',
      available: true,
      createdAt: '2023-08-04T00:00:00.000Z',
    },
  ],
}

// -----------------------------------------------------------------------------
// Contact Artist Modal Dialog Component
// -----------------------------------------------------------------------------
type ContactModalProps = {
  isOpen: boolean
  artistName: string
  artistEmail?: string
  instagramUrl?: string | null
  websiteUrl?: string | null
  onClose: () => void
}

function ContactArtistModal({
  isOpen,
  artistName,
  instagramUrl,
  websiteUrl,
  onClose,
}: ContactModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [inquiryType, setInquiryType] = useState('Acquisition of an original work')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    window.setTimeout(() => {
      setSending(false)
      toast.success(
        'Inquiry delivered',
        `Your message has been sent to ${artistName}. You will receive a copy at ${email}.`
      )
      onClose()
      setName('')
      setEmail('')
      setMessage('')
    }, 450)
  }

  return (
    <div
      className="spotify-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="spotify-modal-dialog">
        <div className="spotify-modal-header">
          <div>
            <h3 id="contact-modal-title">Inquire with {artistName}</h3>
            <p>Direct private consultation regarding acquisitions, commissions, and studio visits.</p>
          </div>
          <button
            type="button"
            className="spotify-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form className="spotify-modal-form" onSubmit={handleSubmit}>
          <div className="spotify-form-field">
            <label htmlFor="inquiry-name">Your Full Name</label>
            <input
              id="inquiry-name"
              required
              placeholder="e.g. Eleanor Vance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="spotify-form-field">
            <label htmlFor="inquiry-email">Collector Email</label>
            <input
              id="inquiry-email"
              type="email"
              required
              placeholder="eleanor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="spotify-form-field">
            <label htmlFor="inquiry-type">Nature of Inquiry</label>
            <select
              id="inquiry-type"
              value={inquiryType}
              onChange={(e) => setInquiryType(e.target.value)}
            >
              <option value="Acquisition of an original work">Acquisition of an original work</option>
              <option value="Bespoke Commission Request">Bespoke Commission Request</option>
              <option value="Gallery Exhibition / Curatorial">Gallery Exhibition / Curatorial</option>
              <option value="Studio Visit / Press Inquiry">Studio Visit / Press Inquiry</option>
            </select>
          </div>

          <div className="spotify-form-field">
            <label htmlFor="inquiry-message">Inquiry Details</label>
            <textarea
              id="inquiry-message"
              required
              rows={4}
              placeholder={`Share details regarding the artwork you are interested in or questions for ${artistName}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {(websiteUrl || instagramUrl) && (
            <div className="spotify-form-field">
              <label>Direct Channels</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="spotify-social-link"
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    <span>Portfolio</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="spotify-social-link"
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    <span>Instagram</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="spotify-modal-actions">
            <button type="button" className="spotify-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="spotify-modal-submit" disabled={sending}>
              {sending ? 'Delivering…' : 'Send Inquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Sample Editor Dialog (for Elena Moreau sample preview)
// -----------------------------------------------------------------------------
type SampleEditorProps = {
  isOpen: boolean
  artist: PublicArtist
  onSave: (updated: Partial<PublicArtist>) => void
  onClose: () => void
}

function SampleProfileEditorModal({ isOpen, artist, onSave, onClose }: SampleEditorProps) {
  const [displayName, setDisplayName] = useState(artist.displayName || `${artist.firstName} ${artist.lastName}`)
  const [medium, setMedium] = useState(artist.medium || '')
  const [location, setLocation] = useState(artist.location || '')
  const [bio, setBio] = useState(artist.bio || '')

  if (!isOpen) return null

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    onSave({ displayName, medium, location, bio })
    toast.success('Preview updated', 'Changes have been applied to this sample profile session.')
    onClose()
  }

  return (
    <div
      className="spotify-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-editor-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="spotify-modal-dialog">
        <div className="spotify-modal-header">
          <div>
            <h3 id="sample-editor-title">Edit Sample Profile</h3>
            <p>Modify preview details to test responsive layout variations.</p>
          </div>
          <button type="button" className="spotify-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form className="spotify-modal-form" onSubmit={handleSave}>
          <div className="spotify-form-field">
            <label>Artist Name</label>
            <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="spotify-form-field">
            <label>Artistic Specialty / Medium</label>
            <input required value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>
          <div className="spotify-form-field">
            <label>Location</label>
            <input required value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="spotify-form-field">
            <label>Artist Biography</label>
            <textarea required rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="spotify-modal-actions">
            <button type="button" className="spotify-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="spotify-modal-submit">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Spotify-Inspired Artist Profile Component
// -----------------------------------------------------------------------------
export function PublicArtistPage() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isSampleArtist = slug === 'elena-moreau'

  const [authToken, setAuthToken] = useState(() => localStorage.getItem('showpeice_token'))
  const [loadAttempt, setLoadAttempt] = useState(0)
  const requestKey = (slug ?? '') + ':' + (authToken ?? '') + ':' + loadAttempt

  const [profileState, setProfileState] = useState<PublicProfileState>({
    requestKey: '',
    artist: isSampleArtist ? initialSampleArtist : null,
    loading: !isSampleArtist,
    error: '',
  })

  const [savingFollow, setSavingFollow] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'artworks' | 'about'>('overview')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'title'>('newest')
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isSampleEditorOpen, setIsSampleEditorOpen] = useState(false)

  const prefersReducedMotion = useReducedMotion()

  // Fetch artist data from the backend by canonical slug. Numeric slugs remain
  // accepted by the API for old profile URLs and return the canonical slug.
  useEffect(() => {
    if (isSampleArtist) return

    const controller = new AbortController()
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined

    fetch(apiUrl(`/artists/${encodeURIComponent(slug ?? '')}`), { headers, signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(result.error || 'Artist profile could not be found.')
        }
        if (!result.artist || !Array.isArray(result.artist.artworks)) {
          throw new Error('Artist profile data was incomplete.')
        }
        setProfileState({
          requestKey,
          artist: result.artist,
          loading: false,
          error: '',
        })
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setProfileState({
            requestKey,
            artist: null,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Artist profile could not be loaded.',
          })
        }
      })

    return () => controller.abort()
  }, [slug, authToken, requestKey, isSampleArtist])

  const currentProfileState = isSampleArtist
    ? { requestKey, artist: initialSampleArtist, loading: false, error: '' }
    : profileState.requestKey === requestKey ? profileState : null
  const loading = currentProfileState?.loading ?? (isSampleArtist ? false : true)
  const artist = currentProfileState?.artist ?? (isSampleArtist ? initialSampleArtist : null)
  const error = currentProfileState?.error ?? ''

  useEffect(() => {
    if (!artist?.slug || loading) return
    const canonicalPath = `/artist/${encodeURIComponent(artist.slug)}`
    if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true })
  }, [artist?.slug, location.pathname, loading, navigate])

  // Full name / Display name
  const artistName = useMemo(() => {
    if (!artist) return ''
    return artist.displayName?.trim() || `${artist.firstName} ${artist.lastName}`.trim()
  }, [artist])

  // Extract unique artwork categories for filtering
  const categories = useMemo(() => {
    if (!artist?.artworks) return ['All']
    const cats = new Set<string>()
    artist.artworks.forEach((w) => {
      if (w.category) cats.add(w.category)
    })
    return ['All', ...Array.from(cats)]
  }, [artist])

  // Filtered and sorted artworks for the "Artworks" tab
  const processedArtworks = useMemo(() => {
    if (!artist?.artworks) return []
    let list = [...artist.artworks]

    if (selectedCategory !== 'All') {
      list = list.filter((w) => w.category === selectedCategory)
    }

    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        list.sort((a, b) => b.price - a.price)
        break
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'newest':
      default:
        list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : a.id
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : b.id
          return dateB - dateA
        })
        break
    }

    return list
  }, [artist, selectedCategory, sortBy])

  // Featured artworks for the "Overview" tab (top 4 curated)
  const featuredArtworks = useMemo(() => {
    if (!artist?.artworks) return []
    return artist.artworks.slice(0, 4)
  }, [artist])

  // Only a saved banner is allowed to fill the hero backdrop.
  const heroBackdrop = useMemo(() => {
    return artist?.bannerUrl
      ? resolveImageUrl(artist.bannerUrl)
      : null
  }, [artist])

  // Artist Avatar / Portrait Image
  const portraitUrl = useMemo(() => {
    if (artist?.avatarUrl) {
      return resolveImageUrl(artist.avatarUrl, fallbackPortraitImage)
    }
    return fallbackPortraitImage
  }, [artist])

  // Follow / Unfollow Handler (Real persistent backend request)
  const handleFollowToggle = async () => {
    if (!artist || savingFollow) return

    // If user is not authenticated, preserve return URL and navigate to login
    if (!authToken && !isSampleArtist) {
      toast.info('Sign in required', 'Please sign in to follow this artist.')
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`)
      return
    }

    // Own profile check
    if (artist.isOwnProfile) {
      toast.info('Personal Studio', 'You cannot follow your own artist profile.')
      return
    }

    // Sample preview local toggle
    if (isSampleArtist) {
      const nextFollowing = !artist.isFollowing
      const nextCount = artist.followerCount + (nextFollowing ? 1 : -1)
      setProfileState((current) =>
        current.artist
          ? {
              ...current,
              artist: {
                ...current.artist,
                isFollowing: nextFollowing,
                followerCount: nextCount,
              },
            }
          : current
      )
      toast.success(
        nextFollowing ? 'Artist followed' : 'Artist unfollowed',
        nextFollowing
          ? `You are now following ${artistName}.`
          : `You have unfollowed ${artistName}.`
      )
      return
    }

    setSavingFollow(true)
    const nextFollowing = !artist.isFollowing

    try {
      const response = await fetch(apiUrl(`/artists/${artist.id}/follow`), {
        method: nextFollowing ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })

      const result = (await response.json().catch((): FollowResponse => ({}))) as FollowResponse

      if (response.status === 401) {
        clearAuthSession()
        setAuthToken(null)
        throw new Error('Your session expired. Please sign in again.')
      }

      if (
        !response.ok ||
        typeof result.isFollowing !== 'boolean' ||
        !Number.isSafeInteger(result.followerCount)
      ) {
        throw new Error(result.error || 'Follow status could not be updated.')
      }

      setProfileState((current) =>
        current.artist
          ? {
              ...current,
              artist: {
                ...current.artist,
                isFollowing: result.isFollowing!,
                followerCount: result.followerCount!,
              },
            }
          : current
      )

      toast.success(
        result.isFollowing ? 'Artist followed' : 'Artist unfollowed',
        result.isFollowing
          ? `You are now following ${artistName}.`
          : `You no longer follow ${artistName}.`
      )
    } catch (cause) {
      toast.error(
        'Follow action failed',
        cause instanceof Error ? cause.message : 'Please check your connection and try again.'
      )
    } finally {
      setSavingFollow(false)
    }
  }

  // Share profile handler
  const handleShare = async () => {
    const shareData = {
      title: `${artistName} — Showpeice Independent Artist`,
      text: artist?.bio || `Discover original artworks by ${artistName} on Showpeice.`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url)
        toast.success('Link copied', 'Artist profile link copied to clipboard.')
        return
      }
      toast.info('Share Profile', window.location.href)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      toast.error('Could not share profile', 'Please copy the URL directly.')
    }
  }

  // Loading state
  if (loading) {
    return <PublicArtistProfileSkeleton />
  }

  // Error state
  if (error || !artist) {
    return (
      <main className="spotify-artist-page">
        <div className="spotify-artist-status-wrap" role="alert">
          <h2>Profile Unavailable</h2>
          <p>{error || 'The requested artist profile could not be found or has been made private.'}</p>
          <button type="button" className="spotify-status-button" onClick={() => setLoadAttempt(value => value + 1)}>Try again</button>
          <Link to="/artists" className="spotify-status-button">
            <ArrowLeft size={16} /> Return to Directory
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="spotify-artist-page" aria-label={`${artistName} profile`}>
      {/* ====================================================================
          1. Spotify-Inspired Cinematic Hero Section
          ==================================================================== */}
      <section className="spotify-artist-hero" aria-labelledby="artist-hero-name">
        <div className="spotify-hero-backdrop" aria-hidden="true">
          {heroBackdrop && (
            <img
              className="spotify-hero-backdrop-img"
              src={heroBackdrop}
              alt=""
              loading="eager"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        <div className="spotify-hero-overlay" aria-hidden="true" />

        {/* Top Breadcrumb Bar */}
        <div className="spotify-hero-top">
          <Link to="/artists" className="spotify-back-link">
            <ArrowLeft size={14} /> Back to Independent Artists
          </Link>
          {isSampleArtist && (
            <div className="spotify-hero-sample-badge">
              <Sparkles size={12} /> Curated Preview Profile
            </div>
          )}
        </div>

        {/* Hero Bottom Content Area */}
        <div className="spotify-hero-content">
          <div className="spotify-verified-badge">
            <span className="badge-icon">
              <Check size={12} strokeWidth={3} />
            </span>
            <span>Verified Artist</span>
          </div>

          <h1 id="artist-hero-name" className="spotify-artist-title">
            {artistName}
          </h1>

          <div className="spotify-artist-meta">
            {artist.location && (
              <span className="spotify-meta-item">
                <MapPin size={14} className="spotify-meta-icon" />
                {artist.location}
              </span>
            )}

            {artist.medium && (
              <>
                <span className="spotify-meta-dot" aria-hidden="true">
                  ·
                </span>
                <span className="spotify-meta-item specialty">{artist.medium}</span>
              </>
            )}

            <span className="spotify-meta-dot" aria-hidden="true">
              ·
            </span>
            <span className="spotify-meta-item">
              <strong>{artist.followerCount.toLocaleString('en-IN')}</strong>{' '}
              {artist.followerCount === 1 ? 'follower' : 'followers'}
            </span>

            <span className="spotify-meta-dot" aria-hidden="true">
              ·
            </span>
            <span className="spotify-meta-item">
              <strong>{artist.artworks.length}</strong>{' '}
              {artist.artworks.length === 1 ? 'original work' : 'original works'}
            </span>
          </div>

          {artist.shopAnnouncement && <p className="spotify-shop-announcement">{artist.shopAnnouncement}</p>}

          {/* Action Row */}
          <div className="spotify-hero-actions">
            <button
              type="button"
              className={`spotify-follow-button${artist.isFollowing ? ' is-following' : ''}`}
              onClick={handleFollowToggle}
              disabled={savingFollow || artist.isOwnProfile}
              aria-pressed={artist.isFollowing}
              title={
                artist.isOwnProfile
                  ? 'You cannot follow your own artist profile'
                  : !authToken && !isSampleArtist
                  ? 'Sign in to follow this artist'
                  : undefined
              }
            >
              {artist.isFollowing ? (
                <>
                  <Check size={15} strokeWidth={2.5} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <Plus size={15} strokeWidth={2.5} />
                  <span>Follow Artist</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="spotify-secondary-button"
              onClick={() => setIsContactOpen(true)}
            >
              <Mail size={15} />
              <span>Contact Artist</span>
            </button>

            <button
              type="button"
              className="spotify-icon-button"
              onClick={handleShare}
              aria-label="Share profile"
              title="Share profile"
            >
              <Share2 size={16} />
            </button>

            {isSampleArtist && (
              <button
                type="button"
                className="spotify-secondary-button"
                onClick={() => setIsSampleEditorOpen(true)}
              >
                <PencilLine size={15} />
                <span>Edit Preview</span>
              </button>
            )}

            {artist.isOwnProfile && (
              <Link to="/artist/dashboard" className="spotify-secondary-button">
                <PencilLine size={15} />
                <span>Edit in Studio</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Spotify-Style Tab Navigation
          ==================================================================== */}
      <nav className="spotify-artist-nav" aria-label="Artist profile sections">
        <div className="spotify-tabs-track">
          <button
            type="button"
            className={`spotify-tab-button${activeTab === 'overview' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
            aria-current={activeTab === 'overview' ? 'page' : undefined}
          >
            <span>Overview</span>
            {activeTab === 'overview' && (
              <motion.span
                className="spotify-tab-indicator"
                layoutId="spotifyActiveTab"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35 }
                }
              />
            )}
          </button>

          <button
            type="button"
            className={`spotify-tab-button${activeTab === 'artworks' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('artworks')}
            aria-current={activeTab === 'artworks' ? 'page' : undefined}
          >
            <span>Artworks</span>
            <span className="spotify-tab-count">{artist.artworks.length}</span>
            {activeTab === 'artworks' && (
              <motion.span
                className="spotify-tab-indicator"
                layoutId="spotifyActiveTab"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35 }
                }
              />
            )}
          </button>

          <button
            type="button"
            className={`spotify-tab-button${activeTab === 'about' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('about')}
            aria-current={activeTab === 'about' ? 'page' : undefined}
          >
            <span>About</span>
            {activeTab === 'about' && (
              <motion.span
                className="spotify-tab-indicator"
                layoutId="spotifyActiveTab"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35 }
                }
              />
            )}
          </button>
        </div>
      </nav>

      {/* ====================================================================
          3. Tab Content Panels
          ==================================================================== */}
      <div className="spotify-artist-body">
        <AnimatePresence mode="wait">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Featured Artworks (Spotify Popular tracks equivalent) */}
              <section className="spotify-overview-section" aria-labelledby="featured-artworks-title">
                <div className="spotify-section-header">
                  <div>
                    <span className="spotify-section-kicker">Curated Selection</span>
                    <h2 id="featured-artworks-title" className="spotify-section-title">
                      Featured Artworks
                    </h2>
                  </div>
                  {artist.artworks.length > 0 && (
                    <button
                      type="button"
                      className="spotify-section-link"
                      onClick={() => {
                        setActiveTab('artworks')
                        window.scrollTo({ top: 380, behavior: 'smooth' })
                      }}
                    >
                      <span>View All Works ({artist.artworks.length})</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {featuredArtworks.length > 0 ? (
                  <div className="spotify-artwork-grid">
                    {featuredArtworks.map((item) => (
                      <article key={item.id} className="spotify-artwork-card">
                        <Link
                          to={artworkDetailPath(artist, item)}
                          className="spotify-artwork-thumb-wrap"
                          aria-label={`View ${item.title}`}
                        >
                          {item.imageUrl ? (
                            <ProtectedArtworkImage
                              isProtected={item.isProtected}
                              className="spotify-artwork-img"
                              src={resolveImageUrl(item.imageUrl, fallbackHeroImage)}
                              alt={item.title}
                              loading="lazy"
                            />
                          ) : (
                            <div className="spotify-artwork-fallback">
                              <span>Original Artwork</span>
                            </div>
                          )}
                          <div className="spotify-artwork-overlay">
                            <span className="spotify-artwork-badge">Original</span>
                            <span className="spotify-artwork-cta">
                              Explore <ArrowUpRight size={13} />
                            </span>
                          </div>
                        </Link>

                        <div className="spotify-artwork-info">
                          <span className="spotify-artwork-category">{item.category}</span>
                          <h3 className="spotify-artwork-title">
                            <Link to={artworkDetailPath(artist, item)}>{item.title}</Link>
                          </h3>
                          <div className="spotify-artwork-footer">
                            <span className="spotify-artwork-price">{formatPrice(item.price)}</span>
                            <Link
                              to={artworkDetailPath(artist, item)}
                              className="spotify-artwork-action"
                              aria-label={`View details of ${item.title}`}
                            >
                              <ArrowUpRight size={16} />
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="spotify-empty-artworks">
                    <h3>No published artworks yet</h3>
                    <p>This artist is currently curating their initial collection for Showpeice.</p>
                  </div>
                )}
              </section>

              {/* Artist Statement Spotlight Card */}
              {artist.bio && (
                <section className="spotify-statement-card" aria-label="Artist statement">
                  <span className="spotify-statement-kicker">Artist Statement</span>
                  <blockquote className="spotify-statement-quote">
                    &ldquo;{artist.bio}&rdquo;
                  </blockquote>
                  <cite className="spotify-statement-author">
                    — {artistName}
                    {artist.location ? `, ${artist.location}` : ''}
                  </cite>
                </section>
              )}

              {/* Disciplines & Specialties */}
              {artist.medium && (
                <div className="spotify-disciplines-wrap">
                  <span className="spotify-section-kicker">Artistic Disciplines</span>
                  <div className="spotify-disciplines-list">
                    <span className="spotify-discipline-pill">{artist.medium}</span>
                    {categories
                      .filter((c) => c !== 'All' && c !== artist.medium)
                      .map((cat) => (
                        <span key={cat} className="spotify-discipline-pill">
                          {cat}
                        </span>
                      ))}
                    <span className="spotify-discipline-pill">Original Works</span>
                    <span className="spotify-discipline-pill">Showpeice Certified</span>
                  </div>
                </div>
              )}

              {/* Quick Stats Area (Real backend metrics only) */}
              <section className="spotify-quick-stats" aria-label="Artist metrics">
                <div className="spotify-stat-cell">
                  <span className="spotify-stat-value">
                    {artist.followerCount.toLocaleString('en-IN')}
                  </span>
                  <span className="spotify-stat-label">Followers</span>
                </div>
                <div className="spotify-stat-cell">
                  <span className="spotify-stat-value">{artist.artworks.length}</span>
                  <span className="spotify-stat-label">Published Originals</span>
                </div>
                <div className="spotify-stat-cell">
                  <span className="spotify-stat-value">{artist.location || 'Global'}</span>
                  <span className="spotify-stat-label">Studio Base</span>
                </div>
                <div className="spotify-stat-cell">
                  <span className="spotify-stat-value">
                    {artist.createdAt
                      ? new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: 'short' }).format(
                          new Date(artist.createdAt)
                        )
                      : 'Verified Maker'}
                  </span>
                  <span className="spotify-stat-label">Artist on Showpeice</span>
                </div>
              </section>
            </motion.div>
          )}

          {/* TAB 2: ARTWORKS (Full Collection) */}
          {activeTab === 'artworks' && (
            <motion.div
              key="artworks"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="spotify-artworks-toolbar">
                <div className="spotify-category-filters">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`spotify-filter-pill${selectedCategory === cat ? ' is-active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Sort by:</span>
                  <select
                    className="spotify-sort-select"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as 'newest' | 'price-asc' | 'price-desc' | 'title'
                      )
                    }
                  >
                    <option value="newest">Recently Added</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="title">Title: A-Z</option>
                  </select>
                </label>
              </div>

              {processedArtworks.length > 0 ? (
                <div className="spotify-artwork-grid">
                  {processedArtworks.map((item) => (
                    <article key={item.id} className="spotify-artwork-card">
                      <Link
                        to={artworkDetailPath(artist, item)}
                        className="spotify-artwork-thumb-wrap"
                        aria-label={`View ${item.title}`}
                      >
                        {item.imageUrl ? (
                          <ProtectedArtworkImage
                            isProtected={item.isProtected}
                            className="spotify-artwork-img"
                            src={resolveImageUrl(item.imageUrl, fallbackHeroImage)}
                            alt={item.title}
                            loading="lazy"
                          />
                        ) : (
                          <div className="spotify-artwork-fallback">
                            <span>Original Artwork</span>
                          </div>
                        )}
                        <div className="spotify-artwork-overlay">
                          <span className="spotify-artwork-badge">Original</span>
                          <span className="spotify-artwork-cta">
                            Explore <ArrowUpRight size={13} />
                          </span>
                        </div>
                      </Link>

                      <div className="spotify-artwork-info">
                        <span className="spotify-artwork-category">{item.category}</span>
                        <h3 className="spotify-artwork-title">
                          <Link to={artworkDetailPath(artist, item)}>{item.title}</Link>
                        </h3>
                        <div className="spotify-artwork-footer">
                          <span className="spotify-artwork-price">{formatPrice(item.price)}</span>
                          <Link
                            to={artworkDetailPath(artist, item)}
                            className="spotify-artwork-action"
                            aria-label={`View details of ${item.title}`}
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="spotify-empty-artworks">
                  <h3>No artworks found</h3>
                  <p>
                    No works match the &ldquo;{selectedCategory}&rdquo; filter. Select a different
                    category to explore the collection.
                  </p>
                  <button
                    type="button"
                    className="spotify-filter-pill"
                    style={{ marginTop: '16px' }}
                    onClick={() => setSelectedCategory('All')}
                  >
                    Show all artworks
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: ABOUT (Spotify-Style Editorial Layout) */}
          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="spotify-about-layout"
            >
              {/* Left Column: Portrait & In-depth Biography */}
              <div className="spotify-about-main">
                <div className="spotify-about-portrait-card">
                  <img
                    className="spotify-about-portrait-img"
                    src={portraitUrl}
                    alt={`Portrait of ${artistName}`}
                  />
                  <div className="spotify-about-portrait-caption">
                    <div>
                      <strong>{artistName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--sp-accent)' }}>
                        {artist.medium || 'Independent Artist'}
                      </div>
                    </div>
                    {artist.location && (
                      <span style={{ fontSize: '12px', color: '#FFF' }}>{artist.location}</span>
                    )}
                  </div>
                </div>

                <div className="spotify-about-bio-card">
                  <span className="spotify-section-kicker">Biography</span>
                  <h3>About the Practice</h3>
                  <p className="spotify-about-bio-text">
                    {artist.bio ||
                      `${artistName} is an independent artist dedicated to the exploration of form, texture, and creative intention. Works by this maker are certified and represented through the Showpeice collection.`}
                  </p>
                </div>
              </div>

              {/* Right Column: Verified Status, Details, Links & Stats */}
              <aside className="spotify-about-aside">
                {/* Verified Artist Card */}
                <div className="spotify-about-card">
                  <div className="spotify-verified-cert-box">
                    <span className="spotify-cert-icon">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <div className="spotify-cert-copy">
                      <h4>Verified Independent Artist</h4>
                      <p>
                        Identity confirmed and artworks independently catalogued for Showpeice
                        collectors.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Studio Details */}
                <div className="spotify-about-card">
                  <div className="spotify-about-card-title">Studio Overview</div>
                  <dl className="spotify-detail-rows">
                    <div className="spotify-detail-row">
                      <dt>Primary Medium</dt>
                      <dd>{artist.medium || 'Independent Fine Art'}</dd>
                    </div>
                    <div className="spotify-detail-row">
                      <dt>Studio Location</dt>
                      <dd>{artist.location || 'Showpeice Studio'}</dd>
                    </div>
                    <div className="spotify-detail-row">
                      <dt>Available Originals</dt>
                      <dd>{artist.artworks.length} pieces</dd>
                    </div>
                    <div className="spotify-detail-row">
                      <dt>Collectors Following</dt>
                      <dd>{artist.followerCount.toLocaleString('en-IN')}</dd>
                    </div>
                    {artist.createdAt && (
                      <div className="spotify-detail-row">
                        <dt>Represented Since</dt>
                        <dd>
                          {new Intl.DateTimeFormat('en-IN', {
                            year: 'numeric',
                            month: 'long',
                          }).format(new Date(artist.createdAt))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Official Artist Links */}
                {(artist.websiteUrl || artist.instagramUrl || artist.publicEmail) && (
                  <div className="spotify-about-card">
                    <div className="spotify-about-card-title">Presence & Channels</div>
                    <div className="spotify-links-list">
                      {artist.publicEmail && (
                        <a href={`mailto:${artist.publicEmail}`} className="spotify-social-link">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={15} /> Email
                          </span>
                          <span>{artist.publicEmail}</span>
                        </a>
                      )}
                      {artist.websiteUrl && (
                        <a
                          href={artist.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="spotify-social-link"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Globe size={15} /> Official Portfolio
                          </span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {artist.instagramUrl && (
                        <a
                          href={artist.instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="spotify-social-link"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <FaInstagram size={15} /> Instagram
                          </span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Direct Action */}
                <button
                  type="button"
                  className="spotify-follow-button"
                  style={{ width: '100%' }}
                  onClick={() => setIsContactOpen(true)}
                >
                  <Mail size={16} /> Inquire with {artistName.split(' ')[0]}
                </button>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ====================================================================
          4. Contact Artist Inquiry Modal
          ==================================================================== */}
      <ContactArtistModal
        isOpen={isContactOpen}
        artistName={artistName}
        instagramUrl={artist.instagramUrl}
        websiteUrl={artist.websiteUrl}
        onClose={() => setIsContactOpen(false)}
      />

      {/* ====================================================================
          5. Sample Profile Local Editor (for Elena Moreau)
          ==================================================================== */}
      {isSampleArtist && (
        <SampleProfileEditorModal
          isOpen={isSampleEditorOpen}
          artist={artist}
          onSave={(updated) => {
            setProfileState((current) =>
              current.artist
                ? {
                    ...current,
                    artist: {
                      ...current.artist,
                      ...updated,
                    },
                  }
                : current
            )
          }}
          onClose={() => setIsSampleEditorOpen(false)}
        />
      )}
    </main>
  )
}

function PublicArtistProfileSkeleton() {
  return (
    <main className="spotify-artist-page spotify-profile-skeleton" role="status" aria-label="Loading artist profile" aria-busy="true">
      <section className="spotify-artist-hero" aria-hidden="true">
        <div className="spotify-hero-backdrop"><Skeleton className="spotify-profile-skeleton-backdrop"/></div>
        <div className="spotify-hero-top">
          <Skeleton shape="text" className="spotify-profile-skeleton-back-link"/>
          <Skeleton shape="text" className="spotify-profile-skeleton-share"/>
        </div>
        <div className="spotify-hero-content">
          <Skeleton shape="text" className="spotify-profile-skeleton-verified"/>
          <Skeleton className="spotify-profile-skeleton-title"/>
          <div className="spotify-profile-skeleton-meta"><Skeleton shape="text"/><Skeleton shape="text"/><Skeleton shape="text"/></div>
          <Skeleton className="spotify-profile-skeleton-announcement"/>
          <div className="spotify-hero-actions"><Skeleton className="spotify-profile-skeleton-button"/><Skeleton className="spotify-profile-skeleton-button spotify-profile-skeleton-button-short"/></div>
        </div>
      </section>
      <nav className="spotify-artist-nav" aria-hidden="true">
        <div className="spotify-tabs-track"><Skeleton className="spotify-profile-skeleton-tab"/><Skeleton className="spotify-profile-skeleton-tab"/><Skeleton className="spotify-profile-skeleton-tab"/></div>
      </nav>
      <div className="spotify-artist-body" aria-hidden="true">
        <div className="spotify-quick-stats spotify-profile-skeleton-stats">
          {Array.from({ length: 4 }, (_, index) => <div className="spotify-profile-skeleton-stat" key={index}><Skeleton shape="text"/><Skeleton shape="text"/></div>)}
        </div>
        <section className="spotify-profile-skeleton-artworks">
          <div className="spotify-section-header"><div><Skeleton shape="text" className="spotify-profile-skeleton-section-kicker"/><Skeleton className="spotify-profile-skeleton-section-title"/></div><Skeleton shape="text" className="spotify-profile-skeleton-view-all"/></div>
          <div className="spotify-artwork-grid">{Array.from({ length: 4 }, (_, index) => <ArtworkCardSkeleton className="spotify-profile-skeleton-card" key={index}/>)}</div>
        </section>
      </div>
    </main>
  )
}
