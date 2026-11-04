export function getLogoDestination() {
  if (!localStorage.getItem('showpeice_token')) return '/'

  try {
    const storedUser = localStorage.getItem('showpeice_user')
    const role = storedUser ? JSON.parse(storedUser).role : null
    if (role === 'buyer') return '/gallery'
    if (role === 'artist' || role === 'seller') return '/artist/dashboard'
  } catch {
    return '/'
  }

  return '/'
}

export function getDashboardDestination() {
  if (!localStorage.getItem('showpeice_token')) return '/login'

  const logoDestination = getLogoDestination()
  return logoDestination === '/gallery' ? '/buyer/dashboard' : logoDestination
}
