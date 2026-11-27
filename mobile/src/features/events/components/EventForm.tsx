import type { EventDraft } from '../../../lib/eventDraft'
import { DateTimeField } from '../../../ui/DateTimeField'
import { Field, Notice } from '../../../ui/Controls'
import EventVisibilityChoice from './EventVisibilityChoice'

interface Props {
  draft: EventDraft
  busy: boolean
  update: <K extends keyof EventDraft>(
    key: K,
    value: EventDraft[K]
  ) => void
}

export default function EventForm({
  draft,
  busy,
  update
}: Props) {
  return (
    <>
      <Field
        label="Titre"
        placeholder="Soirée entre amis"
        value={draft.title}
        onChangeText={value => update('title', value)}
        maxLength={100}
        autoCapitalize="sentences"
        editable={!busy}
      />

      <Field
        label="Description"
        placeholder="Une présentation de la soirée"
        value={draft.description}
        onChangeText={value => update('description', value)}
        maxLength={2000}
        multiline
        autoCapitalize="sentences"
        editable={!busy}
      />

      <Field
        label="Lieu (facultatif)"
        placeholder="Salle, ville ou adresse"
        value={draft.location}
        onChangeText={value => update('location', value)}
        maxLength={120}
        autoCapitalize="sentences"
        editable={!busy}
      />

      <DateTimeField
        label="Début de la soirée"
        kind="start"
        value={draft.startsAt}
        onChangeText={value => update('startsAt', value)}
        disabled={busy}
      />

      <DateTimeField
        label="Fin de la soirée"
        kind="end"
        value={draft.endsAt}
        onChangeText={value => update('endsAt', value)}
        disabled={busy}
      />

      <Notice>
        Les heures sont celles de ton téléphone.
        Elles sont converties en UTC lors de l’enregistrement.
      </Notice>

      <EventVisibilityChoice
        visibility={draft.visibility}
        disabled={busy}
        onChange={value => update('visibility', value)}
      />
    </>
  )
}
