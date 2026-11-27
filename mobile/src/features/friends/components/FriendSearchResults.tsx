import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import {
  relationStatus,
  canRequestFriend
} from '../../../lib/socialFriends'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function FriendSearchResults({
  state
}: { state: FriendsState }) {
  const {
    searched,
    results,
    lists,
    busy,
    opening,
    disabled,
    openProfile,
    sendRequest
  } = state

  const statusLabels = {
    FRIEND: 'Déjà ami',
    INCOMING: 'Demande reçue',
    OUTGOING: 'Demande envoyée',
    NONE: 'Aucune relation'
  }


  return (
    <>
      {searched && results.length === 0 ? (
        <Notice>Aucun utilisateur accessible trouvé.</Notice>
      ) : null}

      {results.map(user => (
        <View key={user.id} style={styles.card}>
          <Text style={styles.name}>{user.name}</Text>

          {lists ? (
            <Notice>
              {statusLabels[relationStatus(lists, user.id)]}
            </Notice>
          ) : null}

          <Action
            label="Voir le profil"
            secondary
            disabled={busy || opening}
            onPress={() => { void openProfile(user.id) }}
          />

          {lists && canRequestFriend(user, lists) ? (
            <Action
              label="Ajouter en ami"
              disabled={disabled}
              onPress={() => sendRequest(user.id)}
            />
          ) : null}
        </View>
      ))}

    </>
  )
}
