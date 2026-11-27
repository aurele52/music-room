import { Text, View } from 'react-native'
import { Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { ParticipationState } from '../hooks/useEventParticipation'
import EventParticipants from './EventParticipants'
import EventInvitationForm from './EventInvitationForm'

export default function ParticipationContent({
  state
}: { state: ParticipationState }) {
  const {
    organizer,
    loading,
    error,
    message
  } = state

  return (
    <View style={{ gap: 12 }}>
      <Text style={{
        color: theme.text,
        fontSize: 21,
        fontWeight: '800'
      }}>
        Participation
      </Text>

      {loading ? <Notice>Chargement…</Notice> : null}
      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {organizer ? (
        <>


          <EventParticipants state={state} />
          <EventInvitationForm state={state} />

        </>
      ) : null}

    </View>
  )
}
