import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import type { EventCreateState } from '../hooks/useEventCreate'
import EventForm from './EventForm'

export default function EventCreateContent({
  state
}: { state: EventCreateState }) {
  const {
    draft,
    busy,
    error,
    update,
    submit
  } = state

  return (
    <Screen
      title="Créer une soirée"
      subtitle="Configure ton événement Music Room."
    >
      <Action
        label="Annuler"
        secondary
        onPress={() => router.replace('/events')}
      />

      <EventForm
        draft={draft}
        busy={busy}
        update={update}
      />

      {error ? <Notice error>{error}</Notice> : null}

      <Action
        label={busy
          ? 'Création en cours…'
          : 'Créer l’événement'}
        disabled={busy}
        onPress={() => { void submit() }}
      />
    </Screen>
  )
}
