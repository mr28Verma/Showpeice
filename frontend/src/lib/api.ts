const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const developmentApiUrl = import.meta.env.DEV ? 'http://localhost:5000' : ''

export const apiBaseUrl = (configuredApiUrl || developmentApiUrl)
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}/api${normalizedPath}`
}

export function apiAssetUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
