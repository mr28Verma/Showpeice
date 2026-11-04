import type { HTMLAttributes } from 'react'
import './skeleton.css'

export type SkeletonAnimation = 'shimmer' | 'pulse' | 'none'

type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  animationType?: SkeletonAnimation
  shape?: 'block' | 'text' | 'circle'
}

export function Skeleton({
  animationType = 'shimmer',
  shape = 'block',
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-animation={animationType}
      className={`showpeice-skeleton showpeice-skeleton-${shape}${className ? ` ${className}` : ''}`}
    />
  )
}

export function ArtworkCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <article className={`showpeice-artwork-card-skeleton${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Skeleton className="showpeice-artwork-card-skeleton-image" />
      <div className="showpeice-artwork-card-skeleton-copy">
        <div className="showpeice-artwork-card-skeleton-details">
          <Skeleton shape="text" className="showpeice-artwork-card-skeleton-title" />
          <div className="showpeice-artwork-card-skeleton-artist-row">
            <Skeleton shape="text" className="showpeice-artwork-card-skeleton-artist" />
            <Skeleton shape="text" className="showpeice-artwork-card-skeleton-price" />
          </div>
        </div>
        <div className="showpeice-artwork-card-skeleton-actions">
          <Skeleton shape="circle" className="showpeice-artwork-card-skeleton-action" />
          <Skeleton shape="circle" className="showpeice-artwork-card-skeleton-action" />
        </div>
      </div>
    </article>
  )
}

export function ArtworkGridSkeleton({
  count = 6,
  className = '',
  cardClassName = '',
  label = 'Loading artworks',
}: {
  count?: number
  className: string
  cardClassName?: string
  label?: string
}) {
  return (
    <div className={className} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: count }, (_, index) => <ArtworkCardSkeleton className={cardClassName} key={index} />)}
    </div>
  )
}

export function CartLineItemsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="cart-line-list cart-line-list-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="cart-line cart-line-skeleton" key={index} aria-hidden="true">
          <Skeleton className="cart-line-image" />
          <div className="cart-line-info cart-line-skeleton-info">
            <Skeleton shape="text" className="cart-line-skeleton-title" />
            <Skeleton shape="text" className="cart-line-skeleton-artist" />
            <Skeleton shape="text" className="cart-line-skeleton-price" />
            <div className="cart-line-controls cart-line-skeleton-controls">
              <Skeleton className="cart-line-skeleton-quantity" />
              <Skeleton shape="text" className="cart-line-skeleton-remove" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
