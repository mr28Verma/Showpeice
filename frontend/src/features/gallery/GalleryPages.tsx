import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Heart, RefreshCw, ShoppingBag } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { artwork } from '../../data/artworks'
import { artworkCategories } from '../../data/categories'
import { artists } from '../../data/artists'
import { curatedCollections } from '../../data/collections'
import { useCart } from '../cart/CartContext'
import { formatINR } from '../../utils/formatCurrency'
import { useMarket } from './MarketContext'
import { ArtworkCard } from './ArtworkCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { toast } from '../../components/ui/toast'

const photo = (id: string, width = 1100) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

type LiveArtworkDetail = {
  id: number
  title: string
  description: string
  price: number
  category: string
  imageUrl: string | null
  isProtected: boolean
  available: boolean
}

type LiveArtistDetail = {
  slug: string
  firstName: string
  lastName: string
  displayName: string | null
  artworks: LiveArtworkDetail[]
}

function ArtworkGrid({ items }: { items: typeof artwork }) {
  return items.length ? <div className="art-grid">{items.map((item, index) => <ArtworkCard key={item.id} item={item} index={index}/>)}</div> : <div className="empty-state">No works in this collection just yet.</div>
}

export function CategoryPage() {
  const { category: slug = '' } = useParams()
  const category = artworkCategories.find((item) => item.slug === slug)
  const items = slug === 'all' ? artwork : artwork.filter((item) => item.category === category?.filter)
  if (slug !== 'all' && !category) return <NotFoundPage/>
  return <main className="route-page section-wrap">
    <div className="eyebrow"><span className="eyebrow-line"/> THE SHOWPEICE GALLERY</div>
    <h1 className="route-title">{category?.name ?? 'All artwork'}<em>.</em></h1>
    <p className="route-intro">{category?.description ?? 'Original works by independent artists, gathered in one place.'}</p>
    <div className="route-meta">{items.length.toString().padStart(2, '0')} ORIGINAL WORKS</div>
    <ArtworkGrid items={items}/>
  </main>
}

export function ArtistDirectoryPage() {
  return <main className="route-page section-wrap">
    <div className="eyebrow"><span className="eyebrow-line"/> INDEPENDENT MAKERS</div><h1 className="route-title">Meet the artists<em>.</em></h1>
    <p className="route-intro">A growing community of thoughtful makers, each with a point of view of their own.</p>
    <p className="sample-data-note">Artist profiles shown here are sample content for the Showpeice preview.</p>
    <div className="artist-directory-grid">{artists.map((artist, index) => <Link to={`/artist/${artist.id}`} className="artist-card" key={artist.id}>
      <div className="artist-portrait"><img src={photo(artist.image, 750)} alt={`Portrait of ${artist.name}`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }}/><span className="artist-number">0{index + 1}</span><ArrowUpRight size={18}/></div>
      <h3>{artist.name}</h3><div className="artist-specialty">{artist.specialty} · {artist.location}</div><p>{artist.note}</p><span className="artist-view-link">View artist <ArrowUpRight size={13}/></span>
    </Link>)}</div>
  </main>
}

