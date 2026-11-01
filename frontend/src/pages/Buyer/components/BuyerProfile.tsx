import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import {
  Camera,
  Loader2,
  Check,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react'
import type { BuyerUser } from '../types'
import { buyerApi, resolveImageUrl } from '../buyerApi'
import { toast } from '../../../components/ui/toast'

type Props = {
  user: BuyerUser
  token: string
  onUserUpdated: (user: BuyerUser) => void
}

type FormErrors = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  displayName?: string
  bio?: string
  location?: string
}

export function BuyerProfile({ user, token, onUserUpdated }: Props) {
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [lastName, setLastName] = useState(user.lastName || '')
  const [displayName, setDisplayName] = useState(user.displayName || '')
  const [email, setEmail] = useState(user.email || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [bio, setBio] = useState(user.bio || '')
  const [location, setLocation] = useState(user.location || '')
  const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications || false)

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const validate = (): boolean => {
    const errs: FormErrors = {}

    if (!firstName.trim()) {
      errs.firstName = 'First name is required.'
    } else if (firstName.trim().length > 80) {
      errs.firstName = 'First name must not exceed 80 characters.'
    }

    if (!lastName.trim()) {
      errs.lastName = 'Last name is required.'
    } else if (lastName.trim().length > 80) {
      errs.lastName = 'Last name must not exceed 80 characters.'
    }

    if (!email.trim()) {
      errs.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email address.'
    }

    if (phone.trim() && !/^[+0-9\s\-()]{7,30}$/.test(phone.trim())) {
      errs.phone = 'Please provide a valid phone number (7-30 digits/symbols).'
    }

    if (displayName.trim().length > 80) {
      errs.displayName = 'Display name must not exceed 80 characters.'
    }

    if (bio.trim().length > 2000) {
      errs.bio = 'Bio must not exceed 2000 characters.'
    }

    if (location.trim().length > 120) {
      errs.location = 'Location must not exceed 120 characters.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Invalid image', 'Please select a PNG or JPEG file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', 'Avatar must be 10 MB or smaller.')
      return
    }

    setUploadingAvatar(true)
    try {
      const result = await buyerApi.uploadAvatar(token, file)
      setAvatarUrl(result.imageUrl)
      const updatedUser: BuyerUser = { ...user, avatarUrl: result.imageUrl }
      onUserUpdated(updatedUser)
      toast.success('Avatar updated', 'Your new profile photo has been saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      toast.error('Avatar upload failed', msg)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!validate()) {
      return
    }

    setIsSaving(true)
    try {
      const result = await buyerApi.updateProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        emailNotifications,
        avatarUrl: avatarUrl || null,
      })

      onUserUpdated(result.user)
      setStatusMessage({ type: 'success', text: 'Profile changes saved successfully.' })
      toast.success('Profile saved', 'Your collector information has been updated.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.'
      setStatusMessage({ type: 'error', text: msg })
      toast.error('Update failed', msg)
    } finally {
      setIsSaving(false)
    }
  }

  const memberSince = (() => {
    try {
      return new Date(user.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
      })
    } catch {
      return '—'
    }
  })()

  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '—'

  return (
    <section aria-label="Buyer Profile Management">
      <div className="buyer-section-header">
        <span className="buyer-kicker">ACCOUNT INFORMATION</span>
        <h1 className="buyer-title">My Profile</h1>
        <p className="buyer-subtitle">
          Manage your personal collector credentials, delivery contact details, and platform preferences.
        </p>
      </div>

      <div className="buyer-profile-layout">
        {/* Left Column: Profile Card */}
        <div className="buyer-profile-card">
          <div className="buyer-avatar-upload-wrap">
            <div className="buyer-avatar-large">
              {avatarUrl ? (
                <img
                  src={resolveImageUrl(avatarUrl)}
                  alt={`${firstName} ${lastName}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>

            <button
              type="button"
              className="buyer-avatar-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Upload profile photo"
              title="Change profile photo"
            >
              {uploadingAvatar ? <Loader2 size={15} className="buyer-spin" /> : <Camera size={15} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <h3>{displayName.trim() || `${firstName} ${lastName}`.trim()}</h3>
          <p>{email}</p>

          <div style={{ marginTop: '20px', textAlign: 'left', borderTop: '1px solid var(--buyer-sand-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--buyer-muted)' }}>
                <Phone size={14} />
                <span>{phone}</span>
              </div>
            )}
            {location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--buyer-muted)' }}>
                <MapPin size={14} />
                <span>{location}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--buyer-muted)' }}>
              <Calendar size={14} />
              <span>Collector since {memberSince}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="buyer-form-panel">
          <form onSubmit={handleSubmit} noValidate>
            {statusMessage && (
              <div
                className={`buyer-form-status is-${statusMessage.type}`}
                role="status"
              >
                {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="buyer-form-grid">
              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="firstName">
                  First Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  className={`buyer-input ${errors.firstName ? 'is-invalid' : ''}`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Eleanor"
                  required
                />
                {errors.firstName && <span className="buyer-field-error">{errors.firstName}</span>}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="lastName">
                  Last Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  className={`buyer-input ${errors.lastName ? 'is-invalid' : ''}`}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Vance"
                  required
                />
                {errors.lastName && <span className="buyer-field-error">{errors.lastName}</span>}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="displayName">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  className={`buyer-input ${errors.displayName ? 'is-invalid' : ''}`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Public or collector moniker"
                />
                {errors.displayName && <span className="buyer-field-error">{errors.displayName}</span>}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="email">
                  Email Address <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className={`buyer-input ${errors.email ? 'is-invalid' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                />
                {errors.email && <span className="buyer-field-error">{errors.email}</span>}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={`buyer-input ${errors.phone ? 'is-invalid' : ''}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                />
                {errors.phone && <span className="buyer-field-error">{errors.phone}</span>}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="location">
                  City / Location
                </label>
                <input
                  id="location"
                  type="text"
                  className={`buyer-input ${errors.location ? 'is-invalid' : ''}`}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Mumbai, Maharashtra"
                />
                {errors.location && <span className="buyer-field-error">{errors.location}</span>}
              </div>

              <div className="buyer-form-group buyer-form-full">
                <label className="buyer-form-label" htmlFor="bio">
                  Collector Statement / Bio
                </label>
                <textarea
                  id="bio"
                  className={`buyer-input buyer-textarea ${errors.bio ? 'is-invalid' : ''}`}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell artists about your art taste, aesthetics, or collection interests..."
                  rows={4}
                />
                {errors.bio && <span className="buyer-field-error">{errors.bio}</span>}
              </div>

              <div className="buyer-form-group buyer-form-full">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--buyer-charcoal)' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--buyer-charcoal)' }}>
                    Subscribe to email notifications for order updates and new collection releases
                  </span>
                </label>
              </div>
            </div>

            <div className="buyer-form-actions">
              <button
                type="submit"
                className="buyer-btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="buyer-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
