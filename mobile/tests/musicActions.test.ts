import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mobileCanVote,
  proposeCatalogTrack
} from '../src/lib/musicActions'
import type { MusicTrackListing } from '../src/lib/musicTracks'

const listing: MusicTrackListing = {
  tracks: [],
  canParticipate: false,
  canVote: true,
  requiresLocation: false,
  finished: false
}

const eventId = '11111111-1111-4111-8111-111111111111'

test('vote public autorise sans droit d ajout', () => {
  assert.equal(mobileCanVote(listing), true)
})

test('vote sans permission interdit', () => {
  assert.equal(mobileCanVote({
    ...listing,
    canVote: false
  }), false)
})

test('vote GPS disponible avec permission serveur', () => {
  assert.equal(mobileCanVote({
    ...listing,
    requiresLocation: true
  }), true)
})

test('evenement termine bloque le vote', () => {
  assert.equal(mobileCanVote({
    ...listing,
    finished: true
  }), false)
})

test('identifiant evenement invalide refuse', async () => {
  await assert.rejects(
    proposeCatalogTrack('invalid', 'blue-horizon', 'test'),
    /événement invalide/
  )
})

for (const [label, id] of [
  ['vide', ''],
  ['espaces', 'blue horizon'],
  ['majuscules', 'Blue-Horizon'],
  ['chemin', '../blue-horizon'],
  ['slash', 'music/blue-horizon'],
  ['caractere special', 'blue@horizon'],
  ['trop long', 'x'.repeat(81)],
  ['controle', 'blue\nhorizon'],
  ['URL', 'https://example.com']
]) {
  test(`identifiant catalogue ${label} refuse`, async () => {
    await assert.rejects(
      proposeCatalogTrack(eventId, id, 'test'),
      /Identifiant catalogue invalide/
    )
  })
}
