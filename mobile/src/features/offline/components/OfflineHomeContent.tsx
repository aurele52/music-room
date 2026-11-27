import { Screen } from '../../../ui/Screen'
import { Notice } from '../../../ui/Controls'
import type {
  OfflineHomeState
} from '../hooks/useOfflineHome'
import CachedEventCard from './CachedEventCard'
import OfflineHomeActions from './OfflineHomeActions'

export default function OfflineHomeContent({
  state
}: { state: OfflineHomeState }) {
  const {
    events,
    loading,
    error
  } = state

  return (
    <Screen
      title="Mode hors ligne"
      subtitle="Retrouve tes playlists sauvegardées."
    >
      <Notice>
        Connexion indisponible. Les données locales
        peuvent être obsolètes.
      </Notice>

      {loading ? (
        <Notice>Lecture du stockage local…</Notice>
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}

      {!loading && !error && events.length === 0 ? (
        <Notice>
          Aucune playlist sauvegardée disponible.
          Consulte une soirée publique en ligne pour
          enregistrer ses playlists sur cet appareil.
        </Notice>
      ) : null}


      {events.map(event => (
        <CachedEventCard
          key={event.eventId}
          event={event}
          state={state}
        />
      ))}

      <OfflineHomeActions state={state} />
    </Screen>
  )
}
