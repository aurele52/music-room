import {
  buildPlaylistItemDraft,
  type PlaylistItemDraft
} from '../musicPlaylistActions'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type OfflineAction =
  | {
      type: 'add'
      draft: PlaylistItemDraft
    }
  | {
      type: 'remove'
      itemId: string
    }
  | {
      type: 'reorder'
      itemIds: string[]
    }

export interface QueueInput {
  userId: string
  eventId: string
  playlistId: string
  baseRevision: number
  action: OfflineAction
}

export interface QueueEntry extends QueueInput {
  id: number
  createdAt: number
  syncState?: 'attempted' | 'conflict'
  syncStatus?: number
  syncMessage?: string
}

export interface QueueRow {
  id: number
  user_id: string
  event_id: string
  playlist_id: string
  base_revision: number
  payload: string
  created_at: number
  sync_state?: string
  sync_status?: number | null
  sync_message?: string | null
}

type SqlValue = string | number

export interface QueueDatabase {
  run(
    sql: string,
    params: SqlValue[]
  ): Promise<{
    lastInsertRowId: number
    changes: number
  }>

  all(
    sql: string,
    params: SqlValue[]
  ): Promise<QueueRow[]>
}

export const QUEUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS pending_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    playlist_id TEXT NOT NULL,
    base_revision INTEGER NOT NULL CHECK(base_revision >= 0),
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    sync_state TEXT NOT NULL DEFAULT 'pending',
    sync_status INTEGER,
    sync_message TEXT
  );

  CREATE INDEX IF NOT EXISTS pending_operations_user
    ON pending_operations(user_id, id);
