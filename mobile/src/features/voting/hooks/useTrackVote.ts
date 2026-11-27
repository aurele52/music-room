import { useTrackVoteData } from './useTrackVoteData'
import { useVoteActions } from './useVoteActions'

export function useTrackVote() {
  const data = useTrackVoteData()
  const actions = useVoteActions(data)

  return {
    ...data,
    ...actions
  }
}

export type TrackVoteState = ReturnType<typeof useTrackVote>
