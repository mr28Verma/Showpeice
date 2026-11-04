import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { ArrowRight, Check, ChevronDown, Heart, ImageOff, RefreshCw, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'
import { ArtworkGridSkeleton } from '../../components/ui/Skeleton'
import { CartModal } from '../cart/CartModal'
import { useCart } from '../cart/CartContext'
import { useMarket } from './MarketContext'
import { apiAssetUrl, apiUrl } from '../../lib/api'
import { formatINR } from '../../utils/formatCurrency'
import { toast } from '../../components/ui/toast'
import './GalleryPage.css'

type GalleryArtwork = {
  id: number
  title: string
  description: string
  price: number
  category: string
  imageUrl: string | null
  isProtected: boolean
  available: boolean
  createdAt: string
  updatedAt: string
  artist: {
    id: number
    slug: string
    firstName: string
    lastName: string
    displayName: string | null
  }
}

type SortOrder = 'newest' | 'price-low' | 'price-high'

type DropdownOption<T extends string> = {
  value: T
  label: string
}

const sortOptions: DropdownOption<SortOrder>[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
]

type SearchableDropdownProps<T extends string> = {
  id: string
  label: string
  placeholder: string
  value: T
  options: DropdownOption<T>[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (value: T) => void
  triggerRef?: RefObject<HTMLButtonElement | null>
  icon?: boolean
}

function SearchableDropdown<T extends string>({
  id,
  label,
  placeholder,
  value,
  options,
  open,
  onOpen,
  onClose,
  onSelect,
  triggerRef: externalTriggerRef,
  icon = false,
}: SearchableDropdownProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const localTriggerRef = useRef<HTMLButtonElement>(null)
  const triggerRef = externalTriggerRef ?? localTriggerRef
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedOption = options.find((option) => option.value === value)
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
  }, [options, query])
  const listboxId = `${id}-options`
  const closeDropdown = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])
  const openDropdown = useCallback(() => {
    setQuery('')
    const selectedIndex = options.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    onOpen()
  }, [onOpen, options, value])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useLayoutEffect(() => {
    if (!open) return

    const positionPanel = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return

      const triggerBounds = trigger.getBoundingClientRect()
      const panelWidth = Math.min(320, window.innerWidth - 32)
      const idealHeight = Math.min(360, window.innerHeight * 0.6)
      const spaceBelow = window.innerHeight - triggerBounds.bottom - 20
      const spaceAbove = triggerBounds.top - 20
      const placeAbove = spaceBelow < idealHeight && spaceAbove > spaceBelow
      const availableHeight = placeAbove ? spaceAbove : spaceBelow
      const panelHeight = Math.max(80, Math.min(idealHeight, availableHeight))
      const preferredLeft = id === 'gallery-sort'
        ? triggerBounds.right - panelWidth
        : triggerBounds.left
      const left = Math.max(16, Math.min(preferredLeft, window.innerWidth - panelWidth - 16))
      const preferredTop = placeAbove
        ? Math.max(8, triggerBounds.top - panelHeight - 8)
        : Math.min(window.innerHeight - panelHeight - 8, triggerBounds.bottom + 8)
      const top = Math.max(8, Math.min(preferredTop, window.innerHeight - panelHeight - 8))

      Object.assign(panel.style, {
        position: 'fixed',
        top: `${top}px`,
        right: 'auto',
        left: `${left}px`,
        width: `${panelWidth}px`,
        maxHeight: `${panelHeight}px`,
      })
      const optionsList = panel.querySelector<HTMLElement>('.live-gallery-dropdown-options')
      if (optionsList) optionsList.style.maxHeight = `${Math.max(0, panelHeight - 72)}px`
    }

    positionPanel()
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [id, open, triggerRef])

  useEffect(() => {
    if (!open) return

    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) closeDropdown()
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [closeDropdown, open])

  useEffect(() => {
    if (!open || activeIndex < 0 || !filteredOptions[activeIndex]) return
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filteredOptions, id, open])

  const selectOption = (option: DropdownOption<T>) => {
    onSelect(option.value)
    closeDropdown()
    triggerRef.current?.focus()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown' && filteredOptions.length > 0) {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % filteredOptions.length)
    } else if (event.key === 'ArrowUp' && filteredOptions.length > 0) {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + filteredOptions.length) % filteredOptions.length)
    } else if (event.key === 'Home' && filteredOptions.length > 0) {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End' && filteredOptions.length > 0) {
      event.preventDefault()
      setActiveIndex(filteredOptions.length - 1)
    } else if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
    }
  }

  return (
    <div className={`live-gallery-dropdown${open ? ' is-open' : ''}`} data-dropdown-id={id} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="live-gallery-filter live-gallery-dropdown-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => open ? closeDropdown() : openDropdown()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            openDropdown()
          }
        }}
      >
        {icon && <SlidersHorizontal size={16} aria-hidden="true" />}
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="live-gallery-dropdown-panel" ref={panelRef}>
          <label className="live-gallery-dropdown-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{placeholder}</span>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label={placeholder}
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
              aria-autocomplete="list"
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          <div className="live-gallery-dropdown-options" id={listboxId} role="listbox" aria-label={label}>
            {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
              <button
                type="button"
                id={`${id}-option-${index}`}
                key={option.value}
                className={`live-gallery-dropdown-option${value === option.value ? ' is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`}
                role="option"
                aria-selected={value === option.value}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            )) : (
              <p className="live-gallery-dropdown-empty">No matching options</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function artworkImageUrl(url: string | null) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : apiAssetUrl(url)
}

