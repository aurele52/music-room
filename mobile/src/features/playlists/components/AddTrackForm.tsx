import { Text, View } from 'react-native'
import { Action, Field } from '../../../ui/Controls'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import type { PlaylistState } from '../hooks/usePlaylists'
import { styles } from './playlistStyles'
import { canEditPlaylistItems } from '../../../lib/musicPlaylistActions'

interface Props {
  state: PlaylistState
  playlist: MusicPlaylist
}

export default function AddTrackForm({
  state,
  playlist
}: Props) {
  const {
    listing,
    drafts,
    updateDraft,
    addItem,
    busy,
    loading
  } = state

  if (
    !listing ||
    !canEditPlaylistItems(listing, playlist.id)
  ) return null

  return (
    <View style={styles.addForm}>
      <Text style={styles.subheading}>
        Ajouter un morceau
      </Text>

      <Field
        label="Titre"
        placeholder="Nom du morceau"
        value={drafts[playlist.id]?.title ?? ''}
        onChangeText={value => updateDraft(
          playlist.id,
          'title',
          value
        )}
        maxLength={150}
      />

      <Field
        label="Artiste"
        placeholder="Nom de l'artiste"
        value={drafts[playlist.id]?.artist ?? ''}
        onChangeText={value => updateDraft(
          playlist.id,
          'artist',
          value
        )}
        maxLength={120}
      />

      <Action
        label="Ajouter à cette playlist"
        disabled={busy || loading}
        onPress={() => addItem(playlist.id)}
      />
    </View>
  )
}
