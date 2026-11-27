import { useState } from 'react'
import TrackVote from '../../voting/TrackVote'
import PlaylistEditor from '../../playlists/PlaylistEditor'
import LiveSession from '../../player/LiveSession'

type Props = {
  eventId: string
  token: string
  onAuthError: (error: unknown) => boolean
}

const tabs = [
  ['votes', 'Votes'],
  ['playlists', 'Playlists'],
  ['session', 'Session musicale']
] as const

type Tab = typeof tabs[number][0]

export default function EventMusicTabs(props: Props) {
  return (
    <MusicTabsContent
      key={`${props.eventId}:${props.token}`}
      {...props}
    />
  )
}

function MusicTabsContent(props: Props) {
  const [tab, setTab] = useState<Tab>('votes')
  const [sessionOpened, setSessionOpened] = useState(false)

  function selectTab(next: Tab) {
    if (next === 'session') setSessionOpened(true)
    setTab(next)
  }

  return (
    <div className="event-music-tabs">
      <nav className="feature-tabs" aria-label="Services musicaux">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'votes' && <TrackVote {...props} />}
      {tab === 'playlists' && <PlaylistEditor {...props} />}

      {sessionOpened && (
        <div hidden={tab !== 'session'}>
          <LiveSession {...props} />
        </div>
      )}
    </div>
  )
}
