import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CartLineItemsSkeleton, Skeleton } from '../../components/ui/Skeleton'
import { useCart } from '../../features/cart/CartContext'
import { CartLineItems } from '../../features/cart/CartModal'
import { formatINR } from '../../utils/formatCurrency'
import { getLogoDestination } from '../../lib/logoDestination'

export function CartPage() {
  const { items, itemCount, subtotal, loading, error, retry } = useCart()

  const token = localStorage.getItem('showpeice_token')

  return (
    <main className="cart-page">
      <Link className="wordmark cart-wordmark" to={getLogoDestination()} aria-label="Showpeice home">
        <img className="brand-logo" src="/showpeice-logo.svg" alt="" />
        <strong>Showpeice</strong>
      </Link>
      <div className="cart-page-content">
        <div className="eyebrow">
          <span className="eyebrow-line" /> YOUR COLLECTION
        </div>
        <h1>
          Your Bag {loading ? <Skeleton className="cart-bag-count-skeleton" /> : <span>({itemCount})</span>}
        </h1>
        {loading ? (
          <div className="cart-page-skeleton" role="status" aria-label="Loading shopping bag" aria-busy="true">
            <CartLineItemsSkeleton count={2} />
            <div className="cart-skeleton-subtotal" aria-hidden="true">
              <Skeleton shape="text" className="cart-skeleton-subtotal-label" />
              <Skeleton shape="text" className="cart-skeleton-subtotal-value" />
            </div>
            <Skeleton shape="text" className="cart-skeleton-note" />
            <Skeleton className="cart-skeleton-checkout" />
          </div>
        ) : error ? (
          <div role="alert">
            <h2>{error.status === 404 ? 'An artwork is no longer available.' : error.status === 500 ? 'Your bag could not be loaded.' : 'Could not connect to your bag.'}</h2>
            <p className="cart-auth-note">{error.message}</p>
            <button type="button" className="auth-submit cart-continue" onClick={retry}>Try again</button>
          </div>
        ) : items.length === 0 ? (
          <>
            <p>Your bag is waiting. When a piece feels like yours, you’ll find it here.</p>
            <Link className="auth-submit cart-continue" to="/gallery">
              Explore Artwork <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <CartLineItems />
            <div className="cart-subtotal cart-page-subtotal">
              <span>Subtotal</span>
              <strong>{formatINR(subtotal)}</strong>
            </div>
            <p>Shipping and provenance insurance are included at checkout.</p>
            {token ? (
              <>
                <p className="cart-auth-note" role="status">
                  Secure payment processing is not configured. No order will be placed.
                </p>
                <button
                  type="button"
                  className="auth-submit cart-continue"
                  disabled
                >
                  Checkout unavailable
                </button>
              </>
            ) : (
              <Link className="auth-submit auth-pill-button auth-cta-pill cart-continue" to="/login?returnTo=%2Fcart">
                Sign in to Complete Checkout <ArrowRight size={16} />
              </Link>
            )}
          </>
        )}
        {!token && (
          <p className="cart-auth-note">
            Already have an account? <Link to="/login?returnTo=%2Fcart">Sign in</Link> to continue.
          </p>
        )}
      </div>
    </main>
  )
}
