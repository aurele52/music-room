import { useState } from 'react'
import EventInvitations from './invitations/EventInvitations'
import EventForm from './components/EventForm'
import EventList from './components/EventList'
import EventDetail from './components/EventDetail'
import { useEvents } from './hooks/useEvents'
import type { Props } from './types'

type View = 'list' | 'create' | 'edit' | 'detail' | 'invitations'

export default function Events({ token, onAuthError }: Props) {
  return (
    <EventsContent
      key={token}
      token={token}
      onAuthError={onAuthError}
    />
  )
}

function EventsContent({ token, onAuthError }: Props) {
  const state = useEvents({ token, onAuthError })
  const { events, loading, error, message } = state
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = events.find(event => event.id === selectedId)

  function goList() {
    state.resetForm()
    setSelectedId(null)
    setView('list')
  }

  function openEvent(id: string) {
    setSelectedId(id)
    setView('detail')
  }

  function openCreate() {
    state.resetForm()
    setView('create')
  }

  async function save(event: Parameters<typeof state.save>[0]) {
    const successful = await state.save(event)

    if (successful) {
      setView(view === 'edit' ? 'detail' : 'list')
    }

    return successful
  }

  return (
    <section className="events-page">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {(view === 'list' || view === 'invitations') && (
        <>
          <div className="feature-toolbar">
            <h2>Mes événements musicaux</h2>
            <button onClick={openCreate}>+ Créer un événement</button>
          </div>

          <nav className="feature-tabs" aria-label="Mes événements">
            <button
              className={view === 'list' ? 'active' : ''}
              aria-current={view === 'list' ? 'page' : undefined}
              onClick={goList}
            >
              Mes soirées
            </button>
            <button
              className={view === 'invitations' ? 'active' : ''}
              aria-current={view === 'invitations' ? 'page' : undefined}
              onClick={() => setView('invitations')}
            >
              Invitations et participations
            </button>
          </nav>
        </>
      )}

      {view === 'list' && (
        <EventList
          events={events}
          loading={loading}
          onOpen={openEvent}
        />
      )}

      {view === 'invitations' && (
        <EventInvitations
          token={token}
          onAuthError={onAuthError}
        />
      )}

      {(view === 'create' || view === 'edit') && (
        <section className="profile event-form-page">
          <button className="link" onClick={goList}>
            Retour aux événements
          </button>

          <EventForm
            state={{
              ...state,
              save,
              resetForm: goList
            }}
          />
        </section>
      )}

      {view === 'detail' && selected && (
        <EventDetail
          key={selected.id}
          event={selected}
          token={token}
          onAuthError={onAuthError}
          working={state.working}
          onBack={goList}
          onEdit={() => {
            state.startEditing(selected)
            setView('edit')
          }}
          onRemove={async () => {
            const removed = await state.remove(selected)
            if (removed) goList()
          }}
        />
      )}

      {view === 'detail' && !selected && (
        <section className="profile">
          <p>Événement indisponible.</p>
          <button onClick={goList}>Retour aux événements</button>
        </section>
      )}
    </section>
  )
}
