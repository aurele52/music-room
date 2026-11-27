import { AppState } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { fetchMusicPlaylists } from '../../../lib/musicPlaylists'
import type { PlaylistItemDraft } from '../../../lib/musicPlaylistActions'
import { errorMessage } from '../../../lib/api'
import * as offlineDatabase from '../../../lib/offline/database'
import {
  createPlaylistLoader,
  isAccessFailure,
  type PlaylistView
} from '../../../lib/offline/playlistLoader'
import { subscribeEventRealtime } from '../../../lib/eventRealtime'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import { subscribeSyncChanges } from '../../../lib/offline/syncChanges'
import { createAsyncFence } from '../../../lib/asyncFence'
import {
  useSession,
  isCurrentSession
} from '../../../session/SessionProvider'

const playlistLoader = createPlaylistLoader(offlineDatabase)

export function usePlaylistData() {
  const { eventId: rawId } = useLocalSearchParams<{
    eventId: string
  }>()

  const eventId = typeof rawId === 'string'
    ? rawId
    : ''

  const { session } = useSession()
  const token = session.status === 'authenticated'
    ? session.token
    : ''

  const userId = session.status === 'authenticated'
    ? session.user.id
    : ''

  const [view, setView] =
    useState<PlaylistView | null>(null)

  const listing = view?.listing ?? null
  const allowCache = useRef(true)

  useEffect(() => {
    if (view?.source !== 'cache') return

    const timer = setTimeout(() => {
      setView(previous => previous === view ? null : previous)
    }, Math.max(0, view.expiresAt - Date.now()))

    return () => clearTimeout(timer)
  }, [view])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drafts, setDrafts] =
    useState<Record<string, PlaylistItemDraft>>({})

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const requestGeneration = useRef(0)
  const [asyncFence] = useState(createAsyncFence)

  const load = useCallback(async (
    active: () => boolean = () => true
  ): Promise<boolean> => {
    if (!token || !isCurrentSession(session)) return false

    const generation = ++requestGeneration.current
    const current = () =>
      active() &&
      isCurrentSession(session) &&
      generation === requestGeneration.current

    setLoading(true)
    setError('')

    try {
      const result = await playlistLoader.load({
        userId,
        eventId,
        current,
        allowCache: allowCache.current,
        fetchListing: () => fetchMusicPlaylists(eventId, token)
      })

      if (!current() || !result) return false

      if (result.source === 'server') {
        allowCache.current = result.cacheable
      }

      setView(result)

      return result.source === 'server'
    } catch (failure) {
      if (current()) {
        if (isAccessFailure(failure)) {
          allowCache.current = false
        }

        setView(null)
        setError(errorMessage(failure))
      }
      return false
    } finally {
      if (current()) {
        setLoading(false)
      }
    }
  }, [eventId, token, userId, session])

  useFocusEffect(useCallback(() => {
    let active = true
    setBusy(false)
    void load(() => active)

    const stopSync = subscribeSyncChanges((user, event) => {
      if (active && user === userId && event === eventId) {
        requestGeneration.current++
        setView(null)
        void load(() => active)
      }
    })

    let wasOffline: boolean | null = null

    const stopNetwork = NetInfo.addEventListener(state => {
      if (!active) return

      const offline = state.isConnected === false ||
        state.isInternetReachable === false

      if (!offline && state.isConnected !== true) return

      const changed = wasOffline !== null &&
        wasOffline !== offline

      wasOffline = offline

      if (changed) {
        void load(() => active)
      }
    })

    // Rattraper les notifications perdues pendant la veille.
    const stopForegroundRefresh = subscribeForegroundRefresh(
      AppState,
      () => {
        if (active) void load(() => active)
      }
    )

    const unsubscribe = token
      ? subscribeEventRealtime(
          token,
          eventId,
          'playlists',
          {
            onChanged: () => {
              if (!active) return

              requestGeneration.current++
              allowCache.current = false
              setView(null)

              void playlistLoader.invalidate(userId, eventId)
                .then(() => {
                  if (active) void load(() => active)
                })
            },
            onAccessChanged: () => {
              if (!active) return

              // Invalider les réponses antérieures avant
              // de masquer les données de l'ancien accès.
              requestGeneration.current++
              asyncFence.invalidate()
              setBusy(false)
              allowCache.current = false
              void playlistLoader.invalidate(userId, eventId)
              setView(null)
              setDrafts({})
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
      requestGeneration.current++
      asyncFence.invalidate()
      stopForegroundRefresh()
      stopNetwork()
      stopSync()
      unsubscribe()
    }
  }, [load, token, eventId, userId, asyncFence]))


  return {
    session,
    token,
    userId,
    eventId,
    view,
    listing,
    title,
    setTitle,
    description,
    setDescription,
    drafts,
    setDrafts,
    loading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    asyncFence,
    load
  }
}

export type PlaylistData = ReturnType<typeof usePlaylistData>
