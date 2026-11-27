import { Action, Field } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'

export default function MusicPreferences({
  state
}: { state: ProfileState }) {
  const {
    genres,
    setGenres,
    artists,
    setArtists,
    busy,
    savePreferences
  } = state

  return (
    <>
      <Field
        label="Genres favoris (séparés par des virgules)"
        value={genres}
        onChangeText={setGenres}
        editable={!busy}
      />
      <Field
        label="Artistes favoris (séparés par des virgules)"
        value={artists}
        onChangeText={setArtists}
        editable={!busy}
      />
      <Action
        label="Enregistrer les préférences"
        disabled={busy}
        onPress={() => {
          void savePreferences()
        }}
      />

    </>
  )
}
