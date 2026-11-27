import {
  cacheGeneration,
  cacheUserGeneration,
  cacheSessionIsCurrent,
  invalidateCacheGeneration,
  serializeCache
} from './syncChanges'
import { ApiError } from '../api'
import type { PlaylistListing } from '../musicPlaylists'
import { validMusicEventId } from '../musicTracks'
import {
  createSnapshot,
  validSnapshotDates,
  type PlaylistSnapshot
} from './cachePolicy'

export type PlaylistView =
  | {
      source: 'server'
      listing: PlaylistListing
      cacheable: boolean
    }
  | ({
      source: 'cache'
    } & PlaylistSnapshot)

interface CacheStorage {
  saveSnapshot(
    userId: string,
    eventId: string,
    snapshot: PlaylistSnapshot
  ): Promise<void>

  loadSnapshot(
    userId: string,
    eventId: string
  ): Promise<PlaylistSnapshot | null>

  deleteSnapshot(
    userId: string,
    eventId: string
  ): Promise<void>
}

interface LoadOptions {
  userId: string
  eventId: string
  current: () => boolean
  allowCache: boolean
  fetchListing: () => Promise<PlaylistListing>
}

export function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError &&
    error.status === 0 &&
    (
      error.message === 'Connexion au serveur impossible' ||
      error.message === 'Le serveur ne répond pas'
    )
}

export function isAccessFailure(error: unknown): boolean {
  return error instanceof ApiError &&
    [401, 403, 404].includes(error.status)
}

export function createPlaylistLoader(
  storage: CacheStorage,
  clock: () => number = Date.now
) {
  // Sérialiser les accès au cache pour éviter qu'une ancienne
  // écriture ne recrée des données après une invalidation.

  function cacheOperation<T>(
    operation: () => Promise<T>
  ): Promise<T | undefined> {
    const result = serializeCache(operation).catch(() => {
      // Un problème SQLite ne doit pas bloquer le mode en ligne.
      return undefined
    })

    return result
  }

  function invalidate(userId: string, eventId: string) {
    invalidateCacheGeneration(userId, eventId)

    return cacheOperation(() =>
      storage.deleteSnapshot(userId, eventId)
    )
  }

  async function load(
    options: LoadOptions
  ): Promise<PlaylistView | null> {
    const {
      userId,
      eventId,
      current: screenCurrent,
      fetchListing
    } = options

    const generation = cacheGeneration(userId, eventId)
    const userGeneration = cacheUserGeneration(userId)

    const current = () =>
      screenCurrent() &&
      cacheSessionIsCurrent(userId) &&
      userGeneration === cacheUserGeneration(userId) &&
      generation === cacheGeneration(userId, eventId)

    if (!current()) return null

    if (!userId || !validMusicEventId(eventId)) {
      throw new Error('Événement invalide.')
    }

    const allowCache = options.allowCache

    try {
      const listing = await fetchListing()

      if (!current()) return null

      const event = listing.event

      if (event && event.id !== eventId) {
        await cacheOperation(() =>
          storage.deleteSnapshot(userId, eventId)
        )

        throw new Error('Événement de playlist incohérent.')
      }

      // Le cache necessite les informations de l'evenement.
      const snapshot = event
        ? createSnapshot(event, listing, clock())
        : null

      await cacheOperation(async () => {
        if (!current()) return

        if (snapshot) {
          await storage.saveSnapshot(
            userId,
            eventId,
            snapshot
          )
        } else {
          await storage.deleteSnapshot(userId, eventId)
        }
      })

      if (!current()) return null

      return {
        source: 'server',
        listing,
        cacheable: snapshot !== null
      }
    } catch (error) {
      if (!current()) return null

      if (isAccessFailure(error)) {
        await cacheOperation(async () => {
          if (current()) {
            await storage.deleteSnapshot(userId, eventId)
          }
        })

        throw error
      }

      if (!allowCache || !isNetworkFailure(error)) {
        throw error
      }

      const snapshot = await cacheOperation(() =>
        storage.loadSnapshot(userId, eventId)
      )

      if (!current()) return null

      if (!snapshot || !validSnapshotDates(snapshot, clock())) {
        throw error
      }

      return {
        ...snapshot,
        source: 'cache',
        listing: {
          ...snapshot.listing,
          canEdit: false,
          organizer: false
        }
      }
    }
  }

  return { load, invalidate }
}
