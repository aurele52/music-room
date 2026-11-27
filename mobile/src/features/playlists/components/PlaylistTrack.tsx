import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import type { PlaylistState } from '../hooks/usePlaylists'
import { styles } from './playlistStyles'
import { canEditPlaylistItems } from '../../../lib/musicPlaylistActions'

interface Props {
  state: PlaylistState
  playlist: MusicPlaylist
  item: MusicPlaylist['items'][number]
  index: number
}

export default function PlaylistTrack({
  state,
  playlist,
  item,
  index
}: Props) {
  const {
    listing,
    busy,
    loading,
    moveItem,
    confirmRemoveItem
  } = state

  const editable = listing
    ? canEditPlaylistItems(listing, playlist.id)
    : false

  return (
    <View
      key={item.id}
      style={styles.item}
    >
      <Text style={styles.itemTitle}>
        {index + 1}. {item.title}
      </Text>

      <Text style={styles.detail}>
        {item.artist}
      </Text>

      {item.addedBy ? (
        <Text style={styles.detail}>
          Ajouté par {item.addedBy.name}
        </Text>
      ) : null}

      {editable ? (
        <>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Action
                label="Monter"
                secondary
                disabled={
                  busy ||
                  loading ||
                  index === 0
                }
                onPress={() => moveItem(
                  playlist.id,
                  item.id,
                  -1
                )}
              />
            </View>

            <View style={styles.action}>
              <Action
                label="Descendre"
                secondary
                disabled={
                  busy ||
                  loading ||
                  index === playlist.items.length - 1
                }
                onPress={() => moveItem(
                  playlist.id,
                  item.id,
                  1
                )}
              />
            </View>
          </View>

          <Action
            label="Retirer ce morceau"
            secondary
            disabled={busy || loading}
            onPress={() => confirmRemoveItem(
              playlist.id,
              item.id,
              item.title
            )}
          />
        </>
      ) : null}
    </View>
  )
}
