// @vitest-environment jsdom

import {
  act,
  cleanup,
  render,
  waitFor
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import PlaylistEditor from '../src/features/playlists/PlaylistEditor'

type RealtimeSubscription = {
  onChanged: () => void
  onAccessChanged: () => void
}

const realtime = vi.hoisted(() => ({
  subscriptions: [] as RealtimeSubscription[]
}))

vi.mock('../src/services/realtime/eventRealtime', () => ({
  subscribeEventRealtime: vi.fn((
    _token: string,
    _eventId: string,
    _channel: string,
    subscription: RealtimeSubscription
  ) => {
    realtime.subscriptions.push(subscription)

    return () => {
      const index = realtime.subscriptions.indexOf(subscription)

      if (index >= 0) {
        realtime.subscriptions.splice(index, 1)
      }
    }
  })
}))

const eventId = '11111111-1111-4111-8111-111111111111'
const playlistId = '22222222-2222-4222-8222-222222222222'

type ApiCall = {
  path: string
  method: string
  body?: any
}

function makeItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
    title: `Musique ${index + 1}`,
    artist: 'Artiste test',
    position: index,
    addedById: '44444444-4444-4444-8444-444444444444',
    addedBy: {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Alice'
    }
  }))
}

function mockApi(options: {
  canEdit?: boolean
  itemCount?: number
} = {}) {
  const calls: ApiCall[] = []

  const state = {
    canEdit: options.canEdit ?? true,
    itemCount: options.itemCount ?? 3,
    accessible: true,
    title: 'Playlist principale'
  }

  const fetchMock = vi.fn(async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const path = String(input)
    const method = init?.method ?? 'GET'

    const body = init?.body
      ? JSON.parse(String(init.body))
      : undefined

    calls.push({ path, method, body })

    if (
      path === `/api/playlists/events/${eventId}` &&
      method === 'GET'
    ) {
      if (!state.accessible) {
        return Response.json(
          { error: 'Événement introuvable' },
          { status: 404 }
        )
      }

      return Response.json({
        playlists: [{
          id: playlistId,
          title: state.title,
          description: 'Playlist collaborative',
          revision: 3,
          createdAt: '2026-11-01T12:00:00.000Z',
          items: makeItems(state.itemCount)
        }],
        canEdit: state.canEdit,
        organizer: true,
        finished: false
      })
    }

    throw new Error(
      `Requête inattendue : ${method} ${path}`
    )
  })

  vi.stubGlobal('fetch', fetchMock)

  return { state, calls, fetchMock }
}

function mount() {
  return render(
    <PlaylistEditor
      eventId={eventId}
      token="session-test"
      onAuthError={() => false}
    />
  )
}

async function loaded(container: HTMLElement) {
  await waitFor(() => {
    expect(container.textContent).toContain('Playlist principale')
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  realtime.subscriptions.length = 0
})

describe('Playlist Editor - interactions React', () => {
  it('charge les playlists et leurs morceaux', async () => {
    const { calls } = mockApi({ itemCount: 3 })
    const { container } = mount()

    await loaded(container)

    expect(container.textContent).toContain('Musique 1')
    expect(container.textContent).toContain('Musique 3')

    expect(
      calls.filter(
        (call) =>
          call.path === `/api/playlists/events/${eventId}` &&
          call.method === 'GET'
      ).length
    ).toBeGreaterThanOrEqual(1)
  })

  it('interdit les modifications en lecture seule', async () => {
    mockApi({ canEdit: false })
    const { container } = mount()

    await loaded(container)

    expect(container.textContent).toContain('Musique 1')
    expect(container.querySelectorAll('form')).toHaveLength(0)
    expect(container.querySelectorAll('.playlist-actions')).toHaveLength(0)

    const buttons = Array.from(
      container.querySelectorAll('button')
    )

    expect(buttons.some(button =>
      button.textContent?.includes('Supprimer la playlist')
    )).toBe(false)
  })

  it('actualise les données après une notification Socket.IO', async () => {
    const { calls, state } = mockApi()
    const { container } = mount()

    await loaded(container)

    expect(realtime.subscriptions).toHaveLength(1)

    state.title = 'Playlist actualisée'

    await act(async () => {
      realtime.subscriptions[0].onChanged()
    })

    await waitFor(() => {
      expect(container.textContent).toContain(
        'Playlist actualisée'
      )
    })

    expect(
      calls.filter((call) => call.method === 'GET').length
    ).toBeGreaterThanOrEqual(2)
  })

  it('efface les données après révocation des droits', async () => {
    const { state } = mockApi()
    const { container } = mount()

    await loaded(container)

    expect(realtime.subscriptions).toHaveLength(1)

    state.accessible = false

    await act(async () => {
      realtime.subscriptions[0].onAccessChanged()
    })

    await waitFor(() => {
      expect(container.textContent).not.toContain(
        'Playlist principale'
      )
    })
  })

  it('retire son abonnement Socket.IO au démontage', async () => {
    mockApi()
    const view = mount()

    await loaded(view.container)

    expect(realtime.subscriptions).toHaveLength(1)

    view.unmount()

    expect(realtime.subscriptions).toHaveLength(0)
  })
})
