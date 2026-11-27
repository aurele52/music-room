import { router } from 'expo-router'
import { Action } from '../../../ui/Controls'
import type { EventDetailState } from '../hooks/useEventDetail'

export default function EventOrganizerActions({
  state
}: { state: EventDetailState }) {
  const {
    event,
    organizer,
    deleting,
    confirmDelete
  } = state

  if (!event || !organizer) return null

  return (
    <>
    <Action
      label="Configurer les règles musicales"
      disabled={deleting}
      onPress={() => router.push({
        pathname: '/event/policies',
        params: { id: event.id }
      })}
    />
    <Action
      label="Modifier l'événement"
      disabled={deleting}
      onPress={() => router.push({
        pathname: '/event/edit',
        params: { id: event.id }
      })}
    />
    <Action
      label={deleting
        ? 'Suppression en cours…'
        : 'Supprimer cet événement'}
      secondary
      disabled={deleting}
      onPress={confirmDelete}
    />

    </>
  )
}
