import type { Playlist } from '../types'
import type { PlaylistsState } from '../hooks/usePlaylists'
import PlaylistTrackList from './PlaylistTrackList'

type Props = {
  playlist: Playlist
  state: PlaylistsState
}

export default function PlaylistCard({
  playlist, state
}: Props) {
  const {
    data, canWork, canEditItems,
    changePermissions, removePlaylist
  } = state

  return (
    <div className="playlist-card" key={playlist.id}>
      <div className="playlist-toolbar">
        <div>
          <h4>{playlist.title}</h4>
          {playlist.description && (
            <p>{playlist.description}</p>
          )}
          <p className="notice">
            {playlist.items.length} morceau(x)
          </p>

          <p className="notice">
            {playlist.visibility === 'PRIVATE'
              ? 'Playlist privée'
              : 'Playlist publique'}
            {' — '}
            {playlist.editPolicy === 'INVITED_ONLY'
              ? 'Édition réservée aux invités'
              : 'Édition ouverte'}
          </p>

          {!canEditItems(playlist) && (
            <p className="notice">Lecture seule.</p>
          )}

          {data.organizer &&
            !data.finished &&
            playlist.visibility &&
            playlist.editPolicy && (
            <div className="playlist-actions">
              <button
                type="button"
                className="secondary"
                disabled={!canWork}
                onClick={() => {
                  void changePermissions(
                    playlist,
                    playlist.visibility === 'PUBLIC'
                      ? 'PRIVATE'
                      : 'PUBLIC',
                    playlist.editPolicy!
                  )
                }}
              >
                {playlist.visibility === 'PUBLIC'
                  ? 'Rendre privée'
                  : 'Rendre publique'}
              </button>

              <button
                type="button"
                className="secondary"
                disabled={!canWork}
                onClick={() => {
                  void changePermissions(
                    playlist,
                    playlist.visibility!,
                    playlist.editPolicy === 'PUBLIC'
                      ? 'INVITED_ONLY'
                      : 'PUBLIC'
                  )
                }}
              >
                {playlist.editPolicy === 'PUBLIC'
                  ? 'Réserver aux invités'
                  : 'Ouvrir les modifications'}
              </button>
            </div>
          )}

        </div>

        {data.canEdit && data.organizer && (
          <button
            type="button"
            className="secondary"
            disabled={!canWork}
            onClick={() => {
              void removePlaylist(playlist)
            }}
          >
            Supprimer la playlist
          </button>
        )}
      </div>
      <PlaylistTrackList
        playlist={playlist}
        state={state}
      />
    </div>
  )
}
