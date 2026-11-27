import { useTrackVote } from './hooks/useTrackVote'
import TrackRanking from './components/TrackRanking'
import TrackProposalForm from './components/TrackProposalForm'
import type { Props } from './types'

export default function TrackVote(props: Props) {
  const state = useTrackVote(props)
  const { ranking, loading, error, message } = state

  return (
    <div className="track-vote">
      <h4>Music Track Vote</h4>

      <div className="track-toolbar">
        <span>
          {ranking.tracks.length} morceau(x)
        </span>


      </div>

      {ranking.finished && (
        <p className="notice">
          Événement terminé : le classement est définitif.
        </p>
      )}

      {!ranking.finished && !ranking.canParticipate && (
        <p className="notice">
          Tu peux consulter le classement.
          La licence actuelle ne te permet pas de proposer
          des morceaux.
          Le vote dépend également des restrictions de la soirée.
        </p>
      )}

      {!ranking.finished &&
        ranking.requiresLocation &&
        ranking.canVote && (
          <p className="notice">
            Cette soirée demande une position GPS lors du vote.
            Ton navigateur demandera ton autorisation au moment
            de voter ou de retirer ton vote.
          </p>
        )}

      {!ranking.finished &&
        ranking.canVote === false && (
          <p className="notice">
            Vote actuellement indisponible selon la licence
            ou les horaires de la soirée.
          </p>
        )}

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {loading ? (
        <p className="notice">Chargement du classement...</p>
      ) : (
        <>
          {ranking.tracks.length === 0 && (
            <p className="notice">
              Aucun morceau proposé pour le moment.
            </p>
          )}

          <TrackRanking state={state} />
        </>
      )}

      <TrackProposalForm state={state} eventId={props.eventId} />
    </div>
  )
}
