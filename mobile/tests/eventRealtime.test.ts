import test from 'node:test'
import assert from 'node:assert/strict'
import type { Socket } from 'socket.io-client'
import {
  createEventRealtimeManager
} from '../src/lib/eventRealtime'

const eventId =
  '123e4567-e89b-42d3-a456-426614174201'

type Handler = (...args: any[]) => void

class FakeSocket {
  connected = false
  connects = 0
  disconnects = 0

  handlers = new Map<string, Handler[]>()
  events: { name: string; args: any[] }[] = []

  on(name: string, handler: Handler) {
    const existing = this.handlers.get(name) ?? []
    existing.push(handler)
    this.handlers.set(name, existing)
    return this
  }

  emit(name: string, ...args: any[]) {
    this.events.push({ name, args })
    return this
  }

  fire(name: string, ...args: any[]) {
    for (const handler of this.handlers.get(name) ?? []) {
      handler(...args)
    }
  }

  connect() {
    this.connects++
    this.connected = true
    this.fire('connect')
    return this
  }

  disconnect() {
    this.disconnects++
    this.connected = false
    this.fire('disconnect')
    return this
  }

  ack(name: string, index: number, ok: boolean) {
    const request = this.events.filter(
      event => event.name === name
    )[index]

    assert.ok(request)
    const callback = request.args[1] as Handler
    callback({ ok })
  }

  count(name: string) {
    return this.events.filter(
      event => event.name === name
    ).length
  }
}

function setup() {
  const sockets: FakeSocket[] = []

  const manager = createEventRealtimeManager(() => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket as unknown as Socket
  })

  const counters = () => {
    const calls = { changed: 0, access: 0 }

    return {
      calls,
      listener: {
        onChanged: () => { calls.changed++ },
        onAccessChanged: () => { calls.access++ }
      }
    }
  }

  return { manager, sockets, counters }
}

test('connexion et ACK tracks', () => {
  const { manager, sockets, counters } = setup()
  const sub = counters()

  const stop = manager.subscribe(
    'token-a', eventId, 'tracks', sub.listener
  )

  assert.equal(sockets.length, 1)
  assert.equal(sockets[0]!.count('tracks:join'), 1)

  sockets[0]!.ack('tracks:join', 0, true)
  assert.equal(sub.calls.changed, 1)

  stop()
})

test('canaux partagent une connexion', () => {
  const { manager, sockets, counters } = setup()

  const a = manager.subscribe(
    'token-a', eventId, 'tracks', counters().listener
  )
  const b = manager.subscribe(
    'token-a', eventId, 'playlists', counters().listener
  )

  assert.equal(sockets.length, 1)
  assert.equal(sockets[0]!.connects, 1)

  a()
  assert.equal(sockets[0]!.disconnects, 0)
  b()
  assert.equal(sockets[0]!.disconnects, 1)
})

test('notification du canal concerne uniquement ses abonnes', () => {
  const { manager, sockets, counters } = setup()
  const tracks = counters()
  const playlists = counters()

  const a = manager.subscribe(
    'token-a', eventId, 'tracks', tracks.listener
  )
  const b = manager.subscribe(
    'token-a', eventId, 'playlists', playlists.listener
  )

  sockets[0]!.fire('tracks:changed')
  assert.equal(tracks.calls.changed, 1)
  assert.equal(playlists.calls.changed, 0)

  a()
  b()
})

test('ACK tardif apres desabonnement ignore', () => {
  const { manager, sockets, counters } = setup()
  const sub = counters()

  const stop = manager.subscribe(
    'token-a', eventId, 'tracks', sub.listener
  )

  stop()
  sockets[0]!.ack('tracks:join', 0, true)

  assert.equal(sub.calls.changed, 0)
})

test('reconnexion invalide les anciens ACK', () => {
  const { manager, sockets, counters } = setup()
  const sub = counters()

  const stop = manager.subscribe(
    'token-a', eventId, 'tracks', sub.listener
  )

  const socket = sockets[0]!
  socket.connected = false
  socket.fire('disconnect')
  socket.connected = true
  socket.fire('connect')

  assert.equal(socket.count('tracks:join'), 2)

  socket.ack('tracks:join', 0, true)
  assert.equal(sub.calls.changed, 0)

  socket.ack('tracks:join', 1, true)
  assert.equal(sub.calls.changed, 1)

  stop()
})

test('refus de salon declenche la revalidation HTTP', () => {
  const { manager, sockets, counters } = setup()
  const sub = counters()

  const stop = manager.subscribe(
    'token-a', eventId, 'playlists', sub.listener
  )

  sockets[0]!.ack('playlists:join', 0, false)

  assert.equal(sub.calls.access, 1)
  stop()
})

test('changement acces cible le bon evenement', () => {
  const { manager, sockets, counters } = setup()
  const sub = counters()

  const stop = manager.subscribe(
    'token-a', eventId, 'tracks', sub.listener
  )

  sockets[0]!.fire('event:access-changed', {
    eventId: '123e4567-e89b-42d3-a456-426614174202'
  })

  assert.equal(sub.calls.access, 0)

  sockets[0]!.fire('event:access-changed', { eventId })
  assert.equal(sub.calls.access, 1)

  stop()
})

