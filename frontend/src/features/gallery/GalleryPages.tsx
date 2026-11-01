import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Heart, ShoppingBag } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { artwork } from '../../data/artworks'
import { artworkCategories } from '../../data/categories'
import { artists } from '../../data/artists'
import { curatedCollections } from '../../data/collections'
import { useCart } from '../cart/CartContext'
import { formatINR } from '../../utils/formatCurrency'
import { useMarket } from './MarketContext'
import { ArtworkCard } from './ArtworkCard'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { apiAssetUrl, apiUrl } from '../../lib/api'

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
  }, [])

  return <main className="route-page section-wrap">
    <div className="eyebrow"><span className="eyebrow-line"/> INDEPENDENT MAKERS</div><h1 className="route-title">Meet the artists<em>.</em></h1>
    <p className="route-intro">Discover independent makers and the works they have chosen to share.</p>
    {error ? <p role="alert">{error}</p> : !artists ? <p role="status">Loading artist profiles…</p> : artists.length ? <div className="artist-directory-grid">{artists.map(artist => {
      const name = artist.displayName?.trim() || (artist.firstName + ' ' + artist.lastName).trim()
      return <Link to={'/artist/' + artist.slug} className="artist-card" key={artist.id}>
        <div className="artist-portrait">{artist.avatarUrl ? <img src={apiAssetUrl(artist.avatarUrl)} alt={name + ' profile'} loading="lazy"/> : <span className="artist-directory-initials" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}<ArrowUpRight size={18}/></div>
        <h3>{name}</h3><div className="artist-specialty">{[artist.medium, artist.location].filter(Boolean).join(' · ') || 'Independent artist'}</div><p>{artist.bio || 'Sharing original works with the Showpeice community.'}</p><span className="artist-view-link">{artist.followerCount.toLocaleString('en-IN')} followers · {artist.publishedArtworkCount} works</span>
      </Link>
    })}</div> : <p>No public artist profiles are available yet.</p>}
  </main>
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
  const [liveDetail, setLiveDetail] = useState<{ key: string; artist: LiveArtistDetail; item: LiveArtworkDetail } | { key: string; error: true } | null>(null)
  const { addItem } = useCart()
  const { favorites, toggleFavorite } = useMarket()
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
      .catch(() => {
        if (!controller.signal.aborted) setLiveDetail({ key: requestKey, error: true })
      })
    return () => controller.abort()
  }, [artistSlug, id, requestKey])

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
    if (artistSlug && !loadFailed) return <main className="route-page section-wrap" role="status">Loading artwork…</main>
    return <NotFoundPage/>
  }

  const isFavorite = favorites.includes(item.id)
  const addToBag = () => {
    if (!item.imageSrc) return
    addItem({ id: item.id, title: item.title, artist: item.artist, price: formatINR(item.price), image: item.imageSrc, isProtected: item.isProtected })
    setAdded(true)
  }

  return <main className="artwork-detail-page section-wrap">
    <div className="artwork-detail-image">{item.imageSrc ? <ProtectedArtworkImage isProtected={item.isProtected} src={item.imageSrc} alt={`${item.title}, an original work by ${item.artist}`} onError={(event) => { event.currentTarget.style.display = 'none' }}/> : <div className="artwork-detail-image-placeholder">Artwork image unavailable</div>}</div>
    <section className="artwork-detail-copy"><div className="eyebrow"><span className="eyebrow-line"/> {item.category.toUpperCase()}</div><h1 className="route-title">{item.title}<em>.</em></h1><Link className="detail-artist-link" to={`/artist/${item.artistId}`}>by {item.artist} <ArrowUpRight size={14}/></Link><p className="artwork-detail-description">{item.description}</p>{(item.medium || item.dimensions) && <div className="artwork-specs">{item.medium && <div><span>MEDIUM</span><strong>{item.medium}</strong></div>}{item.dimensions && <div><span>DIMENSIONS</span><strong>{item.dimensions}</strong></div>}</div>}<div className="artwork-detail-price">{formatINR(item.price)}</div><div className="artwork-detail-actions"><button className="button button-dark" onClick={addToBag} disabled={!item.imageSrc}>Add to bag <ShoppingBag size={16}/></button><button className={isFavorite ? 'detail-favorite is-favorite' : 'detail-favorite'} onClick={() => toggleFavorite(item.id)} aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={isFavorite}><Heart size={19} fill={isFavorite ? 'currentColor' : 'none'}/></button></div>{added && <p className="detail-added-message" role="status">Added to your bag. Open the bag icon to review your selection.</p>}<p className="detail-prototype-note">Checkout is not connected yet.</p></section>
  </main>
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
