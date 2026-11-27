import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseOfflineGuard,
  assertOfflineGuard,
  OfflineGuardError
} from '../src/services/offlinePlaylistGuard.js'

const eventId =
  '00112233-4455-4677-8899-aabbccddee01'

const otherEventId =
  '00112233-4455-4677-8899-aabbccddee02'

const guard = {
  eventId,
  baseRevision: 7
}

const current = {
  eventId,
  visibility: 'PUBLIC',
  revision: 7
}

function expectedStatus(status: number) {
  return (error: unknown) =>
    error instanceof OfflineGuardError &&
    error.status === status
}

test('offline guard: supports existing online requests', () => {
  assert.equal(parseOfflineGuard(undefined), null)

  assert.doesNotThrow(() =>
    assertOfflineGuard(null, current)
  )
})

test('offline guard: parses valid operation', () => {
  assert.deepEqual(
    parseOfflineGuard(guard),
    guard
  )
})

test('offline guard: refuses invalid event id', () => {
  assert.throws(
    () => parseOfflineGuard({
      ...guard,
      eventId: 'invalid'
    }),
    expectedStatus(400)
  )
})

test('offline guard: refuses invalid revisions', () => {
  for (const baseRevision of [-1, 1.5, '7', null]) {
    assert.throws(
      () => parseOfflineGuard({
        ...guard,
        baseRevision
      }),
      expectedStatus(400)
    )
  }
})

test('offline guard: refuses malformed payloads', () => {
  for (const value of [null, [], 'offline', {}]) {
    assert.throws(
      () => parseOfflineGuard(value),
      expectedStatus(400)
    )
  }
})

test('offline guard: accepts matching revision', () => {
  assert.doesNotThrow(() =>
    assertOfflineGuard(guard, current)
  )
})

test('offline guard: refuses stale revision', () => {
  assert.throws(
    () => assertOfflineGuard(guard, {
      ...current,
      revision: 8
    }),
    expectedStatus(409)
  )
})

test('offline guard: refuses another event', () => {
  assert.throws(
    () => assertOfflineGuard(guard, {
      ...current,
      eventId: otherEventId
    }),
    expectedStatus(409)
  )
})

test('offline guard: refuses event switched to private', () => {
  assert.throws(
    () => assertOfflineGuard(guard, {
      ...current,
      visibility: 'PRIVATE'
    }),
    expectedStatus(409)
  )
})

test('offline guard: rejects replay after successful mutation', () => {
  const server = { ...current }

  assertOfflineGuard(guard, server)

  // Simulation d'une operation validee par le serveur.
  server.revision++

  // La reponse HTTP est perdue.
  // Le client renvoie la meme operation.
  assert.throws(
    () => assertOfflineGuard(guard, server),
    expectedStatus(409)
  )

  assert.equal(server.revision, 8)
})
