export type MusicEvent = {
  id: string
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
  organizerId: string
  organizer: {
    id: string
    name: string
  }
}

export type EventDetail = Omit<MusicEvent, 'organizer'>

export type DiscoveryResponse = {
  events: MusicEvent[]
  page: number
  hasMore: boolean
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  token: string
  onAuthError: (error: unknown) => boolean
}
