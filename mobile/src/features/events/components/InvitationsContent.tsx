import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { InvitationsState } from '../hooks/useInvitations'
import InvitationCard from './InvitationCard'

export default function InvitationsContent({
  state
}: { state: InvitationsState }) {
  const {
    invitations,
    loading,
    error
  } = state

  return (
    <Screen
      title="Mes invitations"
      subtitle="Accepte, refuse ou quitte une soirée."
    >
      <Action
        label="Retour aux événements"
        secondary
        onPress={() => router.replace('/events')}
      />

      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <Notice error>{error}</Notice> : null}
      {!loading && invitations.length === 0 ? (
        <Notice>Aucune invitation reçue.</Notice>
      ) : null}


      {invitations.map(invitation => (
        <InvitationCard
          key={invitation.id}
          invitation={invitation}
          state={state}
        />
      ))}

    </Screen>
  )
}
