// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrackVote from '../src/features/voting/TrackVote'
import { subscribeEventRealtime } from '../src/services/realtime/eventRealtime'

vi.mock('../src/services/realtime/eventRealtime', () => ({
  subscribeEventRealtime: vi.fn(() => () => {})
}))

const eventId = '11111111-1111-4111-8111-111111111111'

const tracks = Array.from({ length: 22 }, (_, index) => ({
  id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
  title: `Morceau ${String(index + 1).padStart(2, '0')}`,
  artist: 'Artiste test',
  createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
  proposerId: '44444444-4444-4444-8444-444444444444',
  proposer: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Alice'
  },
  votes: 22 - index,
  myVote: false
}))

type FetchCall = {
  path: string
  method: string
  body: any
}

function mockApi(options: {
  canParticipate?: boolean
  canVote?: boolean
  requiresLocation?: boolean
} = {}) {
  const calls: FetchCall[] = []

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
      path === `/api/tracks/events/${eventId}` &&
      method === 'GET'
    ) {
      return Response.json({
        tracks,
        canParticipate: options.canParticipate ?? true,
        canVote: options.canVote ?? options.canParticipate ?? true,
        requiresLocation: options.requiresLocation ?? false,
        finished: false
      })
    }

    if (
      path.startsWith('/api/tracks/') &&
      path.endsWith('/vote') &&
      (method === 'POST' || method === 'DELETE')
    ) {
      return Response.json(
        { ok: true },
        { status: method === 'POST' ? 201 : 200 }
      )
    }

    throw new Error(`Requête HTTP inattendue : ${method} ${path}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  return { calls, fetchMock }
}

function mount() {
  return render(
    <TrackVote
      eventId={eventId}
      token="token-test"
      onAuthError={() => false}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Music Track Vote - interactions React', () => {
  it('affiche les morceaux dans leur ordre de classement', async () => {
    mockApi()
    const { container } = mount()

    await screen.findByText('Morceau 01')

    const items = Array.from(
      container.querySelectorAll('.track-ranking .track-info strong')
    )

    expect(items.map(item => item.textContent)).toEqual(
      tracks.map(track => track.title)
    )
  })

  it('interdit le vote et les propositions en lecture seule', async () => {
    mockApi({ canParticipate: false, canVote: false })
    mount()

    await screen.findByText('Morceau 01')

    expect(screen.queryAllByRole('button', {
      name: 'Voter'
    })).toHaveLength(0)

    expect(screen.queryByRole('button', {
      name: 'Proposer ce morceau'
    })).toBeNull()
  })

  it('envoie une requête de vote', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    mount()

    const buttons = await screen.findAllByRole('button', {
      name: 'Voter'
    })

    await user.click(buttons[0])

    await waitFor(() => {
      expect(calls.filter(call =>
        call.method === 'POST' &&
        call.path === `/api/tracks/${tracks[0].id}/vote`
      )).toHaveLength(1)
    })
  })
})

// V3.1B : voter et proposer sont deux permissions distinctes.
describe('V3.1B - licence de vote publique', () => {
  it('autorise le vote sans autoriser la proposition', async () => {
    mockApi({ canParticipate: false, canVote: true })
    mount()

    const buttons = await screen.findAllByRole('button', {
      name: 'Voter'
    })

    expect(buttons.length).toBeGreaterThan(0)

    expect(
      screen.queryByRole('button', {
        name: 'Proposer ce morceau'
      })
    ).toBeNull()
  })

  it('masque le vote lorsque la licence le retire', async () => {
    const permissions = {
      canParticipate: false,
      canVote: true
    }

    mockApi(permissions)
    mount()

    expect(
      (await screen.findAllByRole('button', { name: 'Voter' }))
        .length
    ).toBeGreaterThan(0)

    // Le serveur modifie la licence et signale tracks:changed.
    permissions.canVote = false

    const subscription = vi.mocked(
      subscribeEventRealtime
    ).mock.calls.find(args => args[2] === 'tracks')

    expect(subscription).toBeDefined()

    act(() => {
      subscription?.[3].onChanged?.()
    })

    await waitFor(() => {
      expect(
        screen.queryAllByRole('button', { name: 'Voter' })
      ).toHaveLength(0)
    })
  })
})

describe('V3.1C - position GPS au moment du vote', () => {
  it('transmet les coordonnées GPS uniquement au vote', async () => {
    const { calls } = mockApi({
      canParticipate: false,
      canVote: true,
      requiresLocation: true
    })

    const location = vi.fn((success: (
      value: { coords: { latitude: number; longitude: number } }
    ) => void) => {
      success({
        coords: {
          latitude: 48.69,
          longitude: 6.18
        }
      })
    })

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: location
      }
    })

    const user = userEvent.setup()
    mount()

    const voteButtons = await screen.findAllByRole('button', {
      name: 'Voter'
    })

    expect(voteButtons.length).toBeGreaterThan(0)
    expect(location).not.toHaveBeenCalled()

    await user.click(voteButtons[0])

    await waitFor(() => {
      expect(
        calls.some((call) =>
          call.method === 'POST' &&
          call.path.endsWith('/vote') &&
          call.body?.latitude === 48.69 &&
          call.body?.longitude === 6.18
        )
      ).toBe(true)
    })

    expect(location).toHaveBeenCalledTimes(1)
  })

  it('ne vote pas si la géolocalisation est refusée', async () => {
    const { calls } = mockApi({
      canParticipate: false,
      canVote: true,
      requiresLocation: true
    })

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (
          _success: unknown,
          failure: (error: Error) => void
        ) => {
          failure(new Error('Permission denied'))
        }
      }
    })

    const user = userEvent.setup()
    mount()

    const buttons = await screen.findAllByRole('button', {
      name: 'Voter'
    })

    await user.click(buttons[0])

    await waitFor(() => {
      expect(
        screen.getByRole('alert').textContent
      ).toContain('Position GPS refusée')
    })

    expect(
      calls.some((call) =>
        call.method === 'POST' &&
        call.path.endsWith('/vote')
      )
    ).toBe(false)
  })
})
