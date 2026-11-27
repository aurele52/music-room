import LiveSession from '../../player/LiveSession'
import TrackVote from '../../voting/TrackVote'
import PendingEventInvitation from './PendingEventInvitation'
import EventAccessLogin from './EventAccessLogin'
import { useEventAccess } from './useEventAccess'

export { readEventLink } from './eventAccess'

export function EventDeepLink() {
  const {
    eventId, token, gate,
    retry, requireLogin, onAuthError, close
  } = useEventAccess()

  if (!eventId) return null

  if (gate === 'login') {
    return <EventAccessLogin token={token} close={close} />
  }

  return (
    <div
      className="music-deeplink-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Accès à une soirée"
    >
      <div className="music-deeplink-content">
        <div className="music-deeplink-header">
          <h2>Rejoindre une soirée</h2>

          <button
            type="button"
            className="secondary"
            onClick={close}
          >
            Retour à Music Room
          </button>
        </div>

        {gate === 'loading' && (
          <div role="status" className="music-access-status">
            <h3>Vérification de ton accès</h3>
            <p>Nous vérifions les permissions de la soirée.</p>
          </div>
        )}

        {gate === 'denied' && (
          <div role="alert" className="music-access-status">
            <h3>Accès indisponible</h3>
            <p>
              Cette soirée est introuvable ou ton compte n'a
              pas la permission de la consulter.
            </p>
            <p>
              Si tu attends une invitation, tu peux
              l'accepter directement depuis ce lien.
              Sinon, contacte l'organisateur.
            </p>

            <PendingEventInvitation
              eventId={eventId}
              token={token}
              onAccepted={retry}
              onUnauthorized={requireLogin}
            />
            <button
              type="button"
              onClick={retry}
            >
              Réessayer après avoir obtenu l'accès
            </button>
          </div>
        )}

        {gate === 'error' && (
          <div role="alert" className="music-access-status">
            <h3>Vérification impossible</h3>
            <p>
              Impossible de vérifier ton accès pour le moment.
              Vérifie ta connexion et réessaie.
            </p>
            <button type="button" onClick={retry}>
              Réessayer
            </button>
          </div>
        )}

        {gate === 'allowed' && (
          <>
            <p className="music-access-granted" role="status">
              Accès à la soirée autorisé.
            </p>

            <LiveSession
              eventId={eventId}
              token={token}
              onAuthError={onAuthError}
            />

            <TrackVote
              eventId={eventId}
              token={token}
              onAuthError={onAuthError}
            />
          </>
        )}
      </div>
    </div>
  )
}
