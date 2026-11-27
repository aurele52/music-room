import { useEventParticipants } from './useEventParticipants'
import InviteFriendForm from './InviteFriendForm'
import ParticipantList from './ParticipantList'
import type { Props } from './types'

export default function EventParticipants(props: Props) {
  const state = useEventParticipants(props)
  const { loading, error, message } = state

  return (
    <div className="event-participants">
      <h4>Invitations et participants</h4>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {loading ? (
        <p className="notice">Chargement des participants...</p>
      ) : (
        <>
          <InviteFriendForm state={state} eventId={props.eventId} />
          <ParticipantList state={state} />
        </>
      )}
    </div>
  )
}
