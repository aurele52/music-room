import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  isCurrentSession,
  isCurrentSessionToken
} from '../../../session/SessionProvider'
import type { SessionState } from '../../../session/SessionManager'
import { listPendingOperations } from '../../../lib/offline/database'
import { subscribeSyncChanges } from '../../../lib/offline/syncChanges'
import type { QueueEntry } from '../../../lib/offline/queue'
import type { ResolutionPreview } from '../../../lib/offline/resolutionService'
import { errorMessage } from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'

export interface SynchronisationProps {
  scope: SessionState
  userId: string
  token: string | null
}

export function useSynchronisationData({
  scope,
  userId,
  token
}: SynchronisationProps) {
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [preview, setPreview] =
    useState<ResolutionPreview | null>(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const active = useRef(false)
  const busyRef = useRef(false)
  const generation = useRef(0)

  const [screenFence] = useState(createAsyncFence)
  const [comparisonFence] = useState(createAsyncFence)

  // Une actualisation du nom ne change pas le JWT.
  // En revanche, une session hors ligne doit rester
  // exactement celle qui a autorise cet acces.
  const offlineScope = token ? null : scope

  const current = useCallback(() => {
    if (token) {
      return isCurrentSessionToken(token)
    }

    return (
      offlineScope !== null &&
      offlineScope.status === 'error' &&
      offlineScope.offlineUserId === userId &&
      isCurrentSession(offlineScope)
    )
  }, [token, offlineScope, userId])

  const refresh = useCallback(async () => {
    if (!active.current || !current()) return

    const request = ++generation.current

    try {
      const rows = await listPendingOperations(userId)

      if (
        !active.current ||
        !current() ||
        request !== generation.current
      ) return

      setEntries(rows)
      setLoading(false)
    } catch (failure) {
      if (
        active.current &&
        current() &&
        request === generation.current
      ) {
        setError(errorMessage(failure))
        setLoading(false)
      }
    }
  }, [userId, current])

  useFocusEffect(useCallback(() => {
    active.current = true

    setBusy(busyRef.current)
    setPreview(null)
    setError('')
    setMessage('')

    void refresh()

    const unsubscribe = subscribeSyncChanges(user => {
      if (
        user !== userId ||
        !active.current ||
        !current()
      ) return

      comparisonFence.invalidate()
      setPreview(null)

      void refresh()
    })

    return () => {
      active.current = false
      generation.current++

      screenFence.invalidate()
      comparisonFence.invalidate()

      unsubscribe()
    }
  }, [
    refresh,
    userId,
    current,
    screenFence,
    comparisonFence
  ]))

  function reload() {
    if (
      busyRef.current ||
      !active.current ||
      !current()
    ) return

    comparisonFence.invalidate()
    setPreview(null)
    setError('')

    void refresh()
  }

  return {
    scope,
    userId,
    token,
    entries,
    preview,
    setPreview,
    loading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    active,
    busyRef,
    generation,
    screenFence,
    comparisonFence,
    current,
    refresh,
    reload
  }
}

export type SynchronisationData =
  ReturnType<typeof useSynchronisationData>
