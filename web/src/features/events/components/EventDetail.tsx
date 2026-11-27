import { useState } from 'react'
import LiveSession from '../../player/LiveSession'
import TrackVote from '../../voting/TrackVote'
import PlaylistEditor from '../../playlists/PlaylistEditor'
import MusicPolicyEditor from '../../permissions/MusicPolicyEditor'
import EventParticipants from '../participants/EventParticipants'
import type { MusicEvent, Props } from '../types'

const tabs = [
  ['overview', 'Aperçu'],
  ['votes', 'Votes'],
  ['playlists', 'Playlists'],
  ['session', 'Session musicale'],
  ['participants', 'Participants'],
  ['permissions', 'Permissions']
] as const

type Tab = typeof tabs[number][0]

type DetailProps = Props & {
  event: MusicEvent
  working: boolean
  onBack: () => void
  onEdit: () => void
  onRemove: () => void
}

export default function EventDetail({
  event, token, onAuthError, working,
  onBack, onEdit, onRemove
}: DetailProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [sessionOpened, setSessionOpened] = useState(false)

  function selectTab(next: Tab) {
    if (next === 'session') setSessionOpened(true)
    setTab(next)
  }

  const common = {
    eventId: event.id,
    token,
    onAuthError
  }

  return (
    <div className="event-detail-page">
      <button className="link" onClick={onBack}>
        Retour aux événements
      </button>

      <header className="event-detail-header">
        <h2>{event.title}</h2>
        <p>{event.visibility === 'PUBLIC' ? 'Public' : 'Privé'}</p>
      </header>

      <nav className="feature-tabs" aria-label="Détail événement">
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

      {tab === 'overview' && (
        <section className="profile">
          <h3>Informations générales</h3>
          <p>{event.description || 'Sans description'}</p>
          {event.location && <p>Lieu : {event.location}</p>}
          <p>Début : {new Date(event.startsAt).toLocaleString('fr-FR')}</p>
          <p>Fin : {new Date(event.endsAt).toLocaleString('fr-FR')}</p>

          <div className="compact-actions">
            <button disabled={working} onClick={onEdit}>
              Modifier
            </button>
            <button
              className="danger-button"
              disabled={working}
              onClick={onRemove}
            >
              Supprimer
            </button>
          </div>
        </section>
      )}

      {tab === 'votes' && <TrackVote {...common} organizer />}
      {tab === 'playlists' && <PlaylistEditor {...common} />}

      {sessionOpened && (
        <div hidden={tab !== 'session'}>
          <LiveSession {...common} />
        </div>
      )}

      {tab === 'participants' && <EventParticipants {...common} />}
      {tab === 'permissions' && <MusicPolicyEditor {...common} />}
    </div>
  )
}
