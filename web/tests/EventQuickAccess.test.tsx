

// @vitest-environment jsdom

import {
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

import { buildEventLink, EventShare } from '../src/features/events/sharing/EventShare'
import { readEventLink, EventDeepLink } from '../src/features/events/sharing/EventQuickAccess'

vi.mock('../src/features/player/LiveSession', () => ({
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="live-session">{eventId}</div>
  )
}))

vi.mock('../src/features/voting/TrackVote', () => ({
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="track-vote">{eventId}</div>
  )
}))

const eventId = '11111111-1111-4111-8111-111111111111'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('V2.5 - partage et accès direct', () => {
  it('construit un lien sans reprendre les paramètres sensibles', () => {
    window.history.replaceState(
      {},
      '',
      '/?reset=secret&verify=token'
    )

    const link = new URL(buildEventLink(eventId))

    expect(link.searchParams.get('event')).toBe(eventId)
    expect(link.searchParams.has('reset')).toBe(false)
    expect(link.searchParams.has('verify')).toBe(false)
  })

  it('refuse les identifiants invalides', () => {
    expect(() => buildEventLink('../private')).toThrow()
  })

  it('reconnaît le paramètre événement valide', () => {
    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    expect(readEventLink()).toBe(eventId)

    window.history.replaceState(
      {},
      '',
      '/?event=invalide'
    )

    expect(readEventLink()).toBeNull()
  })

  it('affiche un QR code partageable', () => {
    const { container } = render(
      <EventShare eventId={eventId} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Partager la soirée'
      })
    )

    expect(
      screen.getByRole('textbox', {
        name: 'Lien de la soirée'
      })
    ).toHaveProperty(
      'value',
      buildEventLink(eventId)
    )

    expect(
      container.querySelector('.music-event-share-qr svg')
    ).not.toBeNull()
  })

  it('demande la connexion avant de rejoindre la soirée', () => {
    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    render(<EventDeepLink />)

    expect(
      screen.getByText('Connexion nécessaire')
    ).toBeTruthy()

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
  })

  it('ouvre directement les services musicaux si connecté', async () => {
    sessionStorage.setItem('token', 'test-token')

    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ session: { id: 'session-test' } })
    ))

    render(<EventDeepLink />)

    expect(
      (await screen.findByTestId('live-session')).textContent
    ).toBe(eventId)

    expect(
      (await screen.findByTestId('track-vote')).textContent
    ).toBe(eventId)
  })

  it('permet de fermer le lien sans déconnecter', async () => {
    sessionStorage.setItem('token', 'test-token')

    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ session: { id: 'session-test' } })
    ))

    render(<EventDeepLink />)

    await screen.findByTestId('live-session')
    await screen.findByTestId('track-vote')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Retour à Music Room'
      })
    )

    await waitFor(() => {
      expect(readEventLink()).toBeNull()
    })

    expect(
      sessionStorage.getItem('token')
    ).toBe('test-token')
  })
})


describe('V2.6 - contrôle des accès', () => {
  function openWithToken() {
    sessionStorage.setItem('token', 'session-test')

    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )
  }

  it('ne révèle aucune donnée quand le serveur répond 403', async () => {
    openWithToken()

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ error: 'Forbidden' }, { status: 403 })
    ))

    render(<EventDeepLink />)

    await screen.findByText('Accès indisponible')

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
    expect(
      screen.getByText(
        /introuvable ou ton compte n'a pas la permission/
      )
    ).toBeTruthy()
  })

  it('présente le même refus quand la soirée est introuvable', async () => {
    openWithToken()

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ error: 'Not found' }, { status: 404 })
    ))

    render(<EventDeepLink />)

    await screen.findByText('Accès indisponible')

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
  })

  it('autorise les votes avant le demarrage de la session', async () => {
    openWithToken()

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ session: null })
    ))

    render(<EventDeepLink />)

    await screen.findByTestId('live-session')
    await screen.findByTestId('track-vote')
  })

  it('permet de réessayer après une invitation acceptée', async () => {
    openWithToken()

    let authorized = false

    vi.stubGlobal('fetch', vi.fn(async () => (
      authorized
        ? Response.json({ session: { id: 'session-test' } })
        : Response.json({ error: 'Forbidden' }, { status: 403 })
    )))

    render(<EventDeepLink />)

    await screen.findByText('Accès indisponible')

    authorized = true

    fireEvent.click(
      screen.getByRole('button', {
        name: /Réessayer après avoir obtenu l.accès/
      })
    )

    await screen.findByTestId('live-session')
    await screen.findByTestId('track-vote')
  })

  it('refuse une session expirée avec HTTP 401', async () => {
    openWithToken()

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    ))

    render(<EventDeepLink />)

    await screen.findByText('Connexion nécessaire')

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
  })

  it('permet de réessayer après une erreur serveur', async () => {
    openWithToken()

    let failed = true

    vi.stubGlobal('fetch', vi.fn(async () => (
      failed
        ? Response.json({ error: 'Server error' }, { status: 500 })
        : Response.json({ session: { id: 'session-test' } })
    )))

    render(<EventDeepLink />)

    await screen.findByText('Vérification impossible')

    failed = false

    fireEvent.click(
      screen.getByRole('button', { name: 'Réessayer' })
    )

    await screen.findByTestId('live-session')
    await screen.findByTestId('track-vote')
  })
})


