import { useFriends } from './hooks/useFriends'
import FriendList from './components/FriendList'
import ReceivedRequests from './components/ReceivedRequests'
import SentRequests from './components/SentRequests'
import type { Props } from './types'

type FriendsProps = Props & {
  view?: 'all' | 'friends' | 'requests'
}

export default function Friends({
  view = 'all',
  ...props
}: FriendsProps) {
  const state = useFriends(props)
  const { loading, error, message } = state

  return (
    <section className="profile">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {loading ? (
        <p className="notice">Chargement des amis...</p>
      ) : (
        <>
          {view !== 'friends' && (
            <>
              <ReceivedRequests state={state} />
              <SentRequests state={state} />
            </>
          )}

          {view !== 'requests' && <FriendList state={state} />}
        </>
      )}
    </section>
  )
}
