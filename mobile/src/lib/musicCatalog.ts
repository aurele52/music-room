import { api } from './api'

export interface CatalogTrack {
  id: string
  title: string
  artist: string
  audioUrl: string
  premium?: boolean
}

export async function fetchMusicCatalog(
  token: string
): Promise<CatalogTrack[]> {
  const result = await api<{ tracks: CatalogTrack[] }>(
    '/catalog',
    { token }
  )

  return result.tracks
}
