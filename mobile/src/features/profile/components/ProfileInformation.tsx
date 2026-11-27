import { Action, Field, Notice } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'

export default function ProfileInformation({
  state
}: { state: ProfileState }) {
  const {
    publicBio,
    setPublicBio,
    friendsBio,
    setFriendsBio,
    privateNote,
    setPrivateNote,
    busy,
    saveInformation
  } = state

  return (
    <>
      <Notice>Informations personnelles</Notice>

      <Field
        label="Présentation publique"
        value={publicBio}
        onChangeText={setPublicBio}
        maxLength={500}
        editable={!busy}
      />

      <Field
        label="Présentation réservée aux amis"
        value={friendsBio}
        onChangeText={setFriendsBio}
        maxLength={500}
        editable={!busy}
      />

      <Field
        label="Note privée (visible uniquement par toi)"
        value={privateNote}
        onChangeText={setPrivateNote}
        maxLength={500}
        editable={!busy}
      />

      <Action
        label="Enregistrer mes informations"
        disabled={busy}
        onPress={() => { void saveInformation() }}
      />

    </>
  )
}
