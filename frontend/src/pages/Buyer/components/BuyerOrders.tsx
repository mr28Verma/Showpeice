import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  CreditCard,
  Download,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { Order } from '../types'
import { buyerApi, resolveImageUrl } from '../buyerApi'
import { formatINR } from '../../../utils/formatCurrency'
import { ProtectedArtworkImage } from '../../../components/ProtectedArtworkImage'

type Props = {
  token: string
}

type OrderFilter = 'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const orderFilters: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All Orders' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

const ordersPerPage = 5

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getStatusBadge(status: string) {
  const norm = status?.toLowerCase()
  switch (norm) {
    case 'delivered':
      return (
        <span className="buyer-badge buyer-badge-delivered">
          <CheckCircle2 size={12} />
          <span>Delivered</span>
        </span>
      )
    case 'shipped':
      return (
        <span className="buyer-badge buyer-badge-shipped">
          <Truck size={12} />
          <span>Shipped</span>
        </span>
      )
    case 'cancelled':
      return (
        <span className="buyer-badge buyer-badge-cancelled">
          <XCircle size={12} />
          <span>Cancelled</span>
        </span>
      )
    case 'processing':
    case 'pending':
    default:
      return (
        <span className="buyer-badge buyer-badge-processing">
          <Clock size={12} />
          <span>{status || 'Unknown'}</span>
        </span>
      )
  }
}

function getPaymentBadge(paymentStatus: string) {
  const isPaid = paymentStatus?.toLowerCase() === 'paid'
  return (
    <span className={`buyer-badge ${isPaid ? 'buyer-badge-paid' : 'buyer-badge-unpaid'}`}>
      <span>{paymentStatus || 'Unknown'}</span>
    </span>
  )
}

function getItemCount(order: Order) {
  return order.items.reduce((total, item) => total + (Number.isFinite(item.quantity) ? item.quantity : 0), 0)
}

function csvCell(value: string | number) {
  const text = String(value)
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}

