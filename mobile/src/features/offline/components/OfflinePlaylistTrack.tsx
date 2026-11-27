import { Text, View } from 'react-native'
import {
  moveOfflineTrack,
  projectPlaylist
} from '../../../lib/offline/localEdits'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import { Action } from '../../../ui/Controls'
import type { OfflinePlaylistState } from '../hooks/useOfflinePlaylists'
import { styles } from './offlinePlaylistStyles'

type Projection = ReturnType<typeof projectPlaylist>

interface Props {
  state: OfflinePlaylistState
  playlist: MusicPlaylist
  projected: Projection
  item: Projection['items'][number]
  index: number
  editable: boolean
}

export default function OfflinePlaylistTrack({
  state,
  playlist,
  projected,
  item,
  index,
  editable
}: Props) {
  const { edit } = state

  return (
    <View key={item.id} style={styles.track}>
      <Text style={styles.heading}>
        {index + 1}. {item.title}
      </Text>

      <Text style={styles.detail}>
        {item.artist}
      </Text>

      {item.pending ? (
        <Text style={styles.detail}>
          En attente de synchronisation
        </Text>
      ) : null}

      {editable ? (
        <>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Action
                label="Monter"
                secondary
                disabled={index === 0}
                onPress={() => {
                  const action = moveOfflineTrack(
                    playlist,
                    item.id,
                    -1
                  )

                  if (action) {
                    void edit(playlist.id, action)
                  }
                }}
              />
            </View>

            <View style={styles.flex}>
              <Action
                label="Descendre"
                secondary
                disabled={
                  index === projected.items.length - 1
                }
                onPress={() => {
                  const action = moveOfflineTrack(
                    playlist,
                    item.id,
                    1
                  )

                  if (action) {
                    void edit(playlist.id, action)
                  }
                }}
              />
            </View>
          </View>

          <Action
            label="Retirer le morceau"
            secondary
            onPress={() => {
              void edit(playlist.id, {
                type: 'remove',
                itemId: item.id
              })
            }}
          />
        </>
      ) : null}
    </View>
  )
}
