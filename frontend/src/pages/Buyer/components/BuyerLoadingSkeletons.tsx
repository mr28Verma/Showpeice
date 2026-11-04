import { ArtworkCardSkeleton, Skeleton } from '../../../components/ui/Skeleton'
import type { BuyerSection } from '../types'

function BuyerPageHeadingSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="buyer-section-header buyer-page-heading-skeleton" aria-hidden="true">
      {rows > 1 && <Skeleton shape="text" className="buyer-skeleton-kicker" />}
      <Skeleton className="buyer-skeleton-page-title" />
      {rows > 1 && <Skeleton shape="text" className="buyer-skeleton-page-subtitle" />}
    </div>
  )
}

function BuyerOrderCardSkeleton() {
  return (
    <article className="buyer-order-card buyer-order-skeleton" aria-hidden="true">
      <header className="buyer-order-header">
        <div className="buyer-order-id-group">
          <Skeleton shape="text" className="buyer-skeleton-order-number" />
          <Skeleton shape="text" className="buyer-skeleton-order-date" />
        </div>
        <div className="buyer-order-badges">
          <Skeleton className="buyer-skeleton-order-badge" />
          <Skeleton className="buyer-skeleton-order-badge buyer-skeleton-order-badge-short" />
        </div>
      </header>
      <div className="buyer-order-body">
        <div className="buyer-order-item-row">
          <Skeleton className="buyer-skeleton-order-image" />
          <div className="buyer-order-item-info buyer-order-skeleton-info">
            <Skeleton shape="text" className="buyer-skeleton-order-title" />
            <Skeleton shape="text" className="buyer-skeleton-order-artist" />
            <Skeleton shape="text" className="buyer-skeleton-order-quantity" />
          </div>
        </div>
      </div>
      <footer className="buyer-order-footer">
        <div className="buyer-order-total buyer-order-skeleton-total">
          <Skeleton shape="text" className="buyer-skeleton-order-total-label" />
          <Skeleton shape="text" className="buyer-skeleton-order-total-value" />
        </div>
        <Skeleton shape="text" className="buyer-skeleton-order-link" />
      </footer>
    </article>
  )
}

export function BuyerOrdersSkeleton({ includeHeader = false }: { includeHeader?: boolean }) {
  return (
    <section className="buyer-orders-loading" role="status" aria-label="Loading orders" aria-busy="true">
      {includeHeader && <>
        <BuyerPageHeadingSkeleton rows={2} />
        <div className="buyer-orders-toolbar buyer-orders-toolbar-skeleton" aria-hidden="true">
          <div className="buyer-orders-tabs">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="buyer-skeleton-order-filter" />)}
          </div>
          <Skeleton shape="text" className="buyer-skeleton-order-count" />
        </div>
      </>}
      <div className="buyer-orders-list">
        <BuyerOrderCardSkeleton />
        <BuyerOrderCardSkeleton />
        <BuyerOrderCardSkeleton />
      </div>
    </section>
  )
}

export function BuyerAddressesSkeleton({ includeHeader = false }: { includeHeader?: boolean }) {
  return (
    <section className="buyer-addresses-loading" role="status" aria-label="Loading saved addresses" aria-busy="true">
      {includeHeader && <div className="buyer-addresses-header-skeleton">
        <BuyerPageHeadingSkeleton rows={2} />
        <Skeleton className="buyer-skeleton-add-button" />
      </div>}
      <div className="buyer-addresses-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <article className="buyer-address-card buyer-address-skeleton" key={index} aria-hidden="true">
            <Skeleton shape="text" className="buyer-skeleton-address-title" />
            <div className="buyer-address-body buyer-address-skeleton-lines">
              <Skeleton shape="text" className="buyer-skeleton-address-line" />
              <Skeleton shape="text" className="buyer-skeleton-address-line buyer-skeleton-address-line-medium" />
              <Skeleton shape="text" className="buyer-skeleton-address-line buyer-skeleton-address-line-short" />
            </div>
            <div className="buyer-address-actions">
              <Skeleton className="buyer-skeleton-address-action" />
              <Skeleton className="buyer-skeleton-address-action" />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function BuyerProfileSkeleton() {
  return (
    <section className="buyer-profile-loading" role="status" aria-label="Loading buyer profile" aria-busy="true">
      <BuyerPageHeadingSkeleton />
      <div className="buyer-profile-layout">
        <aside className="buyer-profile-card buyer-profile-skeleton-card" aria-hidden="true">
          <Skeleton shape="circle" className="buyer-skeleton-profile-avatar" />
          <Skeleton shape="text" className="buyer-skeleton-profile-name" />
          <Skeleton shape="text" className="buyer-skeleton-profile-email" />
          <div className="buyer-skeleton-profile-meta">
            <Skeleton shape="text" />
            <Skeleton shape="text" />
            <Skeleton shape="text" />
          </div>
        </aside>
        <div className="buyer-form-panel buyer-profile-skeleton-form" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <div className="buyer-profile-skeleton-field" key={index}>
              <Skeleton shape="text" className="buyer-skeleton-field-label" />
              <Skeleton className="buyer-skeleton-field-input" />
            </div>
          ))}
          <Skeleton className="buyer-skeleton-profile-save" />
        </div>
      </div>
    </section>
  )
}

export function BuyerSettingsSkeleton() {
  return (
    <section className="buyer-settings-loading" role="status" aria-label="Loading account settings" aria-busy="true">
      <BuyerPageHeadingSkeleton rows={2} />
      <div className="buyer-settings-stack">
        <article className="buyer-card-panel buyer-settings-skeleton-panel" aria-hidden="true">
          <Skeleton className="buyer-skeleton-settings-heading" />
          {Array.from({ length: 2 }, (_, index) => (
            <div className="buyer-toggle-row buyer-toggle-skeleton-row" key={index}>
              <div className="buyer-toggle-info">
                <Skeleton shape="text" className="buyer-skeleton-setting-title" />
                <Skeleton shape="text" className="buyer-skeleton-setting-description" />
              </div>
              <Skeleton className="buyer-skeleton-switch" />
            </div>
          ))}
        </article>
        <article className="buyer-card-panel buyer-settings-skeleton-panel" aria-hidden="true">
          <Skeleton className="buyer-skeleton-settings-heading" />
          {Array.from({ length: 3 }, (_, index) => (
            <div className="buyer-profile-skeleton-field" key={index}>
              <Skeleton shape="text" className="buyer-skeleton-field-label" />
              <Skeleton className="buyer-skeleton-field-input" />
            </div>
          ))}
          <Skeleton className="buyer-skeleton-profile-save" />
        </article>
      </div>
    </section>
  )
}

export function BuyerSectionSkeleton({ section }: { section: BuyerSection }) {
  if (section === 'orders') return <BuyerOrdersSkeleton includeHeader />
  if (section === 'profile') return <BuyerProfileSkeleton />
  if (section === 'addresses') return <BuyerAddressesSkeleton includeHeader />
  if (section === 'settings') return <BuyerSettingsSkeleton />
  return (
    <div className="buyer-gallery-loading" role="status" aria-label="Loading gallery" aria-busy="true">
      <div className="buyer-gallery-skeleton-tools" aria-hidden="true">
        <Skeleton className="buyer-gallery-skeleton-filter" />
        <Skeleton className="buyer-gallery-skeleton-filter" />
      </div>
      <div className="buyer-gallery-skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => <ArtworkCardSkeleton key={index} />)}
      </div>
    </div>
  )
}
