import { Alert } from 'react-native'
import { errorMessage } from '../../../lib/api'
import {
  startMusicSession,
  controlMusicSession,
  type MusicSessionAction
} from '../../../lib/musicSessions'
import type { SessionData } from './useSessionData'

export function useSessionActions(source: SessionData) {
  const {
    eventId,
    token,
    data,
    loading,
    busy,
    setBusy,
    setError,
    setMessage,
    screenActive,
    operationFence,
    load
  } = source

  async function perform(
    operation: () => Promise<unknown>,
    successMessage: string
  ) {
    if (
      busy ||
      loading ||
      !data?.canControl ||
      !screenActive.current
    ) return

    const scope = operationFence.capture()
    const current = () =>
      screenActive.current &&
      operationFence.isCurrent(scope)

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation()

      if (!current()) return

      await load(current)

      if (current()) {
        setMessage(successMessage)
      }
    } catch (failure) {
      if (!current()) return

      const reason = failure as { status?: number }

      // Conflit de révision ou permissions modifiées :
      // relire le serveur, ne jamais répéter la commande.
      if (reason.status === 409 || reason.status === 403) {
        await load(current)
      }

      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) setBusy(false)
    }
  }

  function start() {
    if (
      !data?.canControl ||
      busy ||
      loading ||
      !screenActive.current
    ) return

    const scope = operationFence.capture()

    const execute = () => {
      if (
        !screenActive.current ||
        !operationFence.isCurrent(scope)
      ) return

      void perform(
        () => startMusicSession(eventId, token),
        'Session préparée depuis le classement.'
      )
    }

    if (!data.session) {
      execute()
      return
    }

    Alert.alert(
      'Remplacer la session actuelle ?',
      'Cette action relancera la session depuis le classement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Remplacer la session',
          style: 'destructive',
          onPress: execute
        }
      ]
    )
  }

  function control(action: MusicSessionAction): boolean {
    const current = data?.session

    if (
      !current ||
      !data?.canControl ||
      busy ||
      loading ||
      !screenActive.current ||
      current.state === 'STOPPED'
    ) return false

    if (
      action === 'ended' &&
      current.state !== 'PLAYING'
    ) return false

    void perform(
      () => controlMusicSession(eventId, token, {
        action,
        revision: current.revision
      }),
      'Session mise à jour.'
    )

    return true
  }


  return {
    start,
    control
  }
}
