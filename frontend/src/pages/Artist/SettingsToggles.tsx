import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, LockKeyhole, Trash2 } from 'lucide-react'
import { MorphButton } from '../../components/spectrumui/morph-button'
import { toast } from '../../components/ui/toast'
import { Switch } from '../../components/ui/Switch'
import { ArtistSettingsSkeleton } from './ArtistLoadingSkeletons'
import { apiUrl } from '../../lib/api'
import { clearAuthSession } from '../../lib/authSession'
import './SettingsToggles.css'

type ArtistSettings = {
  displayName: string | null
  bio: string | null
  shopAnnouncement: string | null
  emailNotifications: boolean
  publicProfileVisible: boolean
  weeklyDigest: boolean
  orderNotifications: boolean
  publicEmailVisible: boolean
}

type ArtistSettingsResponse = { settings?: unknown; error?: string }
type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string }

const emptyPassword: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

async function readError(response: Response) {
  const result = await response.json().catch(() => ({})) as { error?: string; message?: string }
  return result.error || result.message || `Request failed (HTTP ${response.status}).`
}

function parseSettings(value: unknown): ArtistSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('The server returned incomplete artist settings. Please retry.')
  }
  const candidate = value as Record<string, unknown>
  const optionalText = (field: string) => candidate[field] === null || typeof candidate[field] === 'string'
  if (
    !optionalText('displayName') ||
    !optionalText('bio') ||
    !optionalText('shopAnnouncement') ||
    typeof candidate.emailNotifications !== 'boolean' ||
    typeof candidate.publicProfileVisible !== 'boolean' ||
    typeof candidate.weeklyDigest !== 'boolean' ||
    typeof candidate.orderNotifications !== 'boolean' ||
    typeof candidate.publicEmailVisible !== 'boolean'
  ) {
    throw new Error('The server returned incomplete artist settings. Please retry.')
  }
  return {
    displayName: typeof candidate.displayName === 'string' ? candidate.displayName : '',
    bio: typeof candidate.bio === 'string' ? candidate.bio : '',
    shopAnnouncement: typeof candidate.shopAnnouncement === 'string' ? candidate.shopAnnouncement : '',
    emailNotifications: candidate.emailNotifications,
    publicProfileVisible: candidate.publicProfileVisible,
    weeklyDigest: candidate.weeklyDigest,
    orderNotifications: candidate.orderNotifications,
    publicEmailVisible: candidate.publicEmailVisible,
  }
}

type SettingsTogglesProps = {
  token: string
  onLogout: () => void
  onDirtyChange: (dirty: boolean) => void
  onUserUpdated: (user: { displayName: string | null; bio: string | null; emailNotifications: boolean; publicProfileVisible: boolean }) => void
}

