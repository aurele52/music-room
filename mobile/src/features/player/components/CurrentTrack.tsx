import { Text, View } from 'react-native'
import { Notice } from '../../../ui/Controls'
import type { LiveSessionState } from '../hooks/useLiveSession'
import { styles } from './playerStyles'

function sessionStatus(state: string): string {
  switch (state) {
    case 'PLAYING': return 'En lecture'
    case 'PAUSED': return 'En pause'
    case 'STOPPED': return 'Arrêtée'
    default: return 'État inconnu'
  }
}


export default function CurrentTrack({
  state
}: { state: LiveSessionState }) {
  const { live, currentTrack } = state

  if (!live) return null

  return (
    <>
          <View style={styles.card}>
            <Text style={styles.heading}>
              Classement des votes
            </Text>
            <Text style={styles.muted}>
              {sessionStatus(live.state)}
            </Text>
            <Text style={styles.track}>
              {currentTrack
                ? `${currentTrack.title} — ${currentTrack.artist}`
                : 'Aucun morceau sélectionné'}
            </Text>
          </View>
          {currentTrack && !currentTrack.audioUrl ? (
            <Notice>
              Ce morceau ne possède aucun fichier audio.
              Passe au morceau suivant ou propose un morceau
              du catalogue puis relance la session.
            </Notice>
          ) : null}

    </>
  )
}
