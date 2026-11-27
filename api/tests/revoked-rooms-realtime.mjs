import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { io as clientIo } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'

test('Aucune émission après révocation des salons', async t => {
  assert.equal(
    new URL(process.env.DATABASE_URL).pathname,
    '/musicroom_test'
  )

  process.loadEnvFile('.env')

  const {
    setupRealtime,
    reconcileEventSocketAccess,
    notifyTracksChanged,
    notifyPlaylistsChanged,
    notifySessionChanged
  } = await import('../src/realtime.ts')

  const prisma = new PrismaClient()
  const http = createServer()
  const server = new Server(http, {
    transports: ['websocket']
  })

  setupRealtime(server)

  // Barrière d'acquittement : garantit que les paquets
  // précédents ont été traités par chaque client.
  server.on('connection', socket => {
    socket.on('test:barrier', reply => {
      socket.timeout(3000).emit(
        'test:flush',
        error => reply(!error)
      )
    })
  })

  const clients = []
  const userIds = []
  let eventId = null

  async function createUser(name) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        emailVerifiedAt: new Date()
      }
    })
    userIds.push(user.id)
    return user
  }

  function token(user) {
    return jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      process.env.JWT_SECRET,
      {
        issuer: 'music-room',
        audience: 'music-room-api',
        expiresIn: '1h'
      }
    )
  }

  async function connect(user) {
    const address = http.address()
    const socket = clientIo(
      `http://127.0.0.1:${address.port}`,
      {
        auth: { token: token(user) },
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
        timeout: 3000
      }
    )

    clients.push(socket)

    const received = {
      tracks: 0,
      playlists: 0,
      session: 0,
      access: []
    }

    for (const channel of [
      'tracks', 'playlists', 'session'
    ]) {
      socket.on(`${channel}:changed`, () => {
        received[channel]++
      })
    }

    socket.on('event:access-changed', payload => {
      received.access.push(payload)
    })

    socket.on('test:flush', reply => reply())

    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Connexion expiree')),
        4000
      )

      socket.once('connect', () => {
        clearTimeout(timer)
        resolve()
      })

      socket.once('connect_error', error => {
        clearTimeout(timer)
        reject(error)
      })

      socket.connect()
    })

    return { socket, received }
  }

  async function joinAll(client, expected) {
    for (const channel of [
      'tracks', 'playlists', 'session'
    ]) {
      const allowed = await new Promise((resolve, reject) => {
        client.socket.timeout(3000).emit(
          `${channel}:join`,
          eventId,
          (error, result) => {
            if (error) reject(error)
            else resolve(result?.ok)
          }
        )
      })

      assert.equal(
        allowed,
        expected,
        `${channel}:join`
      )
    }
  }

  function roomsOf(client) {
    const socket = server.sockets.sockets.get(
      client.socket.id
    )
    assert.ok(socket, 'Socket serveur absent')
    return socket.rooms
  }

  function assertMembership(client, expected) {
    const rooms = roomsOf(client)

    for (const channel of [
      'tracks', 'playlists', 'session'
    ]) {
      assert.equal(
        rooms.has(`event:${eventId}:${channel}`),
        expected,
        `Salons ${channel} incorrects`
      )
    }
  }

  async function flush() {
    await Promise.all(clients
      .filter(socket => socket.connected)
      .map(socket => new Promise((resolve, reject) => {
        socket.timeout(4000).emit(
          'test:barrier',
          (error, result) => {
            if (error) reject(error)
            else if (!result) {
              reject(new Error('Barriere refusee'))
            } else resolve()
          }
        )
      })))
  }

  async function notifyAll() {
    await notifyTracksChanged(eventId)
    await notifyPlaylistsChanged(eventId)
    await notifySessionChanged(eventId)
    await flush()
  }

  function snapshot(client) {
    return [
      client.received.tracks,
      client.received.playlists,
      client.received.session
    ]
  }

  function assertIncrement(client, previous, count) {
    assert.deepEqual(
      snapshot(client),
      previous.map(value => value + count)
    )
  }

  try {
    const existing = await prisma.$queryRaw`
      SELECT current_database() AS name
    `
    assert.equal(existing[0].name, 'musicroom_test')

    await new Promise(resolve => {
      http.listen(0, '127.0.0.1', resolve)
    })

    const alice = await createUser('Alice Rooms Test')
    const bob = await createUser('Bob Rooms Test')
    const charlie = await createUser('Charlie Rooms Test')

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Test des révocations Socket.IO',
        visibility: 'PUBLIC',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000)
      }
    })

    eventId = event.id

    await prisma.eventInvitation.create({
      data: {
        eventId,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    const a = await connect(alice)
    const b = await connect(bob)
    const c = await connect(charlie)

    await t.test('trois abonnements par utilisateur', async () => {
      for (const client of [a, b, c]) {
        await joinAll(client, true)
        assertMembership(client, true)
      }
    })

    await t.test('émissions publiques reçues par tous', async () => {
      await notifyAll()
      for (const client of [a, b, c]) {
        assert.deepEqual(snapshot(client), [1, 1, 1])
      }
    })

    await t.test('révocation effective du tiers', async () => {
      await prisma.event.update({
        where: { id: eventId },
        data: { visibility: 'PRIVATE' }
      })

      await reconcileEventSocketAccess(eventId)
      await flush()

      assertMembership(a, true)
      assertMembership(b, true)
      assertMembership(c, false)

      assert.deepEqual(c.received.access, [{ eventId }])
      assert.deepEqual(a.received.access, [])
      assert.deepEqual(b.received.access, [])
    })

    await t.test('aucune notification après révocation', async () => {
      const beforeA = snapshot(a)
      const beforeB = snapshot(b)
      const beforeC = snapshot(c)

      await notifyAll()

      assertIncrement(a, beforeA, 1)
      assertIncrement(b, beforeB, 1)
      assertIncrement(c, beforeC, 0)

      await joinAll(c, false)
      assertMembership(c, false)
    })

    await t.test('suppression et départ des derniers abonnés', async () => {
      await prisma.event.delete({
        where: { id: eventId }
      })

      await reconcileEventSocketAccess(eventId)
      await flush()

      for (const client of [a, b, c]) {
        assertMembership(client, false)
      }

      assert.deepEqual(a.received.access, [{ eventId }])
      assert.deepEqual(b.received.access, [{ eventId }])
      assert.deepEqual(c.received.access, [{ eventId }])
    })

    await t.test('aucune émission après suppression', async () => {
      const previous = [a, b, c].map(snapshot)

      await notifyAll()

      for (const [index, client] of [a, b, c].entries()) {
        assert.deepEqual(
          snapshot(client),
          previous[index]
        )
        await joinAll(client, false)
      }
    })

    eventId = null
  } finally {
    for (const client of clients) {
      client.disconnect()
    }

    await new Promise(resolve => server.close(resolve))

    try {
      if (eventId) {
        await prisma.event.deleteMany({
          where: {
            id: eventId,
            organizerId: { in: userIds }
          }
        })
      }

      if (userIds.length) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        })
      }
    } finally {
      await prisma.$disconnect()
    }
  }
})
