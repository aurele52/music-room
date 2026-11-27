import { router } from 'expo-router'
import { Action } from '../../../ui/Controls'
import type {
  OfflineHomeState
} from '../hooks/useOfflineHome'

export default function OfflineHomeActions({
  state
}: { state: OfflineHomeState }) {
  const {
    reconnect,
    disconnect
  } = state

  return (
    <>
      <Action
        label="Synchronisation"
        secondary
        onPress={() => router.push('/synchronisation')}
      />

      <Action
        label="Réessayer la connexion"
        onPress={reconnect}
      />

      <Action
        label="Se déconnecter"
        secondary
        onPress={disconnect}
      />
    </>
  )
}
