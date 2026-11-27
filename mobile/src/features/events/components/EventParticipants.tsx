import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import { participationStatusLabel } from '../../../lib/eventStatus'
import type { ParticipationState } from '../hooks/useEventParticipation'

export default function EventParticipants({
  state
}: { state: ParticipationState }) {
  const {
    members,
    busy,
    removeMember
  } = state

  return (
    <>
      <Text style={{
        color: theme.primary,
        fontWeight: '700'
      }}>
        Invités et participants
      </Text>

      {members.length === 0 ? (
        <Notice>Aucun invité pour cet événement.</Notice>
      ) : null}

      {members.map(member => (
        <View key={member.id} style={{ gap: 8 }}>
          <Notice>
            {member.user.name} — {participationStatusLabel(member.status)}
          </Notice>

          <Action
            label={`Retirer ${member.user.name}`}
            secondary
            disabled={busy}
            onPress={() => removeMember(member)}
          />
        </View>
      ))}
    </>
  )
}
