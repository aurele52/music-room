import {
  useSession,
  isCurrentSession
} from '../../../session/SessionProvider'
import { offlineLock } from '../../../lib/offline/offlineLock'
import { subscribeSyncChanges } from '../../../lib/offline/syncChanges'
import {
  useCallback,
  useRef,
  useState
} from 'react'

import { useFocusEffect } from 'expo-router'

import type { PlaylistSnapshot } from '../../../lib/offline/cachePolicy'

import {
  enqueueOperation,
  listPendingOperations,
  loadSnapshot,
  cancelPendingOperation
} from '../../../lib/offline/database'


import { prepareCurrentOfflineEdit } from '../../../lib/offline/localEdits'
import type {
  OfflineAction,
  QueueEntry
} from '../../../lib/offline/queue'

import { errorMessage } from '../../../lib/api'

export interface OfflinePlaylistProps {
  userId: string
  eventId: string
  snapshot: PlaylistSnapshot
}

export function useOfflinePlaylists({
  userId,
  eventId,
  snapshot
}: OfflinePlaylistProps) {
  const { session } = useSession()

  const current = useCallback(() =>
    isCurrentSession(session) &&
    (
      (
        session.status === 'authenticated' &&
        session.user.id === userId
      ) ||
      (
        session.status === 'error' &&
        session.offlineUserId === userId
      )
    ),
  [session, userId])

  const [pending, setPending] = useState<QueueEntry[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')

  const selected = snapshot.listing.playlists.find(
    playlist => playlist.id === selectedId
  )

  if (selectedId && !selected) {
    setSelectedId(null)
    setAdding(null)
  }

  const active = useRef(false)
  const busyRef = useRef(false)
  const generation = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++generation.current

    try {
      const rows = await listPendingOperations(userId)

      if (
        !active.current ||
        !current() ||
        request !== generation.current
      ) return

      setPending(rows.filter(row =>
        row.userId === userId &&
        row.eventId === eventId
      ))

      setReady(true)
    } catch (failure) {
      if (
        !active.current ||
        !current() ||
        request !== generation.current
      ) return

      setPending([])
      setReady(false)
      setError(errorMessage(failure))
    }
  }, [userId, eventId, current])

  useFocusEffect(useCallback(() => {
    active.current = true

    setReady(false)
    setBusy(busyRef.current)

    void refresh()

    const unsubscribe = subscribeSyncChanges((user, event) => {
      if (user === userId && event === eventId) {
        void refresh()
      }
    })

    return () => {
      unsubscribe()
      active.current = false
      generation.current++
    }
  }, [refresh, userId, eventId]))

  const canEdit =
    snapshot.canQueueEdits === true &&
    !snapshot.listing.finished

  async function perform(
    operation: () => Promise<void>
  ) {
    if (
      !ready ||
      !active.current ||
      !current() ||
      busyRef.current
    ) return

    busyRef.current = true
    setBusy(true)
    setError('')

    try {
      await offlineLock.run(async () => {
        if (!active.current || !current()) return
        await operation()
      })
    } catch (failure) {
      if (active.current && current()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (active.current && current()) {
        await refresh()
      }

      busyRef.current = false

      if (active.current && current()) {
        setBusy(false)
      }
    }
  }

  async function edit(
    playlistId: string,
    action: OfflineAction
  ) {
    await perform(async () => {
      const latest = await loadSnapshot(userId, eventId)
      const rows = await listPendingOperations(userId)

      if (!active.current || !current()) return

      const input = prepareCurrentOfflineEdit({
        userId,
        eventId,
        playlistId,
        snapshot,
        action,
        pending: rows
      }, latest)

      await enqueueOperation(input)

      if (active.current && current()) {
        setAdding(null)
        setTitle('')
        setArtist('')
      }
    })
  }

  async function cancel(entry: QueueEntry) {
    await perform(async () => {
      if (
        entry.userId !== userId ||
        entry.eventId !== eventId
      ) {
        throw new Error('Operation locale invalide.')
      }

      if (!current()) return

      const removed = await cancelPendingOperation(
        userId,
        entry.id
      )

      if (!removed) {
        throw new Error('Operation introuvable.')
      }
    })
  }

  function openAdd(playlistId: string) {
    setAdding(playlistId)
    setTitle('')
    setArtist('')
  }


  return {
    userId,
    eventId,
    snapshot,
    pending,
    ready,
    busy,
    error,
    selected,
    setSelectedId,
    adding,
    setAdding,
    title,
    setTitle,
    artist,
    setArtist,
    canEdit,
    edit,
    cancel,
    openAdd
  }
}

export type OfflinePlaylistState = ReturnType<
  typeof useOfflinePlaylists
>
