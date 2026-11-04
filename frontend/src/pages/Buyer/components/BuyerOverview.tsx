import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  Package,
  CreditCard,
  MapPin,
  ArrowRight,
  Compass,
  Clock,
} from 'lucide-react'
import type { BuyerDashboardData, BuyerSection, OrderArtwork } from '../types'
import { formatINR } from '../../../utils/formatCurrency'
import { resolveImageUrl } from '../buyerApi'
import { ProtectedArtworkImage } from '../../../components/ProtectedArtworkImage'

type Props = {
  data: BuyerDashboardData
  onNavigateSection: (section: BuyerSection) => void
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  // new Date() never throws on bad input, it returns an Invalid Date, so check explicitly.
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getStatusBadgeClass(status: string) {
  switch (status?.toLowerCase()) {
    case 'delivered':
      return 'buyer-badge-delivered'
    case 'shipped':
      return 'buyer-badge-shipped'
    case 'cancelled':
      return 'buyer-badge-cancelled'
    case 'processing':
    case 'pending':
    default:
      return 'buyer-badge-processing'
  }
}

function getPaymentBadgeClass(paymentStatus: string) {
  return paymentStatus?.toLowerCase() === 'paid' ? 'buyer-badge-paid' : 'buyer-badge-processing'
}

function getArtistName(art: OrderArtwork | undefined) {
  const artist = art?.artist
  if (!artist) return ''
  return artist.displayName || `${artist.firstName ?? ''} ${artist.lastName ?? ''}`.trim()
}

function RecentArtworkThumbnail({ artwork }: { artwork: OrderArtwork | undefined }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = artwork?.imageUrl ? resolveImageUrl(artwork.imageUrl) : ''

  if (!imageUrl || imageFailed) {
    return (
      <div className="buyer-order-thumb-placeholder" aria-label="Artwork image unavailable">
        <Package size={20} aria-hidden="true" />
      </div>
    )
  }

  return (
    <ProtectedArtworkImage
      isProtected={artwork?.isProtected}
      src={imageUrl}
      alt={artwork?.title || 'Artwork image'}
      onError={() => setImageFailed(true)}
    />
  )
}

type StatCardProps = {
  label: string
  value: string | number
  description: string
  icon: React.ReactNode
  onClick?: () => void
}

function StatCard({ label, value, description, icon, onClick }: StatCardProps) {
  const content = (
    <>
      <div className="buyer-stat-top">
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </div>
      <div className="buyer-stat-value">{value}</div>
      <div className="buyer-stat-desc">{description}</div>
    </>
  )

  // Cards that lead somewhere are real buttons: keyboard and screen-reader friendly.
  return onClick ? (
    <button type="button" className="buyer-stat-card buyer-stat-card-action" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="buyer-stat-card">{content}</div>
  )
}

export function BuyerOverview({ data, onNavigateSection }: Props) {
  const { user, stats } = data
  const recentOrders = data.recentOrders ?? []
  const firstName = user.firstName
  const hasNoOrders = stats.totalOrders === 0

  return (
    <section aria-label="Account Overview">
      <div className="buyer-section-header">
        <h1 className="buyer-title">Welcome back{firstName ? `, ${firstName}` : ''}.</h1>
      </div>

      <div className="buyer-overview-hero">
        <h2>{hasNoOrders ? 'Begin your collection.' : 'Curate your sanctuary.'}</h2>
        <p>
          {hasNoOrders
            ? 'Your first acquisition starts here. Browse original paintings, sculptures, and limited editions from verified independent artists.'
            : 'Discover original paintings, sculptures, and limited editions from verified independent artists worldwide.'}
        </p>
        <div className="buyer-hero-actions">
          <Link to="/gallery" className="buyer-btn-primary">
            <Compass size={16} aria-hidden="true" />
            <span>Discover Original Art</span>
          </Link>
          <button
            type="button"
            className="buyer-btn-secondary"
            onClick={() => onNavigateSection('orders')}
          >
            <span>View Order History</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="buyer-stats-grid">
        <StatCard
          label="Total Orders"
          value={stats.totalOrders}
          description="All order records"
          icon={<ShoppingBag size={18} />}
          onClick={() => onNavigateSection('orders')}
        />
        <StatCard
          label="Open Orders"
          value={stats.activeOrders}
          description="Pending, processing, or shipped"
          icon={<Package size={18} />}
          onClick={() => onNavigateSection('orders')}
        />
        <StatCard
          label="Paid Order Value"
          value={formatINR(stats.totalSpent)}
          description="Paid orders only"
          icon={<CreditCard size={18} />}
        />
        <StatCard
          label="Saved Addresses"
          value={stats.savedAddresses}
          description="Delivery destinations"
          icon={<MapPin size={18} />}
          onClick={() => onNavigateSection('addresses')}
        />
      </div>

      <div className="buyer-card-panel">
        <div className="buyer-panel-header">
          <h3>Recent Acquisitions</h3>
          {recentOrders.length > 0 && (
            <button
              type="button"
              className="buyer-btn-secondary buyer-btn-compact"
              onClick={() => onNavigateSection('orders')}
            >
              <span>All Orders ({stats.totalOrders})</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="buyer-empty-state buyer-empty-state-compact">
            <div className="buyer-empty-icon">
              <ShoppingBag size={24} aria-hidden="true" />
            </div>
            <h3>No purchases yet</h3>
            <p>
              When an artwork resonates with you, acquire it directly from the artist. Every purchase comes with secure provenance and authentic delivery.
            </p>
            <Link to="/gallery" className="buyer-btn-primary">
              <Compass size={16} aria-hidden="true" />
              <span>Explore Gallery Artworks</span>
            </Link>
          </div>
        ) : (
          <div className="buyer-orders-list">
            {recentOrders.slice(0, 3).map((order) => {
              const items = order.items ?? []
              const firstItem = items[0]
              const moreCount = Math.max(items.length - 1, 0)
              const art = firstItem?.artwork
              const artistName = getArtistName(art)

              return (
                <article key={order.id} className="buyer-order-card">
                  <div className="buyer-order-header">
                    <div className="buyer-order-id-group">
                      <span className="buyer-order-number">{order.orderNumber}</span>
                      <span className="buyer-order-date">
                        <Clock size={12} className="buyer-order-date-icon" aria-hidden="true" />
                        <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
                      </span>
                    </div>
                    <div className="buyer-order-badges">
                      <span className={`buyer-badge ${getStatusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                      {order.paymentStatus && (
                        <span className={`buyer-badge ${getPaymentBadgeClass(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="buyer-order-body">
                    <div className="buyer-order-item-row">
                      <div className="buyer-order-thumb">
                        <RecentArtworkThumbnail key={art?.imageUrl || 'unavailable'} artwork={art} />
                      </div>

                      <div className="buyer-order-item-info">
                        <div className="buyer-order-item-title">
                          {art?.title || 'Artwork details unavailable'}
                          {moreCount > 0 && ` + ${moreCount} other ${moreCount === 1 ? 'piece' : 'pieces'}`}
                        </div>
                        {artistName && (
                          <div className="buyer-order-item-artist">Artist: {artistName}</div>
                        )}
                        {firstItem && <div className="buyer-order-item-qty">Qty: {firstItem.quantity}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="buyer-order-footer">
                    <div className="buyer-order-total">
                      <span>Total:</span>
                      <strong>{formatINR(order.totalAmount)}</strong>
                    </div>

                    <button
                      type="button"
                      className="buyer-order-details-toggle"
                      onClick={() => onNavigateSection('orders')}
                      aria-label={`View order ${order.orderNumber} in Orders`}
                    >
                      <span>View in Orders</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}