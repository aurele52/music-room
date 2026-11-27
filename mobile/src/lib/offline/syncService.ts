import {
  listPendingOperations,
  removePendingOperation,
  deleteSnapshot,
  markOperationAttempt,
  markOperationConflict
} from './database'

import {
  createPlaylistSync,
  type SyncReport
} from './playlistSync'

import { sendOfflineOperation } from './syncApi'
import { offlineLock } from './offlineLock'

import {
  invalidateCacheGeneration,
  serializeCache,
  notifySyncChange
} from './syncChanges'

export async function synchronizePendingOperations(
  userId: string,
  token: string,
  current: () => boolean
): Promise<SyncReport> {
  const touched = new Set<string>()

  try {
    return await offlineLock.run(async () => {
      const sync = createPlaylistSync({
        list: listPendingOperations,

        async beforeSend(entry) {
          const marked = await markOperationAttempt(
            userId,
            entry.id
          )

          if (marked) touched.add(entry.eventId)

          return marked
        },

        send: entry =>
          sendOfflineOperation(entry, token),

        async invalidate(user, event) {
          invalidateCacheGeneration(user, event)

          await serializeCache(() =>
            deleteSnapshot(user, event)
          )
        },

        onConflict: conflict =>
          markOperationConflict(
            userId,
            conflict.entry.id,
            conflict.status,
            conflict.message
          ),

        acknowledge: removePendingOperation
      })

      return sync.synchronize(userId, current)
    })
  } finally {
    for (const eventId of touched) {
      notifySyncChange(userId, eventId)
    }
  }
}
