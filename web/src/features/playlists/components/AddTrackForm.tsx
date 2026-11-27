import type { PlaylistsState } from '../hooks/usePlaylists'

type Props = {
  state: PlaylistsState
  eventId: string
}

export default function AddTrackForm({
  state, eventId
}: Props) {
  const {
    data, canWork, addTrack, canEditItems,
    selectedPlaylist, selectedPlaylistId,
    setSelectedPlaylistId,
    trackTitle, setTrackTitle,
    trackArtist, setTrackArtist
  } = state

  return (
    <>
      {data.canEdit && data.playlists.length > 0 && (
        <form
          className="playlist-form"
          onSubmit={(event) => {
            void addTrack(event)
          }}
        >
          <h4>Ajouter un morceau</h4>

          <label htmlFor={`playlist-select-${eventId}`}>
            Playlist
          </label>

          <select
            id={`playlist-select-${eventId}`}
            value={selectedPlaylistId}
            required
            disabled={!canWork}
            onChange={(event) =>
              setSelectedPlaylistId(event.target.value)
            }
          >
            <option value="">Choisir une playlist</option>

            {data.playlists.map((playlist) => (
              <option
                key={playlist.id}
                value={playlist.id}
                disabled={
                  !canEditItems(playlist) ||
                  playlist.items.length >= 100
                }
              >
                {playlist.title}
              </option>
            ))}
          </select>

          <label htmlFor={`playlist-track-${eventId}`}>
            Titre du morceau
          </label>

          <input
            id={`playlist-track-${eventId}`}
            value={trackTitle}
            required
            minLength={2}
            maxLength={150}
            disabled={!canWork}
            onChange={(event) =>
              setTrackTitle(event.target.value)
            }
            placeholder="One More Time"
          />

          <label htmlFor={`playlist-artist-${eventId}`}>
            Artiste
          </label>

          <input
            id={`playlist-artist-${eventId}`}
            value={trackArtist}
            required
            minLength={2}
            maxLength={120}
            disabled={!canWork}
            onChange={(event) =>
              setTrackArtist(event.target.value)
            }
            placeholder="Daft Punk"
          />

          <button
            type="submit"
            disabled={
              !canWork ||
              !selectedPlaylist ||
              !canEditItems(selectedPlaylist) ||
              selectedPlaylist.items.length >= 100
            }
          >
            Ajouter le morceau
          </button>
        </form>
      )}
    </>
  )
}
