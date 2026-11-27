import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ApiError } from '../src/lib/api'

import {
  createPlaylistSync
} from '../src/lib/offline/playlistSync'

import {
  buildSyncRequest
} from '../src/lib/offline/syncApi'

import type {
  QueueEntry
} from '../src/lib/offline/queue'

const userId = '00112233-4455-4677-8899-aabbccddee01'
const eventId = '00112233-4455-4677-8899-aabbccddee02'
const playlistId = '00112233-4455-4677-8899-aabbccddee03'
const itemId = '00112233-4455-4677-8899-aabbccddee04'
const otherPlaylist = '00112233-4455-4677-8899-aabbccddee05'

const entry: QueueEntry = {
  id: 1,
  userId,
  eventId,
  playlistId,
  baseRevision: 7,
  createdAt: 1800000000000,
  action: {
    type: 'add',
    draft: {
      title: 'Take Five',
      artist: 'Dave Brubeck'
    }
  }
}

const second: QueueEntry = {
  ...entry,
  id: 2,
  playlistId: otherPlaylist
}

const offline = {
  eventId,
  baseRevision: 7
}

function fixture(
  entries: QueueEntry[] = [entry],
  send: (operation: QueueEntry) => Promise<void> =
    async () => {},
  invalidate: () => Promise<void> =
    async () => {}
) {
  const pending = [...entries]
  const sent: number[] = []
  const invalidated: string[] = []

  const sync = createPlaylistSync({
    async list() {
      return [...pending]
    },

    async send(operation) {
      sent.push(operation.id)
      await send(operation)
    },

    async invalidate(user, event) {
      invalidated.push(`${user}:${event}`)
      await invalidate()
    },

    async acknowledge(user, id) {
      const index = pending.findIndex(row =>
        row.userId === user && row.id === id
      )

      if (index < 0) return false

      pending.splice(index, 1)
      return true
    }
  })

  return {
    sync,
    pending,
    sent,
    invalidated
  }
}

test('offline sync: builds protected add request', () => {
  assert.deepEqual(buildSyncRequest(entry), {
    path: `/playlists/${playlistId}/items`,
    method: 'POST',
    body: {
      title: 'Take Five',
      artist: 'Dave Brubeck',
      offline
    }
  })
})

test('offline sync: builds protected remove request', () => {
  assert.deepEqual(buildSyncRequest({
    ...entry,
    action: {
      type: 'remove',
      itemId
    }
  }), {
    path: `/playlists/${playlistId}/items/${itemId}`,
    method: 'DELETE',
    body: { offline }
  })
})

test('offline sync: builds protected reorder request', () => {
  assert.deepEqual(buildSyncRequest({
    ...entry,
    action: {
      type: 'reorder',
      itemIds: [itemId]
    }
  }), {
    path: `/playlists/${playlistId}/order`,
    method: 'PUT',
    body: {
      itemIds: [itemId],
      revision: 7,
      offline
    }
  })
})

test('offline sync: empty queue succeeds', async () => {
  const f = fixture([])

  assert.deepEqual(
    await f.sync.synchronize(userId),
    {
      synced: [],
      conflicts: [],
      stopped: null
    }
  )
})

test('offline sync: acknowledges successful operations', async () => {
  const f = fixture()

  const result = await f.sync.synchronize(userId)

  assert.deepEqual(result.synced, [1])
  assert.deepEqual(f.pending, [])
  assert.equal(result.stopped, null)

  assert.deepEqual(
    f.invalidated,
    [`${userId}:${eventId}`]
  )
})

test('offline sync: processes operations in FIFO order', async () => {
  const f = fixture([second, entry])

  const result = await f.sync.synchronize(userId)

  assert.deepEqual(f.sent, [1, 2])
  assert.deepEqual(result.synced, [1, 2])
  assert.deepEqual(f.pending, [])
})

