import type { TrackVoteState } from '../hooks/useTrackVote'

export default function TrackRanking({
  state
}: { state: TrackVoteState }) {
  const {
    ranking, working, organizer,
    toggleVote, removeTrack
  } = state

  return (
    <ol className="track-ranking">
      {ranking.tracks.map((track) => (
        <li className="track-item" key={track.id}>
          <div className="track-info">
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
            <small>
              Proposé par {track.proposer.name}
            </small>
          </div>

          <div className="track-controls">
            <strong>
              {track.votes} vote{track.votes > 1 ? 's' : ''}
            </strong>

            {(ranking.canVote ?? ranking.canParticipate) && (
              <button
                type="button"
                disabled={working}
                className={track.myVote ? 'secondary' : undefined}
                onClick={() => { void toggleVote(track) }}
              >
                {track.myVote ? 'Retirer mon vote' : 'Voter'}
              </button>
            )}

            {organizer && !ranking.finished && (
              <button
                type="button"
                className="secondary"
                disabled={working}
                onClick={() => { void removeTrack(track) }}
              >
                Supprimer
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>

  )
}
