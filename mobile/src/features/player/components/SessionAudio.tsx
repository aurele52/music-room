import { StyleSheet, Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import {
  useSessionAudio,
  type SessionAudioProps
} from '../hooks/useSessionAudio'
import AudioProgress from './AudioProgress'

export default function SessionAudio({
  url,
  playing,
  canReportEnd,
  onEnded
}: SessionAudioProps) {
  const {
    status,
    error,
    update,
    duration,
    position,
    progress
  } = useSessionAudio({
    url,
    playing,
    canReportEnd,
    onEnded
  })

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Lecteur audio local</Text>

      <Notice>
        {!status.isLoaded
          ? 'Chargement du fichier audio…'
          : status.playing
            ? 'Audio en lecture'
            : playing
              ? 'Audio chargé, lecture inactive'
              : 'Audio en pause'}
      </Notice>


      <AudioProgress
        position={position}
        duration={duration}
        progress={progress}
      />

      {error ? <Notice error>{error}</Notice> : null}

      {playing && !status.playing ? (
        <Action
          label="Activer le son"
          secondary
          onPress={update}
        />
      ) : null}

      <Text selectable style={styles.url}>{url}</Text>
    </View>
  )
}


const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderColor: theme.border,
    borderWidth: 1
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text
  },
  url: {
    color: theme.muted,
    fontSize: 11
  }
})
