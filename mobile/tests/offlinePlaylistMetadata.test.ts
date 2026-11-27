import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parsePlaylistListing
} from '../src/lib/musicPlaylists'

const listing = {
  playlists: [],
  canEdit: true,
  organizer: false,
  finished: false
}

const event = {
  id: '00112233-4455-4677-8899-aabbccddeeff',
  title: 'Jazz Night',
  visibility: 'PUBLIC',
  endsAt: '2027-01-01T23:00:00Z'
}

test('playlist metadata: supports previous API format', () => {
  assert.deepEqual(
    parsePlaylistListing(listing),
    listing
  )
})

test('playlist metadata: parses public event', () => {
  assert.deepEqual(
    parsePlaylistListing({
      ...listing,
      event
    }).event,
    event
  )
})

test('playlist metadata: preserves private visibility', () => {
  const result = parsePlaylistListing({
    ...listing,
    event: {
      ...event,
      visibility: 'PRIVATE'
    }
  })

  assert.equal(result.event?.visibility, 'PRIVATE')
})

test('playlist metadata: rejects invalid visibility', () => {
  assert.throws(() => parsePlaylistListing({
    ...listing,
    event: {
      ...event,
      visibility: 'UNKNOWN'
    }
  }))
})

test('playlist metadata: rejects invalid date', () => {
  assert.throws(() => parsePlaylistListing({
    ...listing,
    event: {
      ...event,
      endsAt: 'invalid'
    }
  }))
})

test('playlist metadata: rejects invalid event identifier', () => {
  assert.throws(() => parsePlaylistListing({
    ...listing,
    event: {
      ...event,
      id: 'invalid'
    }
  }))
})

test('playlist metadata: rejects malformed metadata', () => {
  for (const value of [null, [], {}, 'event']) {
    assert.throws(() => parsePlaylistListing({
      ...listing,
      event: value
    }))
  }
})
