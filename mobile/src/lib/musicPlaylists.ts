import { api } from './api'
import { validMusicEventId } from './musicTracks'

export interface PlaylistItem {
  id: string
  title: string
  artist: string
  position: number
  addedById: string
  addedBy: {
    id: string
    name: string
  } | null
}

export interface PlaylistPermissions {
  visibility: 'PUBLIC' | 'PRIVATE'
  editPolicy: 'PUBLIC' | 'INVITED_ONLY'
}

export interface MusicPlaylist {
  visibility?: PlaylistPermissions['visibility']
  editPolicy?: PlaylistPermissions['editPolicy']
  canEdit?: boolean
  id: string
  title: string
  description: string
  revision: number
  createdAt: string
  items: PlaylistItem[]
}

export interface PlaylistEventMetadata {
  id: string
  title: string
  visibility: 'PUBLIC' | 'PRIVATE'
  endsAt: string
}

export interface PlaylistListing {
  event?: PlaylistEventMetadata
  playlists: MusicPlaylist[]
  canEdit: boolean
  organizer: boolean
  finished: boolean
}

export interface PlaylistDraft {
  title: string
  description: string
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function record(
  value: unknown
): Record<string, unknown> | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null
  }

  return value as Record<string, unknown>
}

function validText(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0)

    if (code < 32 || code === 127) {
      return false
    }
  }

  return true
}

export function buildPlaylistDraft(
  input: PlaylistDraft
): PlaylistDraft {
  const title = input.title.trim()
  const description = input.description.trim()

  if (
    title.length < 2 ||
    title.length > 100 ||
    !validText(title)
  ) {
    throw new Error(
      'Le titre doit contenir entre 2 et 100 caractères valides.'
    )
  }

  if (
    description.length > 500 ||
    !validText(description)
  ) {
    throw new Error(
      'La description est invalide (500 caractères maximum).'
    )
  }

  return { title, description }
}

function parseUser(
  value: unknown
): PlaylistItem['addedBy'] {
  if (value === null || value === undefined) {
    return null
  }

  const user = record(value)

  if (
    !user ||
    typeof user.id !== 'string' ||
    typeof user.name !== 'string'
  ) {
    throw new Error('Auteur invalide.')
  }

  return {
    id: user.id,
    name: user.name
  }
}

function parseItem(value: unknown): PlaylistItem {
  const item = record(value)

  if (
    !item ||
    typeof item.id !== 'string' ||
    !uuid.test(item.id) ||
    typeof item.title !== 'string' ||
    typeof item.artist !== 'string' ||
    typeof item.position !== 'number' ||
    !Number.isSafeInteger(item.position) ||
    item.position < 0 ||
    typeof item.addedById !== 'string'
  ) {
    throw new Error('Morceau de playlist invalide.')
  }

  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    position: item.position,
    addedById: item.addedById,
    addedBy: parseUser(item.addedBy)
  }
}

function parsePlaylist(value: unknown): MusicPlaylist {
  const playlist = record(value)

  if (
    !playlist ||
    typeof playlist.id !== 'string' ||
    !uuid.test(playlist.id) ||
    typeof playlist.title !== 'string' ||
    typeof playlist.description !== 'string' ||
    (
      playlist.visibility !== undefined &&
      playlist.visibility !== 'PUBLIC' &&
      playlist.visibility !== 'PRIVATE'
    ) ||
    (
      playlist.editPolicy !== undefined &&
      playlist.editPolicy !== 'PUBLIC' &&
      playlist.editPolicy !== 'INVITED_ONLY'
    ) ||
    (
      playlist.canEdit !== undefined &&
      typeof playlist.canEdit !== 'boolean'
    ) ||
    typeof playlist.revision !== 'number' ||
    !Number.isSafeInteger(playlist.revision) ||
    playlist.revision < 0 ||
    typeof playlist.createdAt !== 'string' ||
    !Array.isArray(playlist.items)
  ) {
    throw new Error('Playlist invalide.')
  }

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    ...(playlist.visibility === undefined
      ? {}
      : { visibility: playlist.visibility }),
    ...(playlist.editPolicy === undefined
      ? {}
      : { editPolicy: playlist.editPolicy }),
    ...(playlist.canEdit === undefined
      ? {}
      : { canEdit: playlist.canEdit }),
    revision: playlist.revision,
    createdAt: playlist.createdAt,
    items: playlist.items.map(parseItem)
  }
}

/**
 * L'ordre, les révisions et les permissions proviennent
 * exclusivement du serveur. Aucun tri local.
 */
function parseEventMetadata(
  value: unknown
): PlaylistEventMetadata {
  const event = record(value)

  if (
    !event ||
    typeof event.id !== 'string' ||
    !uuid.test(event.id) ||
    typeof event.title !== 'string' ||
    (
      event.visibility !== 'PUBLIC' &&
      event.visibility !== 'PRIVATE'
    ) ||
    typeof event.endsAt !== 'string' ||
    !Number.isFinite(Date.parse(event.endsAt))
  ) {
    throw new Error('Métadonnées événement invalides.')
  }

  return {
    id: event.id,
    title: event.title,
    visibility: event.visibility,
    endsAt: event.endsAt
  }
}

export function parsePlaylistListing(
  input: unknown
): PlaylistListing {
  const source = record(input)

  if (
    source === null ||
    !Array.isArray(source.playlists) ||
    typeof source.canEdit !== 'boolean' ||
    typeof source.organizer !== 'boolean' ||
    typeof source.finished !== 'boolean'
  ) {
    throw new Error('Réponse playlists invalide.')
  }

  return {
    ...(source.event === undefined
      ? {}
      : { event: parseEventMetadata(source.event) }),
    playlists: source.playlists.map(parsePlaylist),
    canEdit: source.canEdit,
    organizer: source.organizer,
    finished: source.finished
  }
}

export function canCreatePlaylist(
  listing: PlaylistListing
): boolean {
  return listing.canEdit && !listing.finished
}

export async function fetchMusicPlaylists(
  eventId: string,
  token: string
): Promise<PlaylistListing> {
  if (!validMusicEventId(eventId)) {
    throw new Error("Identifiant d'événement invalide.")
  }

  const result = await api<unknown>(
    `/playlists/events/${eventId}`,
    { token }
  )

  const listing = parsePlaylistListing(result)

  if (listing.event && listing.event.id !== eventId) {
    throw new Error('Événement de playlist incohérent.')
  }

  return listing
}

export async function createMusicPlaylist(
  eventId: string,
  draft: PlaylistDraft,
  token: string
): Promise<void> {
  if (!validMusicEventId(eventId)) {
    throw new Error("Identifiant d'événement invalide.")
  }

  await api<unknown>(
    `/playlists/events/${eventId}`,
    {
      method: 'POST',
      token,
      body: buildPlaylistDraft(draft)
    }
  )
}


export async function updatePlaylistPermissions(
  playlistId: string,
  permissions: PlaylistPermissions,
  token: string
): Promise<void> {
  if (!uuid.test(playlistId)) {
    throw new Error('Identifiant de playlist invalide.')
  }

  await api<unknown>(
    `/playlists/${playlistId}/policies`,
    {
      method: 'PATCH',
      token,
      body: permissions
    }
  )
}
