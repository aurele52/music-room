import type { MusicEvent } from '../api'
import {
  parsePlaylistListing,
  type PlaylistListing
} from '../musicPlaylists'

export const CACHE_TTL = 24 * 60 * 60 * 1000

export interface PlaylistSnapshot {
  eventTitle?: string
  canQueueEdits?: boolean
  listing: PlaylistListing
  cachedAt: number
  expiresAt: number
}

export function validSnapshotDates(
  snapshot: Pick<PlaylistSnapshot, 'cachedAt' | 'expiresAt'>,
  now: number
): boolean {
  return Number.isSafeInteger(now) &&
    now >= 0 &&
    Number.isSafeInteger(snapshot.cachedAt) &&
    Number.isSafeInteger(snapshot.expiresAt) &&
    snapshot.cachedAt >= 0 &&
    snapshot.cachedAt <= now &&
    snapshot.expiresAt > now &&
    snapshot.expiresAt <= snapshot.cachedAt + CACHE_TTL
}

export function createSnapshot(
  event: Pick<
    MusicEvent,
    'id' | 'title' | 'visibility' | 'endsAt'
  >,
  listing: PlaylistListing,
  now = Date.now()
): PlaylistSnapshot | null {
  const end = Date.parse(event.endsAt)

  // Ne pas mettre en cache les événements privés.
  if (
    event.visibility !== 'PUBLIC' ||
    listing.finished ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isFinite(end) ||
    end <= now
  ) return null

  return {
    eventTitle: event.title,
    canQueueEdits: listing.canEdit && !listing.finished,
    listing: {
      ...listing,
      playlists: listing.playlists.filter(
        playlist => playlist.visibility === 'PUBLIC'
      ),
      canEdit: false,
      organizer: false
    },
    cachedAt: now,
    expiresAt: Math.min(now + CACHE_TTL, end)
  }
}

export function readSnapshot(
  raw: string,
  now = Date.now()
): PlaylistSnapshot | null {
  try {
    const snapshot = JSON.parse(raw)

    if (!validSnapshotDates(snapshot, now)) {
      return null
    }

    const listing = parsePlaylistListing(
      snapshot.listing
    )

    if (listing.finished) return null

    return {
      ...(typeof snapshot.canQueueEdits === 'boolean'
        ? { canQueueEdits: snapshot.canQueueEdits }
        : {}),
      ...(typeof snapshot.eventTitle === 'string'
        ? { eventTitle: snapshot.eventTitle }
        : {}),
      cachedAt: snapshot.cachedAt,
      expiresAt: snapshot.expiresAt,
      listing: {
        ...listing,
        playlists: listing.playlists.filter(
          playlist => playlist.visibility === 'PUBLIC'
        ),
        canEdit: false,
        organizer: false
      }
    }
  } catch {
    return null
  }
}
