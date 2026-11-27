import { api } from '../api'
import {
  validateQueueInput,
  type QueueEntry
} from './queue'

interface SyncRequest {
  path: string
  method: 'POST' | 'DELETE' | 'PUT'
  body: Record<string, unknown>
}

export function buildSyncRequest(
  entry: QueueEntry
): SyncRequest {
  const input = validateQueueInput(entry)

  const path = `/playlists/${input.playlistId}`

  const offline = {
    eventId: input.eventId,
    baseRevision: input.baseRevision
  }

  const action = input.action

  switch (action.type) {
    case 'add':
      return {
        path: `${path}/items`,
        method: 'POST',
        body: {
          ...action.draft,
          offline
        }
      }

    case 'remove':
      return {
        path: `${path}/items/${action.itemId}`,
        method: 'DELETE',
        body: { offline }
      }

    case 'reorder':
      return {
        path: `${path}/order`,
        method: 'PUT',
        body: {
          itemIds: action.itemIds,
          revision: input.baseRevision,
          offline
        }
      }
  }
}

export async function sendOfflineOperation(
  entry: QueueEntry,
  token: string
): Promise<void> {
  const request = buildSyncRequest(entry)

  await api<unknown>(request.path, {
    method: request.method,
    token,
    body: request.body
  })
}
