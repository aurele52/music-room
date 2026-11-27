import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type { LiveSessionState } from '../hooks/useLiveSession'
import { styles } from './playerStyles'

export default function PrepareSession({
  state
}: { state: LiveSessionState }) {
  const {
    data,
    live,
    canControl,
    start
  } = state

  if (!data?.canControl) return null

  return (
        <View style={styles.card}>
          <Text style={styles.heading}>
            Préparer une session
          </Text>
          <Text style={styles.muted}>
            Une nouvelle session remplace la précédente.
          </Text>

          <Action
            label={live
              ? 'Relancer depuis le classement'
              : 'Démarrer depuis le classement'}
            disabled={!canControl}
            onPress={start}
          />
        </View>

  )
}
