// @vitest-environment jsdom

import {
  act,
  cleanup,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import Events from '../src/features/events/Events'
import EventInvitations from '../src/features/events/invitations/EventInvitations'
import EventParticipants from '../src/features/events/participants/EventParticipants'
import { subscribeAccountRealtime } from '../src/services/realtime/friendsRealtime'

vi.mock('../src/services/realtime/friendsRealtime', () => ({
  subscribeAccountRealtime: vi.fn(() => () => {})
}))

// Composants musicaux non concernés par la concurrence HTTP
// des listes étudiées ici.
vi.mock('../src/features/player/LiveSession', () => ({
  default: () => null
}))
vi.mock('../src/features/voting/TrackVote', () => ({
  default: () => null
}))
vi.mock('../src/features/playlists/PlaylistEditor', () => ({
  default: () => null
}))
vi.mock('../src/features/permissions/MusicPolicyEditor', () => ({
  default: () => null
}))

const eventA = '11111111-1111-4111-8111-111111111111'
const eventB = '22222222-2222-4222-8222-222222222222'

function deferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>(done => {
    resolve = done
  })

  return { promise, resolve }
}

type Pending = ReturnType<typeof deferred<Response>>

function musicEvent(id: string, title: string) {
  return {
    id,
    title,
    description: '',
    location: '',
    startsAt: '2026-12-01T18:00:00.000Z',
    endsAt: '2026-12-01T22:00:00.000Z',
    visibility: 'PUBLIC',
    organizerId: 'organizer',
    createdAt: '2026-11-26T00:00:00.000Z'
  }
}

function invitation(id: string, title: string) {
  return {
    id,
    status: 'PENDING',
    createdAt: '2026-11-26T00:00:00.000Z',
    event: {
      ...musicEvent(id, title),
      organizer: { id: 'organizer', name: 'Alice' }
    }
  }
}

function notify(event: string, token = 'token-a') {
  const call = [...vi.mocked(subscribeAccountRealtime).mock.calls]
    .reverse()
    .find(args => args[0] === token && args[1] === event)

  expect(call).toBeDefined()

  act(() => {
    call?.[2]()
  })
}

async function count(requests: Pending[], expected: number) {
  await waitFor(() => {
    expect(requests).toHaveLength(expected)
  })
}

async function respond(
  request: Pending,
  data: unknown,
  status = 200
) {
  await act(async () => {
    request.resolve(Response.json(data, { status }))
    await request.promise
  })
}

