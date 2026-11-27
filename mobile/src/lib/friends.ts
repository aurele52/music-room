import { api } from './api'

export interface FriendUser {
  id: string
  name: string
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
}

export interface FriendRelation {
  id: string
  user: FriendUser
  createdAt: string
}

export interface FriendsResponse {
  friends: FriendRelation[]
  incoming: FriendRelation[]
  outgoing: FriendRelation[]
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Utiliser exclusivement les relations ACCEPTED,
 * que le backend place dans la propriété "friends".
 *
 * Ne pas mélanger incoming et outgoing : ces relations
 * sont encore en attente et ne permettent pas d'inviter.
 */
export function confirmedFriends(
  response: FriendsResponse
): FriendUser[] {
  if (!response || !Array.isArray(response.friends)) {
    throw new Error('Liste d’amis invalide.')
  }

  const unique = new Map<string, FriendUser>()

  for (const relation of response.friends) {
    const user = relation?.user

    if (
      !user ||
      typeof user.id !== 'string' ||
      !uuid.test(user.id) ||
      typeof user.name !== 'string' ||
      !user.name.trim()
    ) {
      continue
    }

    if (!unique.has(user.id)) {
      unique.set(user.id, {
        id: user.id,
        name: user.name.trim(),
        visibility: user.visibility
      })
    }
  }

  return [...unique.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  )
}

export async function fetchConfirmedFriends(
  token: string
): Promise<FriendUser[]> {
  const response = await api<FriendsResponse>(
    '/friends',
    { token }
  )

  return confirmedFriends(response)
}
