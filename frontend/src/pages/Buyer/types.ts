export type BuyerUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  location: string | null
  emailNotifications: boolean
  createdAt: string
}

export type BuyerStats = {
  totalOrders: number
  activeOrders: number
  deliveredOrders: number
  totalSpent: number
  savedAddresses: number
}

export type OrderArtwork = {
  id: number
  title: string
  price: number
  imageUrl: string | null
  isProtected?: boolean
  category?: string
  artist?: {
    id: number
    firstName: string
    lastName: string
    displayName: string | null
  }
}

export type OrderItem = {
  id: number
  orderId: number
  artworkId: number
  quantity: number
  price: number
  artwork: OrderArtwork
}

export type Address = {
  id: number
  userId: number
  fullName: string
  phone: string | null
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

export type ShippingAddress = {
  fullName?: string
  phone?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export type Order = {
  id: number
  orderNumber: string
  buyerId: number
  totalAmount: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | string
  paymentStatus: 'paid' | 'pending' | 'refunded' | string
  paymentMethod: string
  addressId: number | null
  address?: Address | null
  shippingAddress: ShippingAddress | null
  trackingNumber: string | null
  estimatedDelivery: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt?: string
}

export type BuyerDashboardData = {
  user: BuyerUser
  stats: BuyerStats
  recentOrders: Order[]
}

export type BuyerSection = 'overview' | 'profile' | 'orders' | 'addresses' | 'settings'
