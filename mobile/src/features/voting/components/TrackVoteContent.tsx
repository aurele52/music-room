import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { TrackVoteState } from '../hooks/useTrackVote'
import VotePermissions from './VotePermissions'
import TrackProposalForm from './TrackProposalForm'
import TrackRanking from './TrackRanking'

export default function TrackVoteContent({
  state
}: { state: TrackVoteState }) {
  const {
    eventId,
    listing,
    loading,
    error,
    message,
    load
  } = state

  return (
    <Screen
      title="Musique de la soirée"
      subtitle="Classement et votes des morceaux proposés."
    >
      <Action
        label="Retour à l'événement"
        secondary
        onPress={() => router.replace({
          pathname: '/event/[id]',
          params: { id: eventId }
        })}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? (
        <>
          <Notice error>{error}</Notice>
          <Action
            label="Réessayer"
            secondary
            disabled={loading}
            onPress={() => { void load() }}
          />
        </>
      ) : null}

      {message ? <Notice>{message}</Notice> : null}

      {!loading && listing ? (
        <>


          <VotePermissions listing={listing} />

          <TrackProposalForm state={state} />

          <TrackRanking state={state} />

        </>
      ) : null}
    </Screen>
  )
}
