import type { MusicPlaylist } from '../musicPlaylists'
import {
  validSnapshotDates,
  type PlaylistSnapshot
} from './cachePolicy'
import {
  validateQueueInput,
  type OfflineAction,
  type QueueInput,
  type QueueEntry
} from './queue'

export interface LocalTrack {
  id: string
  title: string
  artist: string
  pending: boolean
}

export interface LocalPlaylist {
  items: LocalTrack[]
  status: 'clean' | 'pending' | 'conflict'
}

interface PrepareOptions {
  userId: string
  eventId: string
  playlistId: string
  snapshot: PlaylistSnapshot
  action: OfflineAction
  pending: QueueEntry[]
  now?: number
}

export function trackIdentity(title: string, artist: string) {
  const normalize = (value: string) =>
    value.trim()
      .replace(/\s+/gu, ' ')
      .normalize('NFKC')
      .trim()
      .toLowerCase()

  return JSON.stringify([
    normalize(title),
    normalize(artist)
  ])
}

function checkAction(
  playlist: MusicPlaylist,
  action: OfflineAction
): void {
  const ids = playlist.items.map(item => item.id)

  switch (action.type) {
    case 'add': {
      if (playlist.items.length >= 100) {
        throw new Error('Playlist complète.')
      }

      const identity = trackIdentity(
        action.draft.title,
        action.draft.artist
      )

      if (playlist.items.some(item =>
        trackIdentity(item.title, item.artist) === identity
      )) {
        throw new Error('Ce morceau existe déjà.')
      }

      break
    }

    case 'remove':
      if (!ids.includes(action.itemId)) {
        throw new Error('Morceau introuvable.')
      }
      break

    case 'reorder':
      if (
        action.itemIds.length !== ids.length ||
        new Set(action.itemIds).size !== ids.length ||
        action.itemIds.some(id => !ids.includes(id))
      ) {
        throw new Error('Ordre des morceaux invalide.')
      }

      if (ids.every((id, index) =>
        id === action.itemIds[index]
      )) {
        throw new Error('Aucune modification de l’ordre.')
      }
      break
  }
}

export function prepareOfflineEdit(
  options: PrepareOptions
): QueueInput {
  const {
    userId,
    eventId,
    playlistId,
    snapshot,
    action,
    pending,
    now = Date.now()
  } = options

  if (
    !validSnapshotDates(snapshot, now) ||
    snapshot.listing.finished
  ) {
    throw new Error('Sauvegarde locale expirée.')
  }

  if (snapshot.canQueueEdits !== true) {
    throw new Error(
      'Modification hors ligne non autorisée.'
    )
  }

  const playlist = snapshot.listing.playlists.find(
    item => item.id === playlistId
  )

  if (!playlist) {
    throw new Error('Playlist introuvable.')
  }

  if (
    playlist.visibility !== 'PUBLIC' ||
    playlist.canEdit !== true
  ) {
    throw new Error(
      'Modification hors ligne non autorisée.'
    )
  }

  if (pending.some(entry =>
    entry.userId === userId &&
    entry.playlistId === playlistId
  )) {
    throw new Error(
      'Une modification est déjà en attente.'
    )
  }

  const input = validateQueueInput({
    userId,
    eventId,
    playlistId,
    baseRevision: playlist.revision,
    action
  })

  checkAction(playlist, input.action)

  return input
}

export function projectPlaylist(
  playlist: MusicPlaylist,
  entry?: QueueEntry
): LocalPlaylist {
  const items: LocalTrack[] = playlist.items.map(item => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    pending: false
  }))

  if (!entry) {
    return { items, status: 'clean' }
  }

  if (
    entry.syncState === 'conflict' ||
    entry.playlistId !== playlist.id ||
    entry.baseRevision !== playlist.revision
  ) {
    return { items, status: 'conflict' }
  }

  const action = entry.action

  try {
    checkAction(playlist, action)
  } catch {
    return { items, status: 'conflict' }
  }

  switch (action.type) {
    case 'add':
      return {
        status: 'pending',
        items: [
          ...items,
          {
            id: `pending-${entry.id}`,
            title: action.draft.title,
            artist: action.draft.artist,
            pending: true
          }
        ]
      }

    case 'remove':
      return {
        status: 'pending',
        items: items.filter(
          item => item.id !== action.itemId
        )
      }

    case 'reorder': {
      const byId = new Map(
        items.map(item => [item.id, item])
      )

      return {
        status: 'pending',
        items: action.itemIds.map(id => ({
          ...byId.get(id)!,
          pending: true
        }))
      }
    }
  }
}

export function findPendingForPlaylist(
  entries: QueueEntry[],
  userId: string,
  eventId: string,
  playlistId: string
): QueueEntry | undefined {
  return entries.find(entry =>
    entry.userId === userId &&
    entry.eventId === eventId &&
    entry.playlistId === playlistId
  )
}

export function moveOfflineTrack(
  playlist: MusicPlaylist,
  itemId: string,
  direction: -1 | 1
): OfflineAction | null {
  const ids = playlist.items.map(item => item.id)
  const index = ids.indexOf(itemId)
  const target = index + direction

  if (
    index < 0 ||
    target < 0 ||
    target >= ids.length
  ) return null

  const item = ids[index]
  ids[index] = ids[target]
  ids[target] = item

  return {
    type: 'reorder',
    itemIds: ids
  }
}

export function prepareCurrentOfflineEdit(
  options: PrepareOptions,
  latest: PlaylistSnapshot | null
): QueueInput {
  const previous = options.snapshot.listing.playlists.find(
    playlist => playlist.id === options.playlistId
  )

  const current = latest?.listing.playlists.find(
    playlist => playlist.id === options.playlistId
  )

  if (
    !latest ||
    !previous ||
    !current ||
    latest.cachedAt !== options.snapshot.cachedAt ||
    previous.revision !== current.revision
  ) {
    throw new Error(
      'La sauvegarde locale a changé. Actualise les playlists.'
    )
  }

  return prepareOfflineEdit({
    ...options,
    snapshot: latest
  })
}
