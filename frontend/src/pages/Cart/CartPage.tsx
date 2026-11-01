import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../features/cart/CartContext'
import { CartLineItems } from '../../features/cart/CartModal'
import { formatINR } from '../../utils/formatCurrency'
import { toast } from '../../components/ui/toast'
import { apiUrl } from '../../lib/api'

export function CartPage() {
  const { items, itemCount, subtotal, clearCart } = useCart()
  const navigate = useNavigate()
  const [checkingOut, setCheckingOut] = useState(false)
  const token = localStorage.getItem('showpeice_token')

  const handleCheckout = async () => {
    if (!token) {
      navigate('/login?returnTo=%2Fcart')
      return
    }

    if (items.length === 0) return

    setCheckingOut(true)
    try {
      const response = await fetch(apiUrl('/buyer/orders/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({ artworkId: i.id, quantity: i.quantity })),
          paymentMethod: 'card',
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed.')
      }

      clearCart()
      toast.success('Order placed successfully', `Order #${data.order?.orderNumber || ''} created.`)
      navigate('/buyer/dashboard?section=orders')
    } catch (err) {
      toast.error('Checkout failed', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <main className="cart-page">
      <Link className="wordmark cart-wordmark" to="/" aria-label="Showpeice home">
        <img className="brand-logo" src="/showpeice-logo.svg" alt="" />
        <strong>Showpeice</strong>
      </Link>
      <div className="cart-page-content">
        <div className="eyebrow">
          <span className="eyebrow-line" /> YOUR COLLECTION
        </div>
        <h1>
          Your Bag <span>({itemCount})</span>
        </h1>
        {items.length === 0 ? (
          <>
            <p>Your bag is waiting. When a piece feels like yours, you’ll find it here.</p>
            <Link className="auth-submit cart-continue" to="/#artwork">
              Discover artwork <ArrowRight size={16} />
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
              <button
                type="button"
                className="auth-submit cart-continue"
                onClick={handleCheckout}
                disabled={checkingOut}
                style={{ cursor: checkingOut ? 'not-allowed' : 'pointer' }}
              >
                {checkingOut ? (
                  <>
                    <Loader2 size={16} className="buyer-spin" />
                    <span>Processing Acquisition...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Checkout</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            ) : (
              <Link className="auth-submit cart-continue" to="/login?returnTo=%2Fcart">
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
