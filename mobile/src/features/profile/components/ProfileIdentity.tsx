import { Action, Field } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'

export default function ProfileIdentity({
  state
}: { state: ProfileState }) {
  const {
    name,
    setName,
    busy,
    saveName
  } = state

  return (
    <>
      <Field
        label="Nom"
        value={name}
        onChangeText={setName}
        editable={!busy}
      />
      <Action
        label="Enregistrer le nom"
        disabled={busy}
        onPress={() => { void saveName() }}
      />

    </>
  )
}
