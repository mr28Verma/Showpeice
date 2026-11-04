import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { Link } from 'react-router-dom'
import './floating-dock.css'

export type FloatingDockItem = {
  title: string
  icon: ReactNode
  to?: string
  onSelect?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void
  active?: boolean
  ariaLabel?: string
  badge?: string
  id?: string
  expanded?: boolean
  controls?: string
}

export function FloatingDock({ items, ariaLabel = 'Main navigation' }: { items: FloatingDockItem[]; ariaLabel?: string }) {
  const reducedMotion = useReducedMotion()
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 600px)').matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 600px)')
    const updateCompact = () => setCompact(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateCompact)
    return () => mediaQuery.removeEventListener('change', updateCompact)
  }, [])

  return (
    <nav className="floating-dock" aria-label={ariaLabel} onMouseMove={event => mouseX.set(event.clientX)} onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}>
      <ul className="floating-dock-list">
        {items.map(item => (
          <FloatingDockEntry key={item.title} item={item} mouseX={mouseX} compact={compact} reducedMotion={Boolean(reducedMotion)} />
        ))}
      </ul>
    </nav>
  )
}

function FloatingDockEntry({ item, mouseX, compact, reducedMotion }: { item: FloatingDockItem; mouseX: MotionValue<number>; compact: boolean; reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const className = `floating-dock-item${item.active ? ' is-active' : ''}`
  const distance = useTransform(mouseX, value => {
    const bounds = ref.current?.getBoundingClientRect()
    return bounds ? value - bounds.left - bounds.width / 2 : Number.POSITIVE_INFINITY
  })
  const widthTransform = useTransform(distance, [-150, 0, 150], compact ? [30, 44, 30] : [44, 80, 44])
  const heightTransform = useTransform(distance, [-150, 0, 150], compact ? [30, 44, 30] : [44, 80, 44])
  const iconTransform = useTransform(distance, [-150, 0, 150], compact ? [14, 21, 14] : [21, 38, 21])
  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 })
  const height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 })
  const iconSize = useSpring(iconTransform, { mass: 0.1, stiffness: 150, damping: 12 })
  const accessibleProps = {
    id: item.id,
    'aria-label': item.ariaLabel ?? item.title,
    'aria-current': item.active ? 'page' as const : undefined,
    'aria-expanded': item.expanded,
    'aria-controls': item.controls,
    title: item.title,
    className,
    onMouseEnter: () => setTooltipVisible(true),
    onMouseLeave: () => setTooltipVisible(false),
    onFocus: () => setTooltipVisible(true),
    onBlur: () => setTooltipVisible(false),
  }
  const content = <>
    <motion.span className="floating-dock-icon" style={reducedMotion ? undefined : { width: iconSize, height: iconSize }}>{item.icon}</motion.span>
    {item.badge && <span className="floating-dock-badge" aria-hidden="true">{item.badge}</span>}
  </>

  return (
    <li className="floating-dock-entry">
      <motion.div
        ref={ref}
        className="floating-dock-entry-motion"
        style={reducedMotion ? undefined : { width, height }}
      >
        {item.to
          ? <Link to={item.to} onClick={item.onSelect} {...accessibleProps}>{content}</Link>
          : <button type="button" onClick={item.onSelect} {...accessibleProps}>{content}</button>}
        <AnimatePresence>
          {tooltipVisible && <motion.span
            className="floating-dock-tooltip"
            role="tooltip"
            initial={reducedMotion ? false : { opacity: 0, y: 5, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 3, x: '-50%' }}
            transition={{ duration: reducedMotion ? 0 : 0.14, ease: 'easeOut' }}
          >{item.title}</motion.span>}
        </AnimatePresence>
      </motion.div>
    </li>
  )
}
