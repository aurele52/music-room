import type { DiscoveryState } from './useEventDiscovery'

export default function DiscoveryResults({
  state
}: { state: DiscoveryState }) {
  const {
    loading, page, events, opening,
    openEvent, setPage, hasMore
  } = state

  return (
    <>
      {loading ? (
        <p className="notice">Chargement des événements...</p>
      ) : (
        <>
          <p className="notice">
            Page {page} — {events.length} événement(s)
          </p>

          {events.length === 0 && (
            <p className="notice">
              Aucun événement public trouvé.
            </p>
          )}

          {events.map((event) => (
            <div className="event-item" key={event.id}>
              <h3>{event.title}</h3>
              <p>Organisé par {event.organizer.name}</p>
              {event.location && <p>Lieu : {event.location}</p>}
              <p>
                Début : {new Date(event.startsAt).toLocaleString('fr-FR')}
              </p>

              <button
                type="button"
                className="secondary"
                disabled={opening}
                onClick={() => { void openEvent(event) }}
              >
                Voir les détails
              </button>
            </div>
          ))}

          <div className="event-pagination">
            <button
              type="button"
              className="secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Précédent
            </button>

            <span>Page {page}</span>

            <button
              type="button"
              className="secondary"
              disabled={loading || !hasMore || page >= 50}
              onClick={() => setPage((value) => value + 1)}
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </>

  )
}
