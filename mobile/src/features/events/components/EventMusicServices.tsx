import { router } from 'expo-router'
import { Action } from '../../../ui/Controls'

export default function EventMusicServices({
  eventId
}: { eventId: string }) {
  return (
    <>
      <Action
        label="Session musicale en direct"
        onPress={() => router.push({
          pathname: '/event/session',
          params: { eventId: eventId }
        })}
      />

      <Action
        label="Voir les playlists de la soirée"
        secondary
        onPress={() => router.push({
          pathname: '/event/playlists',
          params: { eventId: eventId }
        })}
      />

      <Action
        label="Voir les morceaux de la soirée"
        onPress={() => router.push({
          pathname: '/event/music',
          params: { eventId: eventId }
        })}
      />

    </>
  )
}
