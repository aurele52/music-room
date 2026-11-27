import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type {
  CachedEvent
} from '../../../lib/offline/cachedEvents'
import { OfflinePlaylistEditor } from '../OfflinePlaylistEditor'
import type {
  OfflineHomeState
} from '../hooks/useOfflineHome'
import { styles } from './offlineHomeStyles'

interface Props {
  event: CachedEvent
  state: OfflineHomeState
}

export default function CachedEventCard({
  event,
  state
}: Props) {
  const { eventId, snapshot } = event

  const {
    userId,
    selected,
    toggleEvent
  } = state

  const opened = selected === eventId

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {snapshot.eventTitle || 'Événement sauvegardé'}
      </Text>

      <Text style={styles.detail}>
        {snapshot.listing.playlists.length} playlist(s)
      </Text>

      <Text style={styles.detail}>
        Dernière synchronisation :
        {' '}{new Date(snapshot.cachedAt).toLocaleString('fr-FR')}
      </Text>

      <Action
        label={opened
          ? 'Masquer les playlists'
          : 'Consulter les playlists'}
        secondary
        onPress={() => toggleEvent(eventId)}
      />

      {opened ? (
        <OfflinePlaylistEditor
          key={`${userId}:${eventId}:${snapshot.cachedAt}`}
          userId={userId}
          eventId={eventId}
          snapshot={snapshot}
        />
      ) : null}
    </View>
  )
}