export function LiveArtistDirectoryPage() {
  type DirectoryArtist = { id: number; slug: string; firstName: string; lastName: string; displayName: string | null; bio: string | null; avatarUrl: string | null; medium: string | null; location: string | null; followerCount: number; publishedArtworkCount: number }
  const [artists, setArtists] = useState<DirectoryArtist[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(apiUrl('/artists'), { signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !Array.isArray(result.artists)) throw new Error(result.error || 'Artist profiles could not be loaded.')
        setArtists(result.artists)
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Artist profiles could not be loaded.') })
    return () => controller.abort()
  }, [attempt])

  return <main className="route-page section-wrap">
    <div className="eyebrow"><span className="eyebrow-line"/> INDEPENDENT MAKERS</div><h1 className="route-title">Meet the artists<em>.</em></h1>
    <p className="route-intro">Discover independent makers and the works they have chosen to share.</p>
    {error ? <div className="artist-directory-status" role="alert"><p>{error}</p><button type="button" className="button live-gallery-retry" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div> : !artists ? <div className="artist-directory-grid artist-directory-grid-skeleton" role="status" aria-label="Loading artist profiles" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <ArtistDirectoryCardSkeleton key={index}/>)}</div> : artists.length ? <div className="artist-directory-grid">{artists.map(artist => {
      const name = artist.displayName?.trim() || (artist.firstName + ' ' + artist.lastName).trim()
      return <Link to={'/artist/' + artist.slug} className="artist-card" key={artist.id}>
        <div className="artist-portrait">{artist.avatarUrl ? <img src={apiAssetUrl(artist.avatarUrl)} alt={name + ' profile'} loading="lazy"/> : <span className="artist-directory-initials" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}<ArrowUpRight size={18}/></div>
        <h3>{name}</h3><div className="artist-specialty">{[artist.medium, artist.location].filter(Boolean).join(' · ') || 'Independent artist'}</div><p>{artist.bio || 'Sharing original works with the Showpeice community.'}</p><span className="artist-view-link">{artist.followerCount.toLocaleString('en-IN')} followers · {artist.publishedArtworkCount} works</span>
      </Link>
    })}</div> : <p>No public artist profiles are available yet.</p>}
  </main>
}

function ArtistDirectoryCardSkeleton() {
  return (
    <article className="artist-card artist-directory-skeleton-card" aria-hidden="true">
      <div className="artist-portrait"><Skeleton className="artist-directory-skeleton-portrait"/></div>
      <Skeleton shape="text" className="artist-directory-skeleton-title"/>
      <Skeleton shape="text" className="artist-directory-skeleton-meta"/>
      <Skeleton shape="text" className="artist-directory-skeleton-copy"/>
      <Skeleton shape="text" className="artist-directory-skeleton-copy-short"/>
      <Skeleton shape="text" className="artist-directory-skeleton-link"/>
    </article>
  )
}

export function ArtistProfilePage() {
  const { id = '' } = useParams()
  const artist = artists.find((item) => item.id === id)
  if (!artist) return <NotFoundPage/>
  const works = artwork.filter((item) => item.artistId === artist.id)
  return <main className="artist-profile-page">
    <section className="artist-profile-hero section-wrap"><div className="artist-profile-photo"><img src={photo(artist.image, 1000)} alt={`Portrait of ${artist.name}`} onError={(event) => { event.currentTarget.style.display = 'none' }}/></div><div className="artist-profile-copy"><div className="eyebrow"><span className="eyebrow-line"/> SAMPLE ARTIST PROFILE</div><h1 className="route-title">{artist.name}<em>.</em></h1><p className="artist-profile-specialty">{artist.specialty} · {artist.location}</p><p>{artist.note} This profile is illustrative sample content; it does not represent a registered Showpeice artist.</p><Link className="text-link" to="/artists">Meet all artists <ArrowRight size={15}/></Link></div></section>
    <section className="section-wrap artist-works"><div className="route-section-heading"><div className="eyebrow"><span className="eyebrow-line"/> SELECTED WORKS</div><h2>Made by {artist.name.split(' ')[0]}.</h2></div><ArtworkGrid items={works}/></section>
  </main>
}

