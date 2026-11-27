import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

// Fabrique de sockets contrôlables par les tests.
const sockets = vi.hoisted(() => {
  type Listener = (...args: any[]) => void

  type FakeSocket = {
    connected: boolean
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    emit: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    trigger: (event: string, ...args: any[]) => void
    acknowledgements: Map<string, Listener[]>
    joins: string[]
    leaves: string[]
  }

  const instances: FakeSocket[] = []

  const create = () => {
    const listeners = new Map<string, Listener[]>()
    const acknowledgements = new Map<string, Listener[]>()
    const joins: string[] = []
    const leaves: string[] = []

    const socket: FakeSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      trigger(event, ...args) {
        for (const callback of listeners.get(event) ?? []) {
          callback(...args)
        }
      },
      acknowledgements,
      joins,
      leaves
    }

    socket.on.mockImplementation(
      (event: string, callback: Listener) => {
        const callbacks = listeners.get(event) ?? []
        callbacks.push(callback)
        listeners.set(event, callbacks)
        return socket
      }
    )

    socket.connect.mockImplementation(() => {
      // On contrôle l'arrivée de 'connect' séparément.
      return socket
    })

    socket.disconnect.mockImplementation(() => {
      socket.connected = false
      socket.trigger('disconnect', 'io client disconnect')
      return socket
    })

    socket.emit.mockImplementation(
      (event: string, ...args: any[]) => {
        if (event.endsWith(':join')) {
          joins.push(event)
          const callback = args.at(-1)

          if (typeof callback === 'function') {
            const callbacks = acknowledgements.get(event) ?? []
            callbacks.push(callback)
            acknowledgements.set(event, callbacks)
          }
        }

        if (event.endsWith(':leave')) {
          leaves.push(event)
        }

        return socket
      }
    )

    instances.push(socket)
    return socket
  }

  return { instances, create }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => sockets.create())
}))

type Manager = typeof import('../src/services/realtime/eventRealtime')

let manager: Manager

function connected(index = 0) {
  const socket = sockets.instances[index]
  socket.connected = true
  socket.trigger('connect')
  return socket
}

function acknowledge(
  socket: (typeof sockets.instances)[number],
  channel: 'tracks' | 'playlists',
  ok = true
) {
  const event = `${channel}:join`
  const pending = socket.acknowledgements.get(event) ?? []
  const callback = pending.shift()

  if (!callback) {
    throw new Error(`Aucun ACK disponible : ${event}`)
  }

  callback({ ok })
}

function subscribe(
  token: string,
  eventId: string,
  channel: 'tracks' | 'playlists'
) {
  const onChanged = vi.fn()
  const onAccessChanged = vi.fn()

  const stop = manager.subscribeEventRealtime(
    token,
    eventId,
    channel,
    { onChanged, onAccessChanged }
  )

  return { stop, onChanged, onAccessChanged }
}

beforeEach(async () => {
  // Un module neuf : les connexions des tests restent isolées.
  vi.resetModules()
  sockets.instances.length = 0

  manager = await import('../src/services/realtime/eventRealtime')
})

