import type { MusicPlaylist } from '../musicPlaylists'
import type { QueueEntry } from './queue'
import {
  projectPlaylist,
  trackIdentity
} from './localEdits'

export type Resolution =
  | 'satisfied'
  | 'reapply'
  | 'blocked'

export function inspectResolution(
  entry: QueueEntry,
  playlist: MusicPlaylist
): Resolution {
  if (entry.playlistId !== playlist.id) {
    return 'blocked'
  }

  const action = entry.action

  switch (action.type) {
    case 'add':
      if (playlist.items.some(item =>
        trackIdentity(item.title, item.artist) ===
          trackIdentity(
            action.draft.title,
            action.draft.artist
          )
      )) {
        return 'satisfied'
      }
      break

    case 'remove':
      if (!playlist.items.some(
        item => item.id === action.itemId
      )) {
        return 'satisfied'
      }
      break

    case 'reorder':
      if (
        playlist.items.length === action.itemIds.length &&
        playlist.items.every(
          (item, index) =>
            item.id === action.itemIds[index]
        )
      ) {
        return 'satisfied'
      }
      break
  }

  // Ne jamais changer silencieusement la revision
  // d'une operation dont le resultat est incertain.

  if (
    entry.syncState !== 'conflict' ||
    entry.syncStatus !== 409 ||
    playlist.revision <= entry.baseRevision
  ) {
    return 'blocked'
  }

  const projection = projectPlaylist(playlist, {
    ...entry,
    // Simulation d'une operation explicitement reappliquee.
    syncState: undefined,
    baseRevision: playlist.revision
  })

  return projection.status === 'pending'
    ? 'reapply'
    : 'blocked'
}

// Une revision plus recente garantit qu'une ancienne
// requete ne peut plus modifier cette playlist avec
// sa revision d'origine.

export function canCloseSatisfied(
  entry: QueueEntry,
  playlist: MusicPlaylist
): boolean {
  return (
    entry.syncState === 'attempted' ||
    entry.syncState === 'conflict'
  ) &&
    playlist.revision > entry.baseRevision &&
    inspectResolution(entry, playlist) === 'satisfied'
}

export function describeOperation(
  entry: QueueEntry
): string {
  switch (entry.action.type) {
    case 'add':
      return `Ajouter : ${entry.action.draft.title} — ${entry.action.draft.artist}`

    case 'remove':
      return 'Retirer un morceau'

    case 'reorder':
      return 'Modifier l’ordre des morceaux'
  }
}
