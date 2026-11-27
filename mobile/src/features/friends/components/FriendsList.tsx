import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function FriendsList({
  state
}: { state: FriendsState }) {
  const {
    lists,
    busy,
    opening,
    disabled,
    openProfile,
    deleteFriend
  } = state

  if (!lists) return null

  return (
    <>
      <Text style={styles.heading}>
        Mes amis ({lists.friends.length})
      </Text>

      {lists.friends.length === 0 ? (
        <Notice>Tu n’as pas encore d’amis.</Notice>
      ) : null}

      {lists.friends.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.user.name}</Text>

          {item.user.visibility !== 'PRIVATE' ? (
            <Action
              label="Voir le profil"
              secondary
              disabled={busy || opening}
              onPress={() => {
                void openProfile(item.user.id)
              }}
            />
          ) : (
            <Notice>Profil privé.</Notice>
          )}

          <Action
            label="Supprimer cet ami"
            secondary
            disabled={disabled}
            onPress={() => deleteFriend(item.user.id)}
          />
        </View>
      ))}

    </>
  )
}
