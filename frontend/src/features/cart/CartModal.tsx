import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, LoaderCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MAX_CART_QUANTITY, useCart } from './CartContext'
import { formatINR } from '../../utils/formatCurrency'
import { QuantityStepper } from '@/components/spectrumui/quantity-stepper'
import { lockBodyScroll } from '@/lib/body-scroll-lock'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { CartLineItemsSkeleton, Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/toast'
import './CartModal.css'

type CartModalProps = { open: boolean; onClose: () => void; onDiscover: () => void; returnFocusRef: RefObject<HTMLButtonElement | null> }

export function CartLineItems({ animatedQuantity = false }: { animatedQuantity?: boolean }) {
  const { items, pendingItemIds, removeItem, setQuantity } = useCart()
  const reducedMotion = useReducedMotion()
  const reportFailure = (error: unknown) => {
    toast.error('Shopping bag could not be updated', error instanceof Error ? error.message : 'Please try again.')
  }
  const changeQuantity = (id: number, quantity: number) => {
    void setQuantity(id, quantity).catch(reportFailure)
  }
  const remove = async (id: number, title: string) => {
    try {
      await removeItem(id)
      toast.success('Artwork removed', title)
    } catch (error) {
      reportFailure(error)
    }
  }

  return <div className="cart-line-list">{items.map((item) => {
    const pending = pendingItemIds.includes(item.id)
    const unitPrice = Number(item.price.replace(/[^\d]/g, '')) || 0
    const lineTotal = unitPrice * item.quantity
    return <article className="cart-line" key={item.id}>
    <ProtectedArtworkImage className="cart-line-image" isProtected={item.isProtected} src={item.image} alt={`${item.title} by ${item.artist}`}/>
    <div className="cart-line-info"><h3>{item.title}</h3><p>{item.artist}</p>{animatedQuantity ? <AnimatePresence mode="popLayout" initial={false}><motion.strong key={item.quantity} className="cart-line-total" aria-live="polite" aria-label={`Line subtotal ${formatINR(lineTotal)}`} initial={reducedMotion ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reducedMotion ? undefined : { y: -8, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}>{formatINR(lineTotal)}</motion.strong></AnimatePresence> : <strong aria-label={`Line subtotal ${formatINR(lineTotal)}`}>{formatINR(lineTotal)}</strong>}
      <div className="cart-line-controls">{animatedQuantity ? <QuantityStepper className="cart-quantity-stepper" value={item.quantity} onValueChange={(quantity) => changeQuantity(item.id, quantity)} min={1} max={MAX_CART_QUANTITY} ariaLabel={`${item.title} quantity`} disabled={pending}/> : <div className="cart-quantity" aria-label={`Quantity for ${item.title}`}><button type="button" aria-label={`Decrease ${item.title} quantity`} disabled={pending || item.quantity <= 1} onClick={() => changeQuantity(item.id, item.quantity - 1)}><Minus size={13}/></button><span aria-live="polite">{item.quantity}</span><button type="button" aria-label={`Increase ${item.title} quantity`} disabled={pending || item.quantity >= MAX_CART_QUANTITY} onClick={() => changeQuantity(item.id, item.quantity + 1)}><Plus size={13}/></button></div>}
        <button className="cart-remove" type="button" disabled={pending} onClick={() => void remove(item.id, item.title)} aria-label={`Remove ${item.title} from bag`}>{pending ? <LoaderCircle className="cart-control-spinner" size={14}/> : <Trash2 size={14}/>}<span>{pending ? 'Updating' : 'Remove'}</span></button>
      </div>
    </div>
  </article>
  })}</div>
}

export function CartModal({ open, onClose, onDiscover, returnFocusRef }: CartModalProps) {
  const { items, itemCount, subtotal, loading, error, authenticated, retry } = useCart()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const returnFocusTarget = returnFocusRef.current
    const releaseScrollLock = lockBodyScroll()
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      releaseScrollLock()
      window.removeEventListener('keydown', handleKeyDown)
      returnFocusTarget?.focus()
    }
  }, [open, onClose, returnFocusRef])

  if (typeof document === 'undefined') return null
  return createPortal(<AnimatePresence>
    {open && <>
      <motion.div className="cart-modal-backdrop" key="cart-backdrop" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}/>
      <motion.div className="cart-modal" ref={panelRef} key="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title" initial={reducedMotion ? false : { opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}>
        <div className="cart-modal-header"><div><div className="cart-modal-kicker">YOUR COLLECTION</div><h2 id="cart-modal-title">Your Bag {loading ? <Skeleton className="cart-bag-count-skeleton" /> : <span>({itemCount})</span>}</h2></div><button ref={closeRef} className="cart-modal-close" type="button" aria-label="Close shopping bag" onClick={onClose}><X size={20}/></button></div>
        {loading ? <>
          <div className="cart-modal-items cart-modal-items-skeleton" role="status" aria-label="Loading shopping bag" aria-busy="true"><CartLineItemsSkeleton count={2}/></div>
          <div className="cart-modal-footer cart-modal-footer-skeleton" aria-hidden="true">
            <div className="cart-subtotal"><Skeleton shape="text" className="cart-skeleton-subtotal-label"/><Skeleton shape="text" className="cart-skeleton-subtotal-value"/></div>
            <Skeleton shape="text" className="cart-skeleton-note"/>
            <Skeleton className="cart-skeleton-checkout"/>
          </div>
        </>
        : error ? <div className="cart-empty-state" role="alert"><div className="cart-empty-mark"><ShoppingBag size={24} strokeWidth={1.3}/></div><h3>{error.status === 404 ? 'This artwork is no longer available.' : error.status === 500 ? 'Your bag could not be loaded.' : 'Could not connect to your bag.'}</h3><p>{error.message}</p><button className="cart-discover-button" type="button" onClick={retry}>Try again</button></div>
        : items.length === 0 ? <div className="cart-empty-state"><div className="cart-empty-mark"><ShoppingBag size={24} strokeWidth={1.3}/></div><h3>Your bag is waiting for something special.</h3><p>When a piece feels like yours, you'll find it here.</p><button className="cart-discover-button" type="button" onClick={onDiscover}>Explore Artwork <ArrowRight size={16}/></button></div>
        : <><div className="cart-modal-items"><CartLineItems animatedQuantity/></div><div className="cart-modal-footer"><div className="cart-subtotal"><span>Subtotal</span><strong>{formatINR(subtotal)}</strong></div><p>Shipping and taxes are calculated at checkout.</p><button className="cart-checkout-button" type="button" disabled>Continue to Checkout <ArrowRight size={16}/></button><div className="cart-checkout-note" role="note">Checkout is not connected yet. {authenticated ? 'Your bag is saved to your account.' : 'Your guest bag is saved on this device.'}</div></div></>}
      </motion.div>
    </>}
  </AnimatePresence>, document.body)
}
