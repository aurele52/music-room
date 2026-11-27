import { useLocalSearchParams } from 'expo-router'
import { Authenticated } from '../auth/Authenticated'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { useLiveSession } from './hooks/useLiveSession'
import LiveSessionContent from './components/LiveSessionContent'

function SessionContent() {
  const state = useLiveSession()

  return <LiveSessionContent state={state} />
}

function SessionBoundContent() {
  const { session } = useSession()
  const { eventId: rawId } = useLocalSearchParams<{
    eventId: string
  }>()

  const eventId = typeof rawId === 'string' ? rawId : ''
  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <SessionContent key={accessScopeKey(token, eventId)} />
  )
}

export default function EventSession() {
  return (
    <Authenticated>
      <SessionBoundContent />
    </Authenticated>
  )
}
