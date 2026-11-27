import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { subscribeAccountRealtime } from '../../../services/realtime/friendsRealtime'
import type { MusicEvent, EventDetail, DiscoveryResponse, ApiError, Props } from './types'

export function useEventDiscovery({
  token,
  onAuthError
}: Props) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [filters, setFilters] = useState({
    title: '',
    location: ''
  })
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)

  const [events, setEvents] = useState<MusicEvent[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<MusicEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  // Invalidation de la recherche courante à chaque changement
  // de la découverte publique ou reconnexion Socket.IO.
  useEffect(() => {
    return subscribeAccountRealtime(
      token,
      'events:discovery-changed',
      () => setRevision(value => value + 1)
    )
  }, [token])

  async function request<T>(
    path: string,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(`/api${path}`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      const failure = new Error(
        data.error || 'Erreur du serveur'
      ) as ApiError

      failure.status = response.status
      failure.code = data.code
      throw failure
    }

    return data as T
  }

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const params = new URLSearchParams({
      page: String(page)
    })

    if (filters.title) {
      params.set('q', filters.title)
    }
    if (filters.location) {
      params.set('location', filters.location)
    }

    setLoading(true)
    setError('')
    setSelected(null)

    void request<DiscoveryResponse>(
      `/events/discover?${params.toString()}`,
      controller.signal
    )
      .then((data) => {
        if (cancelled) return
        setEvents(data.events)
        setHasMore(data.hasMore)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return

        setEvents([])
        setHasMore(false)

        if (!onAuthError(err)) {
          setError(
            err instanceof Error
              ? err.message
              : 'Recherche impossible'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [token, filters, page, revision])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    if (title.trim().length > 80 || location.trim().length > 120) {
      setError('Recherche trop longue')
      return
    }

    setFilters({
      title: title.trim(),
      location: location.trim()
    })
    setPage(1)
    setRevision((value) => value + 1)
  }

  async function openEvent(event: MusicEvent) {
    if (opening || loading) return

    setOpening(true)
    setError('')
    setSelected(null)

    try {
      const data = await request<{ event: EventDetail }>(
        `/events/${encodeURIComponent(event.id)}`
      )

      setSelected({
        ...event,
        ...data.event
      })
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error
            ? err.message
            : 'Événement inaccessible'
        )
      }
    } finally {
      setOpening(false)
    }
  }

  return {
    title, setTitle, location, setLocation,
    page, setPage, events, hasMore,
    selected, setSelected, loading, opening,
    error, search, openEvent
  }
}

export type DiscoveryState = ReturnType<typeof useEventDiscovery>
