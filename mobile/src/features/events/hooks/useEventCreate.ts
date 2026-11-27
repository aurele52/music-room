import { useCallback, useRef, useState } from 'react'
import { createAsyncFence } from '../../../lib/asyncFence'
import { router, useFocusEffect } from 'expo-router'
import {
  api,
  errorMessage,
  type MusicEvent
} from '../../../lib/api'
import {
  buildEventPayload,
  type EventDraft
} from '../../../lib/eventDraft'
import { useSession } from '../../../session/SessionProvider'

const initial: EventDraft = {
  title: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  visibility: 'PUBLIC'
}


export function useEventCreate() {
  const { session } = useSession()
  const [draft, setDraft] = useState<EventDraft>(initial)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const screenActive = useRef(false)
  const [operationFence] = useState(createAsyncFence)
  const [error, setError] = useState('')

  const token = session.status === 'authenticated'
    ? session.token
    : ''

  useFocusEffect(useCallback(() => {
    screenActive.current = true

    busyRef.current = false
    setBusy(false)

    return () => {
      screenActive.current = false
      operationFence.invalidate()
    }
  }, [operationFence]))

  function update<K extends keyof EventDraft>(
    key: K,
    value: EventDraft[K]
  ) {
    if (busyRef.current || !screenActive.current) return

    setDraft(previous => ({
      ...previous,
      [key]: value
    }))
  }

  async function submit() {
    if (
      busyRef.current ||
      !token ||
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

      const result = await api<{ event: MusicEvent }>(
        '/events',
        {
          method: 'POST',
          token,
          body
        }
      )

      if (!current()) return

      if (!result.event?.id) {
        throw new Error('Réponse de création invalide.')
      }

      router.replace({
        pathname: '/event/[id]',
        params: { id: result.event.id }
      })
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
    draft,
    busy,
    error,
    update,
    submit
  }
}

export type EventCreateState =
  ReturnType<typeof useEventCreate>
