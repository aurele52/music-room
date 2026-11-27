import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function IncomingRequests({
  state
}: { state: FriendsState }) {
  const {
    lists,
    disabled,
    acceptRequest,
    rejectRequest
  } = state

  if (!lists) return null

  return (
    <>
      <Text style={styles.heading}>
        Demandes reçues ({lists.incoming.length})
      </Text>

      {lists.incoming.length === 0 ? (
        <Notice>Aucune demande reçue.</Notice>
      ) : null}

      {lists.incoming.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.user.name}</Text>

          <Action
            label="Accepter"
            disabled={disabled}
            onPress={() => acceptRequest(item.id)}
          />

          <Action
            label="Refuser"
            secondary
            disabled={disabled}
            onPress={() => rejectRequest(item.id)}
          />
        </View>
      ))}

    </>
  )
}
