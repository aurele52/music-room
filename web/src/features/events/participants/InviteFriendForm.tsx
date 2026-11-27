import type { ParticipantsState } from './useEventParticipants'

type Props = {
  state: ParticipantsState
  eventId: string
}

export default function InviteFriendForm({
  state, eventId
}: Props) {
  const {
    selectedId, setSelectedId,
    working, availableFriends, invite
  } = state

  return (
    <>
      <form className="event-invite-form" onSubmit={invite}>
        <label htmlFor={`event-friend-${eventId}`}>
          Inviter un ami
        </label>

        <select
          id={`event-friend-${eventId}`}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={working || availableFriends.length === 0}
        >
          <option value="">Choisir un ami</option>

          {availableFriends.map((item) => (
            <option key={item.user.id} value={item.user.id}>
              {item.user.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={working || !selectedId}
        >
          {working ? 'Envoi...' : 'Envoyer une invitation'}
        </button>
      </form>

      {availableFriends.length === 0 && (
        <p className="notice">
          Aucun ami supplémentaire à inviter.
        </p>
      )}
    </>

  )
}
