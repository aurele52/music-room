import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useInvitations } from './hooks/useInvitations'
import InvitationsContent from './components/InvitationsContent'

function InboxContent() {
  const state = useInvitations()

  return <InvitationsContent state={state} />
}

function BoundInboxContent() {
  const { session } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <InboxContent
      key={accessScopeKey(token, 'invitations')}
    />
  )
}

export default function Invitations() {
  return (
    <Authenticated>
      <BoundInboxContent />
    </Authenticated>
  )
}
