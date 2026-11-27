export type FriendUser = {
  id: string
  name: string
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
}

export type FriendItem = {
  id: string
  user: FriendUser
  createdAt: string
}

export type FriendLists = {
  friends: FriendItem[]
  incoming: FriendItem[]
  outgoing: FriendItem[]
}

export type ApiError = Error & {
  status?: number
  code?: string
}

export type Props = {
  token: string
  refreshKey: number
  onAuthError: (error: unknown) => boolean
}
