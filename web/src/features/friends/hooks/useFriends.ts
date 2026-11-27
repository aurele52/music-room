import { useEffect, useState } from 'react'
import { subscribeFriendsRealtime } from '../../../services/realtime/friendsRealtime'
import type { FriendLists, ApiError, Props } from '../types'

const emptyLists: FriendLists = {
  friends: [],
  incoming: [],
  outgoing: []
}

export function useFriends({
  token,
  refreshKey,
  onAuthError
}: Props) {
  const [lists, setLists] = useState<FriendLists>(emptyLists)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function apiRequest<T>(
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

    void apiRequest<FriendLists>('/friends')
      .then((data) => {
        if (!cancelled) {
          setLists(data)
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !onAuthError(err)) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les amis'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, refreshKey, reloadKey])

  useEffect(() => {
    return subscribeFriendsRealtime(token, () => {
      setReloadKey(value => value + 1)
    })
  }, [token])

  async function performAction(
    id: string,
    path: string,
    method: 'POST' | 'DELETE',
    successMessage: string
  ) {
    if (workingId) return

    setWorkingId(id)
    setError('')
    setMessage('')

    try {
      await apiRequest(path, method)
      setMessage(successMessage)
      setReloadKey((value) => value + 1)
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Action impossible'
        )
      }
    } finally {
      setWorkingId('')
    }
  }

  const busy = Boolean(workingId) || loading


  return {
    lists, loading, busy, error,
    message, performAction
  }
}

export type FriendsState = ReturnType<typeof useFriends>
