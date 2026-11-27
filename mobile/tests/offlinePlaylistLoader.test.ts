import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type MusicEvent } from '../src/lib/api'
import type { PlaylistListing } from '../src/lib/musicPlaylists'
import {
  createSnapshot,
  type PlaylistSnapshot
} from '../src/lib/offline/cachePolicy'
import {
  createPlaylistLoader
} from '../src/lib/offline/playlistLoader'

const id = '00112233-4455-4677-8899-aabbccddeeff'
const now = Date.parse('2026-11-27T12:00:00Z')

const event: MusicEvent = {
  id,
  title: 'Jazz Night',
  description: '',
  location: 'Paris',
  startsAt: new Date(now - 3600000).toISOString(),
  endsAt: new Date(now + 3600000).toISOString(),
  visibility: 'PUBLIC',
  organizerId: 'alice'
}

const listing: PlaylistListing = {
  event: {
    id: event.id,
    title: event.title,
    visibility: event.visibility,
    endsAt: event.endsAt
  },
  playlists: [],
  canEdit: true,
  organizer: true,
  finished: false
}

async function offline(): Promise<never> {
  throw new ApiError(0, 'Connexion au serveur impossible')
}

function fixture() {
  const rows = new Map<string, PlaylistSnapshot>()

  const key = (user: string, eventId: string) =>
    `${user}:${eventId}`

  const loader = createPlaylistLoader({
    async saveSnapshot(user, eventId, snapshot) {
      rows.set(key(user, eventId), snapshot)
    },
    async loadSnapshot(user, eventId) {
      return rows.get(key(user, eventId)) ?? null
    },
    async deleteSnapshot(user, eventId) {
      rows.delete(key(user, eventId))
    }
  }, () => now)

  const options = {
    userId: 'alice',
    eventId: id,
    current: () => true,
    allowCache: true,
    fetchListing: async () => listing
  }

  return { loader, rows, options }
}

test('offline loader: saves online playlists', async () => {
  const { loader, rows, options } = fixture()

  const result = await loader.load(options)

  assert.equal(result?.source, 'server')
  assert.equal(rows.size, 1)
  assert.equal(result?.listing.canEdit, true)
})

test('offline loader: restores cache after network failure', async () => {
  const { loader, options } = fixture()
  await loader.load(options)

  const result = await loader.load({
    ...options,
    fetchListing: offline
  })

  assert.equal(result?.source, 'cache')
  assert.equal(result?.listing.canEdit, false)
  assert.equal(result?.listing.organizer, false)
})

test('offline loader: no cache for another user', async () => {
  const { loader, options } = fixture()
  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    userId: 'bob',
    fetchListing: offline
  }))
})

test('offline loader: removes revoked access', async () => {
  const { loader, rows, options } = fixture()
  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    fetchListing: async () => {
      throw new ApiError(403, 'Accès refusé')
    }
  }))

  assert.equal(rows.size, 0)
})

test('offline loader: removes deleted events', async () => {
  const { loader, rows, options } = fixture()
  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    fetchListing: async () => {
      throw new ApiError(404, 'Introuvable')
    }
  }))

  assert.equal(rows.size, 0)
})

test('offline loader: does not cache private events', async () => {
  const { loader, rows, options } = fixture()
  await loader.load(options)

  const result = await loader.load({
    ...options,
    fetchListing: async () => ({
      ...listing,
      event: {
        ...event,
        visibility: 'PRIVATE'
      }
    })
  })

  assert.equal(result?.source, 'server')
  assert.equal(rows.size, 0)
})

test('offline loader: never falls back after HTTP 500', async () => {
  const { loader, options } = fixture()
  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    fetchListing: async () => {
      throw new ApiError(500, 'Server error')
    }
  }))
})

