import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, Heart, ShoppingBag } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { artwork as art } from '../../data/artworks'
import { useMarket } from '../../features/gallery/MarketContext'
import { useCart } from '../../features/cart/CartContext'
import { formatINR } from '../../utils/formatCurrency'
import { Spotlight } from '../../components/ui/spotlight-new'
import { InfiniteMovingCards } from '../../components/ui/infinite-moving-cards'
import { DraggableCardBody, DraggableCardContainer } from '../../components/ui/draggable-card'
import { CanvasText } from '../../components/ui/canvas-text'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { JournalSection } from '../Blog/BlogPages'

const photo = (id: string, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
const artworkProtection = (image: string) => art.find((item) => item.image === image)?.isProtected
const heroPhrases = ['Discover art', 'Collect beauty', 'Support artists', 'Find your story']
const artworkNotes = art.map((item) => ({ quote: item.description, name: item.title, title: item.artist }))
const newsletterCanvasColors = [
  'rgba(245, 245, 245, 0.98)',
  'rgba(220, 220, 220, 0.9)',
  'rgba(255, 255, 255, 0.84)',
  'rgba(190, 190, 190, 0.88)',
  'rgba(245, 245, 245, 0.92)',
  'rgba(210, 210, 210, 0.86)',
]
export function HomePage() {
  const navigate = useNavigate()
  const { query, setQuery, favorites, toggleFavorite } = useMarket()
  const { addItem } = useCart()
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const subscriptionTimer = useRef<number | null>(null)
  const [heroPhraseIndex, setHeroPhraseIndex] = useState(0)
  const [motionAllowed, setMotionAllowed] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setMotionAllowed(!preference.matches)
    preference.addEventListener('change', updatePreference)
    updatePreference()
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!motionAllowed) return
    const timer = window.setInterval(() => setHeroPhraseIndex((index) => (index + 1) % heroPhrases.length), 2800)
    return () => window.clearInterval(timer)
  }, [motionAllowed])

  useEffect(() => () => { if (subscriptionTimer.current !== null) window.clearTimeout(subscriptionTimer.current) }, [])

  const visibleArt = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return art
    return art.filter((item) => `${item.title} ${item.artist} ${item.category}`.toLowerCase().includes(search))
  }, [query])

  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || subscribing || subscribed) return
    setSubscribing(true)
    subscriptionTimer.current = window.setTimeout(() => { subscriptionTimer.current = null; setSubscribing(false); setSubscribed(true) }, 650)
  }
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return <main id="top">


      <section className="hero section-wrap" id="home">
        {motionAllowed && <div className="hero-spotlight" aria-hidden="true"><Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(0, 0%, 95%, .08) 0, hsla(0, 0%, 75%, .02) 50%, hsla(0, 0%, 65%, 0) 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(0, 0%, 95%, .06) 0, hsla(0, 0%, 75%, .02) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(0, 0%, 95%, .04) 0, hsla(0, 0%, 65%, .02) 80%, transparent 100%)"
        /></div>}
        <div className="hero-copy">
          <h1>Find art that<br/>feels like <em>you.</em></h1>
          <div className="hero-rotator" aria-label={`A place to ${heroPhrases[heroPhraseIndex]}`}><span className="rotator-prefix">A place to</span><span className="rotator-window" aria-live="polite" aria-atomic="true"><span key={heroPhraseIndex} className="rotator-word">{heroPhrases[heroPhraseIndex]}</span><span className="rotator-measure" aria-hidden="true">Support artists</span></span></div>
          <p className="hero-intro">Original works, independent artists, and extraordinary pieces waiting to find their place in your world.</p>
          <div className="hero-actions"><button className="button button-dark hero-primary-cta" onClick={() => scrollTo('artwork')}>Explore artwork <ArrowRight size={16}/></button><button className="text-link hero-secondary-cta" onClick={() => navigate('/login?role=artist')}>Sell your art <ArrowUpRight size={15}/></button></div>
        </div>
        <div className="hero-art" aria-label="A collage of contemporary artwork">
          <div className="hero-image hero-image-main"><ProtectedArtworkImage isProtected={artworkProtection('photo-1541961017774-22349e4a1262')} src={photo('photo-1541961017774-22349e4a1262', 1100)} alt="Expressive abstract painting in warm colours"/><span className="image-caption">01 — A study in becoming</span></div>
          <div className="hero-image hero-image-small"><ProtectedArtworkImage isProtected={artworkProtection('photo-1579783902614-a3fb3927b6a5')} src={photo('photo-1579783902614-a3fb3927b6a5', 650)} alt="Framed contemporary painting in a gallery"/></div>
          <div className="hero-note"><span>Curated with<br/>feeling.</span><span className="note-mark">✳</span></div>
          <div className="hero-image hero-image-bottom"><ProtectedArtworkImage isProtected={artworkProtection('photo-1578301978693-85fa9c0320b9')} src={photo('photo-1578301978693-85fa9c0320b9', 650)} alt="Colourful original artwork"/></div>
        </div>
      </section>

      <section className="draggable-artwork-section" id="artwork" aria-labelledby="draggable-artwork-heading">
        <div className="section-wrap draggable-artwork-inner">
          <div className="draggable-artwork-heading">
            <div className="eyebrow"><span className="eyebrow-line"/> THE WORK, UP CLOSE</div>
            <div className="draggable-artwork-heading-row">
              <h2 id="draggable-artwork-heading">Find a piece<br/><em>to live with.</em></h2>
              <p>Original works by independent artists, gathered in one place. Drag a card to take a closer look.</p>
            </div>
          </div>
          {visibleArt.length > 0 ? (
            <DraggableCardContainer className="draggable-artwork-stage">
              {visibleArt.map((item, index) => {
                const isFavorite = favorites.includes(item.id)
                return (
                  <DraggableCardBody key={item.id} className={`draggable-artwork-card draggable-artwork-card--${index + 1}`}>
                    <Link className="draggable-artwork-image" to={`/artwork/${item.id}`} aria-label={`View ${item.title}`}>
                      <ProtectedArtworkImage isProtected={item.isProtected} src={photo(item.image, 900)} alt={`${item.title}, artwork by ${item.artist}`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }}/>
                      <span className="draggable-artwork-category">{item.category}</span>
                    </Link>
                    <div className="draggable-artwork-meta">
                      <div className="draggable-artwork-title">
                        <h3><Link to={`/artwork/${item.id}`}>{item.title}</Link></h3>
                        <Link className="draggable-artwork-artist" to={`/artist/${item.artistId}`}>{item.artist}</Link>
                      </div>
                      <div className="draggable-artwork-actions">
                        <button className={isFavorite ? 'is-favorite' : ''} type="button" aria-label={`${isFavorite ? 'Remove' : 'Add'} ${item.title} ${isFavorite ? 'from' : 'to'} favourites`} aria-pressed={isFavorite} onClick={() => toggleFavorite(item.id)}>
                          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" aria-label={`Add ${item.title} to bag`} onClick={() => addItem({ id: item.id, title: item.title, artist: item.artist, price: formatINR(item.price), image: photo(item.image, 500), isProtected: item.isProtected })}>
                          <ShoppingBag size={16} />
                        </button>
                      </div>
                    </div>
                  </DraggableCardBody>
                )
              })}
            </DraggableCardContainer>
          ) : (
            <div className="draggable-artwork-empty">
              <p>No artworks match “{query}”.</p>
              <button type="button" onClick={() => setQuery('')}>Clear search</button>
            </div>
          )}
        </div>
      </section>

      <section className="sell-section" id="sell"><div className="sell-copy"><div className="eyebrow eyebrow-light"><span className="eyebrow-line"/> MADE FOR MAKERS</div><h2>Your work deserves<br/>a <em>wider world.</em></h2><p>Create your artist profile, share your work, and connect with people who see what you see.</p><button className="button button-light" onClick={() => navigate('/login?role=artist')}>Start selling <ArrowRight size={16}/></button><span className="sell-aside">A GOOD PLACE<br/>TO BEGIN ↗</span></div>
        <div className="sell-visual"><div className="store-window"><div className="store-top"><span className="store-brand">your studio<span>®</span></span><span>SHOP&nbsp; &nbsp; ABOUT&nbsp; &nbsp; CONTACT</span><span>MENU</span></div><div className="store-content"><div><span className="store-kicker">AN ARTIST'S SPACE</span><h3>Make room<br/>for <em>what moves you.</em></h3><span className="store-cta">EXPLORE THE COLLECTION ↗</span></div><ProtectedArtworkImage isProtected={artworkProtection('photo-1541961017774-22349e4a1262')} src={photo('photo-1541961017774-22349e4a1262', 650)} alt="Preview of an artist's online storefront" loading="lazy"/></div><div className="store-bottom"><span>ANANYA RAO · MUMBAI, INDIA</span><span>ORIGINALS, ALWAYS.</span></div></div><span className="sell-side-note">YOUR STUDIO, ON YOUR TERMS.</span></div></section>

      <section className="testimonial-section artwork-notes-section" aria-labelledby="artwork-notes-heading">
        <div className="testimonial-inner">
          <div className="eyebrow"><span className="eyebrow-line" /> NOTES ON THE WORK</div>
          <h2 className="artwork-notes-heading" id="artwork-notes-heading">Stories held in<br /><em>every piece.</em></h2>
        </div>
        {artworkNotes.length > 0 && <InfiniteMovingCards items={artworkNotes} direction="right" speed="slow" className="artwork-notes-scroller" />}
      </section>

      <JournalSection/>

      <section className="newsletter-section section-wrap" id="newsletter"><div className="newsletter-left"><div className="eyebrow"><span className="eyebrow-line"/> LETTERS FROM THE GALLERY</div><h2 aria-label="Make room for more art.">Make room<br/>for <CanvasText text="more art." className="newsletter-canvas-text" backgroundClassName="newsletter-canvas-background" colors={newsletterCanvasColors} animationDuration={24} lineWidth={1.5} lineGap={4} curveIntensity={14}/></h2></div><div className="newsletter-right"><p>Discover new artists, thoughtful collections, and pieces worth remembering.</p><form className="newsletter-form" onSubmit={subscribe}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" required placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={subscribing || subscribed}/><button aria-label="Subscribe to newsletter" type="submit" disabled={subscribing || subscribed}>{subscribing ? 'SENDING…' : subscribed ? 'YOU’RE ON THE LIST ✓' : <>SUBSCRIBE <ArrowUpRight size={14}/></>}</button></form>{subscribing && <p className="success-message" role="status">Adding you to the Showpeice newsletter…</p>}{subscribed && <p className="success-message" role="status">Thanks for subscribing. This is a frontend preview; your address hasn’t been sent anywhere.</p>}<span className="privacy-note">NO NOISE. UNSUBSCRIBE WHENEVER.</span></div></section>

    </main>

}

