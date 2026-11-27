import test from 'node:test'
import assert from 'node:assert/strict'
import type { Socket } from 'socket.io-client'
import {
  createEventRealtimeManager
} from '../src/lib/eventRealtime'

const eventA = '11111111-1111-4111-8111-111111111111'
const eventB = '22222222-2222-4222-8222-222222222222'

type Handler = (...args: unknown[]) => void

class FakeSocket {
  connected = false
  disconnectCount = 0
  private handlers = new Map<string, Handler[]>()

  on(name: string, handler: Handler) {
    const current = this.handlers.get(name) ?? []
    current.push(handler)
    this.handlers.set(name, current)
    return this
  }

  emit(name: string, ...args: unknown[]) {
    if (name.endsWith(':join')) {
      const ack = args.at(-1)

      if (typeof ack === 'function') {
        ;(ack as (result: { ok: boolean }) => void)({
          ok: true
        })
      }
    }

    return this
  }

  fire(name: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(name) ?? []) {
      handler(...args)
    }
  }

  connect() {
    this.connected = true
    this.fire('connect')
    return this
  }

  disconnect() {
    this.disconnectCount++
    this.connected = false
    this.fire('disconnect')
    return this
  }
}

function setup() {
  const sockets: FakeSocket[] = []

  const manager = createEventRealtimeManager(() => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket as unknown as Socket
  })

  return { manager, sockets }
}

function counter() {
  const calls = { changed: 0, access: 0 }

  return {
    calls,
    listener: {
      onChanged: () => { calls.changed++ },
      onAccessChanged: () => { calls.access++ }
    }
  }
}

test('logout ferme tous les sockets du JWT', () => {
  const { manager, sockets } = setup()

  const first = counter()
  const second = counter()

  const stopA = manager.subscribe(
    'token-alice', eventA, 'tracks', first.listener
  )

  const stopB = manager.subscribe(
    'token-alice', eventB, 'playlists', second.listener
  )

  assert.equal(sockets.length, 2)
  assert.equal(first.calls.changed, 1)
  assert.equal(second.calls.changed, 1)

  manager.closeToken('token-alice')

  assert.equal(sockets[0]!.connected, false)
  assert.equal(sockets[1]!.connected, false)
  assert.equal(sockets[0]!.disconnectCount, 1)
  assert.equal(sockets[1]!.disconnectCount, 1)

  sockets[0]!.fire('tracks:changed')
  sockets[1]!.fire('playlists:changed')

  assert.equal(first.calls.changed, 1)
  assert.equal(second.calls.changed, 1)

  stopA()
  stopB()

  assert.equal(sockets[0]!.disconnectCount, 1)
  assert.equal(sockets[1]!.disconnectCount, 1)
})

test('changement de compte preserve le nouveau JWT', () => {
  const { manager, sockets } = setup()

  const alice = counter()
  const bob = counter()

  const stopAlice = manager.subscribe(
    'token-alice', eventA, 'tracks', alice.listener
  )

  const stopBob = manager.subscribe(
    'token-bob', eventA, 'tracks', bob.listener
  )

  manager.closeToken('token-alice')

  assert.equal(sockets[0]!.connected, false)
  assert.equal(sockets[1]!.connected, true)

  sockets[0]!.fire('tracks:changed')
  sockets[1]!.fire('tracks:changed')

  assert.equal(alice.calls.changed, 1)
  assert.equal(bob.calls.changed, 2)

  stopAlice()
  stopBob()
})

test('ancien socket ne notifie pas une nouvelle session', () => {
  const { manager, sockets } = setup()

  const previous = counter()

  const stopOld = manager.subscribe(
    'token-alice', eventA, 'tracks',
    previous.listener
  )

  const oldSocket = sockets[0]!

  manager.closeToken('token-alice')

  const current = counter()

  const stopNew = manager.subscribe(
    'token-alice', eventA, 'tracks',
    current.listener
  )

  assert.equal(sockets.length, 2)

  oldSocket.fire('tracks:changed')
  oldSocket.fire('event:access-changed', {
    eventId: eventA
  })

  assert.equal(previous.calls.changed, 1)
  assert.equal(previous.calls.access, 0)
  assert.equal(current.calls.changed, 1)

  stopOld()

  assert.equal(sockets[1]!.connected, true)

  stopNew()
  assert.equal(sockets[1]!.connected, false)
})


test('ancien desabonnement ne ferme pas la nouvelle session', () => {
  const { manager, sockets } = setup()

  const old = counter()
  const current = counter()
  const another = counter()

  const stopOld = manager.subscribe(
    'token-alice',
    eventA,
    'tracks',
    old.listener
  )

  assert.equal(sockets.length, 1)

  manager.closeToken('token-alice')

  assert.equal(sockets[0]!.connected, false)

  const stopCurrent = manager.subscribe(
    'token-alice',
    eventA,
    'tracks',
    current.listener
  )

  assert.equal(sockets.length, 2)
  assert.equal(sockets[1]!.connected, true)

  // L'ancien composant React termine son nettoyage
  // après la création du nouveau composant.
  stopOld()

  // Un deuxième abonné doit réutiliser le nouveau socket.
  const stopAnother = manager.subscribe(
    'token-alice',
    eventA,
    'tracks',
    another.listener
  )

  assert.equal(
    sockets.length,
    2,
    'Un ancien désabonnement a détruit la connexion récente'
  )

  sockets[1]!.fire('tracks:changed')

  assert.equal(old.calls.changed, 1)
  assert.equal(current.calls.changed, 2)
  assert.equal(another.calls.changed, 2)

  stopAnother()
  assert.equal(sockets[1]!.connected, true)

  stopCurrent()
  assert.equal(sockets[1]!.connected, false)
})
