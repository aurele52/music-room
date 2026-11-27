import { router } from 'expo-router'
import { Action } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'

export default function ProfileAccountActions({
  state
}: { state: ProfileState }) {
  const {
    googleLinked,
    busy,
    linkGoogle,
    logout
  } = state

  return (
    <>
      <Action
        label={googleLinked
          ? 'Google déjà associé'
          : 'Associer un compte Google'}
        secondary
        disabled={busy || googleLinked}
        onPress={() => { void linkGoogle() }}
      />
      <Action
        label="Mes amis"
        secondary
        onPress={() => router.push('/friends')}
      />
      <Action
        label="Retour aux événements"
        secondary
        onPress={() => router.replace('/events')}
      />
      <Action
        label="Déconnexion"
        onPress={() => { void logout() }}
      />

    </>
  )
}