test('offline sync: preserves conflicts and continues', async () => {
  const f = fixture(
    [entry, second],
    async operation => {
      if (operation.id === 1) {
        throw new ApiError(409, 'Revision obsolete')
      }
    }
  )

  const result = await f.sync.synchronize(userId)

  assert.equal(result.conflicts.length, 1)
  assert.equal(result.conflicts[0].status, 409)

  assert.deepEqual(result.synced, [2])
  assert.deepEqual(f.pending, [entry])
  assert.deepEqual(f.sent, [1, 2])
})

test('offline sync: preserves revoked operations', async () => {
  const f = fixture([entry], async () => {
    throw new ApiError(403, 'Modification interdite')
  })

  const result = await f.sync.synchronize(userId)

  assert.equal(result.conflicts[0].status, 403)
  assert.deepEqual(f.pending, [entry])
  assert.equal(f.invalidated.length, 1)
})

test('offline sync: preserves deleted playlist operations', async () => {
  const f = fixture([entry], async () => {
    throw new ApiError(404, 'Playlist introuvable')
  })

  const result = await f.sync.synchronize(userId)

  assert.equal(result.conflicts[0].status, 404)
  assert.deepEqual(f.pending, [entry])
  assert.equal(f.invalidated.length, 1)
})

test('offline sync: stops on network failure', async () => {
  const f = fixture([entry, second], async () => {
    throw new ApiError(0, 'Connexion impossible')
  })

  const result = await f.sync.synchronize(userId)

  assert.equal(result.stopped, 'network')
  assert.deepEqual(f.sent, [1])
  assert.deepEqual(f.pending, [entry, second])
})

test('offline sync: stops on authentication failure', async () => {
  const f = fixture([entry, second], async () => {
    throw new ApiError(401, 'Unauthorized')
  })

  const result = await f.sync.synchronize(userId)

  assert.equal(result.stopped, 'authentication')
  assert.deepEqual(f.sent, [1])
  assert.deepEqual(f.pending, [entry, second])
})

test('offline sync: stops on server failure', async () => {
  const f = fixture([entry, second], async () => {
    throw new ApiError(500, 'Server error')
  })

  const result = await f.sync.synchronize(userId)

  assert.equal(result.stopped, 'server')
  assert.deepEqual(f.pending, [entry, second])
  assert.deepEqual(f.sent, [1])
})

test('offline sync: stops after session change', async () => {
  let active = true

  const f = fixture([entry, second], async () => {
    active = false
  })

  const result = await f.sync.synchronize(
    userId,
    () => active
  )

  assert.equal(result.stopped, 'scope-changed')
  assert.deepEqual(f.sent, [1])
  assert.deepEqual(f.pending, [second])
  assert.deepEqual(result.synced, [1])
  assert.deepEqual(f.invalidated, [`${userId}:${eventId}`])
})

test('offline sync: refuses another user operation', async () => {
  const f = fixture([{
    ...entry,
    userId: 'another-user'
  }])

  const result = await f.sync.synchronize(userId)

  assert.equal(result.stopped, 'storage')
  assert.deepEqual(f.sent, [])
})

test('offline sync: preserves operation after cache failure', async () => {
  const f = fixture(
    [entry],
    async () => {},
    async () => {
      throw new Error('SQLite unavailable')
    }
  )

  const result = await f.sync.synchronize(userId)

  assert.equal(result.stopped, 'storage')
  assert.deepEqual(f.pending, [entry])
  assert.deepEqual(result.synced, [])
})

test('offline sync: refuses concurrent synchronization', async () => {
  let release!: () => void

  const gate = new Promise<void>(resolve => {
    release = resolve
  })

  const f = fixture([entry], async () => {
    await gate
  })

  const first = f.sync.synchronize(userId)

  const second = await f.sync.synchronize(userId)

  assert.equal(second.stopped, 'busy')

  release()

  const result = await first

  assert.deepEqual(result.synced, [1])
  assert.deepEqual(f.sent, [1])
})

