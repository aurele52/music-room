import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { subscribeAccountRealtime } from '../../../services/realtime/friendsRealtime'
import type { Friend, FriendLists, Participant, ApiError, Props } from './types'

export function useEventParticipants({
  eventId,
  token,
  onAuthError
}: Props) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method,
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
    let cancelled = false

    setLoading(true)

    void Promise.all([
      request<FriendLists>('/friends'),
      request<{ invitations: Participant[] }>(
        `/events/${eventId}/invitations`
      )
    ])
      .then(([friendData, invitationData]) => {
        if (cancelled) return

        setFriends(friendData.friends)
        setParticipants(invitationData.invitations)
        setError('')
      })
      .catch((err: unknown) => {
        if (!cancelled && !onAuthError(err)) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les participants'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, token, revision])

  // Un même transport privé signale les changements
  // de participants et de relations d'amitié.
  useEffect(() => {
    const refreshParticipants = (payload?: unknown) => {
      // Sans payload : connexion ou reconnexion.
      if (payload === undefined) {
        setRevision(value => value + 1)
        return
      }

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'eventId' in payload &&
        payload.eventId === eventId
      ) {
        setRevision(value => value + 1)
      }
    }

    const stopParticipants = subscribeAccountRealtime(
      token,
      'event:participants-changed',
      refreshParticipants
    )

    const stopFriends = subscribeAccountRealtime(
      token,
      'friends:changed',
      () => setRevision(value => value + 1)
    )

    return () => {
      stopParticipants()
      stopFriends()
    }
  }, [eventId, token])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedId || working) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(
        `/events/${eventId}/invitations`,
        'POST',
        { userId: selectedId }
      )

      setSelectedId('')
      setMessage('Invitation envoyée.')
      setRevision((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Invitation impossible'
        )
      }
    } finally {
      setWorking(false)
    }
  }

  async function removeParticipant(participant: Participant) {
    if (working) return

    if (!window.confirm(
      `Retirer ${participant.user.name} de cet événement ?`
    )) {
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(
        `/events/${eventId}/invitations/${participant.id}`,
        'DELETE'
      )

      setMessage('Invitation ou participation supprimée.')
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

  const invitedIds = new Set(
    participants.map((item) => item.user.id)
  )

  const availableFriends = friends.filter(
    (item) => !invitedIds.has(item.user.id)
  )

  return {
    participants, availableFriends,
    selectedId, setSelectedId,
    loading, working, error, message,
    invite, removeParticipant
  }
}

export type ParticipantsState = ReturnType<typeof useEventParticipants>
