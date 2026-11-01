export type Artwork = {
  id: number
  title: string
  artist: string
  artistId: string
  category: string
  price: number
  image: string
  shape: 'tall' | 'wide' | 'square'
  medium: string
  dimensions: string
  description: string
  isProtected?: boolean
}
