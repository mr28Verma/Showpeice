import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Compass,
  Home,
  LogOut,
  MapPin,
  Settings,
  ShoppingBag,
  User,
  UserCircle,
} from 'lucide-react'
import { SidebarBody, SidebarLink, useSidebar } from '../../../components/ui/sidebar'
import type { BuyerSection, BuyerUser } from '../types'
import { resolveImageUrl } from '../buyerApi'

type Props = {
  activeSection: BuyerSection
  onSelectSection: (section: BuyerSection) => void
  user: BuyerUser | null
  onLogout: () => void
}

const navItems = [
  { section: 'overview' as BuyerSection, label: 'Overview', icon: Home },
  { section: 'orders' as BuyerSection, label: 'My Orders', icon: ShoppingBag },
  { section: 'profile' as BuyerSection, label: 'My Profile', icon: User },
  { section: 'addresses' as BuyerSection, label: 'Addresses', icon: MapPin },
  { section: 'settings' as BuyerSection, label: 'Settings', icon: Settings },
]

export function BuyerSidebar(props: Props) {
  return (
    <SidebarBody className="buyer-shared-sidebar">
      <BuyerSidebarContent {...props} />
    </SidebarBody>
  )
}

function BuyerSidebarContent({ activeSection, onSelectSection, user, onLogout }: Props) {
  const { open, setOpen } = useSidebar()
  const displayName = user?.displayName?.trim() || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Buyer account'

  return (
    <div className="buyer-shared-sidebar-content">
      <Link to="/" className="buyer-shared-wordmark" aria-label="Showpeice Home">
        <img src="/showpeice-logo.svg" alt="" />
        <motion.span animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }} aria-hidden={!open}>
          Showpeice
          <small>BUYER DASHBOARD</small>
        </motion.span>
      </Link>

      <nav className="buyer-shared-side-nav" aria-label="Buyer dashboard">
        {navItems.map(({ section, label, icon: Icon }) => (
          <SidebarLink
            key={section}
            link={{
              label,
              href: section === 'overview' ? '/buyer/dashboard' : `/buyer/dashboard?section=${section}`,
              icon: <Icon size={19} strokeWidth={1.6} aria-hidden="true" />,
              active: activeSection === section,
            }}
            onClick={() => onSelectSection(section)}
          />
        ))}
        <SidebarLink
          link={{
            label: 'Explore Gallery',
            href: '/#artwork',
            icon: <Compass size={19} strokeWidth={1.6} aria-hidden="true" />,
          }}
        />
      </nav>

      <div className="buyer-shared-sidebar-bottom">
        <div className="buyer-shared-account">
          <span className="buyer-shared-avatar">
            {user?.avatarUrl ? (
              <img src={resolveImageUrl(user.avatarUrl)} alt={`${displayName} profile`} />
            ) : (
              <UserCircle size={23} aria-hidden="true" />
            )}
          </span>
          <motion.span
            animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }}
            aria-hidden={!open}
            className="buyer-shared-account-name"
          >
            <strong>{displayName}</strong>
            <small>{user?.email || 'Loading account…'}</small>
          </motion.span>
        </div>
        <button
          type="button"
          className="buyer-shared-logout"
          onClick={() => {
            setOpen(false)
            onLogout()
          }}
        >
          <LogOut size={18} strokeWidth={1.6} aria-hidden="true" />
          <motion.span animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }} aria-hidden={!open}>
            Sign Out
          </motion.span>
        </button>
      </div>
    </div>
  )
}
