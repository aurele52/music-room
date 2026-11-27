import { validEventId } from './EventShare'

export function readEventLink(): string | null {
  const value = new URLSearchParams(
    window.location.search
  ).get('event')

  return value && validEventId(value)
    ? value
    : null
}

export type AccessGate =
  | 'loading'
  | 'allowed'
  | 'denied'
  | 'login'
  | 'error'

export async function checkEventAccess(
  eventId: string,
  token: string,
  signal: AbortSignal
): Promise<AccessGate> {
  const response = await fetch(
    `/api/sessions/events/${eventId}`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  if (response.status === 401) {
    return 'login'
  }

  // Ne jamais distinguer un événement privé d'un événement
  // inexistant pour un utilisateur sans permission.
  if (response.status === 403 || response.status === 404) {
    return 'denied'
  }

  if (!response.ok) {
    return 'error'
  }

  return 'allowed'
}
