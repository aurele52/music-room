import { Action, Notice } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'

export default function ProfileVisibility({
  state
}: { state: ProfileState }) {
  const {
    visibility,
    busy,
    saveVisibility
  } = state

  return (
    <>
      <Notice>Visibilité du profil : {visibility}</Notice>

      <Action
        label="Public"
        secondary={visibility !== 'PUBLIC'}
        disabled={busy}
        onPress={() => {
          void saveVisibility('PUBLIC')
        }}
      />
      <Action
        label="Amis seulement"
        secondary={visibility !== 'FRIENDS'}
        disabled={busy}
        onPress={() => {
          void saveVisibility('FRIENDS')
        }}
      />
      <Action
        label="Privé"
        secondary={visibility !== 'PRIVATE'}
        disabled={busy}
        onPress={() => {
          void saveVisibility('PRIVATE')
        }}
      />

    </>
  )
}
