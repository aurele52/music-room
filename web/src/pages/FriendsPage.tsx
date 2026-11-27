import { useState } from 'react'
import Friends from '../features/friends/Friends'
import UserSearch from '../features/friends/UserSearch'
import type { Auth } from '../features/auth/useAuth'

const tabs = [
  ['friends', 'Mes amis'],
  ['requests', 'Demandes'],
  ['search', 'Rechercher']
] as const

type Tab = typeof tabs[number][0]

export default function FriendsPage({ auth }: { auth: Auth }) {
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState<Tab>('friends')

  return (
    <>
      <h1>Mes amis</h1>

      <nav className="feature-tabs" aria-label="Navigation amis">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div hidden={tab === 'search'}>
        <Friends
          token={auth.token}
          refreshKey={revision}
          onAuthError={auth.handleProtectedError}
          view={tab === 'requests' ? 'requests' : 'friends'}
        />
      </div>

      <div hidden={tab !== 'search'}>
        <UserSearch
          token={auth.token}
          onAuthError={auth.handleProtectedError}
          onFriendRequestSent={() => setRevision(value => value + 1)}
        />
      </div>
    </>
  )
}