export function SettingsToggles({ token, onLogout, onDirtyChange, onUserUpdated }: SettingsTogglesProps) {
  const id = useId()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<ArtistSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<ArtistSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState<PasswordForm>(emptyPassword)
  const [passwordConfirmationOpen, setPasswordConfirmationOpen] = useState(false)
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false)

  const settingsDirty = useMemo(() => Boolean(settings && savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings)), [settings, savedSettings])
  const dirty = settingsDirty || Boolean(password.currentPassword || password.newPassword || password.confirmPassword)

  useEffect(() => {
    document.body.classList.add('artist-settings-toast-position')
    return () => document.body.classList.remove('artist-settings-toast-position')
  }, [])

  useEffect(() => {
    onDirtyChange(dirty)
    if (!dirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty, onDirtyChange])

  const loadSettings = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(apiUrl('/artist/settings'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        clearAuthSession()
        onLogout()
        return
      }
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json() as ArtistSettingsResponse
      const normalized = parseSettings(result.settings)
      setSettings(normalized)
      setSavedSettings(normalized)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Settings could not be loaded.'
      setLoadError(message)
      toast.error('Settings could not be loaded', message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSettings)
    // Load once for the authenticated token; a retry uses the page action below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const saveSettings = async () => {
    if (!settings || !settingsDirty) return false
    try {
      const response = await fetch(apiUrl('/artist/settings'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (response.status === 401) {
        clearAuthSession()
        onLogout()
        return false
      }
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json() as ArtistSettingsResponse
      const normalized = parseSettings(result.settings)
      setSettings(normalized)
      setSavedSettings(normalized)
      onUserUpdated({
        displayName: normalized.displayName || null,
        bio: normalized.bio || null,
        emailNotifications: normalized.emailNotifications,
        publicProfileVisible: normalized.publicProfileVisible,
      })
      toast.success('Settings saved', 'Your artist settings are now up to date.')
      return true
    } catch (cause) {
      toast.error('Settings could not be saved', cause instanceof Error ? cause.message : 'Please try again.')
      return false
    }
  }

  const changePassword = async () => {
    if (password.newPassword.length < 8 || password.newPassword.length > 128) {
      toast.error('Password change failed', 'Use a new password between 8 and 128 characters.')
      return false
    }
    if (password.newPassword !== password.confirmPassword) {
      toast.error('Password change failed', 'The new password and confirmation do not match.')
      return false
    }
    try {
      const response = await fetch(apiUrl('/artist/profile/password'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }),
      })
      if (response.status === 401) {
        clearAuthSession()
        onLogout()
        return false
      }
      if (!response.ok) throw new Error(await readError(response))
      setPassword(emptyPassword)
      setPasswordConfirmationOpen(false)
      toast.success('Password updated', 'Your new password is active.')
      return true
    } catch (cause) {
      toast.error('Password change failed', cause instanceof Error ? cause.message : 'Please try again.')
      setPasswordConfirmationOpen(false)
      return false
    }
  }

  const downloadMyData = async () => {
    try {
      const response = await fetch(apiUrl('/artist/data-export'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        clearAuthSession()
        onLogout()
        return false
      }
      if (!response.ok) throw new Error(await readError(response))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'showpeice-artist-data.json'
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Your data is ready', 'Downloaded your account and artwork data.')
      return true
    } catch (cause) {
      toast.error('Data export failed', cause instanceof Error ? cause.message : 'Please try again.')
      return false
    }
  }

  const deleteAccount = async () => {
    if (deletePhrase !== 'DELETE' || !deletePassword) return
    setDeleteBusy(true)
    try {
      const response = await fetch(apiUrl('/artist/account'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePassword, confirmation: deletePhrase }),
      })
      if (response.status === 401) {
        clearAuthSession()
        onLogout()
        return
      }
      if (!response.ok) throw new Error(await readError(response))
      toast.success('Account deleted', 'Your account and eligible artwork data have been removed.')
      clearAuthSession()
      navigate('/')
    } catch (cause) {
      toast.error('Account could not be deleted', cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const updateSetting = <Key extends keyof ArtistSettings>(key: Key, value: ArtistSettings[Key]) => {
    setSettings(current => current ? { ...current, [key]: value } : current)
  }

  const updatePassword = (key: keyof PasswordForm, value: string) => {
    setPassword(current => ({ ...current, [key]: value }))
  }

  const settingRow = (key: 'emailNotifications' | 'weeklyDigest' | 'orderNotifications' | 'publicProfileVisible' | 'publicEmailVisible', title: string, description: string) => {
    const titleId = `${id}-${key}-title`
    const descriptionId = `${id}-${key}-description`
    return <div className="artist-settings-row" key={key}>
      <div className="artist-settings-copy">
        <span className="artist-settings-title" id={titleId}>{title}</span>
        <span className="artist-settings-description" id={descriptionId}>{description}</span>
      </div>
      <Switch
        className={`artist-settings-switch${settings?.[key] ? ' is-on' : ''}`}
        checked={settings?.[key] ?? false}
        onCheckedChange={value => updateSetting(key, value)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        disabled={loading || !settings}
      />
    </div>
  }

  return (
    <section className="artist-settings" aria-label="Artist settings">
      {loading ? <ArtistSettingsSkeleton /> : loadError ? <div className="artist-settings-state" role="alert">
        <p>{loadError}</p><button type="button" className="artist-settings-secondary" onClick={() => void loadSettings()}>Try again</button>
      </div> : settings && <>
        <div className="artist-settings-savebar">
          <span className={dirty ? 'artist-settings-dirty' : 'artist-settings-clean'} role="status">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <MorphButton
            className="artist-settings-save"
            onAction={saveSettings}
            loadingLabel="SAVING"
            successLabel="SAVED"
            disabled={!dirty}
          >
            SAVE SETTINGS
          </MorphButton>
        </div>

        <section className="artist-settings-section" aria-labelledby={`${id}-preferences`}>
          <header><h2 id={`${id}-preferences`}>Preferences</h2><p>Choose the account emails you want Showpeice to send.</p></header>
          <div className="artist-settings-panel">
            {settingRow('emailNotifications', 'Email notifications', 'Product updates and account announcements.')}
            {settingRow('weeklyDigest', 'Weekly digest', 'A weekly summary of your sales and studio activity.')}
            {settingRow('orderNotifications', 'Order notifications', 'Email preferences for new orders, payments, and cancellations.')}
          </div>
          <p className="artist-settings-note">Preferences are saved to your account. Email delivery and weekly digest scheduling are not configured in the current backend.</p>
        </section>

        <section className="artist-settings-section" aria-labelledby={`${id}-security`}>
          <header><h2 id={`${id}-security`}>Security</h2><p>Update your account password.</p></header>
          <div className="artist-settings-panel artist-settings-fields">
            <label>Current password<input type="password" autoComplete="current-password" value={password.currentPassword} onChange={event => updatePassword('currentPassword', event.target.value)} /></label>
            <div className="artist-settings-two-columns">
              <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.newPassword} onChange={event => updatePassword('newPassword', event.target.value)} /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.confirmPassword} onChange={event => updatePassword('confirmPassword', event.target.value)} /></label>
            </div>
            <p className="artist-settings-note">Passwords must be 8–128 characters. Existing JWT sessions remain active until their one-hour expiry; the current stateless authentication system does not support session listing or remote revocation.</p>
            <button type="button" className="artist-settings-secondary" disabled={!password.currentPassword || !password.newPassword || !password.confirmPassword} onClick={() => setPasswordConfirmationOpen(true)}>
              <LockKeyhole size={15} /> Change password
            </button>
          </div>
        </section>

        <section className="artist-settings-section" aria-labelledby={`${id}-privacy`}>
          <header><h2 id={`${id}-privacy`}>Privacy</h2><p>Control the account details visible on your public profile.</p></header>
          <div className="artist-settings-panel">
            {settingRow('publicEmailVisible', 'Show my email publicly', 'Display your account email on your public artist profile.')}
          </div>
        </section>

        <section className="artist-settings-section" aria-labelledby={`${id}-account`}>
          <header><h2 id={`${id}-account`}>Account</h2><p>Export your data or manage access to your artist account.</p></header>
          <div className="artist-settings-account-actions">
            <div><h3>Download my data</h3><p>Export your account details, saved preferences, and artworks as JSON.</p></div>
            <MorphButton className="artist-settings-secondary" onAction={downloadMyData} loadingLabel="Preparing export" successLabel="Downloaded">
              <Download size={15} /> Download my data
            </MorphButton>
          </div>
          <div className="artist-account-settings">
            <div>
              <span className="artist-account-settings-kicker">SIGN OUT</span>
              <h2>Sign out of your studio</h2>
              <p>End this session on this device. You can sign in again at any time.</p>
            </div>
            <button type="button" className="artist-logout-button" onClick={() => setLogoutConfirmationOpen(true)}>Log Out</button>
          </div>
          <div className="artist-settings-account-actions is-danger">
            <div><h3>Delete account</h3><p>Deletion is permanent. Accounts with order history are retained for marketplace records and require support assistance.</p></div>
            <button type="button" className="artist-settings-delete" onClick={() => setDeleteConfirmationOpen(true)}><Trash2 size={15} /> Delete account</button>
          </div>
        </section>
      </>}

      {passwordConfirmationOpen && <div className="artist-confirmation-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPasswordConfirmationOpen(false) }}>
        <section className="artist-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-password-confirm-title`}>
          <h2 id={`${id}-password-confirm-title`}>Change your password?</h2>
          <p>Your current password will be replaced. Confirm to save this change.</p>
          <div className="artist-confirmation-dialog-actions">
            <button type="button" className="artist-confirmation-cancel" onClick={() => setPasswordConfirmationOpen(false)}>Cancel</button>
            <MorphButton className="artist-confirmation-danger" onAction={changePassword} loadingLabel="Updating" successLabel="Updated">Change password</MorphButton>
          </div>
        </section>
      </div>}

      {deleteConfirmationOpen && <div className="artist-confirmation-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !deleteBusy) setDeleteConfirmationOpen(false) }}>
        <section className="artist-confirmation-dialog artist-confirmation-dialog-wide" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-delete-title`} aria-describedby={`${id}-delete-description`}>
          <h2 id={`${id}-delete-title`}>Permanently delete your account?</h2>
          <p id={`${id}-delete-description`}>This action cannot be undone. Your profile and eligible artworks will be deleted. Accounts with purchases or sold artworks cannot be removed automatically because order records must be retained.</p>
          <label>Current password<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label>
          <label>Type DELETE to confirm<input value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} autoComplete="off" /></label>
          <div className="artist-confirmation-dialog-actions">
            <button type="button" className="artist-confirmation-cancel" disabled={deleteBusy} onClick={() => setDeleteConfirmationOpen(false)}>Cancel</button>
            <button type="button" className="artist-confirmation-danger" disabled={deleteBusy || deletePhrase !== 'DELETE' || !deletePassword} onClick={() => void deleteAccount()}>{deleteBusy ? 'Deleting account…' : 'Delete account'}</button>
          </div>
        </section>
      </div>}

      {logoutConfirmationOpen && <div className="artist-confirmation-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setLogoutConfirmationOpen(false) }}>
        <section className="artist-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-logout-title`} aria-describedby={`${id}-logout-description`}>
          <h2 id={`${id}-logout-title`}>Are you sure you want to log out?</h2>
          <p id={`${id}-logout-description`}>You will need to sign in again to access your artist studio.</p>
          <div className="artist-confirmation-dialog-actions">
            <button type="button" className="artist-confirmation-cancel" onClick={() => setLogoutConfirmationOpen(false)}>Cancel</button>
            <button type="button" className="artist-confirmation-danger" onClick={onLogout}>Log Out</button>
          </div>
        </section>
      </div>}
    </section>
  )
}
