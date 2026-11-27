import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import { useRef, useCallback, useState } from 'react'
import { AppState } from 'react-native'
import {
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import {
  api,
  errorMessage,
  type MusicEvent
} from '../../../lib/api'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import { createAsyncFence } from '../../../lib/asyncFence'
import { useSession } from '../../../session/SessionProvider'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i


export function useEventDetailData() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = typeof params.id === 'string' ? params.id : ''

  const { session } = useSession()
  const token = session.status === 'authenticated'
    ? session.token
    : ''

  const [event, setEvent] = useState<MusicEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [operationFence] = useState(createAsyncFence)
  const screenActive = useRef(false)
  const requestGate = useRef(createLatestRequestGate())
  const [error, setError] = useState('')

  const load = useCallback(async (
    active: () => boolean = () => true
  ) => {
    if (!token || !screenActive.current) return

    const isLatest = requestGate.current.begin()

    const current = () =>
      screenActive.current &&
      active() &&
      isLatest()

    if (!uuid.test(id)) {
      setError('Identifiant d’événement invalide.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await api<{ event: MusicEvent }>(
        `/events/${id}`,
        { token }
      )

      if (current()) setEvent(result.event)
    } catch (failure) {
      if (current()) {
        setEvent(null)
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) setLoading(false)
    }
  }, [id, token])

  // Resynchronisation pendant la consultation et au retour
  // de l'application. Nettoyage automatique hors écran.
  useFocusEffect(useCallback(() => {
    let active = true
    const subscribeScreenRefresh = () => {
      if (active) void load(() => active)
    }

    const stopForeground = subscribeForegroundRefresh(
      AppState,
      subscribeScreenRefresh
    )



    return () => {
      active = false

      stopForeground()
    }
  }, [load]))

  useFocusEffect(useCallback(() => {
    let active = true
    screenActive.current = true
    setDeleting(false)

    // Ne pas afficher l'ancien événement quand l'ID change.
    setEvent(null)
    void load(() => active)

    return () => {
      active = false
      screenActive.current = false
      requestGate.current.invalidate()
      operationFence.invalidate()
    }
  }, [load, operationFence]))

  const organizer = (
    session.status === 'authenticated' &&
    event?.organizerId === session.user.id
  )


  return {
    id,
    session,
    token,
    event,
    loading,
    deleting,
    setDeleting,
    error,
    setError,
    organizer,
    operationFence,
    screenActive,
    load
  }
}

export type EventDetailData =
  ReturnType<typeof useEventDetailData>
