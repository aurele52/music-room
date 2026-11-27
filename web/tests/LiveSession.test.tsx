

// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
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

import LiveSession from '../src/features/player/LiveSession'

const realtime = vi.hoisted(() => ({
  subscriptions: [] as {
    onChanged: () => void
    onAccessChanged: () => void
  }[]
}))

vi.mock('../src/services/realtime/eventRealtime', () => ({
  subscribeEventRealtime: vi.fn(
    (
      _token: string,
      _eventId: string,
      _channel: string,
      subscription: {
        onChanged: () => void
        onAccessChanged: () => void
      }
    ) => {
      realtime.subscriptions.push(subscription)
      return () => {
        const index = realtime.subscriptions.indexOf(subscription)
        if (index >= 0) realtime.subscriptions.splice(index, 1)
      }
    }
  )
}))

const eventId = '11111111-1111-4111-8111-111111111111'

const items = [
  {
    id: '33333333-3333-4333-8333-333333333331',
    title: 'Premier titre',
    artist: 'Artiste A',
    position: 0
  },
  {
    id: '33333333-3333-4333-8333-333333333332',
    title: 'Second titre',
    artist: 'Artiste B',
    position: 1
  }
]

function mockApi(organizer = true) {
  const calls: {
    method: string
    path: string
    body?: any
  }[] = []

  const state: {
    session: any
  } = {
    session: null
  }

  vi.stubGlobal('fetch', vi.fn(async (
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
      path === `/api/sessions/events/${eventId}` &&
      method === 'GET'
    ) {
      return Response.json({
        session: state.session,
        organizer,
        canControl: organizer,
        finished: false
      })
    }

    if (
      path === `/api/sessions/events/${eventId}/start` &&
      method === 'POST'
    ) {
      state.session = {
        id: '44444444-4444-4444-8444-444444444444',
        eventId,
        state: 'PAUSED',
        currentIndex: 0,
        revision: 1,
        items
      }

      return Response.json(
        { session: state.session },
        { status: 201 }
      )
    }

    if (
      path === `/api/sessions/events/${eventId}/control` &&
      method === 'POST'
    ) {
      state.session = {
        ...state.session,
        state:
          body.action === 'play'
            ? 'PLAYING'
            : body.action === 'pause'
              ? 'PAUSED'
              : state.session.state,
        currentIndex:
          body.action === 'next'
            ? state.session.currentIndex + 1
            : state.session.currentIndex,
        revision: state.session.revision + 1
      }

      return Response.json({ session: state.session })
    }

    throw new Error(`Requête inattendue : ${method} ${path}`)
  }))

  return { calls, state }
}

function mount() {
  const view = render(
    <LiveSession
      eventId={eventId}
      token="token-test"
      onAuthError={() => false}
    />
  )

  return view
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  realtime.subscriptions.length = 0
})

describe('Music Room - session en direct React', () => {
  it('affiche une session absente', async () => {
    mockApi(false)
    mount()

    expect(
      await screen.findByText(
        /Aucune session musicale n'a encore été lancée/
      )
    ).toBeTruthy()

    expect(screen.queryByText('Démarrer depuis le classement')).toBeNull()
  })

  it('organisateur démarre depuis les votes', async () => {
    const { calls } = mockApi()
    mount()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Démarrer depuis le classement'
      })
    )

    expect(
      await screen.findByText(
      'Premier titre',
      { selector: '.music-live-current h4' }
    )
    ).toBeTruthy()

    expect(
      calls.find(
        (call) => call.path.endsWith('/start')
      )?.body
    ).toEqual({})
  })

  it('les commandes incluent la révision attendue', async () => {
    const { calls } = mockApi()
    mount()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Démarrer depuis le classement'
      })
    )

    await screen.findByText(
      'Premier titre',
      { selector: '.music-live-current h4' }
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Lecture' })
    )

    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.path.endsWith('/control') &&
            call.body?.action === 'play' &&
            call.body?.revision === 1
        )
      ).toBe(true)
    })
  })

  it('réagit aux mises à jour Socket.IO', async () => {
    const { state } = mockApi(false)

    state.session = {
      id: '44444444-4444-4444-8444-444444444444',
      state: 'PAUSED',
      currentIndex: 0,
      revision: 1,
      items
    }

    mount()

    await screen.findByText(
      'Premier titre',
      { selector: '.music-live-current h4' }
    )

    expect(realtime.subscriptions).toHaveLength(1)

    state.session = {
      ...state.session,
      currentIndex: 1,
      revision: 2
    }

    await act(async () => {
      for (const subscription of [...realtime.subscriptions]) {
        subscription.onChanged()
      }
    })

    await waitFor(() => {
      expect(
        screen.getByText('Second titre', {
          selector: '.music-live-current h4'
        })
      ).toBeTruthy()
    })

    expect(
      screen.queryByRole('button', { name: 'Suivant' })
    ).toBeNull()
  })
})
