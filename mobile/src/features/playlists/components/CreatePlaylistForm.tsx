import { Text, View } from 'react-native'
import { Action, Field } from '../../../ui/Controls'
import type { PlaylistState } from '../hooks/usePlaylists'
import { styles } from './playlistStyles'

export default function CreatePlaylistForm({
  state
}: { state: PlaylistState }) {
  const {
    title,
    setTitle,
    description,
    setDescription,
    busy,
    loading,
    createPlaylist
  } = state

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        Créer une playlist
      </Text>

      <Field
        label="Titre"
        placeholder="Playlist de la soirée"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />

      <Field
        label="Description facultative"
        placeholder="Ambiance, style musical..."
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
      />

      <Action
        label="Créer la playlist"
        disabled={busy || loading}
        onPress={createPlaylist}
      />
    </View>
  )
}
