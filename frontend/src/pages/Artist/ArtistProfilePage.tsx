import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import { toast } from '../../components/ui/toast'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { MorphButton } from '@/components/spectrumui/morph-button'
import { ArtworkFileUpload } from './ArtworkFileUpload'
import './ArtistProfilePage.css'

export type ArtistProfileUser = {
  id: number
  slug: string
  firstName: string
  lastName: string
  email: string
  role: string
  createdAt: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  medium: string | null
  location: string | null
  instagramUrl: string | null
  websiteUrl: string | null
  emailNotifications: boolean
  publicProfileVisible: boolean
}

export type ArtistProfileStats = {
  totalArtworks: number
  publishedArtworks: number
  draftArtworks: number
  views: number | null
}

type ProfileForm = Omit<ArtistProfileUser, 'id' | 'slug' | 'role' | 'createdAt'>

type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type Props = {
  user: ArtistProfileUser | null
  stats: ArtistProfileStats | null
  token: string
  onUserUpdated: (user: ArtistProfileUser) => void
}

function resolveProfileImageUrl(imageUrl: string): string {
  return imageUrl.startsWith('/') ? apiAssetUrl(imageUrl) : imageUrl
}

const emptyPassword: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const maxProfileImageSize = 10 * 1024 * 1024

function validateProfileImage(file: File): string | null {
  const fallbackType = /\.png$/i.test(file.name)
    ? 'image/png'
    : /\.jpe?g$/i.test(file.name)
      ? 'image/jpeg'
      : ''
  const mimeType = file.type || fallbackType

  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    return 'Choose a PNG or JPEG image.'
  }
  if (file.size > maxProfileImageSize) {
    return 'Choose an image that is 10 MB or smaller.'
  }
  return null
}

async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json()
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function responseErrorMessage(
  payload: Record<string, unknown>,
  response: Response,
  fallback: string,
): string {
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }
  return `${fallback} (HTTP ${response.status}).`
}

function toProfileForm(user: ArtistProfileUser): ProfileForm {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    medium: user.medium ?? '',
    location: user.location ?? '',
    instagramUrl: user.instagramUrl ?? '',
    websiteUrl: user.websiteUrl ?? '',
    emailNotifications: user.emailNotifications,
    publicProfileVisible: user.publicProfileVisible,
  }
}

