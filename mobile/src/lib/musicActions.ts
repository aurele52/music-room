import { api } from './api'
import {
  buildVoteBody,
  type VoteCoordinates
} from './voteCoordinates'
import {
  validMusicEventId,
  type MusicTrackListing
} from './musicTracks'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Le vote reste contrôlé par l'API.
 * Les coordonnées GPS sont demandées si le serveur les exige.
 */
export function mobileCanVote(
  listing: MusicTrackListing
): boolean {
  return (
    listing.canVote &&
    !listing.finished
  )
}

function validTrackId(id: string): string {
  if (!uuid.test(id)) {
    throw new Error('Identifiant de morceau invalide.')
  }

  return id
}

export async function changeMusicVote(
  trackId: string,
  voted: boolean,
  listing: MusicTrackListing,
  token: string,
  coordinates?: VoteCoordinates
): Promise<void> {
  if (!mobileCanVote(listing)) {
    throw new Error(
      'Le vote est actuellement indisponible.'
    )
  }

  const id = validTrackId(trackId)
  const body = buildVoteBody(
    listing.requiresLocation,
    coordinates
  )

  await api<unknown>(
    `/tracks/${id}/vote`,
    {
      method: voted ? 'DELETE' : 'POST',
      token,
      ...(body ? { body } : {})
    }
  )
}

export async function proposeCatalogTrack(
  eventId: string,
  catalogTrackId: string,
  token: string
): Promise<void> {
  if (!validMusicEventId(eventId)) {
    throw new Error("Identifiant d'événement invalide.")
  }

  if (!/^[a-z0-9-]{1,80}$/.test(catalogTrackId)) {
    throw new Error('Identifiant catalogue invalide.')
  }

  await api<unknown>(
    `/tracks/events/${eventId}`,
    {
      method: 'POST',
      token,
      body: { catalogTrackId }
    }
  )
}
