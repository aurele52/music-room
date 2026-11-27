import { useEffect, useState } from 'react'
import { subscribeAccountRealtime } from '../../../services/realtime/friendsRealtime'
import type { Invitation, ApiError, Props } from './types'

export function useEventInvitations({
  token,
  onAuthError
}: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [revision, setRevision] = useState(0)
  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function request<T>(
    path: string,
    method = 'GET'
  ): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method,
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
    let cancelled = false

    setLoading(true)

    void request<{ invitations: Invitation[] }>(
      '/events/invitations/mine'
    )
      .then((data) => {
        if (!cancelled) {
          setInvitations(data.invitations)
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !onAuthError(err)) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les invitations'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, revision])

  useEffect(() => {
    return subscribeAccountRealtime(
      token,
      'events:changed',
      () => setRevision(value => value + 1)
    )
  }, [token])

  async function action(
    invitation: Invitation,
    method: 'POST' | 'DELETE',
    successMessage: string
  ) {
    if (working) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      const path = `/events/invitations/${invitation.id}`
      await request(
        method === 'POST' ? `${path}/accept` : path,
        method
      )

      setMessage(successMessage)
      if (method === 'DELETE') {
        setOpenEventId((current) =>
          current === invitation.event.id ? null : current
        )
      }
      setRevision((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Action impossible'
        )
      }
    } finally {
      setWorking(false)
    }
  }

  const pending = invitations.filter(
    (item) => item.status === 'PENDING'
  )
  const accepted = invitations.filter(
    (item) => item.status === 'ACCEPTED'
  )

  return {
    pending, accepted, openEventId, setOpenEventId,
    loading, working, error, message, action
  }
}

export type InvitationsState = ReturnType<typeof useEventInvitations>
