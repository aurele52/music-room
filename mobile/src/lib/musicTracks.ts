import { api } from './api'

export interface MusicTrack {
  id: string
  title: string
  artist: string
  votes: number
  myVote: boolean
  proposer: {
    id: string
    name: string
  } | null
}

export interface MusicTrackListing {
  tracks: MusicTrack[]
  canParticipate: boolean
  canVote: boolean
  requiresLocation: boolean
  finished: boolean
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validMusicEventId(value: string): boolean {
  return uuid.test(value)
}

function object(
  value: unknown
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null
  }

  return value as Record<string, unknown>
}

/**
 * Valider la structure reçue sans réorganiser le classement.
 * Le backend reste propriétaire du score et du tri.
 */
export function parseMusicTrackListing(
  input: unknown
): MusicTrackListing {
  const source = object(input)

  if (!source || !Array.isArray(source.tracks)) {
    throw new Error('Réponse musicale invalide.')
  }

  for (const key of [
    'canParticipate',
    'canVote',
    'requiresLocation',
    'finished'
  ]) {
    if (typeof source[key] !== 'boolean') {
      throw new Error('Permissions musicales invalides.')
    }
  }

  const tracks: MusicTrack[] = source.tracks.map(
    (item: unknown) => {
      const track = object(item)

      if (
        !track ||
        typeof track.id !== 'string' ||
        !uuid.test(track.id) ||
        typeof track.title !== 'string' ||
        typeof track.artist !== 'string' ||
        typeof track.votes !== 'number' ||
        !Number.isSafeInteger(track.votes) ||
        track.votes < 0 ||
        typeof track.myVote !== 'boolean'
      ) {
        throw new Error('Morceau invalide dans la réponse.')
      }

      let proposer: MusicTrack['proposer'] = null

      if (track.proposer != null) {
        const user = object(track.proposer)

        if (
          !user ||
          typeof user.id !== 'string' ||
          typeof user.name !== 'string'
        ) {
          throw new Error('Auteur du morceau invalide.')
        }

        proposer = {
          id: user.id,
          name: user.name
        }
      }

      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        votes: track.votes,
        myVote: track.myVote,
        proposer
      }
    }
  )

  return {
    tracks,
    canParticipate: source.canParticipate as boolean,
    canVote: source.canVote as boolean,
    requiresLocation: source.requiresLocation as boolean,
    finished: source.finished as boolean
  }
}

export async function fetchMusicTracks(
  eventId: string,
  token: string
): Promise<MusicTrackListing> {
  if (!validMusicEventId(eventId)) {
    throw new Error("Identifiant d'événement invalide.")
  }

  const response = await api<unknown>(
    `/tracks/events/${eventId}`,
    { token }
  )

  return parseMusicTrackListing(response)
}
