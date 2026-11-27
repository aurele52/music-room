import { ApiError } from '../api'
import type { QueueEntry } from './queue'

export interface SyncConflict {
  entry: QueueEntry
  status: number
  message: string
}

export type SyncStopReason =
  | 'busy'
  | 'scope-changed'
  | 'network'
  | 'authentication'
  | 'server'
  | 'storage'
  | 'unexpected'

export interface SyncReport {
  synced: number[]
  conflicts: SyncConflict[]
  stopped: SyncStopReason | null
}

interface SyncDependencies {
  list(userId: string): Promise<QueueEntry[]>

  beforeSend?(entry: QueueEntry): Promise<boolean>

  onConflict?(conflict: SyncConflict): Promise<boolean>

  send(entry: QueueEntry): Promise<void>

  invalidate(
    userId: string,
    eventId: string
  ): Promise<void>

  acknowledge(
    userId: string,
    id: number
  ): Promise<boolean>
}

export function createPlaylistSync(
  dependencies: SyncDependencies
) {
  let running = false

  async function synchronize(
    userId: string,
    current: () => boolean = () => true
  ): Promise<SyncReport> {
    const report: SyncReport = {
      synced: [],
      conflicts: [],
      stopped: null
    }

    function stop(reason: SyncStopReason): SyncReport {
      report.stopped = reason
      return report
    }

    if (running) return stop('busy')
    if (!current()) return stop('scope-changed')

    running = true

    try {
      let entries: QueueEntry[]

      try {
        entries = await dependencies.list(userId)
      } catch {
        return stop('storage')
      }

      entries = [...entries].sort((a, b) => a.id - b.id)

      for (const entry of entries) {
        if (!current()) return stop('scope-changed')

        if (entry.userId !== userId) {
          return stop('storage')
        }

        if (entry.syncState === 'conflict') {
          continue
        }

        try {
          if (
            dependencies.beforeSend &&
            !await dependencies.beforeSend(entry)
          ) {
            return stop('storage')
          }
        } catch {
          return stop('storage')
        }

        if (!current()) return stop('scope-changed')

        try {
          await dependencies.send(entry)
        } catch (failure) {
          if (!(failure instanceof ApiError)) {
            return stop('unexpected')
          }

          if (failure.status === 0) {
            return stop('network')
          }

          if (failure.status === 401) {
            return stop('authentication')
          }

          if (failure.status >= 500) {
            return stop('server')
          }

          if (![400, 403, 404, 409].includes(failure.status)) {
            return stop('unexpected')
          }

          report.conflicts.push({
            entry,
            status: failure.status,
            message: failure.message
          })

          // Ne plus utiliser un cache potentiellement
          // obsolete ou dont les droits ont change.
          if (failure.status !== 400) {
            try {
              await dependencies.invalidate(
                userId,
                entry.eventId
              )
            } catch {
              return stop('storage')
            }
          }

          try {
            if (
              dependencies.onConflict &&
              !await dependencies.onConflict({
                entry,
                status: failure.status,
                message: failure.message
              })
            ) {
              return stop('storage')
            }
          } catch {
            return stop('storage')
          }

          // Conserver l'operation et poursuivre avec
          // les autres playlists.
          continue
        }

        // Le serveur a confirme l'operation.
        // Terminer son traitement dans le compte d'origine,
        // meme si la session a change.

        try {
          // Le cache ne doit plus presenter l'ancienne
          // version comme la derniere version serveur.
          await dependencies.invalidate(
            userId,
            entry.eventId
          )

          const removed = await dependencies.acknowledge(
            userId,
            entry.id
          )

          if (!removed) return stop('storage')

          report.synced.push(entry.id)
        } catch {
          return stop('storage')
        }
      }

      if (!current()) return stop('scope-changed')

      return report
    } finally {
      running = false
    }
  }

  return { synchronize }
}
