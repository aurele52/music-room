import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import type { EventEditState } from '../hooks/useEventEdit'
import EventForm from './EventForm'

export default function EventEditContent({
  state
}: { state: EventEditState }) {
  const {
    draft,
    busy,
    error,
    update,
    save
  } = state

  return (
    <Screen title="Modifier l'événement">
      <Action
        label="Retour à la fiche"
        secondary
        onPress={() => router.back()}
      />

      {!draft && !error ? <ActivityIndicator /> : null}

      {error ? <Notice error>{error}</Notice> : null}

      {draft ? (
        <>
          <EventForm
            draft={draft}
            busy={busy}
            update={update}
          />

          <Action
            label={busy ? 'Enregistrement…' : 'Enregistrer'}
            disabled={busy}
            onPress={() => { void save() }}
          />
        </>
      ) : null}
    </Screen>
  )
}
