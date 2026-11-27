import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { EventDetailState } from '../hooks/useEventDetail'
import EventInformation from './EventInformation'
import EventOrganizerActions from './EventOrganizerActions'
import EventMusicServices from './EventMusicServices'
import { EventParticipation } from './EventParticipation'

export default function EventDetailContent({
  state
}: { state: EventDetailState }) {
  const {
    session,
    token,
    event,
    loading,
    error,
    load
  } = state

  return (
    <Screen
      title={event?.title ?? 'Événement'}
      subtitle="Informations de la soirée"
    >
      <Action
        label="Retour aux événements"
        secondary
        onPress={() => router.replace('/events')}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? (
        <>
          <Notice error>{error}</Notice>
          <Action
            label="Réessayer"
            onPress={() => { void load() }}
          />
        </>
      ) : null}

      {event ? (
        <>


          <EventInformation event={event} />

          <EventOrganizerActions state={state} />

          {session.status === 'authenticated' ? (
            <EventParticipation
              key={event.id}
              event={event}
              viewerId={session.user.id}
              token={token}
            />
          ) : null}


          <EventMusicServices eventId={event.id} />

        </>
      ) : null}
    </Screen>
  )
}
