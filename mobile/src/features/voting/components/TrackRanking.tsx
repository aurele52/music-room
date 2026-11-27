import { Notice } from '../../../ui/Controls'
import type { TrackVoteState } from '../hooks/useTrackVote'
import TrackVoteCard from './TrackVoteCard'

export default function TrackRanking({
  state
}: { state: TrackVoteState }) {
  const { listing } = state

  if (!listing) return null

  return (
    <>
          {listing.tracks.length === 0 ? (
            <Notice>
              Aucun morceau proposé pour cet événement.
            </Notice>
          ) : null}


      {listing.tracks.map((track, index) => (
        <TrackVoteCard
          key={track.id}
          state={state}
          track={track}
          index={index}
        />
      ))}
    </>
  )
}
