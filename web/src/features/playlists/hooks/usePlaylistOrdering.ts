import { useState } from 'react'
import type { DragEvent } from 'react'
import type { Playlist } from '../types'
import type { PlaylistDataState } from './usePlaylistData'

type Props = {
  source: PlaylistDataState
  canEditItems: (playlist: Playlist) => boolean
}

export function usePlaylistOrdering({
  source, canEditItems
}: Props) {
  const { data, working, loading, perform, request } = source

  const [dragged, setDragged] = useState<{
    playlistId: string
    itemId: string
  } | null>(null)

  async function reorderTracks(
    playlist: Playlist,
    sourceIndex: number,
    targetIndex: number
  ) {
    if (!canEditItems(playlist) || working || loading) return

    const ids = playlist.items.map(item => item.id)

    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex >= ids.length ||
      targetIndex >= ids.length ||
      sourceIndex === targetIndex
    ) return

    const [itemId] = ids.splice(sourceIndex, 1)
    ids.splice(targetIndex, 0, itemId)

    await perform(
      () => request(
        `/playlists/${playlist.id}/order`,
        'PUT',
        {
          itemIds: ids,
          revision: playlist.revision
        }
      ),
      'Ordre enregistré.'
    )
  }

  function moveTrack(
    playlist: Playlist,
    index: number,
    direction: -1 | 1
  ) {
    return reorderTracks(
      playlist,
      index,
      index + direction
    )
  }

  function reorderByDrop(
    playlist: Playlist,
    sourceId: string,
    targetId: string
  ) {
    return reorderTracks(
      playlist,
      playlist.items.findIndex(item => item.id === sourceId),
      playlist.items.findIndex(item => item.id === targetId)
    )
  }

  function startDrag(
    event: DragEvent<HTMLLIElement>,
    playlistId: string,
    itemId: string
  ) {
    const playlist = data.playlists.find(
      item => item.id === playlistId
    )

    if (
      !playlist ||
      !canEditItems(playlist) ||
      working ||
      loading
    ) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
    setDragged({ playlistId, itemId })
  }

  function dropTrack(
    event: DragEvent<HTMLLIElement>,
    playlist: Playlist,
    targetId: string
  ) {
    event.preventDefault()

    const source = dragged
    setDragged(null)

    if (
      !source ||
      source.playlistId !== playlist.id ||
      !canEditItems(playlist) ||
      working ||
      loading
    ) {
      return
    }

    void reorderByDrop(playlist, source.itemId, targetId)
  }


  return {
    dragged, setDragged,
    moveTrack, startDrag, dropTrack
  }
}
