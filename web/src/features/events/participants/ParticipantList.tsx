import type { ParticipantsState } from './useEventParticipants'

export default function ParticipantList({
  state
}: { state: ParticipantsState }) {
  const { participants, working, removeParticipant } = state

  return (
    <>
      <h4>Participants ({participants.length})</h4>

      {participants.length === 0 && (
        <p className="notice">
          Aucune invitation envoyée pour cet événement.
        </p>
      )}

      {participants.map((item) => (
        <div className="friend-item" key={item.id}>
          <div>
            <strong>{item.user.name}</strong>
            <p className="notice">
              {item.status === 'ACCEPTED'
                ? 'Participation confirmée'
                : 'Invitation en attente'}
            </p>
          </div>

          <button
            type="button"
            className="secondary"
            disabled={working}
            onClick={() => {
              void removeParticipant(item)
            }}
          >
            Retirer
          </button>
        </div>
      ))}
    </>

  )
}
