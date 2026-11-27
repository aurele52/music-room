import { useRef, useCallback, useState } from 'react'
import {
  router,
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
  buildEventPayload,
  formatLocalDateTime,
  type EventDraft
} from '../../../lib/eventDraft'
import { requireEventId } from '../../../lib/eventParticipation'
import { useSession } from '../../../session/SessionProvider'

export function useEventEdit() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>()
  const id = typeof rawId === 'string' ? rawId : ''

  const { session } = useSession()
  const token = session.status === 'authenticated'
    ? session.token
    : ''
  const viewerId = session.status === 'authenticated'
    ? session.user.id
    : ''

  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const operationFence = useRef(createAsyncFence()).current
  const screenActive = useRef(false)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    let active = true
    screenActive.current = true
    busyRef.current = false
    setBusy(false)

    async function load() {
      setDraft(null)
      setError('')

      try {
        const result = await api<{ event: MusicEvent }>(
          `/events/${requireEventId(id)}`,
          { token }
        )

        if (result.event.organizerId !== viewerId) {
          throw new Error('Modification réservée à l’organisateur.')
        }

        if (active) {
          setDraft({
            title: result.event.title,
            description: result.event.description ?? '',
            location: result.event.location ?? '',
            startsAt: formatLocalDateTime(result.event.startsAt),
            endsAt: formatLocalDateTime(result.event.endsAt),
            visibility: result.event.visibility
          })
        }
      } catch (failure) {
        if (active) setError(errorMessage(failure))
      }
    }

    if (token) void load()

    return () => {
      active = false
      screenActive.current = false
      operationFence.invalidate()
    }
  }, [id, token, viewerId, operationFence]))

  function update<K extends keyof EventDraft>(
    key: K,
    value: EventDraft[K]
  ) {
    if (busyRef.current || !screenActive.current) return

    setDraft(previous => previous
      ? { ...previous, [key]: value }
      : previous
    )
  }

  async function save() {
    if (
      !draft || !token || busyRef.current ||
      !screenActive.current
    ) return

    busyRef.current = true

    const scope = operationFence.capture()
    const current = () =>
      screenActive.current &&
      operationFence.isCurrent(scope)

    setBusy(true)
    setError('')

    try {
      const body = buildEventPayload(draft)

      await api<{ event: MusicEvent }>(
        `/events/${requireEventId(id)}`,
        { method: 'PUT', token, body }
      )

      if (current()) {
        router.replace({
          pathname: '/event/[id]',
          params: { id }
        })
      }
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }


  return {
    id,
    draft,
    busy,
    error,
    update,
    save
  }
}

export type EventEditState =
  ReturnType<typeof useEventEdit>
