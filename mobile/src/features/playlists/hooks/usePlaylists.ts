import { usePlaylistData } from './usePlaylistData'
import { usePlaylistActions } from './usePlaylistActions'

export function usePlaylists() {
  const data = usePlaylistData()
  const actions = usePlaylistActions(data)

  return {
    eventId: data.eventId,
    userId: data.userId,
    view: data.view,
    listing: data.listing,
    title: data.title,
    setTitle: data.setTitle,
    description: data.description,
    setDescription: data.setDescription,
    drafts: data.drafts,
    loading: data.loading,
    busy: data.busy,
    error: data.error,
    message: data.message,
    load: data.load,
    ...actions
  }
}

export type PlaylistState = ReturnType<typeof usePlaylists>
