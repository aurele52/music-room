export type Invitation = {
  id: string
  status: 'PENDING' | 'ACCEPTED'
  createdAt: string
  event: {
    id: string
    title: string
    description: string
    location: string
    startsAt: string
    endsAt: string
    visibility: 'PUBLIC' | 'PRIVATE'
    organizer: {
      id: string
      name: string
    }
  }
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  token: string
  onAuthError: (error: unknown) => boolean
}