test('offline loader: ignores an obsolete request', async () => {
  const { loader, rows, options } = fixture()

  let active = true

  const result = await loader.load({
    ...options,
    current: () => active,
    fetchListing: async () => {
      active = false
      return listing
    }
  })

  assert.equal(result, null)
  assert.equal(rows.size, 0)
})

test('offline loader: invalidation removes cached data', async () => {
  const { loader, rows, options } = fixture()

  await loader.load(options)
  await loader.invalidate('alice', id)

  assert.equal(rows.size, 0)
})

test('offline loader: rejects an expired cache', async () => {
  const { loader, rows, options } = fixture()

  const snapshot = createSnapshot(event, listing, now)
  assert.ok(snapshot)

  rows.set(`alice:${id}`, {
    ...snapshot,
    expiresAt: now - 1
  })

  await assert.rejects(loader.load({
    ...options,
    fetchListing: offline
  }))
})

test('offline loader: refuses cache after access invalidation', async () => {
  const { loader, options } = fixture()
  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    allowCache: false,
    fetchListing: offline
  }))
})

test('offline loader: old API remains online only', async () => {
  const { loader, rows, options } = fixture()

  await loader.load(options)

  const result = await loader.load({
    ...options,
    fetchListing: async () => ({
      ...listing,
      event: undefined
    })
  })

  assert.equal(result?.source, 'server')
  assert.equal(result.cacheable, false)
  assert.equal(rows.size, 0)
})

test('offline loader: rejects inconsistent event metadata', async () => {
  const { loader, rows, options } = fixture()

  await loader.load(options)

  await assert.rejects(loader.load({
    ...options,
    fetchListing: async () => ({
      ...listing,
      event: {
        ...event,
        id: '00112233-4455-4677-8899-aabbccddee01'
      }
    })
  }))

  assert.equal(rows.size, 0)
})

test('offline loader: deletes cache after event ends', async () => {
  const { loader, rows, options } = fixture()

  await loader.load(options)

  await loader.load({
    ...options,
    fetchListing: async () => ({
      ...listing,
      event: {
        ...event,
        endsAt: new Date(now).toISOString()
      }
    })
  })

  assert.equal(rows.size, 0)
})

test('offline loader: invalidation fences an old response', async () => {
  const { loader, rows, options } = fixture()

  const result = await loader.load({
    ...options,
    fetchListing: async () => {
      await loader.invalidate('alice', id)
      return listing
    }
  })

  assert.equal(result, null)
  assert.equal(rows.size, 0)
})

test('offline loader: excludes private playlists', async () => {
  const { loader, rows, options } = fixture()

  const common = {
    title: 'Playlist',
    description: '',
    revision: 1,
    createdAt: new Date(now).toISOString(),
    items: [],
    editPolicy: 'PUBLIC' as const,
    canEdit: true
  }

  const publicPlaylist = {
    ...common,
    id: '00112233-4455-4677-8899-aabbccddee01',
    visibility: 'PUBLIC' as const
  }

  const privatePlaylist = {
    ...common,
    id: '00112233-4455-4677-8899-aabbccddee02',
    visibility: 'PRIVATE' as const
  }

  const result = await loader.load({
    ...options,
    fetchListing: async () => ({
      ...listing,
      playlists: [publicPlaylist, privatePlaylist]
    })
  })

  assert.equal(result?.listing.playlists.length, 2)

  const cached = rows.get(`alice:${id}`)

  assert.ok(cached)

  assert.deepEqual(
    cached.listing.playlists.map(item => item.id),
    [publicPlaylist.id]
  )
})

test('offline cache excludes playlists with unknown visibility', () => {
  const snapshot = createSnapshot(event, {
    ...listing,
    playlists: [{
      id: '00112233-4455-4677-8899-aabbccddee03',
      title: 'Ancienne playlist',
      description: '',
      revision: 1,
      createdAt: new Date(now).toISOString(),
      items: []
    }]
  }, now)

  assert.ok(snapshot)
  assert.deepEqual(snapshot.listing.playlists, [])
})
