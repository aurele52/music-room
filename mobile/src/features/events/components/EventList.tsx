import { Text } from 'react-native'
import type { MusicEvent } from '../../../lib/api'
import { Notice } from '../../../ui/Controls'
import EventCard from './EventCard'
import { styles } from './eventListStyles'

interface Props {
  title: string
  events: MusicEvent[]
  loading: boolean
  emptyMessage: string
}

export default function EventList({
  title,
  events,
  loading,
  emptyMessage
}: Props) {
  return (
    <>
      <Text style={styles.heading}>{title}</Text>

      {!loading && events.length === 0 ? (
        <Notice>{emptyMessage}</Notice>
      ) : null}

      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </>
  )
}
