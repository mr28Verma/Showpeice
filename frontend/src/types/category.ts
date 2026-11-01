export type ArtworkCategory = {
  name: string
  slug: string
  filter: string
  image: string
  description: string
}

export type CuratedCollection = {
  id: string
  label: string
  title: string
  description: string
  image: string
  artworkIds: number[]
}
