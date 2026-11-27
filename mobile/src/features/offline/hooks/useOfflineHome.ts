import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  useSession,
  isCurrentSession
} from '../../../session/SessionProvider'
import {
  subscribeSyncChanges
} from '../../../lib/offline/syncChanges'
import { listSnapshots } from '../../../lib/offline/database'
import {
  removeExpiredEvents,
  type CachedEvent
} from '../../../lib/offline/cachedEvents'

export function useOfflineHome(userId: string) {
  const { session, restore, logout } = useSession()

  const [events, setEvents] = useState<CachedEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    let active = true
    let generation = 0
    const current = () =>
      active &&
      isCurrentSession(session) &&
      session.status === 'error' &&
      session.offlineUserId === userId

    let timer: ReturnType<typeof setTimeout> | undefined

    function refresh() {
      const request = ++generation

      if (timer) clearTimeout(timer)

      void listSnapshots(userId).then(rows => {
        if (!current() || request !== generation) return

        const valid = removeExpiredEvents(rows)

        setEvents(valid)
        setError('')
        setLoading(false)

        if (valid.length === 0) return

        const expiration = Math.min(
          ...valid.map(row => row.snapshot.expiresAt)
        )

        // Retirer automatiquement les donnees expirees.
        timer = setTimeout(() => {
          if (!current()) return

          setEvents(previous => removeExpiredEvents(previous))
          refresh()
        }, Math.max(0, expiration - Date.now()))
      }).catch(() => {
        if (!current() || request !== generation) return

        setEvents([])
        setLoading(false)
        setError('Stockage local indisponible.')
      })
    }

    refresh()

    const unsubscribe = subscribeSyncChanges(user => {
      if (current() && user === userId) {
        refresh()
      }
    })

    const appSubscription = AppState.addEventListener(
      'change',
      state => {
        if (current() && state === 'active') {
          setEvents(previous => removeExpiredEvents(previous))
          refresh()
        }
      }
    )

    return () => {
      active = false
      generation++

      if (timer) clearTimeout(timer)

      unsubscribe()
      appSubscription.remove()
    }
  }, [userId, session]))


  function toggleEvent(eventId: string) {
    setSelected(previous =>
      previous === eventId ? null : eventId
    )
  }

  function reconnect() {
    if (isCurrentSession(session)) {
      void restore()
    }
  }

  function disconnect() {
    if (!isCurrentSession(session)) return

    void logout().catch(() => {
      // SessionManager publie son erreur de stockage.
    })
  }

  return {
    userId,
    events,
    selected,
    loading,
    error,
    toggleEvent,
    reconnect,
    disconnect
  }
}

export type OfflineHomeState =
  ReturnType<typeof useOfflineHome>
