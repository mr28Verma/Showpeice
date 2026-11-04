import { useState } from 'react'
import { IconUserSquareRounded } from '@tabler/icons-react'
import { FloatingDock, type FloatingDockItem } from '../../components/ui/floating-dock'
import { apiAssetUrl } from '../../lib/api'
import { artistDashboardNav } from './artistDashboardNav'

export function ArtistDashboardNavigation({
  activeSection,
  artistName,
  artistSlug,
  avatarUrl,
  settingsDirty,
  onLeaveSettings,
}: {
  activeSection: string
  artistName: string
  artistSlug: string
  avatarUrl: string | null
  settingsDirty: boolean
  onLeaveSettings: (destination: { section?: string; to?: string }) => void
}) {
  const publicProfilePath = artistSlug
    ? `/artist/${encodeURIComponent(artistSlug)}`
    : '/artist/dashboard?section=profile'
  const items: FloatingDockItem[] = [
    ...artistDashboardNav.filter(({ section }) => section !== 'profile').map(({ label, section, icon: Icon }) => ({
      title: label,
      icon: <Icon size={20} stroke={1.7} aria-hidden="true" />,
      to: section === 'overview' ? '/artist/dashboard' : `/artist/dashboard?section=${section}`,
      active: activeSection === section,
      onSelect: (event: Parameters<NonNullable<FloatingDockItem['onSelect']>>[0]) => {
        if (settingsDirty && activeSection === 'settings' && section !== 'settings') {
          event.preventDefault()
          onLeaveSettings({ section })
        }
      },
    })),
    {
      title: artistName ? `Public Profile · ${artistName}` : 'Public Profile',
      icon: <ArtistProfileDockIcon avatarUrl={avatarUrl} />,
      to: publicProfilePath,
      active: activeSection === 'profile',
      onSelect: event => {
        if (settingsDirty && activeSection === 'settings') {
          event.preventDefault()
          onLeaveSettings({ to: publicProfilePath })
        }
      },
    },
  ]

  return (
    <div className="artist-dashboard-dock">
      <FloatingDock items={items} ariaLabel="Artist dashboard navigation" />
    </div>
  )
}

function ArtistProfileDockIcon({ avatarUrl }: { avatarUrl: string | null }) {
  const [unavailableImage, setUnavailableImage] = useState<string | null>(null)
  const imageSrc = avatarUrl
    ? avatarUrl.startsWith('/') ? apiAssetUrl(avatarUrl) : avatarUrl
    : null

  return imageSrc && unavailableImage !== imageSrc
    ? <img className="artist-dashboard-dock-profile-avatar" src={imageSrc} alt="" onError={() => setUnavailableImage(imageSrc)} />
    : <IconUserSquareRounded size={20} stroke={1.7} aria-hidden="true" />
}
