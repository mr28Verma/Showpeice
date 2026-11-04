import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, Outlet, useLocation } from 'react-router-dom'
import { CartProvider } from '../features/cart/CartContext'
import { MarketProvider } from '../features/gallery/MarketContext'
import { SiteFooter, SiteNavbar } from '../features/gallery/SiteChrome'
import { LoginPage, RegisterPage, ForgotPasswordPage } from '../features/auth/AuthPages'
import { CartPage } from '../pages/Cart/CartPage'
import { LiveArtistDirectoryPage, ArtworkDetailPage, CategoryPage, CollectionPage, NotFoundPage } from '../features/gallery/GalleryPages'
import { GalleryPage } from '../features/gallery/GalleryPage'
import { HomePage } from '../pages/Home/HomePage'
import { ArtistDashboard } from '../pages/Artist/ArtistDashboard'
import { BuyerDashboard } from '../pages/Buyer/BuyerDashboard'
import { PublicArtistPage } from '../pages/Artist/PublicArtistPage'
import { BlogArticlePage, BlogIndexPage } from '../pages/Blog/BlogPages'
import { HelpPage } from '../pages/Help/HelpPage'
import { CookieConsentBanner, CookieConsentProvider } from '../features/privacy/CookieConsent'
import { RequireAccountRole } from './RequireAccountRole'

function MarketLayout() {
  const location = useLocation()
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    const targetId = decodeURIComponent(location.hash.slice(1))
    const timer = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' }), 0)
    return () => window.clearTimeout(timer)
  }, [location.pathname, location.hash])
  return <div className="site-shell"><SiteNavbar/><Outlet/><SiteFooter/></div>
}

export function AppRoutes() {
  return <CartProvider><MarketProvider><BrowserRouter><CookieConsentProvider><CookieConsentBanner/><Routes>
    <Route element={<MarketLayout/>}>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/help" element={<HelpPage/>}/>
      <Route path="/blog" element={<BlogIndexPage/>}/>
      <Route path="/blog/:slug" element={<BlogArticlePage/>}/>
      <Route path="/gallery" element={<GalleryPage/>}/>
      <Route path="/artwork/:id" element={<ArtworkDetailPage/>}/>
      <Route path="/artists" element={<LiveArtistDirectoryPage/>}/>
      <Route path="/artists/:slug" element={<PublicArtistPage/>}/>
      <Route path="/artist/:slug" element={<PublicArtistPage/>}/>
      <Route path="/categories/:category" element={<CategoryPage/>}/>
      <Route path="/collections/:id" element={<CollectionPage/>}/>
      <Route path="*" element={<NotFoundPage/>}/>
    </Route>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/register" element={<RegisterPage/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
    <Route path="/cart" element={<CartPage/>}/>
    <Route path="/artist/dashboard" element={<RequireAccountRole role="artist"><ArtistDashboard/></RequireAccountRole>}/>
    <Route path="/buyer/dashboard" element={<RequireAccountRole role="buyer"><BuyerDashboard/></RequireAccountRole>}/>
  </Routes></CookieConsentProvider></BrowserRouter></MarketProvider></CartProvider>
}
