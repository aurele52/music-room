import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import {
  participationStatusLabel,
  participationActionLabel
} from '../../../lib/eventStatus'
import type { Invitation } from '../../../lib/eventParticipation'
import type { InvitationsState } from '../hooks/useInvitations'

interface Props {
  invitation: Invitation
  state: InvitationsState
}

export default function InvitationCard({
  invitation,
  state
}: Props) {
  const {
    busy,
    acceptInvitation,
    leaveInvitation
  } = state

  return (
    <View key={invitation.id} style={{
      gap: 10,
      backgroundColor: theme.surface,
      padding: 15,
      borderRadius: 12
    }}>
      <Text style={{
        color: theme.text,
        fontWeight: '800',
        fontSize: 18
      }}>
        {invitation.event.title}
      </Text>

      <Notice>
        Statut : {participationStatusLabel(invitation.status)}
      </Notice>


      {invitation.status === 'PENDING' ? (
        <Action
          label="Accepter l'invitation"
          disabled={busy}
          onPress={() => acceptInvitation(invitation)}
        />
      ) : null}

      <Action
        label={participationActionLabel(invitation.status)}
        secondary
        disabled={busy}
        onPress={() => leaveInvitation(invitation)}
      />

      <Action
        label="Voir l'événement"
        secondary
        onPress={() => router.push({
          pathname: '/event/[id]',
          params: { id: invitation.event.id }
        })}
      />
    </View>

  )
}
