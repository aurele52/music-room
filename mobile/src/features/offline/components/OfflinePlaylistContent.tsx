import {
  findPendingForPlaylist,
  projectPlaylist
} from '../../../lib/offline/localEdits'
import { View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { OfflinePlaylistState } from '../hooks/useOfflinePlaylists'
import OfflinePlaylistCard from './OfflinePlaylistCard'
import PlaylistSummary from '../../playlists/components/PlaylistSummary'
import { styles } from './offlinePlaylistStyles'

export default function OfflinePlaylistContent({
  state
}: { state: OfflinePlaylistState }) {
  const {
    snapshot,
    pending,
    ready,
    error,
    canEdit,
    selected,
    setSelectedId
  } = state

  return (
    <View style={styles.container}>
      {error ? <Notice error>{error}</Notice> : null}

      {!ready && !error ? (
        <Notice>Lecture des modifications locales…</Notice>
      ) : null}

      {!canEdit ? (
        <Notice>
          Lecture seule. Les droits de modification
          hors ligne ne sont pas disponibles.
        </Notice>
      ) : (
        <Notice>
          Une modification en attente par playlist.
          Les droits seront vérifiés lors de la synchronisation.
        </Notice>
      )}

      {pending.length > 0 ? (
        <Notice>
          {pending.length} modification(s) en attente.
        </Notice>
      ) : null}

      {snapshot.listing.playlists.length === 0 ? (
        <Notice>Aucune playlist disponible.</Notice>
      ) : null}

      {selected ? (
        <>
          <Action
            label="Retour aux playlists"
            secondary
            onPress={() => {
              state.setAdding(null)
              setSelectedId(null)
            }}
          />

          <OfflinePlaylistCard
            key={selected.id}
            state={state}
            playlist={selected}
          />
        </>
      ) : snapshot.listing.playlists.map(playlist => {
        const entry = findPendingForPlaylist(
          pending,
          state.userId,
          state.eventId,
          playlist.id
        )

        const projected = projectPlaylist(playlist, entry)

        return (
          <PlaylistSummary
            key={playlist.id}
            playlist={playlist}
            count={projected.items.length}
            onPress={() => setSelectedId(playlist.id)}
          />
        )
      })}
    </View>
  )
}