describe('Gestionnaire Socket.IO partagé', () => {
  const eventId = '11111111-1111-4111-8111-111111111111'
  const otherEvent = '22222222-2222-4222-8222-222222222222'

  it('partage une seule connexion entre votes et playlists', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')

    expect(sockets.instances).toHaveLength(1)

    const socket = connected()

    expect(socket.connect).toHaveBeenCalledTimes(1)
    expect(socket.joins).toEqual([
      'tracks:join',
      'playlists:join'
    ])

    acknowledge(socket, 'tracks')
    acknowledge(socket, 'playlists')

    expect(tracks.onChanged).toHaveBeenCalledTimes(1)
    expect(playlists.onChanged).toHaveBeenCalledTimes(1)

    tracks.stop()
    playlists.stop()
  })

  it('isole les notifications des deux canaux', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')
    const socket = connected()

    acknowledge(socket, 'tracks')
    acknowledge(socket, 'playlists')

    tracks.onChanged.mockClear()
    playlists.onChanged.mockClear()

    socket.trigger('tracks:changed')

    expect(tracks.onChanged).toHaveBeenCalledTimes(1)
    expect(playlists.onChanged).not.toHaveBeenCalled()

    socket.trigger('playlists:changed')

    expect(playlists.onChanged).toHaveBeenCalledTimes(1)

    tracks.stop()
    playlists.stop()
  })

  it('garde la connexion quand un seul canal ferme', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')
    const socket = connected()

    tracks.stop()

    expect(socket.leaves).toContain('tracks:leave')
    expect(socket.disconnect).not.toHaveBeenCalled()

    playlists.stop()

    expect(socket.leaves).toContain('playlists:leave')
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })

  it('ne quitte pas un canal tant qu’un abonné reste', () => {
    const first = subscribe('token-a', eventId, 'tracks')
    const second = subscribe('token-a', eventId, 'tracks')
    const socket = connected()

    acknowledge(socket, 'tracks')

    first.stop()

    expect(socket.leaves).not.toContain('tracks:leave')

    socket.trigger('tracks:changed')

    expect(first.onChanged).toHaveBeenCalledTimes(1)
    expect(second.onChanged).toHaveBeenCalledTimes(2)

    second.stop()

    expect(socket.leaves).toContain('tracks:leave')
  })

  it('réabonne les deux canaux après reconnexion', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')
    const socket = connected()

    acknowledge(socket, 'tracks')
    acknowledge(socket, 'playlists')

    socket.connected = false
    socket.trigger('disconnect', 'transport close')

    connected()

    expect(socket.joins).toEqual([
      'tracks:join',
      'playlists:join',
      'tracks:join',
      'playlists:join'
    ])

    acknowledge(socket, 'tracks')
    acknowledge(socket, 'playlists')

    expect(tracks.onChanged).toHaveBeenCalledTimes(2)
    expect(playlists.onChanged).toHaveBeenCalledTimes(2)

    tracks.stop()
    playlists.stop()
  })

  it('ignore un accusé de réception après désabonnement', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')
    const socket = connected()

    tracks.stop()

    acknowledge(socket, 'tracks')

    expect(tracks.onChanged).not.toHaveBeenCalled()

    acknowledge(socket, 'playlists')

    expect(playlists.onChanged).toHaveBeenCalledTimes(1)

    playlists.stop()
  })

  it('ignore un ancien accusé de réception après reconnexion', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const socket = connected()

    socket.connected = false
    socket.trigger('disconnect', 'transport close')

    connected()

    // Le premier ACK correspond à la connexion précédente.
    acknowledge(socket, 'tracks')

    expect(tracks.onChanged).not.toHaveBeenCalled()

    acknowledge(socket, 'tracks')

    expect(tracks.onChanged).toHaveBeenCalledTimes(1)

    tracks.stop()
  })

  it('notifie les deux panneaux après révocation', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const playlists = subscribe('token-a', eventId, 'playlists')
    const socket = connected()

    socket.trigger('event:access-changed', {
      eventId: otherEvent
    })

    expect(tracks.onAccessChanged).not.toHaveBeenCalled()
    expect(playlists.onAccessChanged).not.toHaveBeenCalled()

    socket.trigger('event:access-changed', { eventId })

    expect(tracks.onAccessChanged).toHaveBeenCalledTimes(1)
    expect(playlists.onAccessChanged).toHaveBeenCalledTimes(1)

    tracks.stop()
    playlists.stop()
  })

  it('sépare les sessions et les événements différents', () => {
    const a = subscribe('token-a', eventId, 'tracks')
    const b = subscribe('token-b', eventId, 'tracks')
    const c = subscribe('token-a', otherEvent, 'tracks')

    expect(sockets.instances).toHaveLength(3)

    a.stop()
    b.stop()
    c.stop()
  })

  it('ferme la connexion seulement après le dernier abonné', () => {
    const first = subscribe('token-a', eventId, 'tracks')
    const second = subscribe('token-a', eventId, 'tracks')
    const socket = connected()

    first.stop()

    expect(socket.disconnect).not.toHaveBeenCalled()

    second.stop()
    second.stop()

    expect(socket.disconnect).toHaveBeenCalledTimes(1)

    const replacement = subscribe('token-a', eventId, 'tracks')

    expect(sockets.instances).toHaveLength(2)

    replacement.stop()
  })

  it('ne rafraîchit pas les données si le join est refusé', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const socket = connected()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    acknowledge(socket, 'tracks', false)

    expect(tracks.onChanged).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalled()

    tracks.stop()
    warning.mockRestore()
  })
  it('partage le canal session avec les autres panneaux', () => {
    const tracks = subscribe('token-a', eventId, 'tracks')
    const onChanged = vi.fn()
    const onAccessChanged = vi.fn()

    const stopSession = manager.subscribeEventRealtime(
      'token-a',
      eventId,
      'session',
      { onChanged, onAccessChanged }
    )

    expect(sockets.instances).toHaveLength(1)

    const socket = connected()

    expect(socket.joins).toContain('session:join')

    acknowledge(socket, 'tracks')
    acknowledge(socket, 'session')

    socket.trigger('session:changed')
    expect(onChanged).toHaveBeenCalledTimes(2)

    tracks.stop()
    expect(socket.disconnect).not.toHaveBeenCalled()

    stopSession()
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })

})
