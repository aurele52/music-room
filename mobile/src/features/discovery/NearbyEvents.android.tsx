import { useSession } from '../../session/SessionProvider'
import {
  useNearbyEvents
} from './hooks/useNearbyEvents.android'

export default function NearbyEvents() {
  const { session } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : ''

  useNearbyEvents(token)

  return null
}
