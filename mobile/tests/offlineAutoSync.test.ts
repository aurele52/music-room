import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { createAutoSync } from '../src/lib/offline/autoSync'
import { createOfflineLock } from '../src/lib/offline/offlineLock'
import { queueSyncMigrations } from '../src/lib/offline/syncState'

import {
  cacheGeneration,
  invalidateCacheGeneration
} from '../src/lib/offline/syncChanges'

test('offline migration: upgrades old SQLite table', () => {
  const db = new DatabaseSync(':memory:')

  try {
    db.exec(`
      CREATE TABLE pending_operations (
        id INTEGER PRIMARY KEY
      );

      INSERT INTO pending_operations VALUES (1);
    `)

    const migrations = queueSyncMigrations(['id'])

    assert.equal(migrations.length, 3)

    for (const migration of migrations) {
      db.exec(migration)
    }

    const row = db.prepare(
      'SELECT * FROM pending_operations'
    ).get()

    assert.equal(row?.sync_state, 'pending')
    assert.equal(row?.id, 1)
  } finally {
    db.close()
  }
})

test('offline migration: is repeatable', () => {
  assert.deepEqual(
    queueSyncMigrations([
      'sync_state',
      'sync_status',
      'sync_message'
    ]),
    []
  )
})

test('offline lock: serializes operations', async () => {
  const lock = createOfflineLock()
  const calls: number[] = []

  let release!: () => void

  const gate = new Promise<void>(resolve => {
    release = resolve
  })

  const first = lock.run(async () => {
    calls.push(1)
    await gate
    calls.push(2)
  })

  const second = lock.run(async () => {
    calls.push(3)
  })

  await Promise.resolve()

  assert.deepEqual(calls, [1])

  release()

  await Promise.all([first, second])

  assert.deepEqual(calls, [1, 2, 3])
})

test('offline lock: continues after failed operation', async () => {
  const lock = createOfflineLock()

  await assert.rejects(lock.run(async () => {
    throw new Error('SQLite failure')
  }))

  assert.equal(await lock.run(async () => 42), 42)
})

test('offline auto: requires authenticated scope', async () => {
  let calls = 0

  const auto = createAutoSync(
    () => null,
    async () => {
      calls++
    }
  )

  await auto.request()

  assert.equal(calls, 0)
})

test('offline auto: runs after network recovery', async () => {
  const account = { id: 'alice' }
  let online = false
  let calls = 0

  const auto = createAutoSync(
    () => online ? account : null,
    async () => {
      calls++
    }
  )

  await auto.request()
  assert.equal(calls, 0)

  online = true
  await auto.request()

  assert.equal(calls, 1)
})

test('offline auto: invalidates an old account', async () => {
  let scope = { id: 'alice' }

  const auto = createAutoSync(
    () => scope,
    async (account, current) => {
      assert.equal(account.id, 'alice')
      assert.equal(current(), true)

      scope = { id: 'bob' }

      assert.equal(current(), false)
    }
  )

  await auto.request()
})

test('offline auto: coalesces simultaneous triggers', async () => {
  const scope = { id: 'alice' }
  let calls = 0

  const auto = createAutoSync(
    () => scope,
    async () => {
      calls++
    }
  )

  await Promise.all([
    auto.request(),
    auto.request(),
    auto.request()
  ])

  assert.equal(calls, 1)
})

test('offline auto: stops after disposal', async () => {
  let calls = 0

  const auto = createAutoSync(
    () => 'alice',
    async () => {
      calls++
    }
  )

  auto.stop()

  await auto.request()

  assert.equal(calls, 0)
})

test('offline cache: invalidates only the targeted scope', () => {
  const before = cacheGeneration('alice', 'event')
  const other = cacheGeneration('bob', 'event')

  invalidateCacheGeneration('alice', 'event')

  assert.equal(
    cacheGeneration('alice', 'event'),
    before + 1
  )

  assert.equal(
    cacheGeneration('bob', 'event'),
    other
  )
})
