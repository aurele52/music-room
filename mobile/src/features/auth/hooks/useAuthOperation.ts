import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { useFocusEffect } from 'expo-router'
import { errorMessage } from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'
import {
  useSession,
  isCurrentSession
} from '../../../session/SessionProvider'

export function useAuthOperation() {
  const { session } = useSession()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const mounted = useRef(false)
  const active = useRef(false)
  const locked = useRef(false)
  const [fence] = useState(createAsyncFence)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      fence.invalidate()
    }
  }, [fence])

  useFocusEffect(useCallback(() => {
    active.current = true

    return () => {
      active.current = false
      fence.invalidate()
    }
  }, [fence]))

  const available =
    session.status === 'guest' ||
    (
      session.status === 'error' &&
      !session.offlineUserId
    )

  function canSubmit(): boolean {
    return (
      mounted.current &&
      active.current &&
      !locked.current &&
      available &&
      isCurrentSession(session)
    )
  }

  async function perform(
    operation: (current: () => boolean) => Promise<void>
  ) {
    if (!canSubmit()) return

    const snapshot = fence.capture()

    const current = () =>
      mounted.current &&
      active.current &&
      fence.isCurrent(snapshot) &&
      isCurrentSession(session)

    locked.current = true

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation(current)
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      // Ne pas liberer le verrou lors d'un simple
      // changement de focus : la requete continue.
      locked.current = false

      if (mounted.current) {
        setBusy(false)
      }
    }
  }

  return {
    busy: busy || !available,
    error,
    message,
    setError,
    setMessage,
    canSubmit,
    perform
  }
}