function artistName(artist: GalleryArtwork['artist']) {
  return artist.displayName?.trim() || `${artist.firstName} ${artist.lastName}`.trim()
}

export function GalleryPage() {
  return <main><GalleryContent /></main>
}

export function GalleryContent({ embedded = false }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search')?.trim() ?? ''
  const { favorites, favoritesLoading, favoritesError, retryFavorites, toggleFavorite } = useMarket()
  const { addItem, items: cartItems, itemCount } = useCart()
  const [artworks, setArtworks] = useState<GalleryArtwork[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedSearch, setLoadedSearch] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [openDropdown, setOpenDropdown] = useState<'category' | 'sort' | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [addedArtworkTitle, setAddedArtworkTitle] = useState('')
  const [attempt, setAttempt] = useState(0)
  const filtersReturnFocusRef = useRef<HTMLButtonElement>(null)
  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const addedToastSequenceRef = useRef(0)
  const activeAddedToastRef = useRef(0)
  const closeFilterDropdown = useCallback(() => setOpenDropdown(null), [])
  const openCategoryDropdown = useCallback(() => setOpenDropdown('category'), [])
  const openSortDropdown = useCallback(() => setOpenDropdown('sort'), [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  const continueShopping = useCallback(() => setCartOpen(false), [])
  const updateGallerySearch = (value: string) => {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      const nextSearch = value.trim()
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        if (nextSearch) nextParams.set('search', nextSearch)
        else nextParams.delete('search')
        return nextParams
      }, { replace: true })
      searchTimerRef.current = null
    }, 300)
  }
  const dismissAddedToast = useCallback(() => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = null
    activeAddedToastRef.current = 0
    setAddedArtworkTitle('')
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    if (searchTimerRef.current === null && searchInputRef.current && searchInputRef.current.value !== search) {
      searchInputRef.current.value = search
    }
  }, [search])

  useEffect(() => () => {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)
  }, [])

  const showAddedToast = (title: string) => {
    const toastId = ++addedToastSequenceRef.current
    activeAddedToastRef.current = toastId
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setAddedArtworkTitle(title)
    toastTimerRef.current = window.setTimeout(() => {
      if (activeAddedToastRef.current === toastId) {
        activeAddedToastRef.current = 0
        setAddedArtworkTitle('')
        toastTimerRef.current = null
      }
    }, 3500)
    return toastId
  }

  useEffect(() => {
    const controller = new AbortController()
    const query = search ? `?${new URLSearchParams({ search }).toString()}` : ''

    fetch(apiUrl(`/artworks${query}`), { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as {
          artworks?: GalleryArtwork[]
          error?: string
        }
        if (!response.ok || !Array.isArray(result.artworks)) {
          throw new Error(result.error || 'Artwork could not be loaded. Please try again.')
        }
        setArtworks(result.artworks)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Artwork could not be loaded. Please try again.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedSearch(search)
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [attempt, search])

  const galleryLoading = loading || loadedSearch !== search
  const galleryError = loadedSearch === search ? error : ''

  const categories = useMemo(
    () => [...new Set((artworks ?? []).map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [artworks],
  )
  const categoryOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories.map((item) => ({ value: item, label: item })),
    ],
    [categories],
  )
  const visibleArtworks = useMemo(() => {
    const filtered = (artworks ?? []).filter((item) => {
      return category === 'all' || item.category === category
    })

    return filtered.sort((first, second) => {
      if (sortOrder === 'price-low') return first.price - second.price
      if (sortOrder === 'price-high') return second.price - first.price
      return Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
    })
  }, [artworks, category, sortOrder])

  const clearFilters = () => {
    setCategory('all')
    setSortOrder('newest')
  }

  return (
    <section className={embedded ? 'live-gallery live-gallery-embedded' : 'route-page section-wrap live-gallery'}>
      <section className={`live-gallery-toolbar${embedded ? ' live-gallery-toolbar-embedded' : ''}`} aria-label="Gallery tools and filters">
        <div className="live-gallery-filters">
          <SearchableDropdown
            id="gallery-category"
            label="Filter by category"
            placeholder="Search categories..."
            value={category}
            options={categoryOptions}
            open={openDropdown === 'category'}
            onOpen={openCategoryDropdown}
            onClose={closeFilterDropdown}
            onSelect={setCategory}
            triggerRef={filtersReturnFocusRef}
            icon
          />
          <SearchableDropdown
            id="gallery-sort"
            label="Sort artworks"
            placeholder="Search sorting..."
            value={sortOrder}
            options={sortOptions}
            open={openDropdown === 'sort'}
            onOpen={openSortDropdown}
            onClose={closeFilterDropdown}
            onSelect={setSortOrder}
          />
        </div>
        {embedded && <div className="live-gallery-toolbar-controls">
          <label className="live-gallery-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search artworks by title, artist, or category</span>
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Search artworks by title, artist, or category"
              placeholder="Search artwork or artist..."
              defaultValue={search}
              onChange={(event) => updateGallerySearch(event.currentTarget.value)}
            />
            {search && <button type="button" aria-label="Clear artwork search" onClick={() => {
              if (searchInputRef.current) {
                searchInputRef.current.value = ''
                updateGallerySearch('')
              }
            }}><X size={16} aria-hidden="true" /></button>}
          </label>
          <button
            ref={cartButtonRef}
            className="live-gallery-cart-button"
            type="button"
            aria-label={`Open shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            title="Shopping bag"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={19} aria-hidden="true" />
            <span className="live-gallery-cart-count" aria-live="polite">{itemCount > 99 ? '99+' : itemCount}</span>
          </button>
        </div>}
      </section>

      {galleryLoading ? (
        <ArtworkGridSkeleton className="live-gallery-grid live-gallery-grid-skeleton" cardClassName="live-gallery-card-skeleton" label="Loading gallery" />
      ) : galleryError ? (
        <div className="live-gallery-state" role="alert">
          <ImageOff size={25} aria-hidden="true" />
          <h2>The gallery could not be loaded</h2>
          <p>{galleryError}</p>
          <button type="button" className="button live-gallery-retry" onClick={() => {
            setError('')
            setLoading(true)
            setAttempt((value) => value + 1)
          }}>
            <RefreshCw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : artworks?.length === 0 ? (
        <div className="live-gallery-state">
          <ImageOff size={25} aria-hidden="true" />
          <h2>The gallery is waiting for its first works</h2>
          <p>There are no published artworks to show right now. Visit again soon or discover the artists behind Showpeice.</p>
          <Link className="button live-gallery-retry" to="/artists">Explore artists <ArrowRight size={15} /></Link>
        </div>
      ) : visibleArtworks.length === 0 ? (
        <div className="live-gallery-state">
          <Search size={25} aria-hidden="true" />
          <h2>{search ? 'No artworks found' : 'No artworks match those filters'}</h2>
          <p>{search ? `No published artworks matched “${search}”. Try another search or category.` : 'Try a different category or clear the selected filters.'}</p>
          <button type="button" className="button live-gallery-retry" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <>
          <p className="live-gallery-count" aria-live="polite">
            {visibleArtworks.length} {visibleArtworks.length === 1 ? 'original work' : 'original works'}
          </p>
          <div className="live-gallery-grid">
            {visibleArtworks.map((item) => {
              const name = artistName(item.artist)
              const detailUrl = `/artwork/${item.id}?artist=${encodeURIComponent(item.artist.slug)}`
              const imageUrl = artworkImageUrl(item.imageUrl)
              const isFavorite = favorites.includes(item.id)
              const isInBag = cartItems.some((cartItem) => cartItem.id === item.id)

              return (
                <article className="live-gallery-card" key={item.id}>
                  <Link className="live-gallery-image-link" to={detailUrl} aria-label={`View ${item.title}`}>
                    {imageUrl ? (
                      <ProtectedArtworkImage
                        isProtected={item.isProtected}
                        src={imageUrl}
                        alt={`${item.title}, artwork by ${name}`}
                        loading="lazy"
                      />
                    ) : (
                      <span className="live-gallery-image-placeholder"><ImageOff size={24} />Image unavailable</span>
                    )}
                    <span className="live-gallery-category">{item.category.toUpperCase()}</span>
                  </Link>
                  <div className="live-gallery-card-copy">
                    <div className="live-gallery-card-details">
                      <h2><Link to={detailUrl}>{item.title}</Link></h2>
                      <div className="live-gallery-artist-row">
                        <p><Link to={`/artist/${encodeURIComponent(item.artist.slug)}`}>{name}</Link></p>
                        <strong>{formatINR(item.price)}</strong>
                      </div>
                      {!item.available && <span className="live-gallery-unavailable">Currently unavailable</span>}
                    </div>
                    <div className="live-gallery-card-actions">
                      <button
                        type="button"
                        className={isFavorite ? 'live-gallery-action is-favorite' : 'live-gallery-action'}
                        aria-label={favoritesError ? 'Retry loading saved artworks' : isFavorite ? `Remove ${item.title} from favourites` : `Add ${item.title} to favourites`}
                        aria-pressed={favoritesError ? undefined : isFavorite}
                        aria-busy={favoritesLoading}
                        title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (favoritesError) retryFavorites()
                          else toggleFavorite(item.id)
                        }}
                      >
                        {favoritesLoading ? <span className="showpeice-skeleton showpeice-skeleton-circle favorite-action-skeleton" aria-hidden="true" /> : favoritesError ? <RefreshCw size={16} aria-hidden="true" /> : <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />}
                      </button>
                      <button
                        type="button"
                        className={`live-gallery-action${isInBag ? ' is-in-bag' : ''}`}
                        aria-label={isInBag ? `Add another ${item.title} to shopping bag` : `Add ${item.title} to shopping bag`}
                        title={!item.available ? 'Artwork is unavailable' : !imageUrl ? 'Artwork image is unavailable' : isInBag ? 'Add another to shopping bag' : 'Add to shopping bag'}
                        disabled={!item.available || !imageUrl}
                        onClick={async (event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          let addedToastId = 0
                          try {
                            const addRequest = addItem({
                              id: item.id,
                              title: item.title,
                              artist: name,
                              price: formatINR(item.price),
                              image: imageUrl,
                              isProtected: item.isProtected,
                            })
                            addedToastId = showAddedToast(item.title)
                            await addRequest
                          } catch (cause) {
                            if (addedToastId && activeAddedToastRef.current === addedToastId) dismissAddedToast()
                            console.error('Unable to add artwork to the shopping bag.', cause)
                            toast.error('Artwork could not be added', cause instanceof Error ? cause.message : 'Please try again.')
                          }
                        }}
                      >
                        {isInBag ? <Check size={18} /> : <ShoppingBag size={17} />}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
      <CartModal
        open={cartOpen}
        onClose={closeCart}
        onDiscover={continueShopping}
        returnFocusRef={embedded ? cartButtonRef : filtersReturnFocusRef}
      />
      {addedArtworkTitle && !cartOpen && (
        <div className="live-gallery-added-toast" role="status" aria-live="polite">
          <ShoppingBag className="live-gallery-added-toast-icon" size={18} aria-hidden="true" />
          <div className="live-gallery-added-toast-copy">
            <strong>Artwork added to your bag</strong>
            <span>{addedArtworkTitle}</span>
          </div>
          <button
            type="button"
            className="live-gallery-added-toast-view"
            onClick={() => {
              dismissAddedToast()
              setCartOpen(true)
            }}
          >
            View Bag
          </button>
          <button
            type="button"
            className="live-gallery-added-toast-dismiss"
            aria-label="Dismiss notification"
            onClick={dismissAddedToast}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
