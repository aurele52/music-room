import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import FriendSearch from './FriendSearch'
import FriendSearchResults from './FriendSearchResults'
import FriendProfile from './FriendProfile'
import IncomingRequests from './IncomingRequests'
import OutgoingRequests from './OutgoingRequests'
import FriendsList from './FriendsList'

export default function FriendsContent({
  state
}: { state: FriendsState }) {
  const {
    lists,
    loading,
    error,
    message,
    load
  } = state

  return (
    <Screen
      title="Mes amis"
      subtitle="Retrouve tes amis et découvre des utilisateurs."
    >
      <Action
        label="Retour aux événements"
        secondary
        onPress={() => router.replace('/events')}
      />

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}


      <FriendSearch state={state} />
      <FriendSearchResults state={state} />
      <FriendProfile state={state} />

      {loading ? (
        <Notice>Chargement des relations…</Notice>
      ) : null}

      {!lists && !loading ? (
        <Action
          label="Réessayer"
          secondary
          onPress={() => { void load() }}
        />
      ) : null}


      <IncomingRequests state={state} />
      <OutgoingRequests state={state} />
      <FriendsList state={state} />

    </Screen>
  )
}
