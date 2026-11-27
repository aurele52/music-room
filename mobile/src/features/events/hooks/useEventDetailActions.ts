import { Alert } from 'react-native'
import { router } from 'expo-router'
import { api, errorMessage } from '../../../lib/api'
import type { EventDetailData } from './useEventDetailData'

export function useEventDetailActions(data: EventDetailData) {
  const {
    organizer,
    event,
    deleting,
    token,
    screenActive,
    operationFence,
    setDeleting,
    setError
  } = data

  function confirmDelete() {
    if (
      !organizer || !event || deleting ||
      !token || !screenActive.current
    ) return

    const targetId = event.id
    const confirmation = operationFence.capture()

    Alert.alert(
      'Supprimer cet événement ?',
      'Cette action supprimera définitivement la soirée et ses données associées. Elle ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: () => {
            // Une boîte de confirmation peut survivre
            // au départ de l'écran.
            if (
              !screenActive.current ||
              !operationFence.isCurrent(confirmation)
            ) return

            // Une confirmation ne peut etre utilisee
            // qu'une seule fois.
            operationFence.invalidate()

            const scope = operationFence.capture()
            const current = () =>
              screenActive.current &&
              operationFence.isCurrent(scope)

            void (async () => {
              setDeleting(true)
              setError('')

              try {
                await api<{ message: string }>(
                  `/events/${targetId}`,
                  { method: 'DELETE', token }
                )

                if (current()) {
                  router.replace('/events')
                }
              } catch (failure) {
                if (current()) {
                  setError(errorMessage(failure))
                }
              } finally {
                if (current()) {
                  setDeleting(false)
                }
              }
            })()
          }
        }
      ]
    )
  }


  return {
    confirmDelete
  }
}