test('sessions distinctes ne partagent pas le socket', () => {
  const { manager, sockets, counters } = setup()

  const a = manager.subscribe(
    'token-a', eventId, 'tracks', counters().listener
  )
  const b = manager.subscribe(
    'token-b', eventId, 'tracks', counters().listener
  )

  assert.equal(sockets.length, 2)
  a()
  b()
})

test('evenement invalide refuse', () => {
  const { manager, sockets, counters } = setup()

  assert.throws(() => manager.subscribe(
    'token-a', 'invalide', 'tracks', counters().listener
  ))

  assert.equal(sockets.length, 0)
})


// V3.2C6D - regression multi-abonnements

test('deux abonnes au meme canal restent independants', () => {
  const { manager, sockets, counters } = setup()
  const first = counters()
  const second = counters()

  const stopFirst = manager.subscribe(
    'token-a', eventId, 'tracks', first.listener
  )
  const stopSecond = manager.subscribe(
    'token-a', eventId, 'tracks', second.listener
  )

  // Le deuxième abonné reçoit un rafraîchissement initial.
  assert.equal(second.calls.changed, 1)

  stopFirst()
  assert.equal(sockets[0]!.count('tracks:leave'), 0)

  sockets[0]!.fire('tracks:changed')

  assert.equal(first.calls.changed, 0)
  assert.equal(second.calls.changed, 2)

  stopSecond()
  assert.equal(sockets[0]!.count('tracks:leave'), 1)
  assert.equal(sockets[0]!.disconnects, 1)
})

test('reabonnement apres fermeture utilise un socket neuf', () => {
  const { manager, sockets, counters } = setup()

  const stopFirst = manager.subscribe(
    'token-a', eventId, 'tracks',
    counters().listener
  )

  stopFirst()

  const stopSecond = manager.subscribe(
    'token-a', eventId, 'tracks',
    counters().listener
  )

  assert.equal(sockets.length, 2)
  assert.equal(sockets[0]!.disconnects, 1)
  assert.equal(sockets[1]!.connects, 1)

  stopSecond()
})

test('session changed ne notifie que le canal session', () => {
  const { manager, sockets, counters } = setup()

  const session = counters()
  const tracks = counters()

  const stopSession = manager.subscribe(
    'token-a', eventId, 'session', session.listener
  )

  const stopTracks = manager.subscribe(
    'token-a', eventId, 'tracks', tracks.listener
  )

  sockets[0]!.fire('session:changed')

  assert.equal(session.calls.changed, 1)
  assert.equal(tracks.calls.changed, 0)

  stopSession()
  stopTracks()
})

test('ACK ancien ignore apres leave puis join', () => {
  const { manager, sockets, counters } = setup()
  const first = counters()
  const second = counters()

  const stopFirst = manager.subscribe(
    'token-a', eventId, 'tracks', first.listener
  )

  const keepAlive = manager.subscribe(
    'token-a', eventId, 'playlists',
    counters().listener
  )

  stopFirst()

  const stopSecond = manager.subscribe(
    'token-a', eventId, 'tracks', second.listener
  )

  assert.equal(sockets.length, 1)
  assert.equal(sockets[0]!.count('tracks:join'), 2)

  sockets[0]!.ack('tracks:join', 0, true)
  assert.equal(second.calls.changed, 0)

  sockets[0]!.ack('tracks:join', 1, true)
  assert.equal(second.calls.changed, 1)

  stopSecond()
  keepAlive()
})

test('reconnexion retablit les deux canaux', () => {
  const { manager, sockets, counters } = setup()

  const tracks = counters()
  const playlists = counters()

  const stopTracks = manager.subscribe(
    'token-a', eventId, 'tracks', tracks.listener
  )

  const stopPlaylists = manager.subscribe(
    'token-a', eventId, 'playlists', playlists.listener
  )

  const socket = sockets[0]!

  socket.connected = false
  socket.fire('disconnect')

  socket.connected = true
  socket.fire('connect')

  assert.equal(socket.count('tracks:join'), 2)
  assert.equal(socket.count('playlists:join'), 2)

  socket.ack('tracks:join', 1, true)
  socket.ack('playlists:join', 1, true)

  assert.equal(tracks.calls.changed, 1)
  assert.equal(playlists.calls.changed, 1)

  stopTracks()
  stopPlaylists()
})

test('revocation acces avertit les deux canaux', () => {
  const { manager, sockets, counters } = setup()

  const tracks = counters()
  const playlists = counters()

  const stopTracks = manager.subscribe(
    'token-a', eventId, 'tracks', tracks.listener
  )

  const stopPlaylists = manager.subscribe(
    'token-a', eventId, 'playlists', playlists.listener
  )

  sockets[0]!.fire('event:access-changed', {
    eventId
  })

  assert.equal(tracks.calls.access, 1)
  assert.equal(playlists.calls.access, 1)

  stopTracks()
  stopPlaylists()
})
