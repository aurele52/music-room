import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { MusicPolicyState } from '../hooks/useMusicPolicy'
import AccessPolicies from './AccessPolicies'
import VotingSchedule from './VotingSchedule'
import LocationPolicy from './LocationPolicy'

export default function MusicPolicyContent({
  state
}: { state: MusicPolicyState }) {
  const {
    id,
    event,
    form,
    loading,
    busy,
    error,
    message,
    editable,
    save
  } = state

  return (
    <Screen
      title="Règles musicales"
      subtitle="Permissions et restrictions de la soirée"
    >
      <Action
        label="Retour à l'événement"
        secondary
        onPress={() => router.push({
          pathname: '/event/[id]',
          params: { id }
        })}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {event && !editable ? (
        <Notice>
          L’événement est terminé.
          Ses règles ne peuvent plus être modifiées.
        </Notice>
      ) : null}

      {form ? (
        <>


          <AccessPolicies state={state} />

          <VotingSchedule state={state} />

          <LocationPolicy state={state} />

          <Action
            label={busy
              ? 'Enregistrement…'
              : 'Enregistrer les règles musicales'}
            disabled={!editable || loading || busy}
            onPress={() => { void save() }}
          />
        </>
      ) : null}


    </Screen>
  )
}
