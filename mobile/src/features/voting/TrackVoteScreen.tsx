import { useLocalSearchParams } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { accessScopeKey } from '../../lib/accessScope'
import { Authenticated } from '../auth/Authenticated'
import { useTrackVote } from './hooks/useTrackVote'
import TrackVoteContent from './components/TrackVoteContent'

function MusicContent() {
  const state = useTrackVote()

  return <TrackVoteContent state={state} />
}

/**
 * Un JWT ou un événement différent ne doit jamais
 * réutiliser les données de l'écran précédent.
 */
function SessionBoundMusicContent() {
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
    <MusicContent
      key={accessScopeKey(token, eventId)}
    />
  )
}

export default function EventMusic() {
  return (
    <Authenticated>
      <SessionBoundMusicContent />
    </Authenticated>
  )
}
