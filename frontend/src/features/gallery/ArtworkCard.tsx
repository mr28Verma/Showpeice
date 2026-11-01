import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Heart, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../cart/CartContext'
import { formatINR } from '../../utils/formatCurrency'
import type { Artwork } from '../../types/artwork'
import { useMarket } from './MarketContext'
import { GlowingEffect } from '../../components/ui/glowing-effect'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'

const photo = (id: string, width = 850) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

export function ArtworkCard({ item, index }: { item: Artwork; index: number }) {
  const { favorites, toggleFavorite } = useMarket()
  const { addItem } = useCart()
  const isFavorite = favorites.includes(item.id)
  const [isVisible, setIsVisible] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window))
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return
    const card = cardRef.current
    if (!card) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' })
    observer.observe(card)
    return () => observer.disconnect()
  }, [item.id])

  return (
    <article
      ref={cardRef}
      data-artwork-card={item.id}
      className={`art-card art-${item.shape}${isVisible ? ' is-visible' : ''}`}
      style={{ '--card-index': index } as CSSProperties}
    >
      <div className="art-card-glow" aria-hidden="true">
        <GlowingEffect
          spread={40}
          glow
          variant="white"
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          className="art-card-glow-layer"
        />
      </div>
      <div className="art-image">
        <Link className="art-image-link" to={`/artwork/${item.id}`} aria-label={`View ${item.title}`}>
          <ProtectedArtworkImage
            isProtected={item.isProtected}
            src={photo(item.image)}
            alt={`${item.title}, artwork by ${item.artist}`}
            loading="lazy"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        </Link>
        <button
          className={isFavorite ? 'favorite is-favorite' : 'favorite'}
          type="button"
          onClick={() => toggleFavorite(item.id)}
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${item.title} ${isFavorite ? 'from' : 'to'} favourites`}
          aria-pressed={isFavorite}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <span className="art-category">{item.category}</span>
      </div>
      <div className="art-meta">
        <div>
          <h3><Link to={`/artwork/${item.id}`}>{item.title}</Link></h3>
          <p><Link to={`/artist/${item.artistId}`}>{item.artist}</Link></p>
        </div>
        <strong>{formatINR(item.price)}</strong>
      </div>
      <button
        className="art-add-to-bag"
        type="button"
        onClick={() => addItem({ id: item.id, title: item.title, artist: item.artist, price: formatINR(item.price), image: photo(item.image, 500), isProtected: item.isProtected })}
      >
        Add to bag <ShoppingBag size={14} />
      </button>
    </article>
  )
}
