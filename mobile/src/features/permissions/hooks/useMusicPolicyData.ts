import { useCallback, useRef, useState } from 'react'
import {
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import {
  api,
  errorMessage,
  type MusicEvent
} from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'
import {
  fetchMusicPolicies,
  musicPoliciesToLocalForm,
  validMusicPolicyEventId,
  type MusicPolicyForm
} from '../../../lib/musicPolicies'
import { useSession } from '../../../session/SessionProvider'

export function useMusicPolicyData() {
  const { id: rawId } = useLocalSearchParams<{
    id: string
  }>()
  const id = typeof rawId === 'string' ? rawId : ''

  const { session } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : ''

  const viewerId = session.status === 'authenticated'
    ? session.user.id
    : ''

  const [event, setEvent] = useState<MusicEvent | null>(null)
  const [form, setForm] = useState<MusicPolicyForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeRef = useRef(false)
  const busyRef = useRef(false)
  const generation = useRef(0)
  const [operationFence] = useState(createAsyncFence)

  const load = useCallback(async (
    active: () => boolean = () => true
  ) => {
    const request = ++generation.current
    const current = () =>
      active() && request === generation.current

    setLoading(true)
    setForm(null)
    setEvent(null)
    setMessage('')
    setError('')

    try {
      if (!token || !validMusicPolicyEventId(id)) {
        throw new Error('Événement invalide.')
      }

      const result = await api<{ event: MusicEvent }>(
        `/events/${id}`,
        { token }
      )

      if (!current()) return

      if (result.event.organizerId !== viewerId) {
        throw new Error(
          'Configuration réservée à l’organisateur.'
        )
      }

      setEvent(result.event)

      const policies = await fetchMusicPolicies(id, token)

      if (!current()) return

      setForm(musicPoliciesToLocalForm(policies))
    } catch (failure) {
      if (!current()) return

      setForm(null)
      setError(errorMessage(failure))
    } finally {
      if (current()) setLoading(false)
    }
  }, [id, token, viewerId])

  useFocusEffect(useCallback(() => {
    let active = true
    activeRef.current = true

    void load(() => active)

    return () => {
      active = false
      activeRef.current = false
      generation.current++
      operationFence.invalidate()
    }
  }, [load, operationFence]))


  return {
    id,
    token,
    viewerId,
    event,
    setEvent,
    form,
    setForm,
    loading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    activeRef,
    busyRef,
    operationFence,
    load
  }
}

export type MusicPolicyData =
  ReturnType<typeof useMusicPolicyData>
