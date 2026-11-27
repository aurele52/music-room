import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import { subscribeAccountRealtime } from '../../../lib/friendsRealtime'
import {
  api,
  errorMessage,
  type MusicEvent
} from '../../../lib/api'
import { useSession } from '../../../session/SessionProvider'

export function useEvents() {
  const { session, logout } = useSession()
  const [events, setEvents] = useState<MusicEvent[]>([])
  const [mine, setMine] = useState<MusicEvent[]>([])
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestGate = useRef(createLatestRequestGate())

  const token = session.status === 'authenticated'
    ? session.token
    : ''

  const load = useCallback(async (
    search: string,
    isActive: () => boolean = () => true
  ) => {
    if (!token) return

    // Chaque chargement invalide les précédents.
    const isLatest = requestGate.current.begin()

    setLoading(true)
    setError('')

    try {
      const [publicResult, mineResult] = await Promise.all([
        api<{ events: MusicEvent[] }>(
          `/events/discover?q=${encodeURIComponent(search)}`,
          { token }
        ),
        api<{ events: MusicEvent[] }>(
          '/events/mine',
          { token }
        )
      ])

      if (isActive() && isLatest()) {
        setEvents(publicResult.events)
        setMine(mineResult.events)
      }
    } catch (failure) {
      if (isActive() && isLatest()) setError(errorMessage(failure))
    } finally {
      if (isActive() && isLatest()) setLoading(false)
    }
  }, [token])

  useFocusEffect(useCallback(() => {
    let active = true
    const current = () => active

    void load(activeQuery, current)

    const refresh = () => {
      if (active) void load(activeQuery, current)
    }

    const stopPersonal = token
      ? subscribeAccountRealtime(
          token,
          'events:changed',
          refresh
        )
      : () => {}

    const stopDiscovery = token
      ? subscribeAccountRealtime(
          token,
          'events:discovery-changed',
          refresh
        )
      : () => {}

    return () => {
      active = false
      requestGate.current.invalidate()
      stopPersonal()
      stopDiscovery()
    }
  }, [load, activeQuery, token]))


  return {
    events,
    mine,
    query,
    setQuery,
    activeQuery,
    setActiveQuery,
    loading,
    error,
    load,
    logout
  }
}

export type EventsState =
  ReturnType<typeof useEvents>
