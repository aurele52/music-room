import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFriendsRealtimeManager,
  type FriendsSocket
} from '../src/lib/friendsRealtime'

function mockSocket() {
  const handlers = new Map<string, (() => void)[]>()
  let connections = 0
  let disconnections = 0

  const socket: FriendsSocket = {
    connected: false,

    on(name, listener) {
      handlers.set(name, [
        ...(handlers.get(name) ?? []),
        listener
      ])
    },

    connect() {
      connections++
      socket.connected = true
      emit('connect')
    },

    disconnect() {
      disconnections++
      socket.connected = false
    }
  }

  function emit(name: string) {
    for (const callback of handlers.get(name) ?? []) {
      callback()
    }
  }

  return {
    socket,
    emit,
    connections: () => connections,
    disconnections: () => disconnections
  }
}

test('connexion, notification et nettoyage', () => {
  const fake = mockSocket()
  const manager = createFriendsRealtimeManager(
    () => fake.socket
  )

  let updates = 0
  const stop = manager.subscribe('token-A', () => updates++)

  assert.equal(fake.connections(), 1)
  assert.equal(updates, 1)

  fake.emit('friends:changed')
  assert.equal(updates, 2)

  stop()
  assert.equal(fake.disconnections(), 1)

  fake.emit('friends:changed')
  assert.equal(updates, 2)
})

test('plusieurs abonnés partagent une connexion', () => {
  const fake = mockSocket()
  const manager = createFriendsRealtimeManager(
    () => fake.socket
  )

  let a = 0
  let b = 0

  const stopA = manager.subscribe('token-A', () => a++)
  const stopB = manager.subscribe('token-A', () => b++)

  assert.equal(fake.connections(), 1)

  fake.emit('friends:changed')
  assert.equal(a, 2)
  assert.equal(b, 2)

  stopA()
  assert.equal(fake.disconnections(), 0)

  stopB()
  assert.equal(fake.disconnections(), 1)
})

test('reconnexion et isolation des comptes', () => {
  const sockets = new Map<string, ReturnType<typeof mockSocket>>()

  const manager = createFriendsRealtimeManager(token => {
    const fake = mockSocket()
    sockets.set(token, fake)
    return fake.socket
  })

  let alice = 0
  let bob = 0

  const stopA = manager.subscribe('alice', () => alice++)
  const stopB = manager.subscribe('bob', () => bob++)

  sockets.get('alice')!.emit('friends:changed')

  assert.equal(alice, 2)
  assert.equal(bob, 1)

  sockets.get('alice')!.emit('connect')
  assert.equal(alice, 3)

  stopA()
  stopB()
})

test('abonnement sans session refusé', () => {
  const manager = createFriendsRealtimeManager(
    () => mockSocket().socket
  )

  assert.throws(() =>
    manager.subscribe('  ', () => {})
  )
})

test('domaines independants sur une connexion', () => {
  const fake = mockSocket()
  const manager = createFriendsRealtimeManager(
    () => fake.socket
  )

  let friends = 0
  let events = 0
  let participants = 0

  const stopFriends = manager.subscribe(
    'compte-A', () => friends++
  )

  const stopEvents = manager.subscribeAccount(
    'compte-A',
    'events:changed',
    () => events++
  )

  const stopParticipants = manager.subscribeAccount(
    'compte-A',
    'event:participants-changed',
    () => participants++
  )

  assert.equal(fake.connections(), 1)

  const initial = [friends, events, participants]

  fake.emit('events:changed')

  assert.deepEqual(
    [friends, events, participants],
    [initial[0], initial[1] + 1, initial[2]]
  )

  fake.emit('friends:changed')
  assert.equal(friends, initial[0] + 1)

  fake.emit('event:participants-changed')
  assert.equal(participants, initial[2] + 1)

  stopFriends()
  stopEvents()

  assert.equal(fake.disconnections(), 0)

  stopParticipants()
  assert.equal(fake.disconnections(), 1)
})

test('reconnexion synchronise tous les domaines', () => {
  const fake = mockSocket()
  const manager = createFriendsRealtimeManager(
    () => fake.socket
  )

  let friends = 0
  let events = 0

  const stopFriends = manager.subscribe(
    'compte-A', () => friends++
  )

  const stopEvents = manager.subscribeAccount(
    'compte-A',
    'events:changed',
    () => events++
  )

  const previousFriends = friends
  const previousEvents = events

  fake.emit('connect')

  assert.equal(friends, previousFriends + 1)
  assert.equal(events, previousEvents + 1)

  stopFriends()
  stopEvents()
})

test('ancien abonnement ne ferme pas une nouvelle session', () => {
  // Correction V3.3F3E1B : type explicite.
  const sockets: ReturnType<typeof mockSocket>[] = []

  const manager = createFriendsRealtimeManager(() => {
    const fake = mockSocket()
    sockets.push(fake)
    return fake.socket
  })

  const oldStop = manager.subscribe(
    'compte-A', () => {}
  )

  manager.closeToken('compte-A')

  const newStop = manager.subscribeAccount(
    'compte-A',
    'events:changed',
    () => {}
  )

  oldStop()

  assert.equal(sockets[1].disconnections(), 0)

  newStop()

  assert.equal(sockets[1].disconnections(), 1)
})
