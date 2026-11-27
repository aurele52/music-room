import EventCard from './EventCard'
import type { MusicEvent } from '../types'

type Props = {
  events: MusicEvent[]
  loading: boolean
  onOpen: (id: string) => void
}

export default function EventList({
  events, loading, onOpen
}: Props) {
  return (
    <div className="event-list">
      <h3>Événements organisés ({events.length})</h3>

      {loading && <p className="notice">Chargement...</p>}

      {!loading && events.length === 0 && (
        <p className="notice">Tu n'organises aucun événement.</p>
      )}

      {events.map(event => (
        <EventCard
          key={event.id}
          event={event}
          onOpen={() => onOpen(event.id)}
        />
      ))}
    </div>
  )
}
