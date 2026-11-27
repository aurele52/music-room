import EventMusicTabs from '../components/EventMusicTabs'
import type { InvitationsState } from './useEventInvitations'
import type { Props } from './types'

export default function ParticipationList({
  state, token, onAuthError
}: Props & { state: InvitationsState }) {
  const {
    accepted, openEventId, setOpenEventId,
    working, action
  } = state

  return (
    <>
      <h3>Mes participations ({accepted.length})</h3>

      {accepted.length === 0 && (
        <p className="notice">
          Tu ne participes à aucun événement pour le moment.
        </p>
      )}

      {accepted.map((item) => (
        <div className="event-item" key={item.id}>
          <strong>{item.event.title}</strong>
          <p>Organisateur : {item.event.organizer.name}</p>
          <p>
            Début :{' '}
            {new Date(item.event.startsAt).toLocaleString('fr-FR')}
          </p>
          <p>
            Fin :{' '}
            {new Date(item.event.endsAt).toLocaleString('fr-FR')}
          </p>
          {item.event.location && (
            <p>Lieu : {item.event.location}</p>
          )}

          <div className="friend-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setOpenEventId((current) =>
                  current === item.event.id ? null : item.event.id
                )
              }}
            >
              {openEventId === item.event.id
                ? 'Fermer les morceaux'
                : 'Voir les morceaux et voter'}
            </button>

            <button
              type="button"
              className="secondary"
              disabled={working}
              onClick={() => {
                void action(
                  item,
                  'DELETE',
                  'Tu as quitté cet événement.'
                )
              }}
            >
              Quitter l'événement
            </button>
          </div>


          {openEventId === item.event.id && (
            <EventMusicTabs
              eventId={item.event.id}
              token={token}
              onAuthError={onAuthError}
            />
          )}
        </div>
      ))}
    </>

  )
}
