import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type { LiveSessionState } from '../hooks/useLiveSession'
import { styles } from './playerStyles'

export default function SessionControls({
  state
}: { state: LiveSessionState }) {
  const {
    data,
    live,
    canOperate,
    control
  } = state

  if (!data?.canControl || !live) return null

  return (
            <View style={styles.card}>
              <Text style={styles.heading}>Commandes</Text>
              <Action
                label="Lecture"
                disabled={!canOperate || live.state === 'PLAYING'}
                onPress={() => control('play')}
              />
              <Action
                label="Pause"
                secondary
                disabled={!canOperate || live.state === 'PAUSED'}
                onPress={() => control('pause')}
              />
              <Action
                label="Morceau suivant"
                secondary
                disabled={!canOperate}
                onPress={() => control('next')}
              />
              <Action
                label="Arrêter la session"
                secondary
                disabled={!canOperate}
                onPress={() => control('stop')}
              />
            </View>

  )
}
