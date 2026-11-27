import { useState } from 'react'
import { usePlaylists } from './hooks/usePlaylists'
import CreatePlaylistForm from './components/CreatePlaylistForm'
import AddTrackForm from './components/AddTrackForm'
import PlaylistCard from './components/PlaylistCard'
import type { Props } from './types'

export default function PlaylistEditor(props: Props) {
  const state = usePlaylists(props)
  const { data, loading, error, message } = state

  const [form, setForm] = useState<'create' | 'add' | null>(null)

  function toggleForm(next: 'create' | 'add') {
    setForm(current => current === next ? null : next)
  }


  return (
    <div className="playlist-editor">
      <div className="playlist-toolbar">
        <h4>Music Playlist Editor</h4>
      </div>

      {data.finished && (
        <p className="notice">
          Événement terminé : les playlists sont en lecture seule.
        </p>
      )}

      {!data.finished && !data.canEdit && (
        <p className="notice">
          Tu peux consulter les playlists,
          mais pas les modifier.
        </p>
      )}

      {error && (
        <p className="error" role="alert">{error}</p>
      )}

      {message && (
        <p className="success" role="status">{message}</p>
      )}

      {loading ? (
        <p className="notice">Chargement des playlists...</p>
      ) : (
        <>
          {data.canEdit && !data.finished && (
            <div className="compact-actions">
              <button onClick={() => toggleForm('create')}>
                {form === 'create'
                  ? 'Fermer le formulaire'
                  : '+ Créer une playlist'}
              </button>

              {data.playlists.length > 0 && (
                <button onClick={() => toggleForm('add')}>
                  {form === 'add'
                    ? 'Fermer le formulaire'
                    : '+ Ajouter un morceau'}
                </button>
              )}
            </div>
          )}

          {form === 'create' && (
            <CreatePlaylistForm
              state={state}
              eventId={props.eventId}
            />
          )}

          <h4>Playlists ({data.playlists.length})</h4>

          {data.playlists.length === 0 && (
            <p className="notice">
              Aucune playlist pour cet événement.
            </p>
          )}

          {form === 'add' && (
            <AddTrackForm
              state={state}
              eventId={props.eventId}
            />
          )}

          {data.playlists.map(playlist => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              state={state}
            />
          ))}
        </>
      )}
    </div>
  )
}
