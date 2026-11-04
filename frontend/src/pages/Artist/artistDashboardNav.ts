import { IconChartBar, IconCoin, IconHome2, IconPhoto, IconSettings, IconShoppingBag, IconUserSquareRounded } from '@tabler/icons-react'

export const artistDashboardNav = [
  { label: 'Overview', section: 'overview', icon: IconHome2 },
  { label: 'My Artworks', section: 'artworks', icon: IconPhoto },
  { label: 'Orders & Sales', section: 'orders', icon: IconShoppingBag },
  { label: 'Earnings', section: 'earnings', icon: IconCoin },
  { label: 'Analytics', section: 'analytics', icon: IconChartBar },
  { label: 'Artist Profile', section: 'profile', icon: IconUserSquareRounded },
  { label: 'Settings', section: 'settings', icon: IconSettings },
] as const
