import { useLocalSearchParams } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useMusicPolicy } from './hooks/useMusicPolicy'
import MusicPolicyContent from './components/MusicPolicyContent'

function PolicyContent() {
  const state = useMusicPolicy()

  return <MusicPolicyContent state={state} />
}

function BoundPolicyContent() {
  const { session } = useSession()
  const { id: rawId } = useLocalSearchParams<{
    id: string
  }>()

  const id = typeof rawId === 'string' ? rawId : ''

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <PolicyContent key={accessScopeKey(token, id)} />
  )
}

export default function EventMusicPolicies() {
  return (
    <Authenticated>
      <BoundPolicyContent />
    </Authenticated>
  )
}
