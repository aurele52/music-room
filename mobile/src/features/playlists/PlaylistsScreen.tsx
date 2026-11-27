import { useLocalSearchParams } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { usePlaylists } from './hooks/usePlaylists'
import OnlinePlaylistEditor from './components/OnlinePlaylistEditor'

function PlaylistContent() {
  const state = usePlaylists()

  return <OnlinePlaylistEditor state={state} />
}

/**
 * Un JWT ou un événement différent ne doit jamais
 * réutiliser les données de l'écran précédent.
 */
function SessionBoundPlaylistContent() {
  const { session } = useSession()
  const { eventId: rawId } = useLocalSearchParams<{
    eventId: string
  }>()

  const eventId = typeof rawId === 'string'
    ? rawId
    : ''

  const token = session.status === 'authenticated'
    ? session.token
    : null

  return (
    <PlaylistContent
      key={accessScopeKey(token, eventId)}
    />
  )
}

export default function EventPlaylists() {
  return (
    <Authenticated>
      <SessionBoundPlaylistContent />
    </Authenticated>
  )
}