test('offline sync: can resume after network recovery', async () => {
  let connected = false

  const f = fixture([entry], async () => {
    if (!connected) {
      throw new ApiError(0, 'Network failure')
    }
  })

  const first = await f.sync.synchronize(userId)

  assert.equal(first.stopped, 'network')
  assert.deepEqual(f.pending, [entry])

  connected = true

  const second = await f.sync.synchronize(userId)

  assert.deepEqual(second.synced, [1])
  assert.deepEqual(f.pending, [])
})

test('offline sync: never changes revision after conflict', async () => {
  const revisions: number[] = []

  const f = fixture([entry], async operation => {
    revisions.push(operation.baseRevision)
    throw new ApiError(409, 'Revision obsolete')
  })

  await f.sync.synchronize(userId)
  await f.sync.synchronize(userId)

  assert.deepEqual(revisions, [7, 7])
  assert.deepEqual(f.pending, [entry])
})

test('offline sync: skips persistent conflicts', async () => {
  const f = fixture([{
    ...entry,
    syncState: 'conflict',
    syncStatus: 409,
    syncMessage: 'Revision obsolete'
  }, second])

  const report = await f.sync.synchronize(userId)

  assert.deepEqual(f.sent, [2])
  assert.deepEqual(report.synced, [2])
  assert.equal(f.pending.length, 1)
})

test('offline sync: persists attempt before sending', async () => {
  const calls: string[] = []

  const sync = createPlaylistSync({
    async list() {
      return [entry]
    },

    async beforeSend() {
      calls.push('attempt')
      return true
    },

    async send() {
      calls.push('send')
    },

    async invalidate() {
      calls.push('invalidate')
    },

    async acknowledge() {
      calls.push('acknowledge')
      return true
    }
  })

  await sync.synchronize(userId)

  assert.deepEqual(calls, [
    'attempt',
    'send',
    'invalidate',
    'acknowledge'
  ])
})

test('offline sync: never sends if attempt persistence fails', async () => {
  let sent = false

  const sync = createPlaylistSync({
    async list() {
      return [entry]
    },

    async beforeSend() {
      return false
    },

    async send() {
      sent = true
    },

    async invalidate() {},

    async acknowledge() {
      return true
    }
  })

  const result = await sync.synchronize(userId)

  assert.equal(sent, false)
  assert.equal(result.stopped, 'storage')
})

test('offline sync: persists HTTP conflict', async () => {
  let status = 0

  const sync = createPlaylistSync({
    async list() {
      return [entry]
    },

    async send() {
      throw new ApiError(409, 'Revision obsolete')
    },

    async invalidate() {},

    async acknowledge() {
      return false
    },

    async onConflict(conflict) {
      status = conflict.status
      return true
    }
  })

  const result = await sync.synchronize(userId)

  assert.equal(status, 409)
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.stopped, null)
})

test('offline sync: persists conflict after session change', async () => {
  let active = true
  let conflictSaved = false
  let sent = 0

  const sync = createPlaylistSync({
    async list() {
      return [entry, second]
    },

    async send() {
      sent++
      active = false

      throw new ApiError(409, 'Revision obsolete')
    },

    async invalidate() {},

    async acknowledge() {
      return false
    },

    async onConflict(conflict) {
      conflictSaved = conflict.status === 409
      return true
    }
  })

  const result = await sync.synchronize(
    userId,
    () => active
  )

  assert.equal(conflictSaved, true)
  assert.equal(sent, 1)
  assert.equal(result.stopped, 'scope-changed')
})

test('offline sync: never sends after scope invalidation', async () => {
  let active = true
  let sent = false

  const sync = createPlaylistSync({
    async list() {
      return [entry]
    },

    async beforeSend() {
      active = false
      return true
    },

    async send() {
      sent = true
    },

    async invalidate() {},

    async acknowledge() {
      return false
    }
  })

  const result = await sync.synchronize(
    userId,
    () => active
  )

  assert.equal(sent, false)
  assert.equal(result.stopped, 'scope-changed')
})
