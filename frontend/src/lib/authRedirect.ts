export type AccountRole = 'buyer' | 'artist'

export function getSafeReturnTo(value: string | null, role: AccountRole): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  try {
    const destination = new URL(value, window.location.origin)
    if (destination.origin !== window.location.origin || destination.username || destination.password) return null

    const path = destination.pathname
    const commonDestination = path === '/' ||
      path === '/gallery' ||
      path === '/help' ||
      path === '/artists' ||
      path === '/blog' ||
      path === '/cart' ||
      /^\/(artists|categories|collections|blog)\/[a-z0-9_-]+$/i.test(path) ||
      (/^\/artist\/[a-z0-9_-]+$/i.test(path) && path.toLowerCase() !== '/artist/dashboard') ||
      /^\/artwork\/\d+$/.test(path)
    const roleDestination = role === 'buyer'
      ? path === '/buyer/dashboard'
      : path === '/artist/dashboard'

    if (!commonDestination && !roleDestination) return null
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}
