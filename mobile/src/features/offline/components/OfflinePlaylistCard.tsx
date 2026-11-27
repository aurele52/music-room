import { Text, View } from 'react-native'
import {
  findPendingForPlaylist,
  projectPlaylist
} from '../../../lib/offline/localEdits'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import { Action, Notice } from '../../../ui/Controls'
import type { OfflinePlaylistState } from '../hooks/useOfflinePlaylists'
import OfflinePlaylistTrack from './OfflinePlaylistTrack'
import OfflineAddTrackForm from './OfflineAddTrackForm'
import { styles } from './offlinePlaylistStyles'

interface Props {
  state: OfflinePlaylistState
  playlist: MusicPlaylist
}

export default function OfflinePlaylistCard({
  state,
  playlist
}: Props) {
  const {
    pending,
    userId,
    eventId,
    canEdit,
    ready,
    busy,
    cancel
  } = state

  const entry = findPendingForPlaylist(
    pending,
    userId,
    eventId,
    playlist.id
  )

  const projected = projectPlaylist(playlist, entry)

  const editable =
    canEdit &&
    playlist.visibility === 'PUBLIC' &&
    playlist.canEdit === true &&
    ready &&
    !busy &&
    !entry

  return (
    <View key={playlist.id} style={styles.card}>
      <Text style={styles.heading}>
        {playlist.title}
      </Text>

      {playlist.description ? (
        <Text style={styles.detail}>
          {playlist.description}
        </Text>
      ) : null}

      <Text style={styles.detail}>
        Révision serveur : {playlist.revision}
      </Text>

      {projected.status === 'pending' ? (
        <Notice>
          Modification locale non synchronisée.
        </Notice>
      ) : null}

      {projected.status === 'conflict' ? (
        <Notice error>
          La playlist a changé depuis la modification.
          Un conflit devra être résolu.
        </Notice>
      ) : null}

      {projected.items.length === 0 ? (
        <Text style={styles.detail}>
          Playlist vide.
        </Text>
      ) : null}

      {projected.items.map((item, index) => (
        <OfflinePlaylistTrack
          key={item.id}
          state={state}
          playlist={playlist}
          projected={projected}
          item={item}
          index={index}
          editable={editable}
        />
      ))}

      {entry?.syncState === 'attempted' ? (
        <Notice>
          Envoi déjà tenté. Résultat serveur à vérifier.
        </Notice>
      ) : null}

      {entry?.syncState === 'conflict' ? (
        <Notice error>
          {entry.syncMessage || 'Conflit de synchronisation.'}
        </Notice>
      ) : null}

      {entry && !entry.syncState ? (
        <Action
          label="Annuler la modification"
          secondary
          disabled={!ready || busy}
          onPress={() => {
            void cancel(entry)
          }}
        />
      ) : null}

      <OfflineAddTrackForm
        state={state}
        playlist={playlist}
        editable={editable}
      />
    </View>
  )
}
