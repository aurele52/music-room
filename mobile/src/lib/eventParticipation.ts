import { api, type MusicEvent } from './api'

export type ParticipationStatus =
  'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface Invitation {
  id: string
  status: ParticipationStatus
  createdAt: string
  event: MusicEvent
}

export interface EventMember {
  id: string
  status: ParticipationStatus
  createdAt: string
  user: { id: string; name: string }
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function requireEventId(id: string): string {
  if (!uuid.test(id)) {
    throw new Error("Identifiant invalide")
  }
  return id
}

export function requireFriendId(id: string): string {
  return requireEventId(id.trim())
}

export const eventApi = {
  inbox: (token: string) =>
    api<{ invitations: Invitation[] }>(
      '/events/invitations/mine', { token }
    ),

  accept: (id: string, token: string) =>
    api<{ message: string }>(
      `/events/invitations/${requireEventId(id)}/accept`,
      { method: 'POST', token }
    ),

  leave: (id: string, token: string) =>
    api<{ message: string }>(
      `/events/invitations/${requireEventId(id)}`,
      { method: 'DELETE', token }
    ),

  members: (id: string, token: string) =>
    api<{ invitations: EventMember[] }>(
      `/events/${requireEventId(id)}/invitations`,
      { token }
    ),

  invite: (id: string, userId: string, token: string) =>
    api<{ message?: string }>(
      `/events/${requireEventId(id)}/invitations`,
      {
        method: 'POST',
        token,
        body: { userId: requireFriendId(userId) }
      }
    ),

  removeMember: (
    id: string,
    invitationId: string,
    token: string
  ) => api<{ message: string }>(
    `/events/${requireEventId(id)}/invitations/${requireEventId(invitationId)}`,
    { method: 'DELETE', token }
  )
}