describe('V2.7 - connexion via QR code', () => {
  it('laisse le formulaire de connexion accessible', () => {
    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    render(
      <>
        <button type="button">
          Se connecter au compte
        </button>
        <EventDeepLink />
      </>
    )

    expect(
      screen.getByRole('button', {
        name: 'Se connecter au compte'
      })
    ).toBeTruthy()

    expect(
      screen.getByText('Connexion nécessaire')
    ).toBeTruthy()

    expect(
      document.querySelector('.music-deeplink-overlay')
    ).toBeNull()

    expect(readEventLink()).toBe(eventId)
  })

  it('propose la reconnexion après un HTTP 401', async () => {
    sessionStorage.setItem('token', 'ancien-token')

    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    ))

    render(<EventDeepLink />)

    await screen.findByRole('button', {
      name: 'Se reconnecter'
    })

    expect(
      document.querySelector('.music-deeplink-overlay')
    ).toBeNull()

    expect(readEventLink()).toBe(eventId)
  })

  it('permet d’ignorer le lien sans perdre le formulaire', () => {
    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )

    render(
      <>
        <button type="button">
          Se connecter au compte
        </button>
        <EventDeepLink />
      </>
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ignorer ce lien'
      })
    )

    expect(readEventLink()).toBeNull()

    expect(
      screen.getByRole('button', {
        name: 'Se connecter au compte'
      })
    ).toBeTruthy()
  })
})


describe('V2.8 - invitation depuis un QR code', () => {
  function prepare() {
    sessionStorage.setItem('token', 'test-token')

    window.history.replaceState(
      {},
      '',
      `/?event=${eventId}`
    )
  }

  function invitation(
    status: 'PENDING' | 'ACCEPTED' = 'PENDING'
  ) {
    return {
      id: '22222222-2222-4222-8222-222222222222',
      status,
      event: {
        id: eventId,
        title: 'Soiree test'
      }
    }
  }

  it('propose d accepter une invitation en attente', async () => {
    prepare()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)

      if (path.includes('/sessions/events/')) {
        return Response.json({}, { status: 403 })
      }

      if (path.endsWith('/invitations/mine')) {
        return Response.json({
          invitations: [invitation()]
        })
      }

      throw new Error(`Requete inattendue : ${path}`)
    }))

    render(<EventDeepLink />)

    await screen.findByRole('button', {
      name: 'Accepter mon invitation'
    })

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
  })

  it('accepte puis reverifie les droits sur le serveur', async () => {
    prepare()

    let accepted = false

    const calls: string[] = []

    vi.stubGlobal('fetch', vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const path = String(input)
      calls.push(`${init?.method ?? 'GET'} ${path}`)

      if (path.includes('/sessions/events/')) {
        return accepted
          ? Response.json({
              session: { id: 'session-test' }
            })
          : Response.json({}, { status: 403 })
      }

      if (path.endsWith('/invitations/mine')) {
        return Response.json({
          invitations: [invitation()]
        })
      }

      if (
        path.endsWith(
          `/invitations/${invitation().id}/accept`
        ) &&
        init?.method === 'POST'
      ) {
        accepted = true
        return Response.json({
          message: 'Participation confirmee'
        })
      }

      throw new Error(`Requete inattendue : ${path}`)
    }))

    render(<EventDeepLink />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Accepter mon invitation'
      })
    )

    await screen.findByTestId('live-session')
    await screen.findByTestId('track-vote')

    expect(calls.some((call) =>
      call.startsWith('POST ') &&
      call.endsWith(
        `/invitations/${invitation().id}/accept`
      )
    )).toBe(true)

    expect(calls.filter((call) =>
      call.includes('/sessions/events/')
    ).length).toBeGreaterThanOrEqual(2)
  })

  it('ne propose pas d accepter sans invitation', async () => {
    prepare()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)

      if (path.includes('/sessions/events/')) {
        return Response.json({}, { status: 404 })
      }

      if (path.endsWith('/invitations/mine')) {
        return Response.json({ invitations: [] })
      }

      throw new Error(`Requete inattendue : ${path}`)
    }))

    render(<EventDeepLink />)

    await screen.findByText(
      /Aucune invitation en attente pour cette soirée/
    )

    expect(
      screen.queryByRole('button', {
        name: 'Accepter mon invitation'
      })
    ).toBeNull()

    expect(screen.queryByTestId('live-session')).toBeNull()
    expect(screen.queryByTestId('track-vote')).toBeNull()
  })

  it('ne traite pas une invitation d un autre evenement', async () => {
    prepare()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)

      if (path.includes('/sessions/events/')) {
        return Response.json({}, { status: 403 })
      }

      if (path.endsWith('/invitations/mine')) {
        return Response.json({
          invitations: [{
            ...invitation(),
            event: {
              id: '99999999-9999-4999-8999-999999999999',
              title: 'Autre soiree'
            }
          }]
        })
      }

      throw new Error(`Requete inattendue : ${path}`)
    }))

    render(<EventDeepLink />)

    await screen.findByText(
      /Aucune invitation en attente pour cette soirée/
    )

    expect(
      screen.queryByRole('button', {
        name: 'Accepter mon invitation'
      })
    ).toBeNull()
  })
})
