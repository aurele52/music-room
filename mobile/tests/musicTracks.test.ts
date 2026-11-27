import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMusicTrackListing,
  validMusicEventId
} from '../src/lib/musicTracks'

const firstId = '123e4567-e89b-42d3-a456-426614174011'
const secondId = '123e4567-e89b-42d3-a456-426614174012'

function response() {
  return {
    tracks: [
      {
        id: firstId,
        title: 'Morceau A',
        artist: 'Artiste A',
        votes: 5,
        myVote: true,
        proposer: {
          id: '123e4567-e89b-42d3-a456-426614174030',
          name: 'Alice'
        }
      },
      {
        id: secondId,
        title: 'Morceau B',
        artist: 'Artiste B',
        votes: 2,
        myVote: false,
        proposer: null
      }
    ],
    canParticipate: false,
    canVote: true,
    requiresLocation: true,
    finished: false
  }
}

test('identifiant d evenement vérifié', () => {
  assert.equal(validMusicEventId(firstId), true)
  assert.equal(validMusicEventId('invalid'), false)
})

test('conserve le classement du backend', () => {
  const result = parseMusicTrackListing(response())

  assert.deepEqual(
    result.tracks.map(track => track.id),
    [firstId, secondId]
  )
})

test('conserve les votes personnels et les scores', () => {
  const result = parseMusicTrackListing(response())

  assert.equal(result.tracks[0]?.votes, 5)
  assert.equal(result.tracks[0]?.myVote, true)
  assert.equal(result.tracks[1]?.myVote, false)
})

test('lecture possible sans droit d ajout', () => {
  const result = parseMusicTrackListing(response())

  assert.equal(result.canParticipate, false)
  assert.equal(result.canVote, true)
})

test('GPS requis conservé', () => {
  const result = parseMusicTrackListing(response())

  assert.equal(result.requiresLocation, true)
})

test('refuse une réponse sans permissions', () => {
  const data = response()
  const invalid = {
    tracks: data.tracks,
    canParticipate: true
  }

  assert.throws(
    () => parseMusicTrackListing(invalid),
    /Permissions musicales invalides/
  )
})

test('refuse des scores invalides', () => {
  const data = response()

  assert.throws(
    () => parseMusicTrackListing({
      ...data,
      tracks: [
        { ...data.tracks[0], votes: -1 }
      ]
    }),
    /Morceau invalide/
  )
})
