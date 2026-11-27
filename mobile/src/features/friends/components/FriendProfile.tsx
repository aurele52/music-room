import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function FriendProfile({
  state
}: { state: FriendsState }) {
  const {
    opening,
    selected,
    closeProfile
  } = state

  return (
    <>
      {opening ? (
        <Notice>Chargement du profil…</Notice>
      ) : null}

      {selected ? (
        <View style={styles.card}>
          <Text style={styles.name}>{selected.name}</Text>

          <Notice>
            {selected.visibility === 'PUBLIC'
              ? 'Profil public'
              : 'Profil réservé aux amis'}
          </Notice>

          {selected.publicBio ? (
            <Text style={styles.detail}>
              {selected.publicBio}
            </Text>
          ) : null}

          {selected.friendsBio ? (
            <>
              <Text style={styles.name}>
                Informations réservées aux amis
              </Text>
              <Text style={styles.detail}>
                {selected.friendsBio}
              </Text>
            </>
          ) : null}

          <Action
            label="Fermer le profil"
            secondary
            onPress={closeProfile}
          />
        </View>
      ) : null}

    </>
  )
}
