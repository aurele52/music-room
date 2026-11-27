import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  QUEUE_SCHEMA,
  createPendingQueue,
  type QueueRow,
  type QueueInput
} from '../src/lib/offline/queue'

const alice = '00112233-4455-4677-8899-aabbccddee01'
const bob = '00112233-4455-4677-8899-aabbccddee02'
const eventId = '00112233-4455-4677-8899-aabbccddee03'
const playlistId = '00112233-4455-4677-8899-aabbccddee04'
const itemId = '00112233-4455-4677-8899-aabbccddee05'

const now = Date.parse('2026-11-27T12:00:00Z')

const input: QueueInput = {
  userId: alice,
  eventId,
  playlistId,
  baseRevision: 7,
  action: {
    type: 'add',
    draft: {
      title: 'Take Five',
      artist: 'Dave Brubeck'
    }
  }
}

function openQueue(path = ':memory:') {
  const db = new DatabaseSync(path)

  db.exec(QUEUE_SCHEMA)

  const queue = createPendingQueue({
    async run(sql, params) {
      const result = db.prepare(sql).run(...params)

      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid)
      }
    },

    async all(sql, params) {
      return db.prepare(sql).all(
        ...params
      ) as unknown as QueueRow[]
    }
  }, () => now)

  return { db, queue }
}

test('offline queue: stores an addition', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  assert.equal(entry.id, 1)
  assert.equal(entry.baseRevision, 7)
  assert.equal(entry.createdAt, now)

  assert.deepEqual(
    await queue.list(alice),
    [entry]
  )
})

test('offline queue: stores a removal', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue({
    ...input,
    action: {
      type: 'remove',
      itemId
    }
  })

  assert.deepEqual(
    await queue.list(alice),
    [entry]
  )
})

test('offline queue: stores a reorder', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue({
    ...input,
    action: {
      type: 'reorder',
      itemIds: [itemId]
    }
  })

  assert.deepEqual(
    await queue.list(alice),
    [entry]
  )
})

test('offline queue: preserves FIFO order', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const first = await queue.enqueue(input)
  const second = await queue.enqueue(input)
  const third = await queue.enqueue(input)

  assert.deepEqual(
    await queue.list(alice),
    [first, second, third]
  )
})

test('offline queue: isolates users', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const a = await queue.enqueue(input)
  const b = await queue.enqueue({
    ...input,
    userId: bob
  })

  assert.deepEqual(await queue.list(alice), [a])
  assert.deepEqual(await queue.list(bob), [b])
})

test('offline queue: acknowledges only owned entries', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  assert.equal(
    await queue.remove(bob, entry.id),
    false
  )

  assert.equal(
    await queue.remove(alice, entry.id),
    true
  )

  assert.deepEqual(await queue.list(alice), [])
})

test('offline queue: clears only one user', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await queue.enqueue(input)

  const entry = await queue.enqueue({
    ...input,
    userId: bob
  })

  await queue.clear(alice)

  assert.deepEqual(await queue.list(alice), [])
  assert.deepEqual(await queue.list(bob), [entry])
})

test('offline queue: rejects negative revision', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await assert.rejects(queue.enqueue({
    ...input,
    baseRevision: -1
  }))

  assert.deepEqual(await queue.list(alice), [])
})

test('offline queue: rejects invalid identifiers', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await assert.rejects(queue.enqueue({
    ...input,
    playlistId: 'invalid'
  }))
})

test('offline queue: rejects duplicate reorder ids', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await assert.rejects(queue.enqueue({
    ...input,
    action: {
      type: 'reorder',
      itemIds: [itemId, itemId]
    }
  }))
})

test('offline queue: rejects corrupt stored operations', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await queue.enqueue(input)

  db.exec(
    "UPDATE pending_operations SET payload = 'broken'"
  )

  await assert.rejects(queue.list(alice))
})

test('offline queue: survives database reopening', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'musicroom-queue-')
  )

  const path = join(directory, 'offline.db')

  try {
    const first = openQueue(path)

    let entry

    try {
      entry = await first.queue.enqueue(input)
    } finally {
      first.db.close()
    }

    const second = openQueue(path)

    try {
      assert.deepEqual(
        await second.queue.list(alice),
        [entry]
      )
    } finally {
      second.db.close()
    }
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true
    })
  }
})

test('offline queue: exclusive operation per playlist', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  await queue.enqueue(input, true)

  await assert.rejects(
    queue.enqueue(input, true)
  )

  assert.equal(
    (await queue.list(alice)).length,
    1
  )
})

test('offline queue: exclusive concurrent insertions', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const results = await Promise.allSettled([
    queue.enqueue(input, true),
    queue.enqueue(input, true)
  ])

  assert.equal(
    results.filter(r => r.status === 'fulfilled').length,
    1
  )

  assert.equal(
    results.filter(r => r.status === 'rejected').length,
    1
  )

  assert.equal(
    (await queue.list(alice)).length,
    1
  )
})

test('offline queue: remembers attempted operation', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  assert.equal(
    await queue.markAttempt(alice, entry.id),
    true
  )

  const rows = await queue.list(alice)

  assert.equal(rows[0].syncState, 'attempted')
})

test('offline queue: persists conflict status', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  assert.equal(
    await queue.markConflict(
      alice, entry.id, 409, 'Revision obsolete'
    ),
    true
  )

  const rows = await queue.list(alice)

  assert.equal(rows[0].syncState, 'conflict')
  assert.equal(rows[0].syncStatus, 409)
  assert.equal(rows[0].syncMessage, 'Revision obsolete')
})

test('offline queue: prevents cancellation after attempt', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  assert.equal(
    await queue.cancel(alice, entry.id),
    false
  )

  assert.equal((await queue.list(alice)).length, 1)
})

test('offline queue: cancels unsent operations', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  assert.equal(
    await queue.cancel(alice, entry.id),
    true
  )

  assert.deepEqual(await queue.list(alice), [])
})

test('offline queue: refuses attempts by another user', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  assert.equal(
    await queue.markAttempt(bob, entry.id),
    false
  )

  assert.equal(
    (await queue.list(alice))[0].syncState,
    undefined
  )
})

test('offline queue: explicitly rebases conflict', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  await queue.markConflict(
    alice, entry.id, 409, 'Revision obsolete'
  )

  assert.equal(
    await queue.rebase(alice, entry.id, 7, 8),
    true
  )

  const rows = await queue.list(alice)

  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, entry.id)
  assert.equal(rows[0].baseRevision, 8)
  assert.equal(rows[0].syncState, undefined)
  assert.deepEqual(rows[0].action, entry.action)
})

test('offline queue: refuses rebase by another user', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  await queue.markConflict(
    alice, entry.id, 409, 'Revision obsolete'
  )

  assert.equal(
    await queue.rebase(bob, entry.id, 7, 8),
    false
  )

  assert.equal(
    (await queue.list(alice))[0].baseRevision,
    7
  )
})

test('offline queue: refuses rebase of uncertain attempt', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  assert.equal(
    await queue.rebase(alice, entry.id, 7, 8),
    false
  )
})

test('offline queue: refuses stale resolution', async t => {
  const { db, queue } = openQueue()
  t.after(() => db.close())

  const entry = await queue.enqueue(input)

  await queue.markAttempt(alice, entry.id)

  await queue.markConflict(
    alice, entry.id, 409, 'Revision obsolete'
  )

  assert.equal(
    await queue.rebase(alice, entry.id, 6, 8),
    false
  )
})
