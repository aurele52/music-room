import { useState } from 'react'
import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import {
  canDeleteMusicPlaylist,
  canEditPlaylistItems
} from '../../../lib/musicPlaylistActions'
import PlaylistPermissionSettings from './PlaylistPermissionSettings'
import type { PlaylistState } from '../hooks/usePlaylists'
import AddTrackForm from './AddTrackForm'
import PlaylistTrack from './PlaylistTrack'
import { styles } from './playlistStyles'

interface Props {
  state: PlaylistState
  playlist: MusicPlaylist
}

export default function PlaylistCard({
  state,
  playlist
}: Props) {
  const {
    listing,
    busy,
    loading,
    confirmDeletePlaylist
  } = state

  const editable = listing
    ? canEditPlaylistItems(listing, playlist.id)
    : false

  const [adding, setAdding] = useState(false)

  if (!editable && adding) {
    setAdding(false)
  }

  if (!listing) return null

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {playlist.title}
      </Text>

      {playlist.description ? (
        <Text style={styles.detail}>
          {playlist.description}
        </Text>
      ) : null}

      <Text style={styles.detail}>
        {playlist.items.length} morceau(x)
      </Text>

      <PlaylistPermissionSettings
        state={state}
        playlist={playlist}
      />

      {!editable ? (
        <Notice>Playlist en lecture seule.</Notice>
      ) : null}

      {editable ? (
        adding ? (
          <>
            <AddTrackForm
              state={state}
              playlist={playlist}
            />

            <Action
              label="Fermer le formulaire"
              secondary
              disabled={busy}
              onPress={() => setAdding(false)}
            />
          </>
        ) : (
          <Action
            label="Ajouter un morceau"
            disabled={busy || loading}
            onPress={() => setAdding(true)}
          />
        )
      ) : null}

      {playlist.items.length === 0 ? (
        <Notice>
          Cette playlist est vide.
        </Notice>
      ) : null}

      {playlist.items.map((item, index) => (
        <PlaylistTrack
          key={item.id}
          state={state}
          playlist={playlist}
          item={item}
          index={index}
        />
      ))}

      {canDeleteMusicPlaylist(listing) ? (
        <Action
          label="Supprimer cette playlist"
          secondary
          disabled={busy || loading}
          onPress={() => confirmDeletePlaylist(
            playlist.id,
            playlist.title
          )}
        />
      ) : null}
    </View>
  )
}
