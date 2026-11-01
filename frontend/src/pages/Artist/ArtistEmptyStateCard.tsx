import { useId } from 'react'
import { Image, Plus } from 'lucide-react'
import './ArtistEmptyStateCard.css'

type ArtistEmptyStateCardProps = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function ArtistEmptyStateCard({ title, description, actionLabel, onAction }: ArtistEmptyStateCardProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <section className="artist-empty-state-card" aria-labelledby={titleId}>
      <div className="artist-empty-state-icon" aria-hidden="true">
        <Image size={21} strokeWidth={1.7} />
      </div>
      <h3 id={titleId}>{title}</h3>
      <p id={descriptionId}>{description}</p>
      <button
        type="button"
        className="studio-add-top artist-empty-state-action"
        aria-describedby={descriptionId}
        onClick={onAction}
      >
        <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
        {actionLabel}
      </button>
    </section>
  )
}