// Le composant Events monte aussi EventInvitations.
// Fournir une réponse à son appel HTTP évite de fabriquer
// des erreurs d'authentification parasites.
function mockEventsFetch() {
  const requests: Pending[] = []

  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = String(input)

    if (path === '/api/events/invitations/mine') {
      return Promise.resolve(
        Response.json({ invitations: [] })
      )
    }

    if (path === '/api/events/mine') {
      const pending = deferred<Response>()
      requests.push(pending)
      return pending.promise
    }

    throw new Error(`Requête inattendue : ${path}`)
  }))

  return requests
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('V3.3F3H4 - réponses HTTP dans le désordre', () => {
  it('Events : ancienne liste ignorée après notification', async () => {
    const requests = mockEventsFetch()
    const onAuthError = vi.fn(() => false)

    render(
      <Events token="token-a" onAuthError={onAuthError} />
    )

    await count(requests, 1)

    notify('events:changed')
    await count(requests, 2)

    await respond(requests[1], {
      events: [musicEvent(eventB, 'Soirée récente')]
    })

    expect(await screen.findByText('Soirée récente'))
      .toBeTruthy()

    await respond(requests[0], {
      events: [musicEvent(eventA, 'Soirée obsolète')]
    })

    expect(screen.queryByText('Soirée obsolète')).toBeNull()
    expect(screen.getByText('Soirée récente')).toBeTruthy()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('Invitations : une invitation retirée ne revient pas', async () => {
    const requests: Pending[] = []

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input) !== '/api/events/invitations/mine') {
        throw new Error(`Requête inattendue : ${input}`)
      }

      const pending = deferred<Response>()
      requests.push(pending)
      return pending.promise
    }))

    const onAuthError = vi.fn(() => false)

    render(
      <EventInvitations
        token="token-a"
        onAuthError={onAuthError}
      />
    )

    await count(requests, 1)

    notify('events:changed')
    await count(requests, 2)

    await respond(requests[1], { invitations: [] })

    expect(
      await screen.findByText('Aucune invitation en attente.')
    ).toBeTruthy()

    await respond(requests[0], {
      invitations: [invitation(eventA, 'Ancienne invitation')]
    })

    expect(screen.queryByText('Ancienne invitation')).toBeNull()
    expect(
      screen.getByText('Aucune invitation en attente.')
    ).toBeTruthy()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('Participants : ancien événement ignoré', async () => {
    const requests = new Map<string, Pending[]>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input)

      if (
        path !== '/api/friends' &&
        path !== `/api/events/${eventA}/invitations` &&
        path !== `/api/events/${eventB}/invitations`
      ) {
        throw new Error(`Requête inattendue : ${path}`)
      }

      const pending = deferred<Response>()
      const existing = requests.get(path) ?? []
      existing.push(pending)
      requests.set(path, existing)

      return pending.promise
    }))

    const onAuthError = vi.fn(() => false)

    const view = render(
      <EventParticipants
        eventId={eventA}
        token="token-a"
        onAuthError={onAuthError}
      />
    )

    await waitFor(() => {
      expect(requests.get('/api/friends')).toHaveLength(1)
      expect(
        requests.get(`/api/events/${eventA}/invitations`)
      ).toHaveLength(1)
    })

    view.rerender(
      <EventParticipants
        eventId={eventB}
        token="token-a"
        onAuthError={onAuthError}
      />
    )

    await waitFor(() => {
      expect(requests.get('/api/friends')).toHaveLength(2)
      expect(
        requests.get(`/api/events/${eventB}/invitations`)
      ).toHaveLength(1)
    })

    const oldMembers =
      requests.get(`/api/events/${eventA}/invitations`)![0]
    const newMembers =
      requests.get(`/api/events/${eventB}/invitations`)![0]
    const oldFriends = requests.get('/api/friends')![0]
    const newFriends = requests.get('/api/friends')![1]

    await act(async () => {
      newFriends.resolve(Response.json({ friends: [] }))
      newMembers.resolve(Response.json({
        invitations: [{
          id: 'member-b',
          status: 'ACCEPTED',
          createdAt: '2026-11-26T00:00:00.000Z',
          user: { id: 'bob', name: 'Bob actuel' }
        }]
      }))
      await Promise.all([
        newFriends.promise,
        newMembers.promise
      ])
    })

    expect(await screen.findByText('Bob actuel'))
      .toBeTruthy()

    await act(async () => {
      oldFriends.resolve(Response.json({ friends: [] }))
      oldMembers.resolve(Response.json({
        invitations: [{
          id: 'member-a',
          status: 'ACCEPTED',
          createdAt: '2026-11-26T00:00:00.000Z',
          user: { id: 'alice', name: 'Alice obsolète' }
        }]
      }))
      await Promise.all([
        oldFriends.promise,
        oldMembers.promise
      ])
    })

    expect(screen.queryByText('Alice obsolète')).toBeNull()
    expect(screen.getByText('Bob actuel')).toBeTruthy()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('Changement de compte : ancienne réponse ignorée', async () => {
    const requests = mockEventsFetch()
    const onAuthError = vi.fn(() => false)

    const view = render(
      <Events token="token-a" onAuthError={onAuthError} />
    )

    await count(requests, 1)

    view.rerender(
      <Events token="token-b" onAuthError={onAuthError} />
    )

    await count(requests, 2)

    await respond(requests[1], {
      events: [musicEvent(eventB, 'Événement compte B')]
    })

    expect(await screen.findByText('Événement compte B'))
      .toBeTruthy()

    await respond(requests[0], {
      events: [musicEvent(eventA, 'Événement compte A')]
    })

    expect(screen.queryByText('Événement compte A')).toBeNull()
    expect(screen.getByText('Événement compte B')).toBeTruthy()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('Ancienne erreur 401 : aucune déconnexion', async () => {
    const requests = mockEventsFetch()
    const onAuthError = vi.fn(() => false)

    render(
      <Events token="token-a" onAuthError={onAuthError} />
    )

    await count(requests, 1)

    notify('events:changed')
    await count(requests, 2)

    await respond(requests[1], {
      events: [musicEvent(eventB, 'Liste valide')]
    })

    expect(await screen.findByText('Liste valide'))
      .toBeTruthy()

    await respond(
      requests[0],
      { error: 'Session ancienne expirée' },
      401
    )

    expect(onAuthError).not.toHaveBeenCalled()
    expect(screen.getByText('Liste valide')).toBeTruthy()
    expect(screen.queryByText('Session ancienne expirée')).toBeNull()
  })
})
