// @vitest-environment jsdom

import {
  afterEach, describe, expect, it, vi
} from 'vitest'

import {
  act, cleanup, fireEvent, render,
  renderHook, screen
} from '@testing-library/react'

import { useNavigation } from '../src/app/useNavigation'
import AppLayout from '../src/app/AppLayout'
import EventMusicTabs from '../src/features/events/components/EventMusicTabs'
import FriendsPage from '../src/pages/FriendsPage'
import type { Auth } from '../src/features/auth/useAuth'

vi.mock('../src/features/voting/TrackVote', () => ({
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="votes">{eventId}</div>
  )
}))

vi.mock('../src/features/playlists/PlaylistEditor', () => ({
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="playlists">{eventId}</div>
  )
}))

vi.mock('../src/features/player/LiveSession', () => ({
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="session">{eventId}</div>
  )
}))

vi.mock('../src/features/friends/Friends', () => ({
  default: ({ view }: { view: string }) => (
    <div data-testid="friends">{view}</div>
  )
}))

vi.mock('../src/features/friends/UserSearch', () => ({
  default: () => (
    <div data-testid="search">Recherche utilisateur</div>
  )
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('Navigation principale', () => {
  it('ouvre la page accueil par defaut', () => {
    const { result } = renderHook(() => useNavigation())

    expect(result.current.page).toBe('home')
  })

  it('ouvre la page demandee dans URL', () => {
    window.history.replaceState({}, '', '/?view=friends')

    const { result } = renderHook(() => useNavigation())

    expect(result.current.page).toBe('friends')
  })

  it('actualise URL lors de la navigation', () => {
    const { result } = renderHook(() => useNavigation())

    act(() => result.current.navigate('events'))

    expect(result.current.page).toBe('events')

    expect(
      new URLSearchParams(window.location.search).get('view')
    ).toBe('events')
  })

  it('retire le parametre view au retour accueil', () => {
    window.history.replaceState({}, '', '/?view=settings')

    const { result } = renderHook(() => useNavigation())

    act(() => result.current.navigate('home'))

    expect(result.current.page).toBe('home')
    expect(window.location.search).toBe('')
  })

  it('conserve les liens evenement', () => {
    window.history.replaceState({}, '', '/?event=event-test')

    const { result } = renderHook(() => useNavigation())

    act(() => result.current.navigate('events'))

    expect(
      new URLSearchParams(window.location.search).get('event')
    ).toBe('event-test')
  })

  it('reagit a une navigation navigateur', () => {
    const { result } = renderHook(() => useNavigation())

    act(() => {
      window.history.replaceState({}, '', '/?view=profile')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(result.current.page).toBe('profile')
  })

  it('le menu appelle la bonne destination', () => {
    const navigate = vi.fn()

    render(
      <AppLayout
        page="home"
        name="Alice"
        navigate={navigate}
        logout={() => {}}
      >
        Contenu
      </AppLayout>
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Mes événements'
    }))

    expect(navigate).toHaveBeenCalledWith('events')
  })

  it('le menu permet de se deconnecter', () => {
    const logout = vi.fn()

    render(
      <AppLayout
        page="home"
        name="Alice"
        navigate={() => {}}
        logout={logout}
      >
        Contenu
      </AppLayout>
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Se déconnecter'
    }))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})

describe('Onglets musicaux', () => {
  function mount(eventId = 'event-a') {
    return render(
      <EventMusicTabs
        eventId={eventId}
        token="token-test"
        onAuthError={() => false}
      />
    )
  }

  it('affiche les votes par defaut', () => {
    mount()

    expect(screen.getByTestId('votes')).toBeTruthy()
    expect(screen.queryByTestId('playlists')).toBeNull()
    expect(screen.queryByTestId('session')).toBeNull()
  })

  it('ouvre les playlists sur un onglet distinct', () => {
    mount()

    fireEvent.click(screen.getByRole('button', {
      name: 'Playlists'
    }))

    expect(screen.getByTestId('playlists')).toBeTruthy()
    expect(screen.queryByTestId('votes')).toBeNull()
  })

  it('conserve la session montee entre les onglets', () => {
    mount()

    fireEvent.click(screen.getByRole('button', {
      name: 'Session musicale'
    }))

    const session = screen.getByTestId('session')

    fireEvent.click(screen.getByRole('button', {
      name: 'Votes'
    }))

    expect(screen.getByTestId('session')).toBe(session)
    expect(session.closest('[hidden]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', {
      name: 'Session musicale'
    }))

    expect(screen.getByTestId('session')).toBe(session)
    expect(session.closest('[hidden]')).toBeNull()
  })

  it('reinitialise les onglets lors du changement evenement', () => {
    const view = mount()

    fireEvent.click(screen.getByRole('button', {
      name: 'Session musicale'
    }))

    view.rerender(
      <EventMusicTabs
        eventId="event-b"
        token="token-test"
        onAuthError={() => false}
      />
    )

    expect(screen.getByTestId('votes').textContent).toBe('event-b')
    expect(screen.queryByTestId('session')).toBeNull()
  })
})

describe('Navigation amis', () => {
  function mount() {
    const auth = {
      token: 'token-test',
      handleProtectedError: () => false
    } as Auth

    return render(<FriendsPage auth={auth} />)
  }

  it('separe les amis des demandes', () => {
    mount()

    expect(screen.getByTestId('friends').textContent)
      .toBe('friends')

    fireEvent.click(screen.getByRole('button', {
      name: 'Demandes'
    }))

    expect(screen.getByTestId('friends').textContent)
      .toBe('requests')
  })

  it('conserve la recherche montee entre les onglets', () => {
    mount()

    const search = screen.getByTestId('search')

    expect(search.closest('[hidden]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', {
      name: 'Rechercher'
    }))

    expect(search.closest('[hidden]')).toBeNull()

    fireEvent.click(screen.getByRole('button', {
      name: 'Mes amis'
    }))

    expect(screen.getByTestId('search')).toBe(search)
    expect(search.closest('[hidden]')).not.toBeNull()
  })
})
