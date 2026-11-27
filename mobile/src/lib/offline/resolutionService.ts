import {
  fetchMusicPlaylists,
  type MusicPlaylist
} from '../musicPlaylists'

import {
  listPendingOperations,
  removePendingOperation,
  cancelPendingOperation,
  rebasePendingOperation,
  deleteSnapshot
} from './database'

import { offlineLock } from './offlineLock'
import {
  notifySyncChange,
  invalidateCacheGeneration,
  serializeCache
} from './syncChanges'

import {
  inspectResolution,
  canCloseSatisfied,
  type Resolution
} from './conflictResolution'

import type { QueueEntry } from './queue'

export interface ResolutionPreview {
  entry: QueueEntry
  playlist: MusicPlaylist
  resolution: Resolution
  canEdit: boolean
  canClose: boolean
}

function requireCurrent(current: () => boolean) {
  if (!current()) {
    throw new Error('Session modifiée.')
  }
}

async function findOperation(
  userId: string,
  id: number
): Promise<QueueEntry> {
  const entries = await listPendingOperations(userId)

  const entry = entries.find(
    row => row.userId === userId && row.id === id
  )

  if (!entry) {
    throw new Error('Modification locale introuvable.')
  }

  return entry
}

export async function compareOperation(
  userId: string,
  id: number,
  token: string,
  current: () => boolean
): Promise<ResolutionPreview> {
  requireCurrent(current)

  const entry = await findOperation(userId, id)

  requireCurrent(current)

  const listing = await fetchMusicPlaylists(
    entry.eventId,
    token
  )

  requireCurrent(current)

  const event = listing.event

  if (
    !event ||
    event.id !== entry.eventId ||
    event.visibility !== 'PUBLIC'
  ) {
    throw new Error(
      'Cet événement ne permet plus de résolution hors ligne.'
    )
  }

  const playlist = listing.playlists.find(
    row => row.id === entry.playlistId
  )

  if (!playlist) {
    throw new Error('Playlist supprimée ou inaccessible.')
  }

  if (playlist.visibility !== 'PUBLIC') {
    throw new Error(
      'Cette playlist ne permet plus de résolution hors ligne.'
    )
  }

  const canEdit =
    listing.canEdit &&
    playlist.canEdit === true &&
    !listing.finished &&
    Date.parse(event.endsAt) > Date.now()

  return {
    entry,
    playlist,
    canEdit,
    canClose: canCloseSatisfied(entry, playlist),
    resolution: inspectResolution(entry, playlist)
  }
}

export async function reapplyOperation(
  userId: string,
  id: number,
  displayedRevision: number,
  token: string,
  current: () => boolean
): Promise<void> {
  const eventId = await offlineLock.run(async () => {
    requireCurrent(current)

    // Relire le serveur au moment de la confirmation.

    const preview = await compareOperation(
      userId, id, token, current
    )

    if (preview.playlist.revision !== displayedRevision) {
      throw new Error(
        'La playlist a encore changé. Compare de nouveau.'
      )
    }

    if (
      !preview.canEdit ||
      preview.resolution !== 'reapply'
    ) {
      throw new Error(
        'Cette modification ne peut pas être réappliquée.'
      )
    }

    requireCurrent(current)

    const changed = await rebasePendingOperation(
      userId,
      id,
      preview.entry.baseRevision,
      preview.playlist.revision
    )

    if (!changed) {
      throw new Error(
        'La modification locale a changé.'
      )
    }

    return preview.entry.eventId
  })

  notifySyncChange(userId, eventId)
}

export async function discardOperation(
  userId: string,
  id: number,
  current: () => boolean
): Promise<void> {
  const eventId = await offlineLock.run(async () => {
    requireCurrent(current)

    const entry = await findOperation(userId, id)

    requireCurrent(current)

    if (entry.syncState === 'attempted') {
      throw new Error(
        'Le résultat de cet envoi doit encore être vérifié.'
      )
    }

    const removed = entry.syncState === 'conflict'
      ? await removePendingOperation(userId, id)
      : await cancelPendingOperation(userId, id)

    if (!removed) {
      throw new Error(
        'La modification locale a changé.'
      )
    }

    return entry.eventId
  })

  notifySyncChange(userId, eventId)
}

export async function closeSatisfiedOperation(
  userId: string,
  id: number,
  displayedRevision: number,
  token: string,
  current: () => boolean
): Promise<void> {
  const eventId = await offlineLock.run(async () => {
    requireCurrent(current)

    // Ne jamais faire confiance a une ancienne comparaison.
    const preview = await compareOperation(
      userId, id, token, current
    )

    if (
      !preview.canClose ||
      preview.playlist.revision !== displayedRevision
    ) {
      throw new Error(
        'La playlist a changé. Compare de nouveau.'
      )
    }

    requireCurrent(current)

    invalidateCacheGeneration(userId, preview.entry.eventId)

    await serializeCache(() =>
      deleteSnapshot(userId, preview.entry.eventId)
    )

    requireCurrent(current)

    // Aucun POST, PUT ou DELETE HTTP ici.
    // Seule l'intention locale est retiree.
    const removed = await removePendingOperation(userId, id)

    if (!removed) {
      throw new Error('Modification locale introuvable.')
    }

    return preview.entry.eventId
  })

  notifySyncChange(userId, eventId)
}
