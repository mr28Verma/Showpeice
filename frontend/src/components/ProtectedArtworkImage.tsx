import { useEffect, useId, useRef, useState, type ImgHTMLAttributes, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { lockBodyScroll } from '../lib/body-scroll-lock'
import './ProtectedArtworkImage.css'

const protectionMessage = 'This artwork is protected by Showpeice. Unauthorized downloading and reproduction are not permitted.'

function isMobileInteraction() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 700px), (pointer: coarse)').matches
}

type ProtectedArtworkImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'draggable'> & {
  isProtected?: boolean
}

export function ProtectedArtworkImage({ isProtected = false, className, alt = '', ...imageProps }: ProtectedArtworkImageProps) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const showDomWatermark = isProtected && !String(imageProps.src ?? '').includes('/api/artworks/')

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  useEffect(() => {
    if (!overlayOpen) return
    const releaseScrollLock = lockBodyScroll()
    const returnFocusTarget = returnFocusRef.current
    backButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        longPressTriggeredRef.current = false
        setOverlayOpen(false)
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        backButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      releaseScrollLock()
      window.removeEventListener('keydown', handleKeyDown)
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus({ preventScroll: true })
    }
  }, [overlayOpen])

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
  }, [])

  const rememberFocusTarget = (image: HTMLImageElement) => {
    const focusTarget = image.closest<HTMLElement>('a, button, [tabindex]')
    if (!focusTarget) image.tabIndex = 0
    returnFocusRef.current = focusTarget ?? image
  }

  const openOverlay = (image: HTMLImageElement) => {
    rememberFocusTarget(image)
    setOverlayOpen(true)
  }

  const handleContextMenu = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!isProtected) return
    event.preventDefault()
    if (isMobileInteraction()) {
      event.stopPropagation()
      longPressTriggeredRef.current = true
      openOverlay(event.currentTarget)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!isProtected || event.pointerType !== 'touch' || !isMobileInteraction()) return
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    const image = event.currentTarget
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressTriggeredRef.current = true
      openOverlay(image)
    }, 550)
  }

  const handleClickCapture = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!isProtected || !isMobileInteraction()) return
    if (longPressTriggeredRef.current) {
      event.preventDefault()
      event.stopPropagation()
      longPressTriggeredRef.current = false
      return
    }
    if (!event.currentTarget.closest('a, button')) {
      event.preventDefault()
      event.stopPropagation()
      openOverlay(event.currentTarget)
    }
  }

  const image = <img
    {...imageProps}
    className={`${className ?? ''}${isProtected ? ' protected-artwork-image' : ''}`.trim()}
    alt={alt}
    draggable={!isProtected}
    onContextMenu={handleContextMenu}
    onDragStart={isProtected ? (event) => event.preventDefault() : undefined}
    onPointerDown={handlePointerDown}
    onPointerUp={clearLongPressTimer}
    onPointerCancel={clearLongPressTimer}
    onPointerLeave={clearLongPressTimer}
    onClickCapture={handleClickCapture}
  />

  return <>
    {isProtected ? <span className="protected-artwork-frame" onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}>
      {image}
      {showDomWatermark && <span className="protected-artwork-watermark" aria-hidden="true">Showpeice</span>}
    </span> : image}
    {isProtected && overlayOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="artwork-protection-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}
      >
        <div className="artwork-protection-backdrop" aria-hidden="true">
          {imageProps.src && <img src={imageProps.src} alt="" draggable={false} onDragStart={(event) => event.preventDefault()} />}
        </div>
        <div className="artwork-protection-message">
          <span className="artwork-protection-kicker">SHOWPEICE ORIGINAL</span>
          <h2 id={titleId}>Artwork Protected</h2>
          <p id={descriptionId}>{protectionMessage}</p>
          <button ref={backButtonRef} type="button" onClick={() => { longPressTriggeredRef.current = false; setOverlayOpen(false) }}>Back to artwork</button>
        </div>
      </div>,
      document.body,
    )}
  </>
}