export function ArtistProfilePage({ user, stats, token, onUserUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security'>('overview')
  const [form, setForm] = useState<ProfileForm | null>(() => (user ? toProfileForm(user) : null))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarFileError, setAvatarFileError] = useState('')
  const [avatarUploadSuccess, setAvatarUploadSuccess] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerFileError, setBannerFileError] = useState('')
  const [bannerUploadSuccess, setBannerUploadSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const profileFormRef = useRef<HTMLFormElement | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState(emptyPassword)
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const prefersReducedMotion = useReducedMotion()

  if (!user) {
    return (
      <section className="artist-studio-profile artist-studio-empty" role="status">
        <h2>Artist Studio Profile Unavailable</h2>
        <p>Your authenticated artist credentials could not be loaded. Please refresh your session.</p>
      </section>
    )
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim()
  const displayName = user.displayName?.trim() || fullName
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() || 'A'
  const publicProfileUrl = `${window.location.origin}/artist/${user.slug}`

  const bannerBackdrop = user.bannerUrl
    ? resolveProfileImageUrl(user.bannerUrl)
    : null

  const copyPublicLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicProfileUrl)
        toast.success('Profile URL copied', 'Share your public artist profile link with collectors.')
        return
      }
      toast.info('Public Profile Link', publicProfileUrl)
    } catch {
      toast.info('Public Profile Link', publicProfileUrl)
    }
  }

  const handleAvatarFileSelected = (file: File | null) => {
    if (!file) {
      setAvatarFile(null)
      setAvatarFileError('')
      setAvatarUploadSuccess(false)
      return
    }
    const validationError = validateProfileImage(file)
    setAvatarFileError(validationError || '')
    if (validationError) return

    setAvatarFile(file)
    setAvatarUploadSuccess(false)
  }

  const handleBannerFileSelected = (file: File | null) => {
    if (!file) {
      setBannerFile(null)
      setBannerFileError('')
      setBannerUploadSuccess(false)
      return
    }
    const validationError = validateProfileImage(file)
    setBannerFileError(validationError || '')
    if (validationError) return

    setBannerFile(file)
    setBannerUploadSuccess(false)
  }

  const saveProfile = async (): Promise<boolean> => {
    if (!form || savingRef.current) return false
    savingRef.current = true
    setError('')
    setSaving(true)

    try {
      const hasNewAvatar = Boolean(avatarFile)
      const hasNewBanner = Boolean(bannerFile)
      let avatarUrl = form.avatarUrl
      let bannerUrl = form.bannerUrl

      if (avatarFile) {
        const mimeType =
          avatarFile.type ||
          (avatarFile.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')

        const uploadResponse = await fetch(apiUrl('/artist/uploads/profile'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': mimeType,
          },
          body: avatarFile,
        })

        const uploadResult = await readApiResponse(uploadResponse)
        if (!uploadResponse.ok) {
          throw new Error(responseErrorMessage(uploadResult, uploadResponse, 'Profile image upload failed'))
        }
        if (typeof uploadResult.imageUrl !== 'string' || !uploadResult.imageUrl.startsWith('https://res.cloudinary.com/')) {
          throw new Error('The image service returned an invalid secure image URL. Please try again.')
        }
        avatarUrl = uploadResult.imageUrl
      }

      if (bannerFile) {
        const mimeType =
          bannerFile.type ||
          (bannerFile.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')

        const uploadResponse = await fetch(apiUrl('/artist/uploads/banner'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': mimeType,
          },
          body: bannerFile,
        })

        const uploadResult = await readApiResponse(uploadResponse)
        if (!uploadResponse.ok) {
          throw new Error(responseErrorMessage(uploadResult, uploadResponse, 'Banner image upload failed'))
        }
        if (typeof uploadResult.imageUrl !== 'string' || !uploadResult.imageUrl.startsWith('https://res.cloudinary.com/')) {
          throw new Error('The image service returned an invalid secure image URL. Please try again.')
        }
        bannerUrl = uploadResult.imageUrl
      }

      const response = await fetch(apiUrl('/artist/profile'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, avatarUrl, bannerUrl }),
      })

      const result = await readApiResponse(response)
      if (!response.ok) {
        throw new Error(responseErrorMessage(result, response, 'Your profile could not be saved'))
      }
      if (!result.user || typeof result.user !== 'object' || Array.isArray(result.user)) {
        throw new Error('The profile service returned an invalid response. Please try again.')
      }

      const updatedUser = result.user as ArtistProfileUser
      onUserUpdated(updatedUser)
      setForm(toProfileForm(updatedUser))
      setAvatarFile(null)
      setAvatarFileError('')
      setAvatarUploadSuccess(hasNewAvatar)
      setBannerFile(null)
      setBannerFileError('')
      setBannerUploadSuccess(hasNewBanner)
      toast.success(
        hasNewAvatar ? 'Avatar image saved' : hasNewBanner ? 'Banner image saved' : 'Studio profile updated',
        hasNewAvatar ? 'Your portrait is live on your artist profile.' : hasNewBanner ? 'Your cover image is live on your artist profile.' : 'Your profile changes are live on Showpeice.',
      )
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Please try again.'
      setError(message)
      toast.error('Profile update failed', message)
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSaveProfile = async (): Promise<boolean> => {
    if (!profileFormRef.current?.reportValidity()) return false
    return saveProfile()
  }

  const submitProfileForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleSaveProfile().then((succeeded) => {
      if (succeeded) setActiveTab('overview')
    })
  }

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')

    if (password.newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for your new password.')
      return
    }
    if (password.newPassword !== password.confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }

    setSavingPassword(true)

    try {
      const response = await fetch(apiUrl('/artist/profile/password'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || 'Password could not be changed.')
      }

      setPassword(emptyPassword)
      toast.success('Password updated', 'Your new account password is now active.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Please try again.'
      setPasswordError(message)
      toast.error('Password change failed', message)
    } finally {
      setSavingPassword(false)
    }
  }

  const currentForm = form || toProfileForm(user)

  return (
    <section className="artist-studio-profile" aria-label="Artist Studio Profile">
      {/* ====================================================================
          1. Spotify-Style Cinematic Artist Hero Banner (Studio Edition)
          ==================================================================== */}
      <section className="artist-studio-hero" aria-labelledby="artist-studio-name">
        <div className="artist-studio-hero-backdrop" aria-hidden="true">
          {bannerBackdrop && (
            <img
              className="artist-studio-hero-backdrop-img"
              src={bannerBackdrop}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>
        <div className="artist-studio-hero-overlay" aria-hidden="true" />

        {/* Top Badges & Public Profile Link */}
        <div className="artist-studio-hero-top">
          <div className="artist-studio-verified-pill">
            <span className="pill-check">
              <svg className="pill-check-mark" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </span>
            <span>Verified Artist Studio</span>
          </div>

          <div className="artist-studio-status-pills">
            <button
              type="button"
              className="artist-studio-copy-link"
              onClick={copyPublicLink}
              title="Copy public artist link"
            >
              <span>/artist/{user.slug}</span>
              <Copy size={12} />
            </button>
          </div>
        </div>

        {/* Hero Identity Block */}
        <div className="artist-studio-hero-content">
          <div className="artist-studio-identity-block">
            <div className="artist-studio-avatar-wrap">
              <div className="artist-studio-avatar">
                {user.avatarUrl ? (
                  <img
                    className="artist-studio-avatar-img"
                    src={resolveProfileImageUrl(user.avatarUrl)}
                    alt={`${displayName} profile`}
                  />
                ) : (
                  <span className="artist-studio-monogram">{initials}</span>
                )}
              </div>
              {user.publicProfileVisible && <span className="artist-studio-avatar-status" role="status" aria-label="Public profile live" />}
            </div>

            <div className="artist-studio-copy">
              <span className="artist-studio-kicker">Artist Studio Profile</span>
              <h1 id="artist-studio-name" className="artist-studio-title">
                {displayName}
              </h1>

              <div className="artist-studio-meta">
                {user.location && (
                  <span className="artist-studio-meta-item">
                    <MapPin size={13} style={{ color: 'var(--asp-accent)' }} />
                    {user.location}
                  </span>
                )}
                {user.medium && (
                  <>
                    <span className="artist-studio-meta-dot">·</span>
                    <span className="artist-studio-meta-item specialty">{user.medium}</span>
                  </>
                )}
                <span className="artist-studio-meta-dot">·</span>
                <span className="artist-studio-meta-item">
                  {fullName} ({user.email})
                </span>
              </div>

              {user.bio && <p className="artist-studio-bio-snippet">{user.bio}</p>}
            </div>
          </div>

          {/* Action Row */}
          <div className="artist-studio-hero-actions">
            <button
              type="button"
              className="artist-studio-primary-button"
              onClick={() => {
                setForm(toProfileForm(user))
                setActiveTab(activeTab === 'edit' ? 'overview' : 'edit')
              }}
            >
              <PencilLine size={15} />
              <span>{activeTab === 'edit' ? 'Close Editor' : 'Edit Profile'}</span>
            </button>

            <Link
              to={`/artist/${user.slug}`}
              className="artist-studio-secondary-button"
              target="_blank"
              rel="noreferrer"
            >
              <span>View Public Profile</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Studio Statistics Overview
          ==================================================================== */}
      <section className="artist-studio-stats-grid" aria-label="Studio Statistics">
        <article className="artist-studio-stat-card">
          <div className="artist-studio-stat-label">
            <ImageIcon size={15} />
            <span>Total Artworks</span>
          </div>
          <strong>{stats?.totalArtworks ?? 0}</strong>
          <small>Pieces in your studio</small>
        </article>

        <article className="artist-studio-stat-card">
          <div className="artist-studio-stat-label">
            <Sparkles size={15} />
            <span>Published Works</span>
          </div>
          <strong>{stats?.publishedArtworks ?? 0}</strong>
          <small>Live on Showpeice Gallery</small>
        </article>

        <article className="artist-studio-stat-card">
          <div className="artist-studio-stat-label">
            <PencilLine size={15} />
            <span>Draft Pieces</span>
          </div>
          <strong>{stats?.draftArtworks ?? 0}</strong>
          <small>Unpublished works in progress</small>
        </article>

        <article className="artist-studio-stat-card">
          <div className="artist-studio-stat-label">
            <Eye size={15} />
            <span>Artwork Views</span>
          </div>
          <strong>{stats?.views != null ? stats.views.toLocaleString('en-IN') : '—'}</strong>
          <small>Collector impressions</small>
        </article>
      </section>

      {/* ====================================================================
          3. Sub-Navigation Tabs
          ==================================================================== */}
      <nav className="artist-studio-tabs-bar" aria-label="Profile management sections">
        <button
          type="button"
          className={`artist-studio-tab-btn${activeTab === 'overview' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span>Studio Overview</span>
          {activeTab === 'overview' && (
            <motion.span
              className="artist-studio-tab-indicator"
              layoutId="studioProfileTab"
              transition={
                prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
              }
            />
          )}
        </button>

        <button
          type="button"
          className={`artist-studio-tab-btn${activeTab === 'edit' ? ' is-active' : ''}`}
          onClick={() => {
            setForm(toProfileForm(user))
            setActiveTab('edit')
          }}
        >
          <span>Edit Profile</span>
          {activeTab === 'edit' && (
            <motion.span
              className="artist-studio-tab-indicator"
              layoutId="studioProfileTab"
              transition={
                prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
              }
            />
          )}
        </button>

        <button
          type="button"
          className={`artist-studio-tab-btn${activeTab === 'security' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span>Security & Password</span>
          {activeTab === 'security' && (
            <motion.span
              className="artist-studio-tab-indicator"
              layoutId="studioProfileTab"
              transition={
                prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
              }
            />
          )}
        </button>
      </nav>

      {/* ====================================================================
          4. Content Panels
          ==================================================================== */}
      <AnimatePresence mode="wait">
        {/* PANEL 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="artist-studio-grid-2col"
          >
            {/* Left Card: Practice Details */}
            <article className="artist-studio-card">
              <header className="artist-studio-card-header">
                <div>
                  <span className="artist-studio-kicker">Practice & Identity</span>
                  <h3>Artist Information</h3>
                </div>
                <button
                  type="button"
                  className="artist-studio-secondary-button"
                  style={{ minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
                  onClick={() => {
                    setForm(toProfileForm(user))
                    setActiveTab('edit')
                  }}
                >
                  <PencilLine size={13} /> Edit
                </button>
              </header>

              <dl className="artist-studio-detail-list">
                <div className="artist-studio-detail-item">
                  <dt>Display Name</dt>
                  <dd>{displayName}</dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Artistic Specialty</dt>
                  <dd>{user.medium || 'Not specified'}</dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Studio Location</dt>
                  <dd>{user.location || 'Not specified'}</dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Artist Statement</dt>
                  <dd className="bio-text">
                    {user.bio || 'Introduce your background, philosophy, and artistic practice.'}
                  </dd>
                </div>
              </dl>
            </article>

            {/* Right Card: Public Presence & Links */}
            <article className="artist-studio-card">
              <header className="artist-studio-card-header">
                <div>
                  <span className="artist-studio-kicker">Collector Discovery</span>
                  <h3>Public Presence & Links</h3>
                </div>
              </header>

              <dl className="artist-studio-detail-list">
                <div className="artist-studio-detail-item">
                  <dt>Public Profile</dt>
                  <dd>
                    <Link to={`/artist/${user.slug}`} target="_blank" rel="noreferrer">
                      View public profile <ArrowUpRight size={13} />
                    </Link>
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Instagram</dt>
                  <dd>
                    {user.instagramUrl ? (
                      <a href={user.instagramUrl} target="_blank" rel="noreferrer">
                        <FaInstagram size={14} /> Open Instagram <ExternalLink size={12} />
                      </a>
                    ) : (
                      'Not added yet'
                    )}
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Portfolio Website</dt>
                  <dd>
                    {user.websiteUrl ? (
                      <a href={user.websiteUrl} target="_blank" rel="noreferrer">
                        <Globe size={14} /> Open Portfolio <ExternalLink size={12} />
                      </a>
                    ) : (
                      'Not added yet'
                    )}
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Visibility Status</dt>
                  <dd>
                    {user.publicProfileVisible ? (
                      <span style={{ color: 'var(--asp-accent)' }}>Visible to all collectors</span>
                    ) : (
                      <span style={{ color: 'var(--asp-text-muted)' }}>
                        Hidden from public directory
                      </span>
                    )}
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Represented Since</dt>
                  <dd>
                    {new Intl.DateTimeFormat('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(user.createdAt))}
                  </dd>
                </div>
              </dl>
            </article>
          </motion.div>
        )}

        {/* PANEL 2: EDIT PROFILE FORM */}
        {activeTab === 'edit' && (
          <motion.form
            key="edit"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="artist-studio-edit-panel"
            ref={profileFormRef}
            onSubmit={submitProfileForm}
          >
            <div className="artist-studio-card-header">
              <div>
                <span className="artist-studio-kicker">Account & Portfolio Details</span>
                <h3>Edit Artist Profile</h3>
              </div>
              <button
                type="button"
                className="artist-studio-secondary-button"
                style={{ minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
                onClick={() => {
                  setBannerFile(null)
                  setBannerFileError('')
                  setAvatarFile(null)
                  setAvatarFileError('')
                  setActiveTab('overview')
                }}
              >
                Cancel
              </button>
            </div>

            <div className="artist-studio-form-grid">
              <div className="artist-studio-image-uploads">
                <div className="artist-studio-form-field artist-studio-image-field">
                  <label>Artist Portrait / Profile Image</label>
                  <ArtworkFileUpload
                    variant="avatar"
                    file={avatarFile}
                    onFileChange={handleAvatarFileSelected}
                    existingImageUrl={currentForm.avatarUrl ? resolveProfileImageUrl(currentForm.avatarUrl) : null}
                    disabled={saving}
                    uploading={saving && Boolean(avatarFile)}
                    error={avatarFileError}
                    uploadSuccess={avatarUploadSuccess}
                  />
                </div>

                <div className="artist-studio-form-field artist-studio-image-field">
                  <label>Artist Banner / Cover Image</label>
                  <ArtworkFileUpload
                    variant="banner"
                    file={bannerFile}
                    onFileChange={handleBannerFileSelected}
                    existingImageUrl={currentForm.bannerUrl ? resolveProfileImageUrl(currentForm.bannerUrl) : null}
                    disabled={saving}
                    uploading={saving && Boolean(bannerFile)}
                    error={bannerFileError}
                    uploadSuccess={bannerUploadSuccess}
                  />
                </div>
              </div>

              {/* First Name & Last Name */}
              <div className="artist-studio-form-field">
                <label htmlFor="edit-first-name">First Name</label>
                <input
                  id="edit-first-name"
                  required
                  maxLength={80}
                  value={currentForm.firstName}
                  onChange={(e) => setForm({ ...currentForm, firstName: e.target.value })}
                />
              </div>

              <div className="artist-studio-form-field">
                <label htmlFor="edit-last-name">Last Name</label>
                <input
                  id="edit-last-name"
                  required
                  maxLength={80}
                  value={currentForm.lastName}
                  onChange={(e) => setForm({ ...currentForm, lastName: e.target.value })}
                />
              </div>

              {/* Email Address */}
              <div className="artist-studio-form-field">
                <label htmlFor="edit-email">Account Email</label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={currentForm.email}
                  onChange={(e) => setForm({ ...currentForm, email: e.target.value })}
                />
              </div>

              {/* Public Display Name */}
              <div className="artist-studio-form-field">
                <label htmlFor="edit-display-name">Artist Display Name</label>
                <input
                  id="edit-display-name"
                  maxLength={80}
                  placeholder="e.g. Elena Moreau Studio"
                  value={currentForm.displayName ?? ''}
                  onChange={(e) => setForm({ ...currentForm, displayName: e.target.value })}
                />
              </div>

              {/* Specialty & Location */}
              <div className="artist-studio-form-field">
                <label htmlFor="edit-medium">Primary Medium / Specialty</label>
                <input
                  id="edit-medium"
                  maxLength={100}
                  placeholder="e.g. Oil on Linen, Sculpture, Mixed Media"
                  value={currentForm.medium ?? ''}
                  onChange={(e) => setForm({ ...currentForm, medium: e.target.value })}
                />
              </div>

              <div className="artist-studio-form-field">
                <label htmlFor="edit-location">Studio Location</label>
                <input
                  id="edit-location"
                  maxLength={120}
                  placeholder="e.g. Paris, France"
                  value={currentForm.location ?? ''}
                  onChange={(e) => setForm({ ...currentForm, location: e.target.value })}
                />
              </div>

              {/* External URLs */}
              <div className="artist-studio-form-field">
                <label htmlFor="edit-instagram">Instagram Profile URL</label>
                <input
                  id="edit-instagram"
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={currentForm.instagramUrl ?? ''}
                  onChange={(e) => setForm({ ...currentForm, instagramUrl: e.target.value })}
                />
              </div>

              <div className="artist-studio-form-field">
                <label htmlFor="edit-website">Portfolio Website URL</label>
                <input
                  id="edit-website"
                  type="url"
                  placeholder="https://..."
                  value={currentForm.websiteUrl ?? ''}
                  onChange={(e) => setForm({ ...currentForm, websiteUrl: e.target.value })}
                />
              </div>

              {/* Artist Biography Statement */}
              <div className="artist-studio-form-field is-wide">
                <label htmlFor="edit-bio">Artist Statement / Biography</label>
                <textarea
                  id="edit-bio"
                  rows={5}
                  maxLength={2000}
                  placeholder="Share your artistic background, philosophical approach, and current work focus..."
                  value={currentForm.bio ?? ''}
                  onChange={(e) => setForm({ ...currentForm, bio: e.target.value })}
                />
                <span className="artist-studio-char-count">
                  {(currentForm.bio ?? '').length} / 2000 characters
                </span>
              </div>

              {/* Checkboxes */}
              <div className="artist-studio-checkbox-field">
                <input
                  id="edit-public-visible"
                  type="checkbox"
                  checked={currentForm.publicProfileVisible}
                  onChange={(e) =>
                    setForm({ ...currentForm, publicProfileVisible: e.target.checked })
                  }
                />
                <label htmlFor="edit-public-visible">
                  <span>Public Profile Visible in Directory</span>
                  <small>
                    When enabled, collectors can discover your profile and purchase published
                    artworks.
                  </small>
                </label>
              </div>

              <div className="artist-studio-checkbox-field">
                <input
                  id="edit-email-notifications"
                  type="checkbox"
                  checked={currentForm.emailNotifications}
                  onChange={(e) =>
                    setForm({ ...currentForm, emailNotifications: e.target.checked })
                  }
                />
                <label htmlFor="edit-email-notifications">
                  <span>Collector Inquiries & Notifications Preference</span>
                  <small>Receive updates when new collectors follow your artist profile.</small>
                </label>
              </div>
            </div>

            {error && <div className="artist-studio-form-error">{error}</div>}

            <div className="artist-studio-form-actions">
              <button
                type="button"
                className="artist-studio-secondary-button"
                onClick={() => setActiveTab('overview')}
                disabled={saving}
              >
                Cancel
              </button>
              <MorphButton
                onAction={handleSaveProfile}
                loadingLabel="Saving"
                successLabel="Saved"
                successDuration={1200}
                onSuccess={() => setActiveTab('overview')}
                className="artist-studio-primary-button"
                type="submit"
                disabled={saving}
              >
                Save changes
              </MorphButton>
            </div>
          </motion.form>
        )}

        {/* PANEL 3: SECURITY & PASSWORD */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="artist-studio-grid-2col"
          >
            {/* Change Password Card */}
            <article className="artist-studio-card">
              <header className="artist-studio-card-header">
                <div>
                  <span className="artist-studio-kicker">Security Credentials</span>
                  <h3>Update Password</h3>
                </div>
                <Lock size={18} style={{ color: 'var(--asp-accent)' }} />
              </header>

              <form className="artist-studio-password-box" onSubmit={updatePassword}>
                <div className="artist-studio-form-field">
                  <label htmlFor="current-password">Current Password</label>
                  <input
                    id="current-password"
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password.currentPassword}
                    onChange={(e) =>
                      setPassword({ ...password, currentPassword: e.target.value })
                    }
                  />
                </div>

                <div className="artist-studio-form-field">
                  <label htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={password.newPassword}
                    onChange={(e) =>
                      setPassword({ ...password, newPassword: e.target.value })
                    }
                  />
                  <small style={{ fontSize: '11px', color: 'var(--asp-text-muted)' }}>
                    Use at least 8 characters with a mix of letters and numbers.
                  </small>
                </div>

                <div className="artist-studio-form-field">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <input
                    id="confirm-password"
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={password.confirmPassword}
                    onChange={(e) =>
                      setPassword({ ...password, confirmPassword: e.target.value })
                    }
                  />
                </div>

                {passwordError && (
                  <div className="artist-studio-form-error">{passwordError}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="submit"
                    className="artist-studio-primary-button"
                    disabled={savingPassword}
                  >
                    {savingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </article>

            {/* Account Security Information Card */}
            <article className="artist-studio-card">
              <header className="artist-studio-card-header">
                <div>
                  <span className="artist-studio-kicker">Authentication</span>
                  <h3>Account Security</h3>
                </div>
                <ShieldCheck size={18} style={{ color: 'var(--asp-accent)' }} />
              </header>

              <dl className="artist-studio-detail-list">
                <div className="artist-studio-detail-item">
                  <dt>Sign-in Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Account Role</dt>
                  <dd style={{ textTransform: 'capitalize' }}>
                    {user.role} (Verified Showpeice Maker)
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Registration Date</dt>
                  <dd>
                    {new Intl.DateTimeFormat('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(user.createdAt))}
                  </dd>
                </div>
                <div className="artist-studio-detail-item">
                  <dt>Session State</dt>
                  <dd style={{ color: 'var(--asp-accent)' }}>Active Authenticated Studio</dd>
                </div>
              </dl>
            </article>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
