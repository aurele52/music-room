import type { MusicEvent } from '../types'

type Props = {
  event: MusicEvent
  onOpen: () => void
}

export default function EventCard({ event, onOpen }: Props) {
  return (
    <button
      type="button"
      className="event-list-card"
      onClick={onOpen}
    >
      <span className="event-list-icon" aria-hidden="true">♫</span>

      <span className="event-list-info">
        <strong>{event.title}</strong>
        <span>{new Date(event.startsAt).toLocaleString('fr-FR')}</span>
        <small>
          {event.visibility === 'PUBLIC' ? 'Public' : 'Privé'}
          {event.location ? ' · ' + event.location : ''}
        </small>
      </span>

      <span aria-hidden="true">›</span>
    </button>
  )
}
