import {
  readSnapshot,
  validSnapshotDates,
  type PlaylistSnapshot
} from './cachePolicy'
import { validMusicEventId } from '../musicTracks'

export interface CachedEvent {
  eventId: string
  snapshot: PlaylistSnapshot
}

interface CacheRow {
  event_id: string
  payload: string
}

export function decodeCachedEvents(
  rows: CacheRow[],
  now = Date.now()
): CachedEvent[] {
  const events: CachedEvent[] = []

  for (const row of rows) {
    if (!validMusicEventId(row.event_id)) continue

    const snapshot = readSnapshot(row.payload, now)

    if (!snapshot) continue

    events.push({
      eventId: row.event_id,
      snapshot
    })
  }

  return events.sort((a, b) =>
    b.snapshot.cachedAt - a.snapshot.cachedAt
  )
}

export function removeExpiredEvents(
  events: CachedEvent[],
  now = Date.now()
): CachedEvent[] {
  return events.filter(event =>
    validSnapshotDates(event.snapshot, now)
  )
}
