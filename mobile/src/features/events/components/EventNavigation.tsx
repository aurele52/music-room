import { router } from 'expo-router'
import { Action } from '../../../ui/Controls'

export default function EventNavigation() {
  return (
    <>
      <Action
        label="Créer un événement"
        onPress={() => router.push('/event/new')}
      />

      <Action
        label="Mes invitations"
        secondary
        onPress={() => router.push('/invitations')}
      />
    </>
  )
}
