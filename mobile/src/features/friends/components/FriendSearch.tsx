import { Text } from 'react-native'
import { Action, Field } from '../../../ui/Controls'
import type { FriendsState } from '../hooks/useFriends'
import { styles } from './friendsStyles'

export default function FriendSearch({
  state
}: { state: FriendsState }) {
  const {
    query,
    busy,
    searching,
    changeQuery,
    search
  } = state

  return (
    <>
      <Text style={styles.heading}>Rechercher</Text>

      <Field
        label="Nom de l'utilisateur"
        value={query}
        maxLength={50}
        editable={!busy}
        returnKeyType="search"
        onChangeText={changeQuery}
        onSubmitEditing={() => { void search() }}
      />

      <Action
        label={searching ? 'Recherche…' : 'Rechercher'}
        disabled={
          searching || busy || query.trim().length < 2
        }
        onPress={() => { void search() }}
      />

    </>
  )
}
