import { api } from './api'
import type {
  FriendsResponse,
  FriendRelation
} from './friends'

export type ProfileVisibility =
  | 'PUBLIC'
  | 'FRIENDS'
  | 'PRIVATE'

export interface SearchUser {
  id: string
  name: string
  visibility: ProfileVisibility
  createdAt: string
}

export interface SocialProfile extends SearchUser {
  publicBio: string
  friendsBio?: string
}

export interface SearchUsersResponse {
  users: SearchUser[]
}

export interface SocialLists {
  friends: FriendRelation[]
  incoming: FriendRelation[]
  outgoing: FriendRelation[]
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validSocialId(value: string): boolean {
  return uuid.test(value)
}

function requireId(id: string): string {
  if (!validSocialId(id)) {
    throw new Error('Identifiant invalide')
  }

  return id
}

export function normalizeSearchQuery(
  input: string
): string {
  const query = input.trim()

  if (
    query.length < 2 ||
    query.length > 50 ||
    /[\u0000-\u001f\u007f]/u.test(query)
  ) {
    throw new Error(
      'La recherche doit contenir entre 2 et 50 caractères valides'
    )
  }

  return query
}

export function relationStatus(
  lists: SocialLists,
  userId: string
): 'FRIEND' | 'INCOMING' | 'OUTGOING' | 'NONE' {
  if (lists.friends.some(
    item => item.user.id === userId
  )) return 'FRIEND'

  if (lists.incoming.some(
    item => item.user.id === userId
  )) return 'INCOMING'

  if (lists.outgoing.some(
    item => item.user.id === userId
  )) return 'OUTGOING'

  return 'NONE'
}

export function canRequestFriend(
  user: SearchUser,
  lists: SocialLists
): boolean {
  return (
    user.visibility === 'PUBLIC' &&
    relationStatus(lists, user.id) === 'NONE'
  )
}

export async function searchSocialUsers(
  query: string,
  token: string
): Promise<SearchUser[]> {
  const value = normalizeSearchQuery(query)

  const result = await api<SearchUsersResponse>(
    `/profile/search?q=${encodeURIComponent(value)}`,
    { token }
  )

  return result.users
}

export async function fetchSocialProfile(
  userId: string,
  token: string
): Promise<SocialProfile> {
  const result = await api<{ user: SocialProfile }>(
    `/profile/${requireId(userId)}`,
    { token }
  )

  return result.user
}

export async function fetchSocialLists(
  token: string
): Promise<SocialLists> {
  return api<FriendsResponse>('/friends', { token })
}

export async function requestFriend(
  userId: string,
  token: string
): Promise<void> {
  await api<unknown>('/friends/requests', {
    method: 'POST',
    token,
    body: { userId: requireId(userId) }
  })
}

export async function acceptFriendRequest(
  requestId: string,
  token: string
): Promise<void> {
  await api<unknown>(
    `/friends/requests/${requireId(requestId)}/accept`,
    { method: 'POST', token }
  )
}

export async function removeFriendRequest(
  requestId: string,
  token: string
): Promise<void> {
  await api<unknown>(
    `/friends/requests/${requireId(requestId)}`,
    { method: 'DELETE', token }
  )
}

export async function removeFriend(
  userId: string,
  token: string
): Promise<void> {
  await api<unknown>(
    `/friends/${requireId(userId)}`,
    { method: 'DELETE', token }
  )
}