export function ArtworkDetailPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const artistSlug = searchParams.get('artist')
  const staticItem = artistSlug ? undefined : artwork.find((artworkItem) => artworkItem.id === Number(id))
  const [liveDetail, setLiveDetail] = useState<{ key: string; artist: LiveArtistDetail; item: LiveArtworkDetail } | { key: string; error: true; message: string } | null>(null)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const { addItem } = useCart()
  const { favorites, favoritesLoading, favoritesError, retryFavorites, toggleFavorite } = useMarket()
  const [added, setAdded] = useState(false)
  const requestKey = artistSlug ? `${artistSlug}:${id}` : ''

  useEffect(() => {
    if (!artistSlug) return
    const controller = new AbortController()
    fetch(apiUrl(`/artists/${encodeURIComponent(artistSlug)}`), { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as { artist?: LiveArtistDetail; error?: string }
        if (!response.ok || !result.artist) throw new Error(result.error || 'This artwork could not be loaded.')
        const item = result.artist.artworks.find((entry) => entry.id === Number(id))
        if (!item) throw new Error('This artwork could not be found.')
        setLiveDetail({ key: requestKey, artist: result.artist, item })
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLiveDetail({ key: requestKey, error: true, message: cause instanceof Error ? cause.message : 'This artwork could not be loaded.' })
      })
    return () => controller.abort()
  }, [artistSlug, id, requestKey, detailAttempt])

  const loadedDetail = liveDetail?.key === requestKey && 'item' in liveDetail ? liveDetail : null
  const loadFailed = liveDetail?.key === requestKey && 'error' in liveDetail
  const item = staticItem ? {
    id: staticItem.id,
    title: staticItem.title,
    artist: staticItem.artist,
    artistId: staticItem.artistId,
    category: staticItem.category,
    price: staticItem.price,
    description: staticItem.description,
    imageSrc: photo(staticItem.image, 1500),
    isProtected: staticItem.isProtected,
    medium: staticItem.medium,
    dimensions: staticItem.dimensions,
  } : loadedDetail ? {
    id: loadedDetail.item.id,
    title: loadedDetail.item.title,
    artist: loadedDetail.artist.displayName?.trim() || `${loadedDetail.artist.firstName} ${loadedDetail.artist.lastName}`.trim(),
    artistId: loadedDetail.artist.slug,
    category: loadedDetail.item.category,
    price: loadedDetail.item.price,
    description: loadedDetail.item.description,
    imageSrc: loadedDetail.item.imageUrl
      ? loadedDetail.item.imageUrl.startsWith('http') ? loadedDetail.item.imageUrl : apiAssetUrl(loadedDetail.item.imageUrl)
      : null,
    isProtected: loadedDetail.item.isProtected,
    medium: undefined,
    dimensions: undefined,
  } : null

  if (!item) {
    if (artistSlug && !loadFailed) return <ArtworkDetailSkeleton />
    if (artistSlug && loadFailed) return <main className="artwork-detail-error route-page section-wrap" role="alert">
      <div className="eyebrow"><span className="eyebrow-line"/> ARTWORK UNAVAILABLE</div>
      <h1 className="route-title">This piece could not be opened.</h1>
      <p>{liveDetail && 'message' in liveDetail ? liveDetail.message : 'The artwork could not be loaded.'}</p>
      <button type="button" className="button live-gallery-retry" onClick={() => { setLiveDetail(null); setDetailAttempt(value => value + 1) }}>Try again</button>
    </main>
    return <NotFoundPage/>
  }

  const isFavorite = favorites.includes(item.id)
  const addToBag = async () => {
    if (!item.imageSrc) return
    try {
      await addItem({ id: item.id, title: item.title, artist: item.artist, price: formatINR(item.price), image: item.imageSrc, isProtected: item.isProtected })
      setAdded(true)
      toast.success('Artwork added to your bag', item.title)
    } catch (error) {
      toast.error('Artwork could not be added', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return <main className="artwork-detail-page section-wrap">
    <div className="artwork-detail-image">{item.imageSrc ? <ProtectedArtworkImage isProtected={item.isProtected} src={item.imageSrc} alt={`${item.title}, an original work by ${item.artist}`} onError={(event) => { event.currentTarget.style.display = 'none' }}/> : <div className="artwork-detail-image-placeholder">Artwork image unavailable</div>}</div>
    <section className="artwork-detail-copy"><div className="eyebrow"><span className="eyebrow-line"/> {item.category.toUpperCase()}</div><h1 className="route-title">{item.title}<em>.</em></h1><Link className="detail-artist-link" to={`/artist/${item.artistId}`}>by {item.artist} <ArrowUpRight size={14}/></Link><p className="artwork-detail-description">{item.description}</p>{(item.medium || item.dimensions) && <div className="artwork-specs">{item.medium && <div><span>MEDIUM</span><strong>{item.medium}</strong></div>}{item.dimensions && <div><span>DIMENSIONS</span><strong>{item.dimensions}</strong></div>}</div>}<div className="artwork-detail-price">{formatINR(item.price)}</div><div className="artwork-detail-actions"><button className="button button-dark" onClick={addToBag} disabled={!item.imageSrc}>Add to bag <ShoppingBag size={16}/></button><button className={isFavorite ? 'detail-favorite is-favorite' : 'detail-favorite'} onClick={() => favoritesError ? retryFavorites() : toggleFavorite(item.id)} aria-label={favoritesError ? 'Retry loading saved artworks' : isFavorite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={favoritesError ? undefined : isFavorite} aria-busy={favoritesLoading}>{favoritesLoading ? <Skeleton shape="circle" className="favorite-action-skeleton" /> : favoritesError ? <RefreshCw size={16} aria-hidden="true" /> : <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'}/>}</button></div>{added && <p className="detail-added-message" role="status">Added to your bag. Open the bag icon to review your selection.</p>}<p className="detail-prototype-note">Checkout is not connected yet.</p></section>
  </main>
}

function ArtworkDetailSkeleton() {
  return (
    <main className="artwork-detail-page artwork-detail-skeleton" role="status" aria-label="Loading artwork details" aria-busy="true">
      <div className="artwork-detail-image"><Skeleton className="artwork-detail-skeleton-image"/></div>
      <section className="artwork-detail-copy" aria-hidden="true">
        <Skeleton shape="text" className="artwork-detail-skeleton-kicker"/>
        <Skeleton className="artwork-detail-skeleton-title"/>
        <Skeleton shape="text" className="artwork-detail-skeleton-artist"/>
        <div className="artwork-detail-skeleton-description"><Skeleton shape="text"/><Skeleton shape="text"/><Skeleton shape="text"/><Skeleton shape="text"/></div>
        <div className="artwork-detail-skeleton-specs"><Skeleton shape="text"/><Skeleton shape="text"/></div>
        <Skeleton className="artwork-detail-skeleton-price"/>
        <div className="artwork-detail-skeleton-actions"><Skeleton className="artwork-detail-skeleton-button"/><Skeleton shape="circle" className="artwork-detail-skeleton-favorite"/></div>
      </section>
    </main>
  )
}

export function CollectionPage() {
  const { id = '' } = useParams()
  const collection = curatedCollections.find((item) => item.id === id)
  if (!collection) return <NotFoundPage/>
  const works = artwork.filter((item) => collection.artworkIds.includes(item.id))
  return <main className="route-page section-wrap collection-detail-page">
    <div className="collection-detail-cover"><ProtectedArtworkImage isProtected={artwork.find((item) => item.image === collection.image)?.isProtected} src={photo(collection.image, 1500)} alt={`${collection.title} curated art collection`}/><span>{collection.label}</span></div>
    <div className="collection-detail-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> CURATED BY SHOWPEICE</div><h1 className="route-title">{collection.title}</h1></div><p>{collection.description}</p></div>
    <ArtworkGrid items={works}/>
  </main>
}

export function NotFoundPage() {
  const navigate = useNavigate()
  const goBack = () => {
    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
    else navigate('/')
  }

  return <main className="route-page section-wrap not-found-page">
    <div className="eyebrow"><span className="eyebrow-line"/> A QUIET DETOUR</div>
    <span className="not-found-mark" aria-hidden="true">✳</span>
    <p className="not-found-code">404</p>
    <h1 className="not-found-title">This piece seems to be missing.</h1>
    <p className="not-found-copy">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
    <div className="not-found-actions">
      <Link className="button not-found-primary" to="/">Explore artwork <ArrowRight size={16}/></Link>
      <button className="button not-found-secondary" type="button" onClick={goBack}><ArrowLeft size={15}/> Go back</button>
    </div>
  </main>
}
