import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PlaylistItem, Playlist, Props } from '../types'
import { usePlaylistData } from './usePlaylistData'
import { usePlaylistOrdering } from './usePlaylistOrdering'

export function usePlaylists(props: Props) {
  const { eventId } = props
  const source = usePlaylistData(props)

  const {
    data, loading, working,
    error, message, request, perform
  } = source

  const [playlistTitle, setPlaylistTitle] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const [trackTitle, setTrackTitle] = useState('')
  const [trackArtist, setTrackArtist] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')

  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data.canEdit || data.playlists.length >= 20) return

    const successful = await perform(
      () => request(
        `/playlists/events/${eventId}`,
        'POST',
        {
          title: playlistTitle,
          description: playlistDescription
        }
      ),
      'Playlist créée.'
    )

    if (successful) {
      setPlaylistTitle('')
      setPlaylistDescription('')
    }
  }

  function canEditItems(playlist: Playlist): boolean {
    return (
      data.canEdit &&
      !data.finished &&
      playlist.canEdit === true
    )
  }

  async function addTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!data.canEdit || !selectedPlaylistId) return

    const playlist = data.playlists.find(
      (item) => item.id === selectedPlaylistId
    )

    if (
      !playlist ||
      !canEditItems(playlist) ||
      playlist.items.length >= 100
    ) return

    const successful = await perform(
      () => request(
        `/playlists/${selectedPlaylistId}/items`,
        'POST',
        {
          title: trackTitle,
          artist: trackArtist
        }
      ),
      'Morceau ajouté.'
    )

    if (successful) {
      setTrackTitle('')
      setTrackArtist('')
    }
  }


  const {
    dragged, setDragged,
    moveTrack, startDrag, dropTrack
  } = usePlaylistOrdering({
    source,
    canEditItems
  })

  async function removeTrack(
    playlistId: string,
    item: PlaylistItem
  ) {
    const playlist = data.playlists.find(
      candidate => candidate.id === playlistId
    )

    if (!playlist || !canEditItems(playlist)) return

    if (!window.confirm(
      `Retirer "${item.title}" de cette playlist ?`
    )) {
      return
    }

    await perform(
      () => request(
        `/playlists/${playlistId}/items/${item.id}`,
        'DELETE'
      ),
      'Morceau retiré.'
    )
  }

  async function removePlaylist(playlist: Playlist) {
    if (!data.canEdit || !data.organizer) return

    if (!window.confirm(
      `Supprimer définitivement la playlist "${playlist.title}" ?`
    )) {
      return
    }

    const successful = await perform(
      () => request(
        `/playlists/${playlist.id}`,
        'DELETE'
      ),
      'Playlist supprimée.'
    )

    if (successful && selectedPlaylistId === playlist.id) {
      setSelectedPlaylistId('')
    }
  }

  async function changePermissions(
    playlist: Playlist,
    visibility: 'PUBLIC' | 'PRIVATE',
    editPolicy: 'PUBLIC' | 'INVITED_ONLY'
  ) {
    if (!data.organizer || data.finished) return

    await perform(
      () => request(
        `/playlists/${playlist.id}/policies`,
        'PATCH',
        { visibility, editPolicy }
      ),
      'Permissions actualisées.'
    )
  }

  const canWork = data.canEdit && !working && !loading
  const selectedPlaylist = data.playlists.find(
    (item) => item.id === selectedPlaylistId
  )


  return {
    data, loading, working, error, message,
    playlistTitle, setPlaylistTitle,
    playlistDescription, setPlaylistDescription,
    trackTitle, setTrackTitle,
    trackArtist, setTrackArtist,
    selectedPlaylistId, setSelectedPlaylistId,
    dragged, setDragged,
    createPlaylist, canEditItems, addTrack,
    moveTrack, startDrag, dropTrack,
    removeTrack, removePlaylist,
    changePermissions, canWork, selectedPlaylist
  }
}

export type PlaylistsState = ReturnType<typeof usePlaylists>
