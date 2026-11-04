import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import {
  Camera,
  Loader2,
  Check,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  RotateCcw,
} from 'lucide-react'
import type { BuyerUser } from '../types'
import { buyerApi, resolveImageUrl } from '../buyerApi'
import { toast } from '../../../components/ui/toast'

/**
 * Component styles, rendered through the <style> tag below so everything lives in this one file.
 */
const PROFILE_CSS = `
/* BuyerProfile enhancements */

/* Layout: let the right column shrink, give the card a sane width */
.buyer-profile-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); /* minmax(0, ...) stops grid blowout */
  gap: 24px;
  align-items: start;
}

@media (max-width: 900px) {
  .buyer-profile-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Profile card: contain everything inside it */
.buyer-profile-card {
  min-width: 0;
  overflow: hidden;
  text-align: center;
}

.buyer-profile-name {
  margin: 0 0 4px;
  overflow-wrap: anywhere;
}

/* THE EMAIL FIX: long addresses wrap instead of running past the card edge.
   Emails have no natural break points, so overflow-wrap: anywhere breaks at any character. */
.buyer-profile-email {
  margin: 0;
  padding: 0 4px;
  max-width: 100%;
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Contact meta list */
.buyer-profile-meta {
  list-style: none;
  margin: 20px 0 0;
  padding: 16px 0 0;
  border-top: 1px solid var(--buyer-sand-light);
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.buyer-profile-meta li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--buyer-muted);
}

.buyer-profile-meta svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.buyer-profile-meta span {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* Avatar */
.buyer-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.buyer-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Form bits */
.buyer-required {
  color: #dc2626;
}

.buyer-field-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-top: 6px;
}

.buyer-field-footer .buyer-field-error {
  margin-top: 0;
}

.buyer-char-count {
  margin-left: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--buyer-muted);
}

.buyer-char-count.is-over {
  color: #dc2626;
}

.buyer-checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.buyer-checkbox-row input {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  accent-color: var(--buyer-charcoal);
}

.buyer-checkbox-row span {
  font-size: 13px;
  color: var(--buyer-charcoal);
}

/* Actions row */
.buyer-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.buyer-unsaved-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--buyer-muted);
}

.buyer-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font: inherit;
  font-size: 13px;
  color: var(--buyer-charcoal);
  background: transparent;
  border: 1px solid var(--buyer-sand-light);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.buyer-btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--buyer-muted);
}

.buyer-btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.buyer-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Keyboard focus */
.buyer-btn-secondary:focus-visible,
.buyer-avatar-upload-btn:focus-visible,
.buyer-checkbox-row input:focus-visible {
  outline: 2px solid var(--buyer-charcoal);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .buyer-btn-secondary {
    transition: none;
  }
}
`

type Props = {
  user: BuyerUser
  token: string
  onUserUpdated: (user: BuyerUser) => void
}

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'displayName'
  | 'bio'
  | 'location'

type FormErrors = Partial<Record<FieldName, string>>

type FormValues = Record<FieldName, string> & { emailNotifications: boolean }

const LIMITS = { name: 80, bio: 2000, location: 120 } as const

const toFormValues = (u: BuyerUser): FormValues => ({
  firstName: u.firstName || '',
  lastName: u.lastName || '',
  displayName: u.displayName || '',
  email: u.email || '',
  phone: u.phone || '',
  bio: u.bio || '',
  location: u.location || '',
  emailNotifications: Boolean(u.emailNotifications),
})

/** Validates one field. Returns an error message or undefined. */
function validateField(name: FieldName, raw: string): string | undefined {
  const value = raw.trim()

  switch (name) {
    case 'firstName':
      if (!value) return 'First name is required.'
      if (value.length > LIMITS.name) return `First name must not exceed ${LIMITS.name} characters.`
      return
    case 'lastName':
      if (!value) return 'Last name is required.'
      if (value.length > LIMITS.name) return `Last name must not exceed ${LIMITS.name} characters.`
      return
    case 'displayName':
      if (value.length > LIMITS.name) return `Display name must not exceed ${LIMITS.name} characters.`
      return
    case 'email':
      if (!value) return 'Email address is required.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please provide a valid email address.'
      if (value.length > 254) return 'Email address is too long.'
      return
    case 'phone': {
      if (!value) return
      const digits = value.replace(/\D/g, '').length
      if (!/^[+0-9\s\-()]+$/.test(value) || digits < 7 || digits > 15) {
        return 'Enter a valid phone number with 7–15 digits.'
      }
      return
    }
    case 'location':
      if (value.length > LIMITS.location) return `Location must not exceed ${LIMITS.location} characters.`
      return
    case 'bio':
      if (value.length > LIMITS.bio) return `Bio must not exceed ${LIMITS.bio} characters.`
      return
  }
}

