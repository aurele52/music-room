import { Authenticated } from '../auth/Authenticated'
import { useSession } from '../../session/SessionProvider'
import { useProfile } from './hooks/useProfile'
import ProfileContentView from './components/ProfileContent'

function ProfileContent() {
  const state = useProfile()

  return <ProfileContentView state={state} />
}

function SessionProfile() {
  const { session } = useSession()

  if (session.status !== 'authenticated') return null

  return <ProfileContent key={session.token} />
}

export default function Profile() {
  return (
    <Authenticated>
      <SessionProfile />
    </Authenticated>
  )
}
