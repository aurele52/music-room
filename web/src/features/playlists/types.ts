export type PlaylistItem = {
  id: string
  title: string
  artist: string
  position: number
  addedById: string
  addedBy: {
    id: string
    name: string
  }
}

export type Playlist = {
  visibility?: 'PUBLIC' | 'PRIVATE'
  editPolicy?: 'PUBLIC' | 'INVITED_ONLY'
  canEdit?: boolean
  id: string
  title: string
  description: string
  revision: number
  createdAt: string
  items: PlaylistItem[]
}

export type PlaylistResponse = {
  playlists: Playlist[]
  canEdit: boolean
  organizer: boolean
  finished: boolean
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  eventId: string
  token: string
  onAuthError: (error: unknown) => boolean
}
