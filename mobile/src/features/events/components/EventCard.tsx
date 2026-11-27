import { Text, View } from 'react-native'
import { router } from 'expo-router'
import type { MusicEvent } from '../../../lib/api'
import { Action } from '../../../ui/Controls'
import { styles } from './eventListStyles'

export default function EventCard({ event }: { event: MusicEvent }) {
  const date = new Date(event.startsAt)

  return (
    <View style={styles.card}>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.detail}>
        {Number.isNaN(date.getTime())
          ? 'Date indisponible'
          : date.toLocaleString('fr-FR')}
      </Text>
      <Text style={styles.detail}>
        {event.location || 'Lieu non renseigné'}
      </Text>
      {event.organizer?.name ? (
        <Text style={styles.detail}>
          Organisé par {event.organizer.name}
        </Text>
      ) : null}
      <Action
        label="Voir la fiche"
        secondary
        onPress={() => router.push({
          pathname: '/event/[id]',
          params: { id: event.id }
        })}
      />
    </View>
  )
}
