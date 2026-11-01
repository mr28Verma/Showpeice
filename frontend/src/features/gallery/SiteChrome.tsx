import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { FaFacebookF, FaInstagram, FaLinkedin, FaPinterestP, FaXTwitter } from 'react-icons/fa6'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { artwork } from '../../data/artworks'
import { CartModal } from '../cart/CartModal'
import { useCart } from '../cart/CartContext'
import { useMarket } from './MarketContext'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'

function NavMotionItem({ selected, reducedMotion, onSelect, children, underline = true }: { selected: boolean; reducedMotion: boolean; onSelect: () => void; children: ReactNode; underline?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const showUnderline = underline && (selected || hovered)
  return <motion.div className="nav-motion-item" variants={{ hidden: { opacity: 0, y: reducedMotion ? 0 : -5 }, show: { opacity: 1, y: 0 } }} transition={{ duration: reducedMotion ? 0 : 0.32 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={() => setHovered(false)} onClick={onSelect}>
    <div className="nav-item-link">{children}<motion.span className="nav-underline" aria-hidden="true" initial={false} animate={{ scaleX: showUnderline ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}/></div>
  </motion.div>
}

export function SiteNavbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const cart = useCart()
  const { query, setQuery } = useMarket()
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion ?? false
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeNav, setActiveNav] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const bagButtonRef = useRef<HTMLButtonElement>(null)

  const token = localStorage.getItem('showpeice_token')
  const userRole = (() => {
    try {
      const u = localStorage.getItem('showpeice_user')
      return u ? JSON.parse(u).role : null
    } catch {
      return null
    }
  })()
  const dashboardPath = userRole === 'seller' || userRole === 'artist'
    ? '/artist/dashboard'
    : userRole === 'buyer'
      ? '/buyer/dashboard'
      : '/login'

  useEffect(() => {
    const handleScroll = () => setScrolled(!reducedMotion && window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [reducedMotion])

  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSearchOpen(false) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const scrollTo = useCallback((id: string) => {
    if (location.pathname !== '/' || location.hash !== `#${id}`) navigate(`/#${id}`)
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), location.pathname === '/' ? 0 : 80)
  }, [location.hash, location.pathname, navigate, reducedMotion])
  const closeCart = useCallback(() => setCartOpen(false), [])
  const selectNavigationItem = (label: string, sectionId: string) => {
    setActiveNav(label)
    setMobileMenuOpen(false)
    scrollTo(sectionId)
  }
  const discoverFromCart = useCallback(() => {
    setCartOpen(false)
    if (location.pathname !== '/') navigate('/#artwork')
    window.setTimeout(() => document.getElementById('artwork')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), 80)
  }, [location.pathname, navigate, reducedMotion])
  const searchResults = query.trim().length >= 2 ? artwork.filter((item) => `${item.title} ${item.artist} ${item.category} ${item.medium}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : []
  const submitSearch = () => { setSearchOpen(false); navigate(`/#artwork`); window.setTimeout(() => document.getElementById('artwork')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), 80) }

  return <>
    <motion.header className={`site-header${scrolled ? ' is-scrolled' : ''}`} initial={reducedMotion ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.42, ease: 'easeOut' }}>
        <motion.div className="nav-pill">
        <motion.div className="wordmark" initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.12 }} whileHover={reducedMotion ? undefined : { y: -1 }}><Link className="wordmark-anchor" to="/" aria-label="Showpeice home"><img className="brand-logo" src="/showpeice-logo.svg" alt=""/><strong className="brand-name">Showpeice</strong></Link></motion.div>
        <motion.nav className="main-nav" aria-label="Main navigation" initial={reducedMotion ? false : 'hidden'} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : 0.055, delayChildren: reducedMotion ? 0 : 0.12 } } }}>
          <NavMotionItem selected={activeNav === 'Home'} reducedMotion={reducedMotion} onSelect={() => selectNavigationItem('Home', 'home')}><Link to="/#home">Home</Link></NavMotionItem>
          <NavMotionItem selected={activeNav === 'Artworks'} reducedMotion={reducedMotion} onSelect={() => selectNavigationItem('Artworks', 'artwork')}><Link to="/#artwork">Artworks</Link></NavMotionItem>
          <NavMotionItem selected={activeNav === 'Artists'} reducedMotion={reducedMotion} onSelect={() => selectNavigationItem('Artists', 'sell')}><Link to="/#sell">Artists</Link></NavMotionItem>
          <NavMotionItem selected={activeNav === 'Journal'} reducedMotion={reducedMotion} onSelect={() => selectNavigationItem('Journal', 'journal')}><Link to="/#journal">Journal</Link></NavMotionItem>
        </motion.nav>
        <motion.div className="header-actions" initial={reducedMotion ? false : 'hidden'} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : 0.075, delayChildren: reducedMotion ? 0 : 0.18 } } }}>
          <motion.div className="selling-cta-wrap" variants={{ hidden: { opacity: 0, y: reducedMotion ? 0 : 5 }, show: { opacity: 1, y: 0 } }} transition={{ duration: reducedMotion ? 0 : 0.3 }} whileHover={reducedMotion ? undefined : { scale: 1.035 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}><Link className="selling-cta" to="/login?role=artist">Start selling</Link></motion.div>
          <button className="icon-button mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
          <motion.button className="icon-button search-toggle" aria-label={searchOpen ? 'Close search' : 'Search artwork'} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)} whileHover={reducedMotion ? undefined : { y: -2, backgroundColor: '#ececec' }} whileTap={reducedMotion ? undefined : { scale: 0.96 }} variants={{ hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.9 }, show: { opacity: 1, scale: 1 } }} transition={{ duration: reducedMotion ? 0 : 0.22 }}><AnimatePresence mode="wait" initial={false}><motion.span className="icon-swap" key={searchOpen ? 'close' : 'search'} initial={reducedMotion ? false : { opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={reducedMotion ? undefined : { opacity: 0, scale: 0.88 }} transition={{ duration: reducedMotion ? 0 : 0.14 }}>{searchOpen ? <X size={20}/> : <Search size={20}/>}</motion.span></AnimatePresence></motion.button>
          <motion.button className="icon-button account-toggle" aria-label="Account" title="Account" onClick={() => navigate(token ? dashboardPath : '/login')} whileHover={reducedMotion ? undefined : { y: -2, backgroundColor: '#ececec' }} whileTap={reducedMotion ? undefined : { scale: 0.96 }} variants={{ hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.9 }, show: { opacity: 1, scale: 1 } }} transition={{ duration: reducedMotion ? 0 : 0.22 }}><UserRound size={20}/></motion.button>
          <motion.button ref={bagButtonRef} className="icon-button bag-toggle" aria-label={cart.itemCount ? `Shopping bag, ${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'}` : 'Shopping bag'} aria-expanded={cartOpen} aria-controls="cart-modal-title" title="Shopping bag" onClick={() => setCartOpen(true)} whileHover={reducedMotion ? undefined : { y: -2, backgroundColor: '#ececec' }} whileTap={reducedMotion ? undefined : { scale: 0.96 }} variants={{ hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.9 }, show: { opacity: 1, scale: 1 } }} transition={{ duration: reducedMotion ? 0 : 0.22 }}><ShoppingBag size={20}/>{cart.itemCount > 0 && <span className="bag-count" aria-hidden="true">{cart.itemCount > 99 ? '99+' : cart.itemCount}</span>}</motion.button>
          <Link className="sign-in-toggle" to={token ? dashboardPath : '/login'}>{token ? 'Dashboard' : 'Sign in'}</Link>
          <AnimatePresence initial={false}>{searchOpen && <motion.div className="search-panel" initial={reducedMotion ? false : { opacity: 0, height: 0, y: -7 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, height: 0, y: -5 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}><form className="search-panel-inner" role="search" onSubmit={(event) => { event.preventDefault(); submitSearch() }}><input ref={searchInputRef} className="header-search" aria-label="Search artwork" placeholder="Search artwork…" value={query} onChange={(event) => setQuery(event.target.value)}/><button className="search-close" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={18}/></button></form>{query.trim().length >= 2 && <div className="search-results">{searchResults.length ? searchResults.map((item) => <Link key={item.id} to={`/artwork/${item.id}`} onClick={() => setSearchOpen(false)}><ProtectedArtworkImage isProtected={item.isProtected} src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=100&q=80`} alt=""/><span><strong>{item.title}</strong><small>{item.artist} · {item.category}</small></span><ArrowUpRight size={15}/></Link>) : <p>No artworks found. Try a different search.</p>}</div>}</motion.div>}</AnimatePresence>
        </motion.div>
      </motion.div>
      <AnimatePresence>{mobileMenuOpen && <motion.nav id="mobile-primary-navigation" className="mobile-nav" aria-label="Mobile navigation" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
        <Link className="mobile-nav-link" to="/#home" aria-current={activeNav === 'Home' ? 'page' : undefined} onClick={() => selectNavigationItem('Home', 'home')}>Home</Link>
        <Link className="mobile-nav-link" to="/#artwork" aria-current={activeNav === 'Artworks' ? 'page' : undefined} onClick={() => selectNavigationItem('Artworks', 'artwork')}>Artworks</Link>
        <Link className="mobile-nav-link" to="/#sell" aria-current={activeNav === 'Artists' ? 'page' : undefined} onClick={() => selectNavigationItem('Artists', 'sell')}>Artists</Link>
        <Link className="mobile-nav-link" to="/#journal" aria-current={activeNav === 'Journal' ? 'page' : undefined} onClick={() => selectNavigationItem('Journal', 'journal')}>Journal</Link>
      </motion.nav>}</AnimatePresence>
    </motion.header>
    <CartModal open={cartOpen} onClose={closeCart} onDiscover={discoverFromCart} returnFocusRef={bagButtonRef}/>
  </>
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-card">
      <div className="footer-rule" />
      <div className="footer-main">
        <Link className="wordmark footer-brand-name" to="/" aria-label="Showpeice home"><img className="brand-logo" src="/showpeice-logo.svg" alt=""/><strong>Showpeice</strong></Link>
        <nav className="footer-nav" aria-label="Footer navigation">
          <Link to="/#artwork">Products</Link>
          <Link to="/login?role=artist">Studio</Link>
          <Link to="/artists">Clients</Link>
          <Link to="/#newsletter">Pricing</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/help">Help &amp; Feedback</Link>
          <Link to="/#newsletter">Privacy</Link>
          <Link to="/#newsletter">Terms</Link>
        </nav>
      </div>
      <div className="footer-divider" />
      <div className="footer-bottom">
        <span>© Showpeice. All rights reserved.</span>
        <div className="footer-socials" role="group" aria-label="Social media links">
          <a href="https://x.com/your-showpeice-profile" target="_blank" rel="noreferrer" aria-label="X / Twitter" title="X / Twitter"><FaXTwitter aria-hidden="true" /></a>
          <a href="https://www.linkedin.com/in/your-showpeice-profile" target="_blank" rel="noreferrer" aria-label="LinkedIn" title="LinkedIn"><FaLinkedin aria-hidden="true" /></a>
          <a href="https://www.pinterest.com/your-showpeice-profile" target="_blank" rel="noreferrer" aria-label="Pinterest" title="Pinterest"><FaPinterestP aria-hidden="true" /></a>
          <a href="https://www.facebook.com/your-showpeice-profile" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook"><FaFacebookF aria-hidden="true" /></a>
          <a href="https://www.instagram.com/your-showpeice-profile" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram"><FaInstagram aria-hidden="true" /></a>
        </div>
      </div>
    </div>
  </footer>
}
