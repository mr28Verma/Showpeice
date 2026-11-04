import { ArtworkCardSkeleton, Skeleton } from '../../components/ui/Skeleton'

export function ArtistSettingsSkeleton() {
  return (
    <div className="artist-settings-skeleton" role="status" aria-label="Loading artist settings" aria-busy="true">
      <div className="artist-settings-savebar" aria-hidden="true">
        <Skeleton shape="text" className="artist-skeleton-save-status" />
        <Skeleton className="artist-skeleton-save-button" />
      </div>
      <section className="artist-settings-section" aria-hidden="true">
        <header><Skeleton className="artist-skeleton-section-title"/><Skeleton shape="text" className="artist-skeleton-section-description"/></header>
        <div className="artist-settings-panel">
          {Array.from({ length: 3 }, (_, index) => <ArtistSettingRowSkeleton key={index}/>)}
        </div>
      </section>
      <section className="artist-settings-section" aria-hidden="true">
        <header><Skeleton className="artist-skeleton-section-title"/><Skeleton shape="text" className="artist-skeleton-section-description"/></header>
        <div className="artist-settings-panel artist-settings-fields">
          <ArtistSettingFieldSkeleton/>
          <div className="artist-settings-two-columns"><ArtistSettingFieldSkeleton/><ArtistSettingFieldSkeleton/></div>
          <Skeleton className="artist-skeleton-secondary-button"/>
        </div>
      </section>
      <section className="artist-settings-section" aria-hidden="true">
        <header><Skeleton className="artist-skeleton-section-title"/><Skeleton shape="text" className="artist-skeleton-section-description"/></header>
        <div className="artist-settings-panel"><ArtistSettingRowSkeleton/></div>
      </section>
      <section className="artist-settings-section" aria-hidden="true">
        <header><Skeleton className="artist-skeleton-section-title"/><Skeleton shape="text" className="artist-skeleton-section-description"/></header>
        <div className="artist-settings-panel artist-settings-account-actions">
          <div><Skeleton className="artist-skeleton-section-title"/><Skeleton shape="text" className="artist-skeleton-section-description"/></div>
          <Skeleton className="artist-skeleton-secondary-button"/>
        </div>
      </section>
    </div>
  )
}

function ArtistSettingRowSkeleton() {
  return (
    <div className="artist-settings-row artist-settings-row-skeleton" aria-hidden="true">
      <div className="artist-settings-copy"><Skeleton className="artist-skeleton-row-title"/><Skeleton shape="text" className="artist-skeleton-row-description"/></div>
      <Skeleton className="artist-skeleton-switch"/>
    </div>
  )
}

function ArtistSettingFieldSkeleton() {
  return <div className="artist-skeleton-setting-field" aria-hidden="true"><Skeleton shape="text" className="artist-skeleton-field-label"/><Skeleton className="artist-skeleton-field-input"/></div>
}

export function ArtistProfileSkeleton() {
  return (
    <section className="artist-studio-profile artist-profile-skeleton" role="status" aria-label="Loading artist profile" aria-busy="true">
      <section className="artist-studio-hero" aria-hidden="true">
        <div className="artist-studio-hero-backdrop"><Skeleton className="artist-profile-skeleton-backdrop"/></div>
        <div className="artist-studio-hero-top"><Skeleton className="artist-profile-skeleton-pill"/><Skeleton className="artist-profile-skeleton-link"/></div>
        <div className="artist-studio-hero-content">
          <div className="artist-studio-identity-block">
            <Skeleton shape="circle" className="artist-profile-skeleton-avatar"/>
            <div className="artist-profile-skeleton-copy"><Skeleton shape="text" className="artist-profile-skeleton-kicker"/><Skeleton className="artist-profile-skeleton-name"/><Skeleton shape="text" className="artist-profile-skeleton-meta"/><Skeleton shape="text" className="artist-profile-skeleton-bio"/></div>
          </div>
          <div className="artist-studio-hero-actions"><Skeleton className="artist-profile-skeleton-action"/><Skeleton className="artist-profile-skeleton-action artist-profile-skeleton-action-short"/></div>
        </div>
      </section>
      <section className="artist-studio-stats-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <article className="artist-studio-stat-card" key={index}><Skeleton shape="text" className="artist-profile-skeleton-stat-label"/><Skeleton className="artist-profile-skeleton-stat-value"/><Skeleton shape="text" className="artist-profile-skeleton-stat-note"/></article>)}
      </section>
      <nav className="artist-studio-tabs-bar" aria-hidden="true"><Skeleton className="artist-profile-skeleton-tab"/><Skeleton className="artist-profile-skeleton-tab"/><Skeleton className="artist-profile-skeleton-tab"/></nav>
      <div className="artist-studio-grid-2col artist-profile-skeleton-panels" aria-hidden="true">
        <article className="artist-studio-card"><header className="artist-studio-card-header"><Skeleton className="artist-profile-skeleton-panel-title"/></header><Skeleton shape="text"/><Skeleton shape="text"/><Skeleton shape="text"/></article>
        <article className="artist-studio-card"><header className="artist-studio-card-header"><Skeleton className="artist-profile-skeleton-panel-title"/></header><Skeleton shape="text"/><Skeleton shape="text"/><Skeleton shape="text"/></article>
      </div>
    </section>
  )
}

export function ArtistArtworkSectionSkeleton() {
  return (
    <section className="studio-artworks artist-artworks-skeleton" role="status" aria-label="Loading artworks" aria-busy="true">
      <header><div><Skeleton shape="text" className="artist-skeleton-art-kicker"/><Skeleton className="artist-skeleton-art-title"/></div><Skeleton shape="text" className="artist-skeleton-art-count"/></header>
      <div className="studio-art-grid">{Array.from({ length: 6 }, (_, index) => <ArtworkCardSkeleton className="artist-artwork-card-skeleton" key={index}/>)}</div>
    </section>
  )
}

export function ArtistDashboardSectionSkeleton({ section }: { section: string }) {
  if (section === 'profile') return <ArtistProfileSkeleton />
  if (section === 'settings') return <ArtistSettingsSkeleton />
  if (section === 'artworks') return <ArtistArtworkSectionSkeleton />

  return (
    <section className="studio-panel studio-skeleton-page-empty" role="status" aria-label={`Loading ${section}`} aria-busy="true">
      <Skeleton shape="circle" className="artist-skeleton-empty-icon"/>
      <Skeleton className="artist-skeleton-empty-title"/>
      <Skeleton shape="text" className="artist-skeleton-empty-description"/>
      <div className="artist-skeleton-chart"><Skeleton/><Skeleton/><Skeleton/><Skeleton/><Skeleton/><Skeleton/><Skeleton/></div>
    </section>
  )
}
