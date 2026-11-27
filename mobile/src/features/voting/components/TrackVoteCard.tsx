import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import { mobileCanVote } from '../../../lib/musicActions'
import type { MusicTrack } from '../../../lib/musicTracks'
import type { TrackVoteState } from '../hooks/useTrackVote'
import { styles } from './votingStyles'

interface Props {
  state: TrackVoteState
  track: MusicTrack
  index: number
}

export default function TrackVoteCard({
  state,
  track,
  index
}: Props) {
  const {
    listing,
    loading,
    busy,
    toggleVote
  } = state

  if (!listing) return null

  return (
            <View
              key={track.id}
              style={styles.track}
            >
              <Text style={styles.rank}>
                #{index + 1}
              </Text>

              <Text style={styles.title}>
                {track.title}
              </Text>

              <Text style={styles.detail}>
                {track.artist}
              </Text>

              <Text style={styles.detail}>
                {track.votes} vote(s)
              </Text>

              {track.myVote ? (
                <Text style={styles.voted}>
                  Tu as voté pour ce morceau.
                </Text>
              ) : null}

              {track.proposer ? (
                <Text style={styles.detail}>
                  Proposé par {track.proposer.name}
                </Text>
              ) : null}

              {mobileCanVote(listing) ? (
                <Action
                  label={track.myVote
                    ? 'Retirer mon vote'
                    : 'Voter pour ce morceau'}
                  secondary={track.myVote}
                  disabled={busy || loading}
                  onPress={() => toggleVote(
                    track.id,
                    track.myVote
                  )}
                />
              ) : null}
            </View>

  )
}
