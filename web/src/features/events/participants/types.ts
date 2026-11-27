export type Friend = {
  id: string
  user: {
    id: string
    name: string
  }
}

export type FriendLists = {
  friends: Friend[]
}

export type Participant = {
  id: string
  status: 'PENDING' | 'ACCEPTED'
  user: {
    id: string
    name: string
  }
  createdAt: string
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
