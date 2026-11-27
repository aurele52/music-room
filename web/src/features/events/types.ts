export type MusicEvent = {
  id: string
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
  organizerId: string
  createdAt: string
}

export type EventForm = {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  token: string
  onAuthError: (error: unknown) => boolean
}
