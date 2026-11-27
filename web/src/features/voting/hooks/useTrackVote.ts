import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { subscribeEventRealtime } from '../../../services/realtime/eventRealtime'
import type { Track, CatalogTrack, Ranking, ApiError, Props } from '../types'
import { voteCoordinates } from '../voteCoordinates'

export function useTrackVote({
  eventId,
  token,
  organizer = false,
  onAuthError
}: Props) {
  const [ranking, setRanking] = useState<Ranking>({
    tracks: [],
    canParticipate: false,
    finished: false
  })
  const [catalog, setCatalog] = useState<CatalogTrack[]>([])
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) })
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

    setLoading(true)

    void request<Ranking>(
      `/tracks/events/${eventId}`,
      'GET',
      undefined,
      controller.signal
    )
      .then((data) => {
        if (!cancelled) {
          setRanking(data)
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return

        if (!onAuthError(err)) {
          setError(
            err instanceof Error
              ? err.message
              : 'Classement indisponible'
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
  }, [eventId, token, revision])

  useEffect(() => {
    return subscribeEventRealtime(
      token,
      eventId,
      'tracks',
      {
        onChanged: () => {
          setRevision((value) => value + 1)
        },
        onAccessChanged: () => {
          setRanking({
            tracks: [],
            canParticipate: false,
            finished: false
          })
          setRevision((value) => value + 1)
        }
      }
    )
  }, [eventId, token])

  useEffect(() => {
    let active = true

    void request<{ tracks: CatalogTrack[] }>('/catalog')
      .then(result => {
        if (active) setCatalog(result.tracks)
      })
      .catch(() => {
        if (active) setCatalog([])
      })

    return () => { active = false }
  }, [token])

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (working || !ranking.canParticipate || ranking.finished) return

    const selected = catalog.find(track =>
      track.title === title && track.artist === artist
    )

    if (!selected) {
      setError('Choisis un morceau du catalogue.')
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(
        `/tracks/events/${eventId}`,
        'POST',
        { catalogTrackId: selected.id }
      )

      setTitle('')
      setArtist('')
      setMessage('Morceau proposé.')
      setRevision((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error
            ? err.message
            : 'Proposition impossible'
        )
      }
    } finally {
      setWorking(false)
    }
  }



  async function toggleVote(track: Track) {
    if (working || !(ranking.canVote ?? ranking.canParticipate)) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      const coordinates = ranking.requiresLocation
        ? await voteCoordinates()
        : undefined

      await request(
        `/tracks/${track.id}/vote`,
        track.myVote ? 'DELETE' : 'POST',
        coordinates
      )

      setMessage(
        track.myVote ? 'Vote retiré.' : 'Vote enregistré.'
      )
      setRevision((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Vote impossible'
        )
      }

      if ((err as ApiError)?.status === 403) {
        setRevision((value) => value + 1)
      }
    } finally {
      setWorking(false)
    }
  }

  async function removeTrack(track: Track) {
    if (working || !organizer || ranking.finished) return

    if (!window.confirm(
      `Supprimer le morceau "${track.title}" de ${track.artist} ?`
    )) {
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(`/tracks/${track.id}`, 'DELETE')
      setMessage('Morceau supprimé.')
      setRevision((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Suppression impossible'
        )
      }
    } finally {
      setWorking(false)
    }
  }

  return {
    ranking, catalog, title, setTitle,
    artist, setArtist, organizer,
    loading, working, error, message,
    propose, toggleVote, removeTrack
  }
}

export type TrackVoteState = ReturnType<typeof useTrackVote>
