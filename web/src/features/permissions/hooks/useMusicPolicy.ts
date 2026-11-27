import { useEffect, useState } from 'react'
import type { FormState, Policies, Props } from '../types'
import { fromApi, toApi } from '../policyForm'

export function useMusicPolicy({
  eventId,
  token,
  onAuthError
}: Props) {
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setForm(null)
    setError('')
    setMessage('')

    void fetch(`/api/events/${eventId}/music-policies`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Lecture impossible')
        }

        return response.json() as Promise<{ policies: Policies }>
      })
      .then((data) => {
        if (active) setForm(fromApi(data.policies))
      })
      .catch((reason: unknown) => {
        if (!active || controller.signal.aborted) return
        if (!onAuthError(reason)) {
          setError('Impossible de charger les licences.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [eventId, token])

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((previous) =>
      previous ? { ...previous, [key]: value } : previous
    )
    setMessage('')
  }

  async function save() {
    if (!form || working) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      // Validation locale supplémentaire ; l'API reste
      // l'autorité pour toutes les vérifications.
      const policies = toApi(form)

      const response = await fetch(
        `/api/events/${eventId}/music-policies`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(policies)
        }
      )

      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        throw new Error(
          (details as { error?: string }).error ??
          'Modification impossible'
        )
      }

      const data =
        await response.json() as { policies: Policies }

      setForm(fromApi(data.policies))
      setMessage('Licences musicales enregistrées.')
    } catch (reason) {
      if (!onAuthError(reason)) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Modification impossible'
        )
      }
    } finally {
      setWorking(false)
    }
  }

  return {
    form, loading, working,
    error, message, update, save
  }
}

export type MusicPolicyState = ReturnType<typeof useMusicPolicy>
