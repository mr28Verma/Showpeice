import { useState, type FormEvent } from 'react'
import {
  Bell,
  Lock,
  LogOut,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { BuyerUser } from '../types'
import { buyerApi } from '../buyerApi'
import { toast } from '../../../components/ui/toast'

type Props = {
  user: BuyerUser
  token: string
  onUserUpdated: (user: BuyerUser) => void
  onLogout: () => void
}

export function BuyerSettings({ user, token, onUserUpdated, onLogout }: Props) {
  const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications || false)
  const [orderNotifications, setOrderNotifications] = useState(user.orderNotifications ?? true)
  const [updatingNotifications, setUpdatingNotifications] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const handleToggleNotifications = async (
    preference: 'emailNotifications' | 'orderNotifications',
    checked: boolean,
  ) => {
    const previous = preference === 'emailNotifications' ? emailNotifications : orderNotifications
    if (preference === 'emailNotifications') setEmailNotifications(checked)
    else setOrderNotifications(checked)
    setUpdatingNotifications(true)
    try {
      const res = await buyerApi.updateProfile(token, { [preference]: checked })
      onUserUpdated(res.user)
      toast.success(
        'Preferences saved',
        preference === 'orderNotifications'
          ? 'Your order update email preference was saved.'
          : 'Your curated artwork email preference was saved.'
      )
    } catch {
      if (preference === 'emailNotifications') setEmailNotifications(previous)
      else setOrderNotifications(previous)
      toast.error('Failed to update', 'Could not save notification preferences.')
    } finally {
      setUpdatingNotifications(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError('Please provide your current password.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await buyerApi.changePassword(token, currentPassword, newPassword)
      setPasswordSuccess('Your password has been updated securely.')
      toast.success('Password updated', 'Your account credentials have been changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not change password.'
      setPasswordError(msg)
      toast.error('Password change failed', msg)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <section aria-label="Buyer Account Settings">
      <div className="buyer-section-header">
        <span className="buyer-kicker">PREFERENCES & SECURITY</span>
        <h1 className="buyer-title">Account Settings</h1>
        <p className="buyer-subtitle">
          Manage your email alerts, authentication credentials, and platform session.
        </p>
      </div>

      <div className="buyer-settings-stack">
        {/* Email & Notification Preferences */}
        <div className="buyer-card-panel">
          <div className="buyer-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} />
              <h3>Notification Preferences</h3>
            </div>
          </div>

          <div className="buyer-toggle-row">
            <div className="buyer-toggle-info">
              <h4>Order Milestones & Delivery Updates</h4>
              <p>Save whether you want email updates when orders are processed, packaged, and out for delivery.</p>
            </div>
            <label className="buyer-switch" aria-label="Toggle order milestone emails">
              <input
                type="checkbox"
                checked={orderNotifications}
                disabled={updatingNotifications}
                onChange={(e) => handleToggleNotifications('orderNotifications', e.target.checked)}
              />
              <span className="buyer-slider" />
            </label>
          </div>

          <div className="buyer-toggle-row">
            <div className="buyer-toggle-info">
              <h4>Curated Drops & Private Previews</h4>
              <p>Save whether you want email alerts when featured artists release new artwork or collections.</p>
            </div>
            <label className="buyer-switch" aria-label="Toggle curated drop emails">
              <input
                type="checkbox"
                checked={emailNotifications}
                disabled={updatingNotifications}
                onChange={(e) => handleToggleNotifications('emailNotifications', e.target.checked)}
              />
              <span className="buyer-slider" />
            </label>
          </div>

          <p className="buyer-subtitle">These preferences are stored on your account. Email delivery is not configured yet.</p>
        </div>

        {/* Password Security */}
        <div className="buyer-card-panel">
          <div className="buyer-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} />
              <h3>Security & Password</h3>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} style={{ maxWidth: '480px' }} noValidate>
            {passwordSuccess && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  borderRadius: 'var(--buyer-radius-sm)',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                <Check size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: 'var(--buyer-radius-sm)',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                <AlertCircle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="currentPassword">
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="currentPassword"
                    type={showCurrent ? 'text' : 'password'}
                    className="buyer-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--buyer-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="newPassword">
                  New Password (min 8 chars)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    className="buyer-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--buyer-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="buyer-form-group">
                <label className="buyer-form-label" htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="buyer-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="buyer-btn-primary"
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <>
                      <Loader2 size={15} className="buyer-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Account Details & Session */}
        <div className="buyer-card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#f87171', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                ACCOUNT
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px', fontFamily: 'inherit', color: '#ffffff' }}>
                Sign out of Showpeice
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
                Signed in as <strong style={{ color: '#e5e7eb' }}>{user.email}</strong>. End this session on this device.
              </p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              style={{
                backgroundColor: '#883138',
                color: '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9f3a42')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#883138')}
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
