import EventMusicTabs from '../components/EventMusicTabs'
import type { DiscoveryState } from './useEventDiscovery'
import type { Props } from './types'

export default function DiscoveryDetail({
  state, token, onAuthError
}: Props & { state: DiscoveryState }) {
  const { selected, setSelected } = state

  if (!selected) return null

  return (
    <div className="event-discovery-detail">
      <h3>{selected.title}</h3>
      <p>Organisateur : {selected.organizer.name}</p>
      <p>{selected.description || 'Sans description'}</p>
      {selected.location && <p>Lieu : {selected.location}</p>}
      <p>
        Début : {new Date(selected.startsAt).toLocaleString('fr-FR')}
      </p>
      <p>
        Fin : {new Date(selected.endsAt).toLocaleString('fr-FR')}
      </p>
      <p className="notice">
        Les actions musicales dépendent des permissions
        définies par l'organisateur.
      </p>



      <EventMusicTabs
        eventId={selected.id}
        token={token}
        onAuthError={onAuthError}
      />

      <button
        type="button"
        className="secondary"
        onClick={() => setSelected(null)}
      >
        Fermer
      </button>
    </div>

  )
}
