import SessionAudio from '../SessionAudio'
import type { LiveSessionState } from '../hooks/useLiveSession'

export default function SessionControls({
  state
}: { state: LiveSessionState }) {
  const { session, current, data, disabled, control } = state

  return (
    <>
      {session && (
        <div className="music-live-current">
          <p>
            {session.state === 'PLAYING'
              ? 'En lecture'
              : session.state === 'PAUSED'
                ? 'En pause'
                : 'Session arrêtée'}
          </p>

          <h4>{current?.title ?? 'Aucun morceau'}</h4>
          <p>{current?.artist}</p>

          {data.canControl &&
            session.state !== 'STOPPED' &&
            current?.audioUrl && (
              <SessionAudio
                key={`${session.id}:${current.id}`}
                url={current.audioUrl}
                playing={session.state === 'PLAYING'}
                onEnded={() => control('ended')}
              />
            )}

          {current && !current.audioUrl && (
            <p className="notice">
              Aucun fichier audio disponible pour ce morceau.
            </p>
          )}

          {data.canControl &&
            session.state !== 'STOPPED' && (
              <div className="music-live-controls">
                <button
                  disabled={disabled}
                  onClick={() => control(
                    session.state === 'PLAYING'
                      ? 'pause'
                      : 'play'
                  )}
                >
                  {session.state === 'PLAYING'
                    ? 'Pause'
                    : 'Lecture'}
                </button>

                <button
                  disabled={disabled}
                  onClick={() => control('next')}
                >
                  Suivant
                </button>

                <button
                  disabled={disabled}
                  onClick={() => control('stop')}
                >
                  Arrêter
                </button>
              </div>
            )}
        </div>
      )}
    </>

  )
}
