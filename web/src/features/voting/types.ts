export type Track = {
  id: string
  title: string
  artist: string
  createdAt: string
  proposerId: string
  proposer: {
    id: string
    name: string
  }
  votes: number
  myVote: boolean
}

export type CatalogTrack = {
  id: string
  title: string
  artist: string
  premium?: boolean
}

export type Ranking = {
  tracks: Track[]
  canParticipate: boolean
  canVote?: boolean
  requiresLocation?: boolean
  finished: boolean
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  eventId: string
  token: string
  organizer?: boolean
  onAuthError: (error: unknown) => boolean
}
