import { Authenticated } from '../auth/Authenticated'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { useEvents } from './hooks/useEvents'
import EventsContent from './components/EventsContent'

function EventsScreenContent() {
  const state = useEvents()

  return <EventsContent state={state} />
}

function BoundEventsContent() {
  const { session } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <EventsScreenContent
      key={accessScopeKey(token, 'events')}
    />
  )
}

export default function Events() {
  return (
    <Authenticated>
      <BoundEventsContent />
    </Authenticated>
  )
}
