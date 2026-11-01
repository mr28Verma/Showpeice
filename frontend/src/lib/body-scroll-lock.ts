let activeLocks = 0
let previousOverflow: string | undefined

/** Keeps background scrolling disabled until every open overlay releases its lock. */
export function lockBodyScroll() {
  if (typeof document === 'undefined') return () => {}

  if (activeLocks === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  activeLocks += 1

  let released = false
  return () => {
    if (released) return
    released = true
    activeLocks = Math.max(0, activeLocks - 1)

    if (activeLocks === 0) {
      document.body.style.overflow = previousOverflow ?? ''
      previousOverflow = undefined
    }
  }
}
