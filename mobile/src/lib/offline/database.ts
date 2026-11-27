import type {
  QueueInput,
  QueueEntry
} from './queue'
import type { CachedEvent } from './cachedEvents'

// Native implementation is loaded on Android and iOS.
// Offline storage is available on native platforms only.

import type { PlaylistSnapshot } from './cachePolicy'

export async function saveSnapshot(
  _userId: string,
  _eventId: string,
  _snapshot: PlaylistSnapshot
): Promise<void> {}

export async function loadSnapshot(
  _userId: string,
  _eventId: string
): Promise<PlaylistSnapshot | null> {
  return null
}

export async function deleteSnapshot(
  _userId: string,
  _eventId: string
): Promise<void> {}

export async function clearUserCache(
  _userId: string
): Promise<void> {}

export async function listSnapshots(
  _userId: string
): Promise<CachedEvent[]> {
  return []
}

export async function enqueueOperation(
  _input: QueueInput
): Promise<QueueEntry> {
  throw new Error('Edition offline indisponible sur le web.')
}

export async function listPendingOperations(
  _userId: string
): Promise<QueueEntry[]> {
  return []
}

export async function removePendingOperation(
  _userId: string,
  _id: number
): Promise<boolean> {
  return false
}

export async function clearPendingOperations(
  _userId: string
): Promise<void> {}

export async function markOperationAttempt(
  _userId: string,
  _id: number
): Promise<boolean> {
  return false
}

export async function markOperationConflict(
  _userId: string,
  _id: number,
  _status: number,
  _message: string
): Promise<boolean> {
  return false
}

export async function cancelPendingOperation(
  _userId: string,
  _id: number
): Promise<boolean> {
  return false
}

export async function rebasePendingOperation(
  _userId: string,
  _id: number,
  _oldRevision: number,
  _newRevision: number
): Promise<boolean> {
  return false
}
