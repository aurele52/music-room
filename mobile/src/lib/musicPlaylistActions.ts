import { api } from './api'
import { canCreatePlaylist } from './musicPlaylists'
import type {
  MusicPlaylist,
  PlaylistItem,
  PlaylistListing
} from './musicPlaylists'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PlaylistItemDraft {
  title: string
  artist: string
}

function requireId(id: string): string {
  if (!uuid.test(id)) {
    throw new Error('Identifiant invalide.')
  }
  return id
}

function cleanText(
  value: string,
  min: number,
  max: number,
  label: string
): string {
  const cleaned = value.trim()

  const invalid = [...cleaned].some(character => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })

  if (
    cleaned.length < min ||
    cleaned.length > max ||
    invalid
  ) {
    throw new Error(`${label} invalide.`)
  }

  return cleaned
}

export function buildPlaylistItemDraft(
  draft: PlaylistItemDraft
): PlaylistItemDraft {
  return {
    title: cleanText(draft.title, 2, 150, 'Titre'),
    artist: cleanText(draft.artist, 2, 120, 'Artiste')
  }
}

/**
 * Le serveur décide de l'autorisation effective.
 * Le mobile masque seulement les actions quand canEdit=false.
 */
export function canManagePlaylistItems(
  listing: PlaylistListing
): boolean {
  return canCreatePlaylist(listing)
}

/**
 * Suppression de playlist limitée à l'organisateur
 * dans l'interface. L'API reste l'autorité finale.
 */
export function canDeleteMusicPlaylist(
  listing: PlaylistListing
): boolean {
  return canManagePlaylistItems(listing) && listing.organizer
}

/**
 * Utiliser les permissions individuelles fournies par le serveur.
 * Une permission absente ne donne aucun droit.
 */
export function canEditPlaylistItems(
  listing: PlaylistListing,
  playlistId: string
): boolean {
  const playlist = listing.playlists.find(
    candidate => candidate.id === playlistId
  )

  return (
    canManagePlaylistItems(listing) &&
    playlist?.canEdit === true
  )
}

export function canChangePlaylistPermissions(
  listing: PlaylistListing,
  playlistId: string
): boolean {
  return (
    listing.organizer &&
    canEditPlaylistItems(listing, playlistId)
  )
}

export function buildReorderPayload(
  playlist: MusicPlaylist,
  itemId: string,
  direction: -1 | 1
): { itemIds: string[]; revision: number } {
  requireId(playlist.id)
  requireId(itemId)

  if (
    !Number.isSafeInteger(playlist.revision) ||
    playlist.revision < 0
  ) {
    throw new Error('Révision invalide.')
  }

  const itemIds = playlist.items.map(
    (item: PlaylistItem) => requireId(item.id)
  )

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error('Liste de morceaux invalide.')
  }

  const index = itemIds.indexOf(itemId)
  const target = index + direction

  if (
    index < 0 ||
    target < 0 ||
    target >= itemIds.length
  ) {
    throw new Error('Déplacement impossible.')
  }

  const current = itemIds[index]
  const adjacent = itemIds[target]

  if (!current || !adjacent) {
    throw new Error('Déplacement impossible.')
  }

  itemIds[index] = adjacent
  itemIds[target] = current

  return {
    itemIds,
    revision: playlist.revision
  }
}

export async function addMusicPlaylistItem(
  playlistId: string,
  draft: PlaylistItemDraft,
  token: string
): Promise<void> {
  await api<unknown>(
    `/playlists/${requireId(playlistId)}/items`,
    {
      method: 'POST',
      token,
      body: buildPlaylistItemDraft(draft)
    }
  )
}

export async function removeMusicPlaylistItem(
  playlistId: string,
  itemId: string,
  token: string
): Promise<void> {
  await api<unknown>(
    `/playlists/${requireId(playlistId)}/items/${requireId(itemId)}`,
    {
      method: 'DELETE',
      token
    }
  )
}

export async function deleteMusicPlaylist(
  playlistId: string,
  token: string
): Promise<void> {
  await api<unknown>(
    `/playlists/${requireId(playlistId)}`,
    {
      method: 'DELETE',
      token
    }
  )
}

export async function moveMusicPlaylistItem(
  playlist: MusicPlaylist,
  itemId: string,
  direction: -1 | 1,
  token: string
): Promise<void> {
  const body = buildReorderPayload(
    playlist,
    itemId,
    direction
  )

  await api<unknown>(
    `/playlists/${requireId(playlist.id)}/order`,
    {
      method: 'PUT',
      token,
      body
    }
  )
}
