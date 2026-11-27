import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlaylistItemDraft,
  buildReorderPayload,
  canDeleteMusicPlaylist,
  canManagePlaylistItems,
  canEditPlaylistItems,
  canChangePlaylistPermissions
} from '../src/lib/musicPlaylistActions'
import type {
  MusicPlaylist,
  PlaylistListing
} from '../src/lib/musicPlaylists'

const a = '123e4567-e89b-42d3-a456-426614174201'
const b = '123e4567-e89b-42d3-a456-426614174202'
const c = '123e4567-e89b-42d3-a456-426614174203'
const playlistId = '123e4567-e89b-42d3-a456-426614174204'

const playlist: MusicPlaylist = {
  id: playlistId,
  title: 'Playlist',
  description: '',
  revision: 7,
  createdAt: '2035-01-01T00:00:00.000Z',
  items: [a, b, c].map((id, position) => ({
    id,
    title: `Morceau ${position}`,
    artist: 'Groupe',
    position,
    addedById: a,
    addedBy: null
  }))
}

const listing: PlaylistListing = {
  playlists: [playlist],
  canEdit: true,
  organizer: false,
  finished: false
}

test('valide un nouveau morceau', () => {
  assert.deepEqual(buildPlaylistItemDraft({
    title: '  Morceau  ',
    artist: '  Artiste  '
  }), {
    title: 'Morceau',
    artist: 'Artiste'
  })
})

test('refuse un titre trop court', () => {
  assert.throws(() => buildPlaylistItemDraft({
    title: 'A',
    artist: 'Artiste'
  }))
})

test('refuse un artiste trop court', () => {
  assert.throws(() => buildPlaylistItemDraft({
    title: 'Morceau',
    artist: 'A'
  }))
})

test('refuse un titre trop long', () => {
  assert.throws(() => buildPlaylistItemDraft({
    title: 'x'.repeat(151),
    artist: 'Artiste'
  }))
})

test('refuse un artiste trop long', () => {
  assert.throws(() => buildPlaylistItemDraft({
    title: 'Morceau',
    artist: 'x'.repeat(121)
  }))
})

test('autorise une edition accordee par API', () => {
  assert.equal(canManagePlaylistItems(listing), true)
})

test('interdit edition evenement termine', () => {
  assert.equal(canManagePlaylistItems({
    ...listing,
    finished: true
  }), false)
})

test('suppression playlist reservee organisateur UI', () => {
  assert.equal(canDeleteMusicPlaylist(listing), false)
  assert.equal(canDeleteMusicPlaylist({
    ...listing,
    organizer: true
  }), true)
})

test('monter conserve tous les identifiants', () => {
  assert.deepEqual(
    buildReorderPayload(playlist, b, -1),
    {
      itemIds: [b, a, c],
      revision: 7
    }
  )
})

test('descendre conserve tous les identifiants', () => {
  assert.deepEqual(
    buildReorderPayload(playlist, b, 1),
    {
      itemIds: [a, c, b],
      revision: 7
    }
  )
})

test('deplacement au bord refuse', () => {
  assert.throws(
    () => buildReorderPayload(playlist, a, -1),
    /Déplacement impossible/
  )
})

test('morceau inconnu refuse', () => {
  assert.throws(
    () => buildReorderPayload(playlist, playlistId, 1),
    /Déplacement impossible/
  )
})

test('revision invalide refusee', () => {
  assert.throws(
    () => buildReorderPayload({
      ...playlist,
      revision: -1
    }, b, 1),
    /Révision invalide/
  )
})

test('identifiants dupliques refuses', () => {
  assert.throws(
    () => buildReorderPayload({
      ...playlist,
      items: [
        playlist.items[0]!,
        playlist.items[0]!
      ]
    }, a, 1),
    /Liste de morceaux invalide/
  )
})


// Permissions individuelles fournies par le serveur.

const editableListing: PlaylistListing = {
  ...listing,
  playlists: [{
    ...playlist,
    visibility: 'PUBLIC',
    editPolicy: 'PUBLIC',
    canEdit: true
  }]
}

const readonlyListing: PlaylistListing = {
  ...listing,
  playlists: [{
    ...playlist,
    visibility: 'PUBLIC',
    editPolicy: 'INVITED_ONLY',
    canEdit: false
  }]
}

const organizerListing: PlaylistListing = {
  ...editableListing,
  organizer: true
}

test('permission individuelle accordee', () => {
  assert.equal(
    canEditPlaylistItems(editableListing, playlistId),
    true
  )
})

test('permission individuelle refusee', () => {
  assert.equal(
    canEditPlaylistItems(readonlyListing, playlistId),
    false
  )
})

test('permission individuelle absente refusee', () => {
  assert.equal(
    canEditPlaylistItems(listing, playlistId),
    false
  )
})

test('playlist inconnue non modifiable', () => {
  assert.equal(
    canEditPlaylistItems(editableListing, a),
    false
  )
})

test('permission globale refusee prioritaire', () => {
  assert.equal(
    canEditPlaylistItems({
      ...editableListing,
      canEdit: false
    }, playlistId),
    false
  )
})

test('evenement termine prioritaire', () => {
  assert.equal(
    canEditPlaylistItems({
      ...editableListing,
      finished: true
    }, playlistId),
    false
  )
})

test('organisateur respecte permission individuelle', () => {
  assert.equal(
    canEditPlaylistItems({
      ...readonlyListing,
      organizer: true
    }, playlistId),
    false
  )
})

test('playlist privee autorisee selon serveur', () => {
  assert.equal(
    canEditPlaylistItems({
      ...editableListing,
      playlists: [{
        ...playlist,
        visibility: 'PRIVATE',
        canEdit: true
      }]
    }, playlistId),
    true
  )
})

test('invite autorise selon serveur', () => {
  assert.equal(
    canEditPlaylistItems({
      ...editableListing,
      playlists: [{
        ...playlist,
        editPolicy: 'INVITED_ONLY',
        canEdit: true
      }]
    }, playlistId),
    true
  )
})

test('permissions distinctes entre deux playlists', () => {
  const mixed: PlaylistListing = {
    ...listing,
    playlists: [
      { ...playlist, canEdit: true },
      { ...playlist, id: a, canEdit: false }
    ]
  }

  assert.equal(
    canEditPlaylistItems(mixed, playlistId),
    true
  )

  assert.equal(
    canEditPlaylistItems(mixed, a),
    false
  )
})

test('organisateur peut configurer les droits', () => {
  assert.equal(
    canChangePlaylistPermissions(organizerListing, playlistId),
    true
  )
})

test('non organisateur ne configure pas les droits', () => {
  assert.equal(
    canChangePlaylistPermissions(editableListing, playlistId),
    false
  )
})

test('configuration evenement termine interdite', () => {
  assert.equal(
    canChangePlaylistPermissions({
      ...organizerListing,
      finished: true
    }, playlistId),
    false
  )
})

test('configuration playlist inconnue interdite', () => {
  assert.equal(
    canChangePlaylistPermissions(organizerListing, a),
    false
  )
})

test('configuration sans permission globale interdite', () => {
  assert.equal(
    canChangePlaylistPermissions({
      ...organizerListing,
      canEdit: false
    }, playlistId),
    false
  )
})

test('configuration sans permission individuelle interdite', () => {
  assert.equal(
    canChangePlaylistPermissions({
      ...readonlyListing,
      organizer: true
    }, playlistId),
    false
  )
})
