import { Action, Field } from '../../../ui/Controls'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import type { OfflinePlaylistState } from '../hooks/useOfflinePlaylists'

interface Props {
  state: OfflinePlaylistState
  playlist: MusicPlaylist
  editable: boolean
}

export default function OfflineAddTrackForm({
  state,
  playlist,
  editable
}: Props) {
  const {
    adding,
    setAdding,
    title,
    setTitle,
    artist,
    setArtist,
    edit,
    openAdd
  } = state

  return (
    <>
    {editable && adding !== playlist.id ? (
      <Action
        label="Ajouter un morceau"
        secondary
        onPress={() => openAdd(playlist.id)}
      />
    ) : null}

    {editable && adding === playlist.id ? (
      <>
        <Field
          label="Titre"
          value={title}
          onChangeText={setTitle}
        />

        <Field
          label="Artiste"
          value={artist}
          onChangeText={setArtist}
        />

        <Action
          label="Enregistrer hors ligne"
          onPress={() => {
            void edit(playlist.id, {
              type: 'add',
              draft: { title, artist }
            })
          }}
        />

        <Action
          label="Annuler"
          secondary
          onPress={() => setAdding(null)}
        />
      </>
    ) : null}
    </>
  )
}
