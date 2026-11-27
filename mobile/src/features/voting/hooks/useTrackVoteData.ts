import { AppState } from 'react-native'
import { useCallback, useRef, useState } from 'react'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  fetchMusicTracks,
  type MusicTrackListing
} from '../../../lib/musicTracks'
import {
  fetchMusicCatalog,
  type CatalogTrack
} from '../../../lib/musicCatalog'
import { errorMessage } from '../../../lib/api'
import { subscribeEventRealtime } from '../../../lib/eventRealtime'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import { createAsyncFence } from '../../../lib/asyncFence'
import { useSession } from '../../../session/SessionProvider'

export function useTrackVoteData() {
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

  const [listing, setListing] =
    useState<MusicTrackListing | null>(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [catalog, setCatalog] = useState<CatalogTrack[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const availableTracks = catalog.filter(track =>
    !listing?.tracks.some(item =>
      item.title === track.title &&
      item.artist === track.artist
    )
  )

  const selectedTrack = availableTracks.find(
    track => track.id === selectedId
  )

  const requestGeneration = useRef(0)
  const [asyncFence] = useState(createAsyncFence)

  const load = useCallback(async (
    active: () => boolean = () => true
  ) => {
    if (!token) return

    const generation = ++requestGeneration.current
    const current = () =>
      active() &&
      generation === requestGeneration.current

    setLoading(true)
    setError('')

    try {
      const [result, catalogResult] = await Promise.all([
        fetchMusicTracks(eventId, token),
        fetchMusicCatalog(token)
          .then(tracks => ({ tracks, error: '' }))
          .catch(failure => ({
            tracks: [] as CatalogTrack[],
            error: errorMessage(failure)
          }))
      ])

      if (current()) {
        setListing(result)
        setCatalog(catalogResult.tracks)
        setCatalogError(catalogResult.error)
      }
    } catch (failure) {
      if (current()) {
        setListing(null)
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) {
        setLoading(false)
      }
    }
  }, [eventId, token])

  useFocusEffect(useCallback(() => {
    let active = true
    setBusy(false)
    void load(() => active)

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
          'tracks',
          {
            onChanged: () => {
              if (active) void load(() => active)
            },
            onAccessChanged: () => {
              if (!active) return

              // Invalider les réponses antérieures avant
              // de masquer les données de l'ancien accès.
              requestGeneration.current++
              asyncFence.invalidate()
              setBusy(false)
              setListing(null)
              setCatalog([])
              setSelectedId('')
              setCatalogError('')
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
      unsubscribe()
    }
  }, [load, token, eventId, asyncFence]))


  return {
    eventId,
    token,
    listing,
    loading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    catalogError,
    availableTracks,
    selectedTrack,
    selectedId,
    setSelectedId,
    asyncFence,
    load
  }
}

export type TrackVoteData = ReturnType<typeof useTrackVoteData>
