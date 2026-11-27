import type { InvitationsState } from './useEventInvitations'

export default function InvitationList({
  state
}: { state: InvitationsState }) {
  const { pending, working, action } = state

  return (
    <>
      <h3>Invitations reçues ({pending.length})</h3>

      {pending.length === 0 && (
        <p className="notice">Aucune invitation en attente.</p>
      )}

      {pending.map((item) => (
        <div className="event-item" key={item.id}>
          <strong>{item.event.title}</strong>
          <p>Organisateur : {item.event.organizer.name}</p>
          <p>
            Début :{' '}
            {new Date(item.event.startsAt).toLocaleString('fr-FR')}
          </p>
          {item.event.location && (
            <p>Lieu : {item.event.location}</p>
          )}
          {item.event.description && (
            <p>{item.event.description}</p>
          )}

          <div className="friend-actions">
            <button
              type="button"
              disabled={working}
              onClick={() => {
                void action(
                  item,
                  'POST',
                  'Invitation acceptée.'
                )
              }}
            >
              Accepter
            </button>

            <button
              type="button"
              className="secondary"
              disabled={working}
              onClick={() => {
                void action(
                  item,
                  'DELETE',
                  'Invitation refusée.'
                )
              }}
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </>

  )
}
