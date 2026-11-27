import { AppState } from 'react-native'
import { useCallback, useRef, useState } from 'react'
import {
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { useSession } from '../../../session/SessionProvider'
import { errorMessage } from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import { subscribeEventRealtime } from '../../../lib/eventRealtime'
import {
  fetchMusicSession,
  type MusicSessionListing
} from '../../../lib/musicSessions'

export function useSessionData() {
  const { eventId: rawId } = useLocalSearchParams<{
    eventId: string
  }>()

  const eventId = typeof rawId === 'string' ? rawId : ''

  const { session: account } = useSession()
  const token = account.status === 'authenticated'
    ? account.token
    : ''

  const [data, setData] = useState<MusicSessionListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const requestGeneration = useRef(0)
  const screenActive = useRef(false)
  const [operationFence] = useState(createAsyncFence)

  const load = useCallback(async (
    active: () => boolean = () => true
  ): Promise<boolean> => {
    if (!token || !eventId) return false

    const generation = ++requestGeneration.current
    const current = () =>
      active() &&
      generation === requestGeneration.current

    setLoading(true)

    try {
      const result = await fetchMusicSession(eventId, token)

      if (!current()) return false

      setData(result)
      setError('')

      return current()
    } catch (failure) {
      if (current()) {
        setData(null)
        setError(errorMessage(failure))
      }

      return false
    } finally {
      if (current()) setLoading(false)
    }
  }, [eventId, token])

  useFocusEffect(useCallback(() => {
    let active = true
    screenActive.current = true
    setBusy(false)

    void load(() => active)

    // Rattrapage HTTP après une mise en veille.
    const stopForeground = subscribeForegroundRefresh(
      AppState,
      () => {
        if (active) void load(() => active)
      }
    )

    // Même canal que le dashboard web.
    const unsubscribe = token && eventId
      ? subscribeEventRealtime(
          token,
          eventId,
          'session',
          {
            onChanged: () => {
              if (active) void load(() => active)
            },
            onAccessChanged: () => {
              if (!active) return

              // Masquer immédiatement l'ancien état privé.
              requestGeneration.current++
              operationFence.invalidate()
              setBusy(false)
              setData(null)
              setError('')
              setMessage('')
              setLoading(true)

              void load(() => active)
            }
          }
        )
      : () => {}

    return () => {
      active = false
      screenActive.current = false
      requestGeneration.current++
      operationFence.invalidate()
      stopForeground()
      unsubscribe()
    }
  }, [load, token, eventId, operationFence]))


  return {
    eventId,
    token,
    data,
    loading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    screenActive,
    operationFence,
    load
  }
}

export type SessionData = ReturnType<typeof useSessionData>
