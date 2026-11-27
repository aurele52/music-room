import { useLocalSearchParams } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useEventDetail } from './hooks/useEventDetail'
import EventDetailContent from './components/EventDetailContent'

function DetailContent() {
  const state = useEventDetail()

  return <EventDetailContent state={state} />
}

function BoundDetailContent() {
  const { session } = useSession()
  const { id: rawId } = useLocalSearchParams<{
    id: string
  }>()

  const id = typeof rawId === 'string' ? rawId : ''

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <DetailContent key={accessScopeKey(token, id)} />
  )
}

export default function EventDetail() {
  return (
    <Authenticated>
      <BoundDetailContent />
    </Authenticated>
  )
}
