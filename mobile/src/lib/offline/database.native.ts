import { queueSyncMigrations } from './syncState'
import {
  QUEUE_SCHEMA,
  createPendingQueue,
  type QueueRow,
  type QueueInput
} from './queue'
import {
  decodeCachedEvents,
  type CachedEvent
} from './cachedEvents'
import * as SQLite from 'expo-sqlite'
import {
  readSnapshot,
  type PlaylistSnapshot
} from './cachePolicy'

let opening: Promise<SQLite.SQLiteDatabase> | undefined

async function initialize() {
  const db = await SQLite.openDatabaseAsync(
    'musicroom-offline.db'
  )

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS playlist_cache (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, event_id)
    );
  `)

  await db.execAsync(QUEUE_SCHEMA)

  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(pending_operations)'
  )

  for (const sql of queueSyncMigrations(
    columns.map(column => column.name)
  )) {
    await db.execAsync(sql)
  }

  return db
}

function database(): Promise<SQLite.SQLiteDatabase> {
  opening ??= initialize().catch(error => {
    opening = undefined
    throw error
  })

  return opening
}

export async function saveSnapshot(
  userId: string,
  eventId: string,
  snapshot: PlaylistSnapshot
): Promise<void> {
  const db = await database()

  await db.runAsync(
    'DELETE FROM playlist_cache WHERE expires_at <= ?',
    Date.now()
  )

  await db.runAsync(
    `INSERT INTO playlist_cache
      (user_id, event_id, payload, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, event_id)
      DO UPDATE SET
        payload = excluded.payload,
        expires_at = excluded.expires_at`,
    userId,
    eventId,
    JSON.stringify(snapshot),
    snapshot.expiresAt
  )
}

export async function loadSnapshot(
  userId: string,
  eventId: string
): Promise<PlaylistSnapshot | null> {
  const db = await database()

  const row = await db.getFirstAsync<{
    payload: string
  }>(
    `SELECT payload FROM playlist_cache
     WHERE user_id = ? AND event_id = ?`,
    userId,
    eventId
  )

  if (!row) return null

  return readSnapshot(row.payload)
}

export async function deleteSnapshot(
  userId: string,
  eventId: string
): Promise<void> {
  const db = await database()

  await db.runAsync(
    `DELETE FROM playlist_cache
     WHERE user_id = ? AND event_id = ?`,
    userId,
    eventId
  )
}

export async function clearUserCache(
  userId: string
): Promise<void> {
  const db = await database()

  await db.runAsync(
    'DELETE FROM playlist_cache WHERE user_id = ?',
    userId
  )
}

export async function listSnapshots(
  userId: string
): Promise<CachedEvent[]> {
  if (!userId) return []

  const db = await database()

  const rows = await db.getAllAsync<{
    event_id: string
    payload: string
  }>(
    `SELECT event_id, payload
     FROM playlist_cache
     WHERE user_id = ?
       AND expires_at > ?`,
    userId,
    Date.now()
  )

  return decodeCachedEvents(rows)
}

// File d'attente persistante partageant la base locale.

const pendingQueue = createPendingQueue({
  async run(sql, params) {
    const db = await database()
    return db.runAsync(sql, ...params)
  },

  async all(sql, params) {
    const db = await database()
    return db.getAllAsync<QueueRow>(sql, ...params)
  }
})

export async function enqueueOperation(input: QueueInput) {
  return pendingQueue.enqueue(input, true)
}

export async function listPendingOperations(userId: string) {
  return pendingQueue.list(userId)
}

export async function removePendingOperation(
  userId: string,
  id: number
) {
  return pendingQueue.remove(userId, id)
}

export async function clearPendingOperations(userId: string) {
  await pendingQueue.clear(userId)
}

export async function markOperationAttempt(
  userId: string,
  id: number
) {
  return pendingQueue.markAttempt(userId, id)
}

export async function markOperationConflict(
  userId: string,
  id: number,
  status: number,
  message: string
) {
  return pendingQueue.markConflict(
    userId, id, status, message
  )
}

export async function cancelPendingOperation(
  userId: string,
  id: number
) {
  return pendingQueue.cancel(userId, id)
}

export async function rebasePendingOperation(
  userId: string,
  id: number,
  oldRevision: number,
  newRevision: number
) {
  return pendingQueue.rebase(
    userId,
    id,
    oldRevision,
    newRevision
  )
}
