import { EventShare } from '../events/sharing/EventShare'
import SessionControls from './components/SessionControls'
import { useLiveSession } from './hooks/useLiveSession'
import type { Props } from './types'

export default function LiveSession(props: Props) {
  return (
    <SessionContent
      key={`${props.eventId}:${props.token}`}
      {...props}
    />
  )
}


function SessionContent(props: Props) {
  const state = useLiveSession(props)
  const { eventId } = props
  const { data, session, loading, error, disabled, start } = state

  return (
    <section className="music-live-session">
      <h3>Session musicale</h3>

      <EventShare eventId={eventId} />

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !session && (
        <p>Aucune session musicale n'a encore été lancée.</p>
      )}

      {data.finished && <p>Événement terminé.</p>}

      {data.canControl && (
        <button disabled={disabled} onClick={start}>
          {session
            ? 'Relancer depuis le classement'
            : 'Démarrer depuis le classement'}
        </button>
      )}

      <SessionControls state={state} />

      <p className="notice">
        Le prochain morceau est choisi selon les votes.
        Les morceaux du catalogue sont diffusés sur le lecteur de l’organisateur.
      </p>
    </section>
  )
}
