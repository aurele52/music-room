import type { Playlist } from '../types'
import type { PlaylistsState } from '../hooks/usePlaylists'

type Props = {
  playlist: Playlist
  state: PlaylistsState
}

export default function PlaylistTrackList({
  playlist, state
}: Props) {
  const {
    dragged, setDragged,
    canWork, canEditItems,
    startDrag, dropTrack, moveTrack, removeTrack
  } = state

  return (
    <>
      {playlist.items.length === 0 ? (
        <p className="notice">
          Cette playlist est vide.
        </p>
      ) : (
        <ol className="playlist-items">
          {playlist.items.map((item, index) => (
            <li
              key={item.id}
              className={
                dragged?.playlistId === playlist.id &&
                dragged.itemId === item.id
                  ? 'playlist-item playlist-item-dragging'
                  : 'playlist-item'
              }
              draggable={canWork && canEditItems(playlist)}
              onDragStart={(event) => {
                startDrag(event, playlist.id, item.id)
              }}
              onDragOver={(event) => {
                if (
                  canWork &&
                  canEditItems(playlist) &&
                  dragged?.playlistId === playlist.id
                ) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(event) => {
                dropTrack(event, playlist, item.id)
              }}
              onDragEnd={() => setDragged(null)}
              title={
                canWork && canEditItems(playlist)
                  ? 'Glisser pour déplacer ce morceau'
                  : undefined
              }
            >
              <div className="playlist-item-info">
                <strong>{item.title}</strong>
                <span>{item.artist}</span>
                <small>
                  Ajouté par {item.addedBy.name}
                </small>
              </div>

              {canEditItems(playlist) && (
                <div className="playlist-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={!canWork || index === 0}
                    onClick={() => {
                      void moveTrack(playlist, index, -1)
                    }}
                  >
                    Monter
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={
                      !canWork ||
                      index === playlist.items.length - 1
                    }
                    onClick={() => {
                      void moveTrack(playlist, index, 1)
                    }}
                  >
                    Descendre
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={!canWork}
                    onClick={() => {
                      void removeTrack(playlist.id, item)
                    }}
                  >
                    Retirer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
