import { Authenticated } from '../auth/Authenticated'
import { useSession } from '../../session/SessionProvider'
import { useFriends } from './hooks/useFriends'
import FriendsContentView from './components/FriendsContent'

function FriendsContent({ token }: { token: string }) {
  const state = useFriends(token)

  return <FriendsContentView state={state} />
}

function SessionFriends() {
  const { session } = useSession()

  if (session.status !== 'authenticated') return null

  return (
    <FriendsContent
      key={session.token}
      token={session.token}
    />
  )
}

export default function Friends() {
  return (
    <Authenticated>
      <SessionFriends />
    </Authenticated>
  )
}
