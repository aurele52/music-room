import { useLocalSearchParams } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useEventEdit } from './hooks/useEventEdit'
import EventEditContent from './components/EventEditContent'

function EditContent() {
  const state = useEventEdit()

  return <EventEditContent state={state} />
}

function BoundEditContent() {
  const { session } = useSession()
  const { id: rawId } = useLocalSearchParams<{
    id: string
  }>()

  const id = typeof rawId === 'string' ? rawId : ''

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <EditContent key={accessScopeKey(token, id)} />
  )
}

export default function EditEvent() {
  return (
    <Authenticated>
      <BoundEditContent />
    </Authenticated>
  )
}
