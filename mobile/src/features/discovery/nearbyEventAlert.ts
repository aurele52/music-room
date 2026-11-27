import { Alert } from 'react-native'
import { router } from 'expo-router'
import type { MusicEvent } from '../../lib/api'

export function showNearbyEvent(
  event: MusicEvent,
  current: () => boolean,
  close: () => void
) {
  if (!current()) {
    close()
    return
  }

  const message = [
    event.title,
    event.location,
    event.description
  ].filter(Boolean).join('\n\n')

  Alert.alert(
    'Événement musical à proximité',
    message,
    [
      {
        text: 'Ignorer',
        style: 'cancel',
        onPress: close
      },
      {
        text: 'Voir la fiche',
        onPress: () => {
          close()

          if (!current()) return

          router.push({
            pathname: '/event/[id]',
            params: { id: event.id }
          })
        }
      }
    ],
    {
      cancelable: true,
      onDismiss: close
    }
  )

}
