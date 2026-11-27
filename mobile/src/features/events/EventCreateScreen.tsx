import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useEventCreate } from './hooks/useEventCreate'
import EventCreateContent from './components/EventCreateContent'

function CreateContent() {
  const state = useEventCreate()

  return <EventCreateContent state={state} />
}

function BoundCreateContent() {
  const { session } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <CreateContent
      key={accessScopeKey(token, 'event-create')}
    />
  )
}

export default function NewEvent() {
  return (
    <Authenticated>
      <BoundCreateContent />
    </Authenticated>
  )
}
