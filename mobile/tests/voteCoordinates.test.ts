import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVoteBody,
  validatePositionTimestamp,
  validateVoteCoordinates
} from '../src/lib/voteCoordinates'

const valid = {
  latitude: 48.8566,
  longitude: 2.3522
}

test('coordonnées correctes acceptées', () => {
  assert.deepEqual(
    validateVoteCoordinates(valid),
    valid
  )
})

test('coordonnées aux limites acceptées', () => {
  assert.deepEqual(
    validateVoteCoordinates({
      latitude: -90,
      longitude: 180
    }),
    {
      latitude: -90,
      longitude: 180
    }
  )
})

test('latitude excessive refusée', () => {
  assert.throws(() => validateVoteCoordinates({
    latitude: 91,
    longitude: 0
  }))
})

test('longitude excessive refusée', () => {
  assert.throws(() => validateVoteCoordinates({
    latitude: 0,
    longitude: -181
  }))
})

test('NaN refusé', () => {
  assert.throws(() => validateVoteCoordinates({
    latitude: Number.NaN,
    longitude: 2
  }))
})

test('Infinity refusée', () => {
  assert.throws(() => validateVoteCoordinates({
    latitude: 48,
    longitude: Infinity
  }))
})

test('chaînes refusées', () => {
  assert.throws(() => validateVoteCoordinates({
    latitude: '48.8',
    longitude: '2.3'
  }))
})

test('vote sans GPS ne transmet rien', () => {
  assert.equal(buildVoteBody(false), undefined)
})

test('vote GPS nécessite des coordonnées', () => {
  assert.throws(
    () => buildVoteBody(true),
    /position GPS/
  )
})

test('vote GPS utilise la structure attendue par API', () => {
  assert.deepEqual(buildVoteBody(true, valid), valid)
})

test('position récente acceptée', () => {
  validatePositionTimestamp(100_000, 105_000)
})

test('position ancienne refusée', () => {
  assert.throws(
    () => validatePositionTimestamp(1_000, 100_000),
    /ancienne/
  )
})

test('position future excessive refusée', () => {
  assert.throws(
    () => validatePositionTimestamp(200_000, 100_000),
    /invalide/
  )
})

test('timestamp non numérique refusé', () => {
  assert.throws(
    () => validatePositionTimestamp(NaN, 100_000)
  )
})
