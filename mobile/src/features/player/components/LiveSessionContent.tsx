import {
  ActivityIndicator,
  Text,
  View
} from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import { apiOrigin } from '../../../lib/api'
import type { LiveSessionState } from '../hooks/useLiveSession'
import CurrentTrack from './CurrentTrack'
import SessionAudio from './SessionAudio'
import SessionControls from './SessionControls'
import PrepareSession from './PrepareSession'
import { styles } from './playerStyles'

export default function LiveSessionContent({
  state
}: { state: LiveSessionState }) {
  const {
    eventId,
    data,
    loading,
    error,
    message,
    live,
    currentTrack,
    canOperate,
    control
  } = state

  return (
    <Screen
      title="Session musicale"
      subtitle="Lecture et suivi en direct de la soirée"
    >
      <Action
        label="Retour à l'événement"
        secondary
        onPress={() => router.push({
          pathname: '/event/[id]',
          params: { id: eventId }
        })}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {data?.finished ? (
        <Notice>L’événement est terminé.</Notice>
      ) : null}

      {data && !data.canControl ? (
        <Notice>
          Lecture consultable uniquement. Les commandes
          sont réservées à l’organisateur pendant la soirée.
        </Notice>
      ) : null}

      {data && !live ? (
        <View style={styles.card}>
          <Text style={styles.heading}>
            Aucune session en cours
          </Text>
          <Text style={styles.muted}>
            L’organisateur peut préparer une session
            depuis le classement des morceaux proposés.
          </Text>
        </View>
      ) : null}

      {live ? (
        <>


          <CurrentTrack state={state} />

          {data?.canControl &&
            live.state !== 'STOPPED' &&
            currentTrack?.audioUrl ? (
              <SessionAudio
                key={`${live.id}:${currentTrack.id}`}
                url={`${apiOrigin()}${currentTrack.audioUrl}`}
                playing={live.state === 'PLAYING'}
                canReportEnd={canOperate}
                onEnded={() => control('ended')}
              />
            ) : null}


          <SessionControls state={state} />
        </>
      ) : null}

      <PrepareSession state={state} />

      <Action
        label="Proposer des morceaux et voter"
        onPress={() => router.push({
          pathname: '/event/music',
          params: { eventId }
        })}
      />

      <Notice>
        Le prochain morceau est choisi selon les votes.
        Les morceaux du catalogue sont diffusés par le lecteur de l’organisateur.
      </Notice>

    </Screen>
  )
}
