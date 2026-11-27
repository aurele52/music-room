import { api } from './api'

export type MusicSessionState =
  | 'PAUSED'
  | 'PLAYING'
  | 'STOPPED'

export type MusicSessionAction =
  | 'play'
  | 'pause'
  | 'next'
  | 'ended'
  | 'stop'

export interface MusicSessionItem {
  id: string
  title: string
  artist: string
  position: number
  audioUrl?: string | null
}

export interface MusicSession {
  id: string
  eventId: string
  state: MusicSessionState
  currentIndex: number
  revision: number
  updatedAt: string
  items: MusicSessionItem[]
}

export interface MusicSessionListing {
  session: MusicSession | null
  organizer: boolean
  canControl: boolean
  finished: boolean
}

export interface MusicSessionControlPayload {
  action: MusicSessionAction
  revision: number
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validSessionEventId(id: string): boolean {
  return uuid.test(id)
}

function requireId(id: string): string {
  if (!validSessionEventId(id)) {
    throw new Error('Identifiant invalide')
  }

  return id
}

export function currentSessionTrack(
  session: MusicSession | null
): MusicSessionItem | null {
  if (!session) return null

  return session.items[session.currentIndex] ?? null
}

export function buildSessionControl(
  action: MusicSessionAction,
  revision: number
): MusicSessionControlPayload {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('Révision de session invalide')
  }

  return { action, revision }
}

export async function fetchMusicSession(
  eventId: string,
  token: string
): Promise<MusicSessionListing> {
  return api<MusicSessionListing>(
    `/sessions/events/${requireId(eventId)}`,
    { token }
  )
}

export async function startMusicSession(
  eventId: string,
  token: string
): Promise<MusicSession> {
  const result = await api<{ session: MusicSession }>(
    `/sessions/events/${requireId(eventId)}/start`,
    {
      method: 'POST',
      token,
      body: {}
    }
  )

  return result.session
}

export async function controlMusicSession(
  eventId: string,
  token: string,
  payload: MusicSessionControlPayload
): Promise<MusicSession> {
  const body = buildSessionControl(
    payload.action,
    payload.revision
  )

  const result = await api<{ session: MusicSession }>(
    `/sessions/events/${requireId(eventId)}/control`,
    {
      method: 'POST',
      token,
      body
    }
  )

  return result.session
}
