import { useCallback, useEffect, useState } from 'react'
import { checkEventAccess, readEventLink } from './eventAccess'
import type { AccessGate } from './eventAccess'

export function useEventAccess() {
  const [eventId, setEventId] = useState(readEventLink)
  const [token, setToken] = useState(
    () => sessionStorage.getItem('token') || ''
  )
  const [gate, setGate] = useState<AccessGate>('loading')
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setAttempt(value => value + 1)
  }, [])

  const requireLogin = useCallback(() => {
    setGate('login')
  }, [])

  const onAuthError = useCallback((error: unknown) => {
    const failure = error as { status?: number } | null

    if (failure?.status !== 401) return false

    requireLogin()
    return true
  }, [requireLogin])

  // App.tsx pilote l'authentification. Le jeton est mis à
  // jour dans sessionStorage sans rechargement de page.
  useEffect(() => {
    if (!eventId) return

    function syncToken() {
      const nextToken = sessionStorage.getItem('token') || ''

      setToken((previous) =>
        previous === nextToken ? previous : nextToken
      )
    }

    // Le même onglet ne reçoit pas l'événement "storage"
    // pour ses propres écritures dans sessionStorage.
    // App.tsx émet donc un signal local après toute
    // connexion, déconnexion ou expiration de session.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncToken()
      }
    }

    syncToken()

    window.addEventListener(
      'music-room:auth-changed',
      syncToken
    )
    window.addEventListener('storage', syncToken)
    window.addEventListener('focus', syncToken)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener(
        'music-room:auth-changed',
        syncToken
      )
      window.removeEventListener('storage', syncToken)
      window.removeEventListener('focus', syncToken)
      document.removeEventListener(
        'visibilitychange',
        onVisible
      )
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return

    if (!token) {
      setGate('login')
      return
    }

    const controller = new AbortController()
    let active = true

    setGate('loading')

    void checkEventAccess(
      eventId,
      token,
      controller.signal
    )
      .then((result) => {
        if (active) setGate(result)
      })
      .catch((error: unknown) => {
        if (!active) return

        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) return

        setGate('error')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [eventId, token, attempt])


  function close() {
    const url = new URL(window.location.href)

    url.searchParams.delete('event')

    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search + url.hash
    )

    setEventId(null)
  }

  return {
    eventId, token, gate,
    retry, requireLogin, onAuthError, close
  }
}
