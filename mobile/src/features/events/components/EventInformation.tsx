import { Text, View } from 'react-native'
import type { MusicEvent } from '../../../lib/api'
import { styles } from './eventDetailStyles'

function formatDate(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Date indisponible'
    : date.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short'
      })
}


export default function EventInformation({
  event
}: { event: MusicEvent }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Début</Text>
      <Text style={styles.value}>
        {formatDate(event.startsAt)}
      </Text>

      <Text style={styles.label}>Fin</Text>
      <Text style={styles.value}>
        {formatDate(event.endsAt)}
      </Text>

      <Text style={styles.label}>Lieu</Text>
      <Text style={styles.value}>
        {event.location || 'Non renseigné'}
      </Text>

      <Text style={styles.label}>Visibilité</Text>
      <Text style={styles.value}>
        {event.visibility === 'PUBLIC'
          ? 'Événement public'
          : 'Événement privé'}
      </Text>

      {event.organizer?.name ? (
        <>
          <Text style={styles.label}>Organisateur</Text>
          <Text style={styles.value}>
            {event.organizer.name}
          </Text>
        </>
      ) : null}

      {event.description ? (
        <>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>
            {event.description}
          </Text>
        </>
      ) : null}
    </View>

  )
}
