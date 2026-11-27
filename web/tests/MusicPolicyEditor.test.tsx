// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MusicPolicyEditor from '../src/features/permissions/MusicPolicyEditor'

const eventId = '11111111-1111-4111-8111-111111111111'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('V3.1B - configuration des licences', () => {
  it('charge les politiques publiques par défaut', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        policies: {
          votePolicy: 'PUBLIC',
          editPolicy: 'PUBLIC'
        }
      })
    )

    vi.stubGlobal('fetch', fetchMock)

    render(
      <MusicPolicyEditor
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )

    const vote = await screen.findByLabelText('Qui peut voter ?')
    const edit = screen.getByLabelText(
      'Qui peut éditer les playlists ?'
    )

    expect((vote as HTMLSelectElement).value).toBe('PUBLIC')
    expect((edit as HTMLSelectElement).value).toBe('PUBLIC')

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/events/${eventId}/music-policies`,
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer token-test'
        }
      })
    )
  })

  it('enregistre indépendamment les deux politiques', async () => {
    const requests: {
      method: string
      body: unknown
    }[] = []

    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const method = init?.method ?? 'GET'

      if (method === 'GET') {
        return Response.json({
          policies: {
            votePolicy: 'PUBLIC',
            editPolicy: 'PUBLIC'
          }
        })
      }

      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body))
        requests.push({ method, body })

        return Response.json({ policies: body })
      }

      throw new Error('Méthode HTTP inattendue')
    })

    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()

    render(
      <MusicPolicyEditor
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )

    const vote = await screen.findByLabelText('Qui peut voter ?')

    await user.selectOptions(vote, 'INVITED_ONLY')

    expect(
      (screen.getByLabelText(
        'Qui peut éditer les playlists ?'
      ) as HTMLSelectElement).value
    ).toBe('PUBLIC')

    await user.click(screen.getByRole('button', {
      name: 'Enregistrer les licences'
    }))

    await waitFor(() => {
      expect(requests).toEqual([{
        method: 'PUT',
        body: expect.objectContaining({
          votePolicy: 'INVITED_ONLY',
          editPolicy: 'PUBLIC',
          voteWindowStart: null,
          voteWindowEnd: null,
          voteLatitude: null,
          voteLongitude: null,
          voteRadiusMeters: null
        })
      }])
    })

    expect(
      await screen.findByText('Licences musicales enregistrées.')
    ).toBeTruthy()
  })

  it('ne présente pas les sélecteurs sans permission', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json(
        { error: 'Événement introuvable' },
        { status: 404 }
      )
    ))

    render(
      <MusicPolicyEditor
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )

    await screen.findByRole('alert')

    expect(
      screen.queryByLabelText('Qui peut voter ?')
    ).toBeNull()
  })
})

// V3.1C : enregistrement simultané des restrictions.
describe('V3.1C - configuration horaire et GPS', () => {
  it('enregistre les horaires UTC et la zone GPS', async () => {
    const submitted: any[] = []

    vi.stubGlobal('fetch', vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return Response.json({
          policies: {
            votePolicy: 'PUBLIC',
            editPolicy: 'PUBLIC',
            voteWindowStart: null,
            voteWindowEnd: null,
            voteLatitude: null,
            voteLongitude: null,
            voteRadiusMeters: null
          }
        })
      }

      const body = JSON.parse(String(init?.body))
      submitted.push(body)

      return Response.json({ policies: body })
    }))

    const user = userEvent.setup()

    render(
      <MusicPolicyEditor
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )

    await screen.findByLabelText('Qui peut voter ?')

    await user.click(screen.getByLabelText(
      'Limiter le vote à une plage horaire'
    ))

    await user.type(
      screen.getByLabelText('Début des votes'),
      '2027-01-02T10:00'
    )

    await user.type(
      screen.getByLabelText('Fin des votes'),
      '2027-01-02T11:00'
    )

    await user.click(screen.getByLabelText(
      'Limiter le vote à une zone GPS'
    ))

    await user.type(
      screen.getByLabelText('Latitude du centre'),
      '48.69'
    )

    await user.type(
      screen.getByLabelText('Longitude du centre'),
      '6.18'
    )

    await user.type(
      screen.getByLabelText('Rayon autorisé (mètres)'),
      '1000'
    )

    await user.click(screen.getByRole('button', {
      name: 'Enregistrer les licences'
    }))

    await waitFor(() => {
      expect(submitted).toHaveLength(1)
    })

    expect(submitted[0]).toEqual(
      expect.objectContaining({
        voteLatitude: 48.69,
        voteLongitude: 6.18,
        voteRadiusMeters: 1000
      })
    )

    expect(
      new Date(submitted[0].voteWindowStart).getTime()
    ).toBeLessThan(
      new Date(submitted[0].voteWindowEnd).getTime()
    )
  })

  it('refuse une zone GPS incomplète sans appeler le PUT', async () => {
    const calls: string[] = []

    vi.stubGlobal('fetch', vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const method = init?.method ?? 'GET'
      calls.push(method)

      return Response.json({
        policies: {
          votePolicy: 'PUBLIC',
          editPolicy: 'PUBLIC',
          voteWindowStart: null,
          voteWindowEnd: null,
          voteLatitude: null,
          voteLongitude: null,
          voteRadiusMeters: null
        }
      })
    }))

    const user = userEvent.setup()

    render(
      <MusicPolicyEditor
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )

    await screen.findByLabelText('Qui peut voter ?')

    await user.click(screen.getByLabelText(
      'Limiter le vote à une zone GPS'
    ))

    await user.click(screen.getByRole('button', {
      name: 'Enregistrer les licences'
    }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(calls).toEqual(['GET'])
  })
})
