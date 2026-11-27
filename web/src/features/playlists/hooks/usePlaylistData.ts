import { useEffect, useState } from 'react'
import { subscribeEventRealtime } from '../../../services/realtime/eventRealtime'
import type { PlaylistResponse, ApiError, Props } from '../types'

const initialData: PlaylistResponse = {
  playlists: [],
  canEdit: false,
  organizer: false,
  finished: false
}


export function usePlaylistData({
  eventId, token, onAuthError
}: Props) {

  const [data, setData] = useState<PlaylistResponse>(initialData)
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

    const result: unknown = await response.json()

    if (!response.ok) {
      const details = result as {
        error?: string
        code?: string
      }

      const failure = new Error(
        details.error || 'Opération impossible'
      ) as ApiError

      failure.status = response.status
      failure.code = details.code

      throw failure
    }

    return result as T
  }

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    setLoading(true)

    void request<PlaylistResponse>(
      `/playlists/events/${eventId}`,
      'GET',
      undefined,
      controller.signal
    )
      .then((result) => {
        if (cancelled) return

        setData(result)
        setError('')
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        if (
          reason instanceof Error &&
          reason.name === 'AbortError'
        ) {
          return
        }

        if ([401, 403, 404].includes(
          (reason as ApiError).status ?? 0
        )) {
          setData(initialData)
        }

        if (!onAuthError(reason)) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Chargement des playlists impossible'
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
      'playlists',
      {
        onChanged: () => {
          setRevision((value) => value + 1)
        },
        onAccessChanged: () => {
          setData(initialData)
          setRevision((value) => value + 1)
        }
      }
    )
  }, [eventId, token])

  function refresh() {
    setRevision((value) => value + 1)
  }

  async function perform<T>(
    operation: () => Promise<T>,
    success: string | ((result: T) => string)
  ): Promise<boolean> {
    if (working || loading) return false

    setWorking(true)
    setError('')
    setMessage('')

    try {
      const result = await operation()
      setMessage(
        typeof success === 'function'
          ? success(result)
          : success
      )
      refresh()
      return true
    } catch (reason) {
      if (!onAuthError(reason)) {
        const failure = reason as ApiError

        if (failure.status === 409 && failure.message.startsWith('Révision obsolète')) {
          setMessage(
            'La playlist a changé. Liste actualisée : '
            + 'vérifie le nouvel ordre puis réessaie.'
          )
          refresh()
        } else {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Modification impossible'
          )
        }
      }
      return false
    } finally {
      setWorking(false)
    }
  }


  return {
    data, loading, working,
    error, message, request, perform
  }
}

export type PlaylistDataState = ReturnType<typeof usePlaylistData>
