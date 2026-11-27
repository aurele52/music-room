import {
  useOfflinePlaylists,
  type OfflinePlaylistProps
} from './hooks/useOfflinePlaylists'
import OfflinePlaylistContent from './components/OfflinePlaylistContent'

export function OfflinePlaylistEditor(
  props: OfflinePlaylistProps
) {
  const state = useOfflinePlaylists(props)

  return <OfflinePlaylistContent state={state} />
}