const FIELD_ORDER: FieldName[] = [
  'firstName',
  'lastName',
  'displayName',
  'email',
  'phone',
  'location',
  'bio',
]

export function BuyerProfile({ user, token, onUserUpdated }: Props) {
  // `baseline` is the last saved state; it powers the "unsaved changes" logic.
  const [baseline, setBaseline] = useState<FormValues>(() => toFormValues(user))
  const [values, setValues] = useState<FormValues>(() => toFormValues(user))

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDirty = useMemo(
    () => (Object.keys(baseline) as (keyof FormValues)[]).some((k) => baseline[k] !== values[k]),
    [baseline, values],
  )

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Auto-dismiss the success banner.
  useEffect(() => {
    if (statusMessage?.type !== 'success') return
    const t = window.setTimeout(() => setStatusMessage(null), 5000)
    return () => window.clearTimeout(t)
  }, [statusMessage])

  const setField = <K extends keyof FormValues>(name: K, value: FormValues[K]) => {
    if (statusMessage?.type === 'success') setStatusMessage(null)
    setValues((prev) => ({ ...prev, [name]: value }))
    // Once a field has shown an error, re-check it live so it clears as soon as it's fixed.
    if (name !== 'emailNotifications' && errors[name as FieldName]) {
      const msg = validateField(name as FieldName, value as string)
      setErrors((prev) => ({ ...prev, [name]: msg }))
    }
  }

  const handleBlur = (name: FieldName) => {
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values[name]) }))
  }

  const validateAll = (): FieldName | null => {
    const next: FormErrors = {}
    for (const f of FIELD_ORDER) {
      const msg = validateField(f, values[f])
      if (msg) next[f] = msg
    }
    setErrors(next)
    return FIELD_ORDER.find((f) => next[f]) ?? null
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Invalid image', 'Please select a PNG or JPEG file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', 'Avatar must be 10 MB or smaller.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingAvatar(true)
    try {
      const result = await buyerApi.uploadAvatar(token, file)
      setAvatarUrl(result.imageUrl)
      onUserUpdated({ ...user, avatarUrl: result.imageUrl })
      toast.success('Avatar updated', 'Your new profile photo has been saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      toast.error('Avatar upload failed', msg)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReset = () => {
    setValues(baseline)
    setErrors({})
    setStatusMessage(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    const firstInvalid = validateAll()
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setIsSaving(true)
    try {
      const result = await buyerApi.updateProfile(token, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        displayName: values.displayName.trim() || null,
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || null,
        bio: values.bio.trim() || null,
        location: values.location.trim() || null,
        emailNotifications: values.emailNotifications,
        avatarUrl: avatarUrl || null,
      })

      const saved = toFormValues(result.user)
      setBaseline(saved)
      setValues(saved)
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

  const memberSince = useMemo(() => {
    const date = new Date(user.createdAt)
    // `new Date('garbage')` doesn't throw — it yields an Invalid Date, so check explicitly.
    if (!user.createdAt || Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
  }, [user.createdAt])

  const { firstName, lastName, displayName, email, phone, location, bio } = values
  const fullName = `${firstName} ${lastName}`.trim()
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '—'

  // Shared props for every text field: wiring for a11y + validation behaviour.
  const fieldProps = (name: FieldName) => ({
    id: name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(name, e.target.value),
    onBlur: () => handleBlur(name),
    className: `buyer-input ${errors[name] ? 'is-invalid' : ''}`,
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  })

  const renderError = (name: FieldName) =>
    errors[name] ? (
      <span id={`${name}-error`} className="buyer-field-error" role="alert">
        {errors[name]}
      </span>
    ) : null

  return (
    <section aria-label="Buyer Profile Management">
      <style>{PROFILE_CSS}</style>
      <div className="buyer-section-header">
        <h1 className="buyer-title">My Profile</h1>
      </div>

      <div className="buyer-profile-layout">
        {/* Left column: profile summary card */}
        <aside className="buyer-profile-card" aria-label="Profile summary">
          <div className="buyer-avatar-upload-wrap">
            <div className="buyer-avatar-large">
              {avatarUrl ? (
                <img
                  src={resolveImageUrl(avatarUrl)}
                  alt={fullName || 'Profile photo'}
                  className="buyer-avatar-img"
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
              title="Change profile photo (PNG or JPEG, max 10 MB)"
            >
              {uploadingAvatar ? <Loader2 size={15} className="buyer-spin" /> : <Camera size={15} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="buyer-visually-hidden"
              tabIndex={-1}
              onChange={handleAvatarChange}
            />
          </div>

          <h3 className="buyer-profile-name" title={displayName.trim() || fullName}>
            {displayName.trim() || fullName || 'Your name'}
          </h3>

          {/* Long emails wrap instead of overflowing the card. */}
          <p className="buyer-profile-email" title={email}>
            {email}
          </p>

          <ul className="buyer-profile-meta">
            {phone.trim() && (
              <li>
                <Phone size={14} aria-hidden="true" />
                <span>{phone}</span>
              </li>
            )}
            {location.trim() && (
              <li>
                <MapPin size={14} aria-hidden="true" />
                <span>{location}</span>
              </li>
            )}
            {memberSince && (
              <li>
                <Calendar size={14} aria-hidden="true" />
                <span>Collector since {memberSince}</span>
              </li>
            )}
          </ul>
        </aside>

        {/* Right column: edit form */}
        <div className="buyer-form-panel">
          <form onSubmit={handleSubmit} noValidate>
            {statusMessage && (
              <div className={`buyer-form-status is-${statusMessage.type}`} role="status">
                {statusMessage.type === 'success' ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <AlertCircle size={16} aria-hidden="true" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="buyer-form-grid">
              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="firstName">
                  First Name <span className="buyer-required">*</span>
                </label>
                <input
                  {...fieldProps('firstName')}
                  type="text"
                  autoComplete="given-name"
                  placeholder="e.g. Eleanor"
                  required
                />
                {renderError('firstName')}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="lastName">
                  Last Name <span className="buyer-required">*</span>
                </label>
                <input
                  {...fieldProps('lastName')}
                  type="text"
                  autoComplete="family-name"
                  placeholder="e.g. Vance"
                  required
                />
                {renderError('lastName')}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="displayName">
                  Display Name
                </label>
                <input
                  {...fieldProps('displayName')}
                  type="text"
                  autoComplete="nickname"
                  placeholder="Public or collector moniker"
                />
                {renderError('displayName')}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="email">
                  Email Address <span className="buyer-required">*</span>
                </label>
                <input
                  {...fieldProps('email')}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@domain.com"
                  required
                />
                {renderError('email')}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  {...fieldProps('phone')}
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +91 98765 43210"
                />
                {renderError('phone')}
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="location">
                  City / Location
                </label>
                <input
                  {...fieldProps('location')}
                  type="text"
                  autoComplete="address-level2"
                  placeholder="e.g. Mumbai, Maharashtra"
                />
                {renderError('location')}
              </div>

              <div className="buyer-form-group buyer-form-full">
                <label className="buyer-form-label" htmlFor="bio">
                  Collector Statement / Bio
                </label>
                <textarea
                  {...fieldProps('bio')}
                  className={`buyer-input buyer-textarea ${errors.bio ? 'is-invalid' : ''}`}
                  placeholder="Tell artists about your art taste, aesthetics, or collection interests..."
                  rows={4}
                />
                <div className="buyer-field-footer">
                  {renderError('bio') ?? <span />}
                  <span
                    className={`buyer-char-count ${bio.length > LIMITS.bio ? 'is-over' : ''}`}
                    aria-live="polite"
                  >
                    {bio.length} / {LIMITS.bio}
                  </span>
                </div>
              </div>

              <div className="buyer-form-group buyer-form-full">
                <label className="buyer-checkbox-row">
                  <input
                    type="checkbox"
                    checked={values.emailNotifications}
                    onChange={(e) => setField('emailNotifications', e.target.checked)}
                  />
                  <span>
                    Subscribe to email notifications for order updates and new collection releases
                  </span>
                </label>
              </div>
            </div>

            <div className="buyer-form-actions">
              {isDirty && !isSaving && (
                <span className="buyer-unsaved-hint">You have unsaved changes</span>
              )}

              {isDirty && (
                <button
                  type="button"
                  className="buyer-btn-secondary"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Discard changes</span>
                </button>
              )}

              <button
                type="submit"
                className="buyer-btn-primary"
                disabled={isSaving || !isDirty}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="buyer-spin" />
                    <span>Saving changes...</span>
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