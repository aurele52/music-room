import type { EventForm as EventFormData } from '../types'
import type { EventsState } from '../hooks/useEvents'

export default function EventForm({
  state
}: { state: EventsState }) {
  const {
    editingId, form, working,
    save, updateField, resetForm
  } = state

  return (
    <>
      <h3>{editingId ? 'Modifier un événement' : 'Créer un événement'}</h3>

      <form className="form-content event-form" onSubmit={save}>
        <label htmlFor="event-title">Nom de l'événement</label>
        <input
          id="event-title"
          required
          minLength={3}
          maxLength={100}
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
        />

        <label htmlFor="event-description">Description</label>
        <textarea
          id="event-description"
          rows={3}
          maxLength={2000}
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />

        <label htmlFor="event-location">Lieu (facultatif)</label>
        <input
          id="event-location"
          maxLength={120}
          value={form.location}
          onChange={(e) => updateField('location', e.target.value)}
        />

        <label htmlFor="event-start">Début</label>
        <input
          id="event-start"
          type="datetime-local"
          required
          value={form.startsAt}
          onChange={(e) => updateField('startsAt', e.target.value)}
        />

        <label htmlFor="event-end">Fin</label>
        <input
          id="event-end"
          type="datetime-local"
          required
          value={form.endsAt}
          onChange={(e) => updateField('endsAt', e.target.value)}
        />

        <label htmlFor="event-visibility">Visibilité</label>
        <select
          id="event-visibility"
          value={form.visibility}
          onChange={(e) => updateField(
            'visibility',
            e.target.value as EventFormData['visibility']
          )}
        >
          <option value="PRIVATE">Privé</option>
          <option value="PUBLIC">Public</option>
        </select>

        <button type="submit" disabled={working}>
          {working
            ? 'Enregistrement...'
            : editingId ? 'Enregistrer les modifications' : 'Créer'}
        </button>

        {editingId && (
          <button
            type="button"
            className="secondary"
            disabled={working}
            onClick={resetForm}
          >
            Annuler la modification
          </button>
        )}
      </form>
    </>
  )
}
