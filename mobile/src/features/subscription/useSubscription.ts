import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api, errorMessage } from '../../lib/api'
import { createAsyncFence } from '../../lib/asyncFence'
import { createLatestRequestGate } from '../../lib/latestRequestGate'
import { isCurrentSessionToken } from '../../session/SessionProvider'

export type Plan = 'FREE' | 'PREMIUM'

type Subscription = {
  subscription: Plan
}

export function useSubscription(token: string) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const active = useRef(false)
  const locked = useRef(false)

  const [fence] = useState(createAsyncFence)
  const [requestGate] = useState(createLatestRequestGate)

  const load = useCallback(async () => {
    if (
      !active.current ||
      locked.current ||
      !isCurrentSessionToken(token)
    ) return

    const latest = requestGate.begin()

    const current = () =>
      active.current &&
      latest() &&
      isCurrentSessionToken(token)

    setLoading(true)
    setPlan(null)

    try {
      const result = await api<Subscription>(
        '/subscription',
        { token }
      )

      if (current()) {
        setPlan(result.subscription)
      }
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) {
        setLoading(false)
      }
    }
  }, [token, requestGate])

  useFocusEffect(useCallback(() => {
    active.current = true

    setBusy(locked.current)
    setError('')
    setMessage('')

    if (!locked.current) {
      void load()
    }

    return () => {
      active.current = false
      requestGate.invalidate()
      fence.invalidate()
    }
  }, [load, fence, requestGate]))

  async function change(subscription: Plan) {
    if (
      !active.current ||
      locked.current ||
      loading ||
      !plan ||
      subscription === plan ||
      !isCurrentSessionToken(token)
    ) return

    locked.current = true

    // Un ancien GET ne doit pas remplacer le PATCH.
    requestGate.invalidate()

    const snapshot = fence.capture()

    const current = () =>
      active.current &&
      fence.isCurrent(snapshot) &&
      isCurrentSessionToken(token)

    setBusy(true)
    setError('')
    setMessage('')

    let failed = false

    try {
      const result = await api<Subscription>(
        '/subscription',
        {
          method: 'PATCH',
          token,
          body: { subscription }
        }
      )

      if (current()) {
        setPlan(result.subscription)
        setMessage('Abonnement mis à jour.')
      }
    } catch (failure) {
      failed = true

      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      locked.current = false

      if (
        active.current &&
        isCurrentSessionToken(token)
      ) {
        setBusy(false)

        // En cas de retour sur l'ecran pendant
        // l'operation, relire la valeur serveur.
        if (!current() || failed) {
          void load()
        }
      }
    }
  }

  function retry() {
    if (
      !active.current ||
      locked.current ||
      !isCurrentSessionToken(token)
    ) return

    setError('')
    setMessage('')

    void load()
  }

  return {
    plan,
    loading,
    busy,
    error,
    message,
    change,
    retry
  }
}
