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
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
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

export function BuyerOverview({ data, onNavigateSection }: Props) {
  const { user, stats, recentOrders } = data
  const firstName = user.firstName

  return (
    <section aria-label="Account Overview">
      <div className="buyer-section-header">
        <span className="buyer-kicker">COLLECTOR DESK</span>
        <h1 className="buyer-title">Welcome back{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="buyer-subtitle">
          Your personal sanctuary for original contemporary artworks, tracked shipments, and bespoke collection records.
        </p>
      </div>

      <div className="buyer-overview-hero">
        <h2>Curate your sanctuary.</h2>
        <p>
          Discover original paintings, sculptures, and limited editions from verified independent artists worldwide.
        </p>
        <div className="buyer-hero-actions">
          <Link to="/#artwork" className="buyer-btn-primary">
            <Compass size={16} />
            <span>Discover Original Art</span>
          </Link>
          <button
            type="button"
            className="buyer-btn-secondary"
            onClick={() => onNavigateSection('orders')}
          >
            <span>View Order History</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="buyer-stats-grid">
        <div className="buyer-stat-card">
          <div className="buyer-stat-top">
            <span>Total Orders</span>
            <ShoppingBag size={18} />
          </div>
          <div className="buyer-stat-value">{stats.totalOrders}</div>
          <div className="buyer-stat-desc">All order records</div>
        </div>

        <div className="buyer-stat-card">
          <div className="buyer-stat-top">
            <span>Open Orders</span>
            <Package size={18} />
          </div>
          <div className="buyer-stat-value">{stats.activeOrders}</div>
          <div className="buyer-stat-desc">Pending, processing, or shipped</div>
        </div>

        <div className="buyer-stat-card">
          <div className="buyer-stat-top">
            <span>Paid Order Value</span>
            <CreditCard size={18} />
          </div>
          <div className="buyer-stat-value">{formatINR(stats.totalSpent)}</div>
          <div className="buyer-stat-desc">Paid orders only</div>
        </div>

        <div className="buyer-stat-card">
          <div className="buyer-stat-top">
            <span>Saved Addresses</span>
            <MapPin size={18} />
          </div>
          <div className="buyer-stat-value">{stats.savedAddresses}</div>
          <div className="buyer-stat-desc">Delivery destinations</div>
        </div>
      </div>

      <div className="buyer-card-panel">
        <div className="buyer-panel-header">
          <h3>Recent Acquisitions</h3>
          {recentOrders.length > 0 && (
            <button
              type="button"
              className="buyer-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => onNavigateSection('orders')}
            >
              <span>All Orders ({stats.totalOrders})</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="buyer-empty-state" style={{ padding: '40px 20px' }}>
            <div className="buyer-empty-icon">
              <ShoppingBag size={24} />
            </div>
            <h3>No purchases yet</h3>
            <p>
              When an artwork resonates with you, acquire it directly from the artist. Every purchase comes with secure provenance and authentic delivery.
            </p>
            <Link to="/#artwork" className="buyer-btn-primary">
              <Compass size={16} />
              <span>Explore Gallery Artworks</span>
            </Link>
          </div>
        ) : (
          <div className="buyer-orders-list">
            {recentOrders.slice(0, 3).map((order) => {
              const firstItem = order.items?.[0]
              const moreCount = order.items.length - 1
              const art = firstItem?.artwork

              return (
                <div key={order.id} className="buyer-order-card">
                  <div className="buyer-order-header">
                    <div className="buyer-order-id-group">
                      <span className="buyer-order-number">{order.orderNumber}</span>
                      <span className="buyer-order-date">
                        <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="buyer-order-badges">
                      <span className={`buyer-badge ${getStatusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                      {order.paymentStatus && (
                        <span className="buyer-badge buyer-badge-paid">
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
                        {(art?.artist?.displayName || `${art?.artist?.firstName ?? ''} ${art?.artist?.lastName ?? ''}`.trim()) && (
                          <div className="buyer-order-item-artist">
                            Artist: {art?.artist?.displayName || `${art?.artist?.firstName ?? ''} ${art?.artist?.lastName ?? ''}`.trim()}
                          </div>
                        )}
                        {firstItem && <div className="buyer-order-item-qty">Qty: {firstItem.quantity}</div>}
                      </div>

                      <div className="buyer-order-item-price">
                        {formatINR(order.totalAmount)}
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
                    >
                      <span>View in Orders</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
