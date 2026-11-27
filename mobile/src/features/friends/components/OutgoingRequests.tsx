import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function OutgoingRequests({
  state
}: { state: FriendsState }) {
  const {
    lists,
    disabled,
    cancelRequest
  } = state

  if (!lists) return null

  return (
    <>
      <Text style={styles.heading}>
        Demandes envoyées ({lists.outgoing.length})
      </Text>

      {lists.outgoing.length === 0 ? (
        <Notice>Aucune demande en attente.</Notice>
      ) : null}

      {lists.outgoing.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.user.name}</Text>

          <Action
            label="Annuler la demande"
            secondary
            disabled={disabled}
            onPress={() => cancelRequest(item.id)}
          />
        </View>
      ))}

    </>
  )
}
