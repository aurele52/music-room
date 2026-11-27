import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { TrackVoteState } from '../hooks/useTrackVote'
import CatalogSelector from './CatalogSelector'
import { styles } from './votingStyles'

export default function TrackProposalForm({
  state
}: { state: TrackVoteState }) {
  const {
    listing,
    loading,
    busy,
    catalogError,
    availableTracks,
    selectedTrack,
    selectedId,
    setSelectedId,
    submitTrack
  } = state

  if (!listing?.canParticipate || listing.finished) {
    return null
  }

  return (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>
                  Proposer un morceau
                </Text>

                {catalogError ? (
                  <Notice error>{catalogError}</Notice>
                ) : null}

                {availableTracks.length === 0 ? (
                  <Notice>
                    Aucun nouveau morceau disponible.
                  </Notice>
                ) : null}

                <CatalogSelector
                  tracks={availableTracks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  disabled={busy || loading}
                />

                <Action
                  label={busy
                    ? 'Enregistrement…'
                    : 'Proposer ce morceau'}
                  disabled={busy || loading || !selectedTrack}
                  onPress={submitTrack}
                />
              </View>

  )
}