`

function requireId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) {
    throw new Error('Identifiant offline invalide.')
  }

  return value
}

function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('Operation offline invalide.')
  }

  return value as Record<string, unknown>
}

export function validateAction(
  value: unknown
): OfflineAction {
  const action = record(value)

  if (action.type === 'add') {
    const draft = record(action.draft)

    if (
      typeof draft.title !== 'string' ||
      typeof draft.artist !== 'string'
    ) {
      throw new Error('Morceau offline invalide.')
    }

    return {
      type: 'add',
      draft: buildPlaylistItemDraft({
        title: draft.title,
        artist: draft.artist
      })
    }
  }

  if (action.type === 'remove') {
    return {
      type: 'remove',
      itemId: requireId(action.itemId)
    }
  }

  if (action.type === 'reorder') {
    if (
      !Array.isArray(action.itemIds) ||
      action.itemIds.length > 100
    ) {
      throw new Error('Ordre offline invalide.')
    }

    const itemIds = action.itemIds.map(requireId)

    if (new Set(itemIds).size !== itemIds.length) {
      throw new Error('Morceaux dupliques.')
    }

    return {
      type: 'reorder',
      itemIds
    }
  }

  throw new Error('Type d operation inconnu.')
}

export function validateQueueInput(
  input: QueueInput
): QueueInput {
  if (
    !Number.isSafeInteger(input.baseRevision) ||
    input.baseRevision < 0
  ) {
    throw new Error('Revision offline invalide.')
  }

  return {
    userId: requireId(input.userId),
    eventId: requireId(input.eventId),
    playlistId: requireId(input.playlistId),
    baseRevision: input.baseRevision,
    action: validateAction(input.action)
  }
}

export function decodeQueueRow(
  row: QueueRow
): QueueEntry {
  if (
    !Number.isSafeInteger(row.id) ||
    row.id <= 0 ||
    !Number.isSafeInteger(row.created_at) ||
    row.created_at <= 0
  ) {
    throw new Error('Operation locale corrompue.')
  }

  const input = validateQueueInput({
    userId: row.user_id,
    eventId: row.event_id,
    playlistId: row.playlist_id,
    baseRevision: row.base_revision,
    action: validateAction(JSON.parse(row.payload))
  })

  const entry: QueueEntry = {
    ...input,
    id: row.id,
    createdAt: row.created_at
  }

  const state = row.sync_state ?? 'pending'

  if (state === 'attempted') {
    entry.syncState = 'attempted'
  } else if (state === 'conflict') {
    if (
      typeof row.sync_status !== 'number' ||
      ![400, 403, 404, 409].includes(row.sync_status) ||
      typeof row.sync_message !== 'string'
    ) {
      throw new Error('Conflit local corrompu.')
    }

    entry.syncState = 'conflict'
    entry.syncStatus = row.sync_status
    entry.syncMessage = row.sync_message
  } else if (state !== 'pending') {
    throw new Error('Etat de synchronisation invalide.')
  }

  return entry
}

export function createPendingQueue(
  db: QueueDatabase,
  clock: () => number = Date.now
) {
  async function enqueue(
    input: QueueInput,
    exclusive = false
  ): Promise<QueueEntry> {
    const valid = validateQueueInput(input)
    const createdAt = clock()

    if (
      !Number.isSafeInteger(createdAt) ||
      createdAt <= 0
    ) {
      throw new Error('Date offline invalide.')
    }

    const result = await db.run(
      `INSERT INTO pending_operations (
        user_id,
        event_id,
        playlist_id,
        base_revision,
        payload,
        created_at
      ) ${
        exclusive
          ? `SELECT ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM pending_operations
               WHERE user_id = ? AND playlist_id = ?
             )`
          : 'VALUES (?, ?, ?, ?, ?, ?)'
      }`,
      [
        valid.userId,
        valid.eventId,
        valid.playlistId,
        valid.baseRevision,
        JSON.stringify(valid.action),
        createdAt,
        ...(exclusive ? [
          valid.userId,
          valid.playlistId
        ] : [])
      ]
    )

    if (result.changes !== 1) {
      throw new Error(
        'Une modification est déjà en attente pour cette playlist.'
      )
    }

    return {
      ...valid,
      id: result.lastInsertRowId,
      createdAt
    }
  }

  async function list(
    userId: string
  ): Promise<QueueEntry[]> {
    const rows = await db.all(
      `SELECT *
       FROM pending_operations
       WHERE user_id = ?
       ORDER BY id ASC`,
      [requireId(userId)]
    )

    return rows.map(decodeQueueRow)
  }

  async function remove(
    userId: string,
    id: number
  ): Promise<boolean> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Operation invalide.')
    }

    const result = await db.run(
      `DELETE FROM pending_operations
       WHERE user_id = ? AND id = ?`,
      [requireId(userId), id]
    )

    return result.changes === 1
  }

  async function clear(
    userId: string
  ): Promise<void> {
    await db.run(
      `DELETE FROM pending_operations
       WHERE user_id = ?`,
      [requireId(userId)]
    )
  }

  async function markAttempt(
    userId: string,
    id: number
  ): Promise<boolean> {
    const result = await db.run(
      `UPDATE pending_operations
       SET sync_state = 'attempted'
       WHERE user_id = ? AND id = ?
         AND sync_state IN ('pending', 'attempted')`,
      [requireId(userId), id]
    )

    return result.changes === 1
  }

  async function markConflict(
    userId: string,
    id: number,
    status: number,
    message: string
  ): Promise<boolean> {
    if (![400, 403, 404, 409].includes(status)) {
      throw new Error('Statut de conflit invalide.')
    }

    const result = await db.run(
      `UPDATE pending_operations
       SET sync_state = 'conflict',
           sync_status = ?,
           sync_message = ?
       WHERE user_id = ? AND id = ?
         AND sync_state = 'attempted'`,
      [status, message, requireId(userId), id]
    )

    return result.changes === 1
  }

  async function rebase(
    userId: string,
    id: number,
    oldRevision: number,
    newRevision: number
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(oldRevision) ||
      !Number.isSafeInteger(newRevision) ||
      oldRevision < 0 ||
      newRevision <= oldRevision
    ) {
      throw new Error('Revision de resolution invalide.')
    }

    const result = await db.run(
      `UPDATE pending_operations
       SET base_revision = ?,
           sync_state = 'pending',
           sync_status = NULL,
           sync_message = NULL
       WHERE user_id = ?
         AND id = ?
         AND base_revision = ?
         AND sync_state = 'conflict'
         AND sync_status = 409`,
      [
        newRevision,
        requireId(userId),
        id,
        oldRevision
      ]
    )

    return result.changes === 1
  }

  async function cancel(
    userId: string,
    id: number
  ): Promise<boolean> {
    const result = await db.run(
      `DELETE FROM pending_operations
       WHERE user_id = ? AND id = ?
         AND sync_state = 'pending'`,
      [requireId(userId), id]
    )

    return result.changes === 1
  }

  return {
    enqueue,
    list,
    remove,
    clear,
    markAttempt,
    markConflict,
    rebase,
    cancel
  }
}
