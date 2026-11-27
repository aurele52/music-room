import { useEventInvitations } from './useEventInvitations'
import InvitationList from './InvitationList'
import ParticipationList from './ParticipationList'
import type { Props } from './types'

export default function EventInvitations(props: Props) {
  const state = useEventInvitations(props)
  const { loading, error, message } = state

  return (
    <section className="profile">
      <h2>Mes invitations aux événements</h2>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {loading ? (
        <p className="notice">Chargement...</p>
      ) : (
        <>
          <InvitationList state={state} />
          <ParticipationList state={state} {...props} />
        </>
      )}
    </section>
  )
}
