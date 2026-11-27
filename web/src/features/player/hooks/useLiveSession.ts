import { useEffect, useState } from 'react'
import { subscribeEventRealtime } from '../../../services/realtime/eventRealtime'
import type { SessionResponse, Props } from '../types'

const empty: SessionResponse = {
  session: null,
  canControl: false,
  finished: false
}

export function useLiveSession({
  eventId,
  token,
  onAuthError
}: Props) {
  const [data, setData] = useState<SessionResponse>(empty)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const path = `/sessions/events/${eventId}`

  async function request<T>(
    endpoint: string,
    method = 'GET',
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(`/api${endpoint}`, {
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

    const result = await response.json()

    if (!response.ok) {
      throw Object.assign(
        new Error(result.error || 'Opération impossible'),
        { status: response.status }
      )
    }

    return result as T
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)

    void request<SessionResponse>(
      path, 'GET', undefined, controller.signal
    )
      .then(result => {
        if (!active) return
        setData(result)
        setError('')
      })
      .catch(reason => {
        if (!active) return

        setData(empty)

        if (!onAuthError(reason)) {
          setError(reason.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [eventId, token, refresh])

  useEffect(() => {
    return subscribeEventRealtime(
      token,
      eventId,
      'session',
      {
        onChanged: () => {
          setRefresh(value => value + 1)
        },
        onAccessChanged: () => {
          setData(empty)
          setLoading(true)
          setRefresh(value => value + 1)
        }
      }
    )
  }, [eventId, token])

  async function perform(
    endpoint: string,
    body: unknown
  ) {
    if (busy || loading || !data.canControl) return

    setBusy(true)
    setError('')

    try {
      await request(endpoint, 'POST', body)
    } catch (reason) {
      if (!onAuthError(reason)) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Commande impossible'
        )
      }
    } finally {
      setBusy(false)
      setRefresh(value => value + 1)
    }
  }

  const session = data.session
  const current = session?.items[session.currentIndex]

  function start() {
    if (session && !window.confirm(
      'Remplacer la session actuelle ?'
    )) return

    void perform(`${path}/start`, {})
  }

  function control(
    action: 'play' | 'pause' | 'next' | 'ended' | 'stop'
  ) {
    if (!session) return

    void perform(`${path}/control`, {
      action,
      revision: session.revision
    })
  }

  const disabled = busy || loading

  return {
    data, session, current,
    loading, error, disabled,
    start, control
  }
}

export type LiveSessionState = ReturnType<typeof useLiveSession>
