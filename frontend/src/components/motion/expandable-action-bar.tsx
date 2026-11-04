import type { ReactNode } from 'react'
import './expandable-action-bar.css'

export type ExpandableActionBarItem = {
  label: string
  icon: ReactNode
  onClick: () => void
  badge?: boolean
  pressed?: boolean
  disabled?: boolean
  intent?: 'default' | 'danger'
}

export type ExpandableActionBarProps = {
  items: readonly ExpandableActionBarItem[]
  ariaLabel?: string
  className?: string
}

export function ExpandableActionBar({ items, ariaLabel = 'Artwork actions', className = '' }: ExpandableActionBarProps) {
  return (
    <div className={`expandable-action-bar${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel}>
      {items.map(item => (
        <button
          className="expandable-action-bar__button"
          data-intent={item.intent ?? 'default'}
          type="button"
          key={item.label}
          aria-label={item.label}
          aria-pressed={item.pressed}
          disabled={item.disabled}
          onClick={event => {
            event.stopPropagation()
            item.onClick()
          }}
        >
          <span className="expandable-action-bar__icon" aria-hidden="true">{item.icon}</span>
          {item.badge && <span className="expandable-action-bar__badge" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
