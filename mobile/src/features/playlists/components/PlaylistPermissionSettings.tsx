import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import {
  canChangePlaylistPermissions
} from '../../../lib/musicPlaylistActions'
import type { PlaylistState } from '../hooks/usePlaylists'
import { styles } from './playlistStyles'

interface Props {
  state: PlaylistState
  playlist: MusicPlaylist
}

export default function PlaylistPermissionSettings({
  state,
  playlist
}: Props) {
  const {
    listing,
    busy,
    loading,
    changePermissions
  } = state

  const { visibility, editPolicy } = playlist

  const configurable = Boolean(
    listing &&
    canChangePlaylistPermissions(listing, playlist.id)
  )

  if (!visibility || !editPolicy) {
    return (
      <Text style={styles.detail}>
        Informations de permissions indisponibles.
      </Text>
    )
  }

  return (
    <View style={styles.addForm}>
      <Text style={styles.detail}>
        {visibility === 'PUBLIC'
          ? 'Playlist publique'
          : 'Playlist privée'}
      </Text>

      <Text style={styles.detail}>
        {editPolicy === 'PUBLIC'
          ? 'Édition ouverte'
          : 'Édition réservée aux invités'}
      </Text>

      {configurable ? (
        <>
          <Action
            secondary
            label={visibility === 'PUBLIC'
              ? 'Rendre privée'
              : 'Rendre publique'}
            disabled={busy || loading}
            onPress={() => changePermissions(
              playlist.id,
              {
                visibility: visibility === 'PUBLIC'
                  ? 'PRIVATE'
                  : 'PUBLIC',
                editPolicy
              }
            )}
          />

          <Action
            secondary
            label={editPolicy === 'PUBLIC'
              ? 'Réserver aux invités'
              : 'Ouvrir les modifications'}
            disabled={busy || loading}
            onPress={() => changePermissions(
              playlist.id,
              {
                visibility,
                editPolicy: editPolicy === 'PUBLIC'
                  ? 'INVITED_ONLY'
                  : 'PUBLIC'
              }
            )}
          />
        </>
      ) : null}
    </View>
  )
}