function downloadOrderReport(orders: Order[]) {
  const headers = ['Order number', 'Date placed', 'Order status', 'Payment status', 'Payment method', 'Items', 'Quantity', 'Total amount', 'Tracking number', 'Estimated delivery']
  const rows = orders.map((order) => [
    order.orderNumber,
    order.createdAt,
    order.status,
    order.paymentStatus,
    order.paymentMethod,
    order.items.map((item) => item.artwork?.title || '').filter(Boolean).join('; '),
    getItemCount(order),
    order.totalAmount,
    order.trackingNumber || '',
    order.estimatedDelivery || '',
  ])
  const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `showpeice-order-history-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function BuyerOrders({ token }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const activeView: 'overview' = 'overview'
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({})
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let cancelled = false
    const fetchOrders = async () => {
      try {
        const result = await buyerApi.getOrders(token)
        if (!cancelled) {
          setOrders(result.orders || [])
          setCurrentPage(1)
          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not fetch orders.')
          setLoading(false)
        }
      }
    }

    void fetchOrders()
    return () => {
      cancelled = true
    }
  }, [token])

  const reloadOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await buyerApi.getOrders(token)
      setOrders(result.orders || [])
      setCurrentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch orders.')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (orderId: number) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % orderFilters.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + orderFilters.length) % orderFilters.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = orderFilters.length - 1
    if (nextIndex === undefined) return

    event.preventDefault()
    const nextFilter = orderFilters[nextIndex]
    setActiveFilter(nextFilter.id)
    setCurrentPage(1)
    tabRefs.current[nextIndex]?.focus()
  }

  const filteredOrders = activeFilter === 'all'
    ? orders
    : orders.filter((order) => order.status?.toLowerCase() === activeFilter)
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage))
  const pageOrders = filteredOrders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage)
  const paidOrders = orders.filter((order) => order.paymentStatus?.toLowerCase() === 'paid')
  const paidTotal = paidOrders.reduce((total, order) => Number.isFinite(order.totalAmount) ? total + order.totalAmount : total, 0)
  const paidOrdersWithAmount = paidOrders.filter((order) => Number.isFinite(order.totalAmount))
  const activeOrders = orders.filter((order) => ['pending', 'processing', 'shipped'].includes(order.status?.toLowerCase())).length
  const deliveredOrders = orders.filter((order) => order.status?.toLowerCase() === 'delivered').length
  const totalItems = orders.reduce((total, order) => total + getItemCount(order), 0)
  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = order.status?.trim() || 'Unknown'
    const key = status.toLowerCase()
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
  const statusLabels = new Map<string, string>(orders.map((order): [string, string] => [
    order.status?.trim().toLowerCase() || 'unknown',
    order.status?.trim() || 'Unknown',
  ]))
  const statusBreakdown = Object.entries(statusCounts).sort(([, a], [, b]) => b - a)

  return (
    <section aria-label="Buyer Order History">
      <div className="buyer-section-header">
        <span className="buyer-kicker">ACQUISITION HISTORY</span>
        <h1 className="buyer-title">My Orders</h1>
        <p className="buyer-subtitle">
          Review your original art purchases, shipment tracking, provenance records, and delivery status.
        </p>
      </div>

      <div className="buyer-orders-toolbar">
        <div className="buyer-orders-tabs" role="tablist" aria-label="Filter orders by status">
          {orderFilters.map((filter, index) => (
            <button
              key={filter.id}
              ref={(element) => { tabRefs.current[index] = element }}
              id={`buyer-orders-tab-${filter.id}`}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.id}
              aria-controls="buyer-orders-panel"
              tabIndex={activeFilter === filter.id ? 0 : -1}
              className={`buyer-orders-tab ${activeFilter === filter.id ? 'is-active' : ''}`}
              onClick={() => {
                setActiveFilter(filter.id)
                setCurrentPage(1)
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <span className="buyer-orders-count" aria-live="polite">
          {loading ? 'Checking records...' : `${filteredOrders.length} ${filteredOrders.length === 1 ? 'order' : 'orders'} found`}
        </span>
      </div>

      <div
        id="buyer-orders-panel"
        className="buyer-orders-panel"
        role="tabpanel"
        aria-labelledby={`buyer-orders-tab-${activeFilter}`}
        tabIndex={0}
      >
        {loading ? (
          activeView === 'overview' ? (
            <div className="buyer-orders-list">
              {[1, 2].map((i) => (
                <div key={i} className="buyer-order-card" style={{ padding: '24px' }}>
                  <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '40%' }} />
                  <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '80%', height: '50px', margin: '16px 0' }} />
                  <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '30%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="buyer-orders-message" role="status">Loading order history…</div>
          )
        ) : error ? (
          <div className="buyer-empty-state">
            <div className="buyer-empty-icon buyer-empty-icon-error">
              <AlertCircle size={24} />
            </div>
            <h3>Unable to load orders</h3>
            <p>{error}</p>
            <button type="button" className="buyer-btn-primary" onClick={reloadOrders}>
              Retry
            </button>
          </div>
        ) : activeView === 'overview' ? (
          filteredOrders.length === 0 ? (
            <div className="buyer-empty-state">
              <div className="buyer-empty-icon">
                <ShoppingBag size={24} />
              </div>
              <h3>{activeFilter === 'all' ? 'No orders placed yet' : `No ${activeFilter} orders`}</h3>
              <p>
                {activeFilter === 'all'
                  ? 'When you acquire an original piece from Showpeice, all order details, shipping milestones, and authentic records will appear here.'
                  : `You do not have any orders with the ${activeFilter} status.`}
              </p>
              {activeFilter === 'all' ? (
                <Link to="/#artwork" className="buyer-btn-primary">
                  <Compass size={16} />
                  <span>Explore Gallery Works</span>
                </Link>
              ) : (
                <button type="button" className="buyer-btn-secondary" onClick={() => setActiveFilter('all')}>
                  Show All Orders
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="buyer-orders-list">
                {pageOrders.map((order) => {
                  const isExpanded = Boolean(expandedOrders[order.id])
                  const address = order.shippingAddress || order.address

                  return (
                    <article key={order.id} className="buyer-order-card" aria-label={`Order ${order.orderNumber}`}>
                      <header className="buyer-order-header">
                        <div className="buyer-order-id-group">
                          <span className="buyer-order-number">{order.orderNumber}</span>
                          <span className="buyer-order-date">
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            Placed {formatDate(order.createdAt)}
                          </span>
                        </div>

                        <div className="buyer-order-badges">
                          {getStatusBadge(order.status)}
                          {getPaymentBadge(order.paymentStatus)}
                        </div>
                      </header>

                      <div className="buyer-order-body">
                        <div className="buyer-order-items-list">
                          {order.items.map((item) => {
                            const art = item.artwork
                            const artistName =
                              art?.artist?.displayName ||
                              `${art?.artist?.firstName ?? ''} ${art?.artist?.lastName ?? ''}`.trim()

                            return (
                              <div key={item.id} className="buyer-order-item-row">
                                <div className="buyer-order-thumb">
                                  {art?.imageUrl ? (
                                    <ProtectedArtworkImage
                                      isProtected={art.isProtected}
                                      src={resolveImageUrl(art.imageUrl)}
                                      alt={art.title || 'Artwork image'}
                                    />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#eceae4' }}>
                                      <Package size={22} color="#8a857c" />
                                    </div>
                                  )}
                                </div>

                                <div className="buyer-order-item-info">
                                  <h4 className="buyer-order-item-title">
                                    {art?.title || 'Artwork details unavailable'}
                                  </h4>
                                  {(artistName || art?.category) && <p className="buyer-order-item-artist">
                                    {artistName && `by ${artistName}`}{artistName && art?.category && ' · '}{art?.category}
                                  </p>}
                                  <span className="buyer-order-item-qty">
                                    Quantity: {item.quantity}
                                  </span>
                                </div>

                                <div className="buyer-order-item-price">
                                  {formatINR(item.price * item.quantity)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <footer className="buyer-order-footer">
                        <div className="buyer-order-total">
                          <span>Order Total:</span>
                          <strong>{formatINR(order.totalAmount)}</strong>
                        </div>

                        <button
                          type="button"
                          className="buyer-order-details-toggle"
                          onClick={() => toggleExpand(order.id)}
                          aria-expanded={isExpanded}
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Order & Delivery Details'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </footer>

                      {isExpanded && (
                        <div className="buyer-order-expanded-panel">
                          <div className="buyer-detail-col">
                            <h4>
                              <Truck size={13} style={{ display: 'inline', marginRight: '4px' }} />
                              Shipment & Tracking
                            </h4>
                            <p>
                              Status: <strong style={{ textTransform: 'capitalize' }}>{order.status}</strong>
                            </p>
                            {order.trackingNumber ? (
                              <div>
                                <p style={{ marginTop: '4px' }}>Tracking Number:</p>
                                <span className="buyer-tracking-chip">{order.trackingNumber}</span>
                              </div>
                            ) : (
                              <p style={{ color: 'var(--buyer-muted)', marginTop: '4px' }}>
                                Tracking number will be assigned upon dispatch.
                              </p>
                            )}
                            {order.estimatedDelivery && (
                              <p style={{ marginTop: '8px' }}>
                                Estimated Delivery: <strong>{formatDate(order.estimatedDelivery)}</strong>
                              </p>
                            )}
                          </div>

                          <div className="buyer-detail-col">
                            <h4>
                              <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                              Delivery Address
                            </h4>
                            {address ? (
                              <>
                                <p><strong>{address.fullName}</strong></p>
                                <p>{address.street}</p>
                                <p>{address.city}, {address.state} - {address.postalCode}</p>
                                {address.country && <p>{address.country}</p>}
                                {address.phone && <p style={{ marginTop: '4px', color: 'var(--buyer-muted)' }}>Tel: {address.phone}</p>}
                              </>
                            ) : (
                              <p style={{ color: 'var(--buyer-muted)' }}>Standard delivery address registered at checkout.</p>
                            )}
                          </div>

                          <div className="buyer-detail-col">
                            <h4>
                              <CreditCard size={13} style={{ display: 'inline', marginRight: '4px' }} />
                              Payment Summary
                            </h4>
                            <p>Payment Method: <strong style={{ textTransform: 'uppercase' }}>{order.paymentMethod}</strong></p>
                            <p>Payment Status: <strong style={{ textTransform: 'capitalize' }}>{order.paymentStatus}</strong></p>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              {pageCount > 1 && (
                <nav className="buyer-orders-pagination" aria-label="Order pages">
                  <button
                    type="button"
                    className="buyer-page-button buyer-page-step"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={17} aria-hidden="true" />
                    <span>Previous</span>
                  </button>
                  <div className="buyer-page-numbers">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`buyer-page-button ${currentPage === page ? 'is-active' : ''}`}
                        aria-label={`Page ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="buyer-page-button buyer-page-step"
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                    disabled={currentPage === pageCount}
                  >
                    <span>Next</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )
        ) : activeView === 'analytics' ? (
          orders.length === 0 ? (
            <div className="buyer-empty-state">
              <div className="buyer-empty-icon"><BarChart3 size={24} /></div>
              <h3>No order activity to analyze</h3>
              <p>Analytics will appear here when your account has order history.</p>
            </div>
          ) : (
            <div className="buyer-orders-analytics">
              <p className="buyer-orders-data-note">Calculated from your {orders.length} order records.</p>
              <div className="buyer-orders-analytics-grid">
                <article className="buyer-stat-card">
                  <span className="buyer-orders-stat-label">Total orders</span>
                  <strong className="buyer-stat-value">{orders.length}</strong>
                  <span className="buyer-orders-stat-note">All recorded orders</span>
                </article>
                <article className="buyer-stat-card">
                  <span className="buyer-orders-stat-label">Active orders</span>
                  <strong className="buyer-stat-value">{activeOrders}</strong>
                  <span className="buyer-orders-stat-note">Pending, processing, or shipped</span>
                </article>
                <article className="buyer-stat-card">
                  <span className="buyer-orders-stat-label">Delivered orders</span>
                  <strong className="buyer-stat-value">{deliveredOrders}</strong>
                  <span className="buyer-orders-stat-note">Marked delivered</span>
                </article>
                <article className="buyer-stat-card">
                  <span className="buyer-orders-stat-label">Items purchased</span>
                  <strong className="buyer-stat-value">{totalItems}</strong>
                  <span className="buyer-orders-stat-note">Quantity across order records</span>
                </article>
              </div>

              <section className="buyer-orders-breakdown" aria-labelledby="buyer-orders-breakdown-title">
                <div className="buyer-orders-subheading">
                  <h2 id="buyer-orders-breakdown-title">Order status</h2>
                  <span>{orders.length} total</span>
                </div>
                <ul className="buyer-orders-status-list">
                  {statusBreakdown.map(([status, count]) => (
                    <li key={status}>
                      <span>{statusLabels.get(status) || status}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="buyer-orders-breakdown" aria-labelledby="buyer-orders-payments-title">
                <div className="buyer-orders-subheading">
                  <h2 id="buyer-orders-payments-title">Paid order total</h2>
                  <span>{paidOrders.length} paid {paidOrders.length === 1 ? 'order' : 'orders'}</span>
                </div>
                {paidOrdersWithAmount.length > 0 ? (
                  <div className="buyer-orders-paid-summary">
                    <strong>{formatINR(paidTotal)}</strong>
                    <span>Sum of order totals marked paid by the payment records.</span>
                  </div>
                ) : (
                  <p className="buyer-orders-message">Paid amount details are unavailable in the returned order records.</p>
                )}
              </section>
            </div>
          )
        ) : orders.length === 0 ? (
          <div className="buyer-empty-state">
            <div className="buyer-empty-icon"><Package size={24} /></div>
            <h3>No order history to report</h3>
            <p>Reports will be available when your account has order records.</p>
          </div>
        ) : (
          <section className="buyer-orders-report" aria-labelledby="buyer-orders-report-title">
            <div className="buyer-orders-report-header">
              <div>
                <h2 id="buyer-orders-report-title">Order history report</h2>
                <p>{orders.length} records from your order history</p>
              </div>
              <button type="button" className="buyer-btn-secondary buyer-orders-export" onClick={() => downloadOrderReport(orders)}>
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="buyer-orders-report-wrap">
              <table className="buyer-orders-report-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Date placed</th>
                    <th scope="col">Items</th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="is-numeric">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <th scope="row">{order.orderNumber}</th>
                      <td>{formatDate(order.createdAt)}</td>
                      <td className="buyer-orders-report-items">
                        {order.items.length > 0
                          ? order.items.map((item) => item.artwork?.title || 'Artwork details unavailable').join(', ')
                          : 'Item details unavailable'}
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>{getPaymentBadge(order.paymentStatus)}</td>
                      <td className="is-numeric">{formatINR(order.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
