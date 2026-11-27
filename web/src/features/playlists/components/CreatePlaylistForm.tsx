import type { PlaylistsState } from '../hooks/usePlaylists'

type Props = {
  state: PlaylistsState
  eventId: string
}

export default function CreatePlaylistForm({
  state, eventId
}: Props) {
  const {
    data, canWork, createPlaylist,
    playlistTitle, setPlaylistTitle,
    playlistDescription, setPlaylistDescription
  } = state

  return (
    <>
      {data.canEdit && (
        <form
          className="playlist-form"
          onSubmit={(event) => {
            void createPlaylist(event)
          }}
        >
          <h4>Créer une playlist</h4>

          <label htmlFor={`playlist-title-${eventId}`}>
            Nom
          </label>

          <input
            id={`playlist-title-${eventId}`}
            value={playlistTitle}
            required
            minLength={2}
            maxLength={100}
            disabled={!canWork}
            onChange={(event) =>
              setPlaylistTitle(event.target.value)
            }
            placeholder="Playlist de la soirée"
          />

          <label htmlFor={`playlist-description-${eventId}`}>
            Description
          </label>

          <textarea
            id={`playlist-description-${eventId}`}
            value={playlistDescription}
            maxLength={500}
            rows={2}
            disabled={!canWork}
            onChange={(event) =>
              setPlaylistDescription(event.target.value)
            }
            placeholder="Description facultative"
          />

          <button
            type="submit"
            disabled={!canWork || data.playlists.length >= 20}
          >
            Créer la playlist
          </button>

          {data.playlists.length >= 20 && (
            <p className="notice">
              Limite de 20 playlists atteinte.
            </p>
          )}
        </form>
      )}
    </>
  )
}
