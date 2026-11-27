import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlaylistDraft,
  canCreatePlaylist,
  parsePlaylistListing
} from '../src/lib/musicPlaylists'

const playlistId = '123e4567-e89b-42d3-a456-426614174101'
const itemA = '123e4567-e89b-42d3-a456-426614174102'
const itemB = '123e4567-e89b-42d3-a456-426614174103'

function example() {
  return {
    playlists: [{
      id: playlistId,
      title: 'La soirée',
      description: 'Pop et rock',
      revision: 3,
      createdAt: '2035-01-01T00:00:00.000Z',
      items: [
        {
          id: itemA,
          title: 'Morceau A',
          artist: 'Groupe A',
          position: 0,
          addedById: itemA,
          addedBy: {
            id: itemA,
            name: 'Alice'
          }
        },
        {
          id: itemB,
          title: 'Morceau B',
          artist: 'Groupe B',
          position: 1,
          addedById: itemB,
          addedBy: null
        }
      ]
    }],
    canEdit: true,
    organizer: false,
    finished: false
  }
}

test('lecture des playlists valide', () => {
  const result = parsePlaylistListing(example())
  assert.equal(result.playlists.length, 1)
  assert.equal(result.playlists[0]?.title, 'La soirée')
})

test('ordre des morceaux conserve', () => {
  const result = parsePlaylistListing(example())

  assert.deepEqual(
    result.playlists[0]?.items.map(item => item.id),
    [itemA, itemB]
  )
})

test('revision conservee', () => {
  const result = parsePlaylistListing(example())
  assert.equal(result.playlists[0]?.revision, 3)
})

test('creation autorisee par permission API', () => {
  assert.equal(
    canCreatePlaylist(parsePlaylistListing(example())),
    true
  )
})

test('creation interdite sans droit edition', () => {
  const result = parsePlaylistListing({
    ...example(),
    canEdit: false
  })
  assert.equal(canCreatePlaylist(result), false)
})

test('creation interdite apres evenement termine', () => {
  const result = parsePlaylistListing({
    ...example(),
    finished: true
  })
  assert.equal(canCreatePlaylist(result), false)
})

test('titre et description normalises', () => {
  assert.deepEqual(
    buildPlaylistDraft({
      title: '  Playlist test  ',
      description: '  Musique  '
    }),
    {
      title: 'Playlist test',
      description: 'Musique'
    }
  )
})

test('titre court refuse', () => {
  assert.throws(
    () => buildPlaylistDraft({
      title: 'A',
      description: ''
    }),
    /titre/
  )
})

test('description trop longue refusee', () => {
  assert.throws(
    () => buildPlaylistDraft({
      title: 'Playlist',
      description: 'x'.repeat(501)
    }),
    /description/
  )
})

test('reponse sans permissions refusee', () => {
  assert.throws(
    () => parsePlaylistListing({
      playlists: [],
      canEdit: true
    }),
    /Réponse playlists invalide/
  )
})
