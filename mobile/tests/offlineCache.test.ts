import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { MusicEvent } from '../src/lib/api'
import type {
  PlaylistListing
} from '../src/lib/musicPlaylists'

import {
  CACHE_TTL,
  createSnapshot,
  readSnapshot
} from '../src/lib/offline/cachePolicy'

const now = Date.parse('2026-11-27T12:00:00Z')

const event: MusicEvent = {
  id: '00112233-4455-4677-8899-aabbccddeeff',
  title: 'Music Room',
  location: 'Paris',
  description: '',
  startsAt: new Date(now - 3600000).toISOString(),
  endsAt: new Date(now + 2 * CACHE_TTL).toISOString(),
  visibility: 'PUBLIC',
  organizerId: 'organizer'
}

const listing: PlaylistListing = {
  playlists: [],
  canEdit: true,
  organizer: true,
  finished: false
}

test('offline: caches public playlists', () => {
  const snapshot = createSnapshot(event, listing, now)
  assert.ok(snapshot)
  assert.equal(snapshot.cachedAt, now)
})

test('offline: cached permissions are read only', () => {
  const snapshot = createSnapshot(event, listing, now)
  assert.ok(snapshot)
  assert.equal(snapshot.listing.canEdit, false)
  assert.equal(snapshot.listing.organizer, false)
  assert.equal(listing.canEdit, true)
})

test('offline: private events are not cached', () => {
  assert.equal(createSnapshot({
    ...event,
    visibility: 'PRIVATE'
  }, listing, now), null)
})

test('offline: finished events are not cached', () => {
  assert.equal(createSnapshot({
    ...event,
    endsAt: new Date(now - 1).toISOString()
  }, listing, now), null)
})

test('offline: maximum cache lifetime is 24 hours', () => {
  const snapshot = createSnapshot(event, listing, now)
  assert.ok(snapshot)
  assert.equal(snapshot.expiresAt, now + CACHE_TTL)
})

test('offline: expiration respects event end', () => {
  const end = now + 3600000
  const snapshot = createSnapshot({
    ...event,
    endsAt: new Date(end).toISOString()
  }, listing, now)

  assert.ok(snapshot)
  assert.equal(snapshot.expiresAt, end)
})

test('offline: restores valid snapshots', () => {
  const snapshot = createSnapshot(event, listing, now)

  assert.deepEqual(
    readSnapshot(JSON.stringify(snapshot), now + 1000),
    snapshot
  )
})

test('offline: rejects expired snapshots', () => {
  const snapshot = createSnapshot(event, listing, now)

  assert.equal(
    readSnapshot(
      JSON.stringify(snapshot),
      now + CACHE_TTL
    ),
    null
  )
})

test('offline: rejects corrupted JSON', () => {
  assert.equal(readSnapshot('broken', now), null)
  assert.equal(readSnapshot('{}', now), null)
  assert.equal(readSnapshot('null', now), null)
})

test('offline: rejects snapshots from the future', () => {
  const snapshot = createSnapshot(event, listing, now)

  assert.equal(
    readSnapshot(JSON.stringify(snapshot), now - 1),
    null
  )
})
