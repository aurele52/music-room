import { Alert } from 'react-native'
import { errorMessage } from '../../../lib/api'
import { eventApi, type EventMember } from '../../../lib/eventParticipation'
import type { ParticipationData } from './useParticipationData'

export function useParticipationActions(
  data: ParticipationData
) {
  const {
    event,
    token,
    organizer,
    busy,
    setBusy,
    activeRef,
    busyRef,
    operationFence,
    setMessage,
    setError,
    selectedFriend,
    setFriendId,
    load
  } = data

  function confirmDestructive(
    title: string,
    description: string,
    execute: () => void
  ) {
    const confirmation = operationFence.capture()

    Alert.alert(title, description, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: () => {
          if (
            !activeRef.current ||
            busyRef.current ||
            !operationFence.isCurrent(confirmation)
          ) return

          execute()
        }
      }
    ])
  }

  async function perform(
    operation: () => Promise<unknown>,
    onSuccess?: () => void
  ) {
    if (
      !organizer ||
      !token ||
      !activeRef.current ||
      busyRef.current
    ) return

    busyRef.current = true

    // Invalider les anciennes confirmations.
    operationFence.invalidate()

    const scope = operationFence.capture()
    const current = () =>
      activeRef.current &&
      operationFence.isCurrent(scope)

    setBusy(true)
    setMessage('')
    setError('')

    try {
      await operation()

      if (!current()) return

      onSuccess?.()

      await load(current)

      if (current()) {
        setMessage('Opération enregistrée.')
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

  function removeMember(member: EventMember) {
    if (!organizer || busy) return

    confirmDestructive(
      'Retirer cette personne ?',
      `${member.user.name} perdra son accès à l’événement si aucune autre autorisation ne s’applique.`,
      () => {
        void perform(() =>
          eventApi.removeMember(
            event.id,
            member.id,
            token
          )
        )
      }
    )
  }

  function inviteFriend() {
    if (!organizer || !selectedFriend || busy) return

    const targetId = selectedFriend.id

    void perform(
      () => eventApi.invite(
        event.id,
        targetId,
        token
      ),
      () => setFriendId('')
    )
  }

  return {
    removeMember,
    inviteFriend
  }
}
