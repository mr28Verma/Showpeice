import { useId, useState } from 'react'
import './SettingsToggles.css'

type SettingId = 'emailNotifications' | 'publicProfile' | 'weeklyDigest'

const SETTINGS: Array<{
  id: SettingId
  title: string
  description: string
}> = [
  {
    id: 'emailNotifications',
    title: 'Email notifications',
    description: 'Product updates and announcements',
  },
  {
    id: 'publicProfile',
    title: 'Public profile',
    description: 'Anyone can view your profile',
  },
  {
    id: 'weeklyDigest',
    title: 'Weekly digest',
    description: 'A summary in your inbox every Monday',
  },
]

type SettingsTogglesProps = {
  onLogout: () => void
}

export function SettingsToggles({ onLogout }: SettingsTogglesProps) {
  const id = useId()
  // Local UI state only. Connect an account settings service when persistence is available.
  const [enabled, setEnabled] = useState<Record<SettingId, boolean>>({
    emailNotifications: true,
    publicProfile: false,
    weeklyDigest: true,
  })
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false)

  return (
    <section className="artist-settings" aria-label="Artist preferences">
      <div className="artist-settings-panel">
        {SETTINGS.map(setting => {
          const titleId = `${id}-${setting.id}-title`
          const descriptionId = `${id}-${setting.id}-description`

          return (
            <div className="artist-settings-row" key={setting.id}>
              <div className="artist-settings-copy">
                <span className="artist-settings-title" id={titleId}>{setting.title}</span>
                <span className="artist-settings-description" id={descriptionId}>{setting.description}</span>
              </div>
              <button
                type="button"
                className={`artist-settings-switch${enabled[setting.id] ? ' is-on' : ''}`}
                role="switch"
                aria-label={setting.title}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-checked={enabled[setting.id]}
                onClick={() => setEnabled(current => ({ ...current, [setting.id]: !current[setting.id] }))}
              >
                <span className="artist-settings-switch-knob" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <p className="artist-settings-note">Changes are local to this view and are not saved to your account yet.</p>
      <section className="artist-account-settings" aria-labelledby={`${id}-account-title`}>
        <div>
          <span className="artist-account-settings-kicker">ACCOUNT</span>
          <h2 id={`${id}-account-title`}>Sign out of your studio</h2>
          <p>End this session on this device. You can sign in again at any time.</p>
        </div>
        <button type="button" className="artist-logout-button" onClick={() => setLogoutConfirmationOpen(true)}>Log Out</button>
      </section>
      {logoutConfirmationOpen && <div className="artist-logout-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setLogoutConfirmationOpen(false) }}>
        <section className="artist-logout-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-logout-title`} aria-describedby={`${id}-logout-description`}>
          <h2 id={`${id}-logout-title`}>Are you sure you want to log out?</h2>
          <p id={`${id}-logout-description`}>You will need to sign in again to access your artist studio.</p>
          <div className="artist-logout-dialog-actions">
            <button type="button" className="artist-logout-cancel" onClick={() => setLogoutConfirmationOpen(false)}>Cancel</button>
            <button type="button" className="artist-logout-confirm" onClick={onLogout}>Log Out</button>
          </div>
        </section>
      </div>}
    </section>
  )
}
