import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decodeCachedEvents,
  removeExpiredEvents
} from '../src/lib/offline/cachedEvents'

import {
  readSnapshot,
  type PlaylistSnapshot
} from '../src/lib/offline/cachePolicy'

const now = Date.parse('2026-11-27T12:00:00Z')
const id = '00112233-4455-4677-8899-aabbccddeeff'
const secondId = '00112233-4455-4677-8899-aabbccddeeaa'

const snapshot: PlaylistSnapshot = {
  eventTitle: 'Jazz Night',
  cachedAt: now - 1000,
  expiresAt: now + 3600000,
  listing: {
    playlists: [],
    canEdit: false,
    organizer: false,
    finished: false
  }
}

function row(
  value: PlaylistSnapshot = snapshot,
  eventId = id
) {
  return {
    event_id: eventId,
    payload: JSON.stringify(value)
  }
}

test('offline home: lists saved events', () => {
  assert.deepEqual(
    decodeCachedEvents([row()], now),
    [{ eventId: id, snapshot }]
  )
})

test('offline home: supports old snapshots without title', () => {
  const old = {
    ...snapshot,
    eventTitle: undefined
  }

  const result = decodeCachedEvents([row(old)], now)

  assert.equal(result.length, 1)
  assert.equal(result[0].snapshot.eventTitle, undefined)
})

test('offline home: rejects expired events', () => {
  const expired = {
    ...snapshot,
    expiresAt: now
  }

  assert.deepEqual(
    decodeCachedEvents([row(expired)], now),
    []
  )
})

test('offline home: rejects invalid event ids', () => {
  assert.deepEqual(
    decodeCachedEvents([row(snapshot, 'invalid')], now),
    []
  )
})

test('offline home: ignores corrupted entries', () => {
  const result = decodeCachedEvents([
    { event_id: secondId, payload: 'broken' },
    row()
  ], now)

  assert.equal(result.length, 1)
  assert.equal(result[0].eventId, id)
})

test('offline home: sorts newest snapshots first', () => {
  const older = {
    ...snapshot,
    cachedAt: now - 2000
  }

  const result = decodeCachedEvents([
    row(older),
    row(snapshot, secondId)
  ], now)

  assert.equal(result[0].eventId, secondId)
})

test('offline home: hides events expiring during consultation', () => {
  const events = decodeCachedEvents([row()], now)

  assert.equal(
    removeExpiredEvents(events, now).length,
    1
  )

  assert.equal(
    removeExpiredEvents(
      events,
      snapshot.expiresAt
    ).length,
    0
  )
})

test('offline home: refuses cached write permissions', () => {
  const value = {
    ...snapshot,
    listing: {
      ...snapshot.listing,
      canEdit: true,
      organizer: true
    }
  }

  const result = readSnapshot(
    JSON.stringify(value),
    now
  )

  assert.ok(result)
  assert.equal(result.listing.canEdit, false)
  assert.equal(result.listing.organizer, false)
})

test('offline home: rejects finished events', () => {
  const value = {
    ...snapshot,
    listing: {
      ...snapshot.listing,
      finished: true
    }
  }

  assert.deepEqual(
    decodeCachedEvents([row(value)], now),
    []
  )
})
