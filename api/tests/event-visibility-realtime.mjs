import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { io } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}
const channels = ['tracks', 'playlists', 'session']

test('Socket.IO - révocation des trois salons', async t => {
  if (
    !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).pathname !== '/musicroom_test'
  ) {
    throw new Error('musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const userIds = []
  const sockets = []
  let eventId = null

  async function createUser(name) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        visibility: 'PUBLIC',
        emailVerifiedAt: new Date()
      }
    })

    userIds.push(user.id)
    return user
  }

  function token(user) {
    return jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      secret,
      {
        issuer: 'music-room',
        audience: 'music-room-api',
        expiresIn: '1h'
      }
    )
  }

  async function connect(authToken) {
    const socket = io(base, {
      auth: { token: authToken },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      timeout: 3000
    })

    sockets.push(socket)

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion expirée'))
      }, 4000)

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

    return socket
  }

  async function join(socket, channel) {
    return new Promise((resolve, reject) => {
      socket.timeout(3000).emit(
        `${channel}:join`,
        eventId,
        (error, result) => {
          if (error) {
            reject(error)
            return
          }

          resolve(result?.ok)
        }
      )
    })
  }

  async function expectChannels(socket, expected) {
    for (const channel of channels) {
      assert.equal(
        await join(socket, channel),
        expected,
        `${channel}:join attendu ${expected}`
      )
    }
  }

  function observeAccess(socket) {
    const received = []
    const waiters = new Set()

    socket.on('event:access-changed', payload => {
      received.push(payload)

      for (const check of [...waiters]) {
        check()
      }
    })

    return {
      received,

      waitFor(count) {
        if (received.length >= count) {
          return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            waiters.delete(check)
            reject(new Error(
              `Révocation absente : ${count} attendue(s)`
            ))
          }, 4000)

          function check() {
            if (received.length >= count) {
              clearTimeout(timer)
              waiters.delete(check)
              resolve()
            }
          }

          waiters.add(check)
          check()
        })
      }
    }
  }

  async function request(method, path, authToken, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) })
    })

    return {
      status: response.status,
      body: await response.json()
    }
  }

  const startsAt = new Date(Date.now() + 86400000)
  const endsAt = new Date(Date.now() + 90000000)

  function eventBody(visibility) {
    return {
      title: 'Test révocation trois salons',
      description: 'Test Socket.IO isolé',
      location: 'Salle de test',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      visibility
    }
  }

  try {
    const alice = await createUser('Alice Revocation')
    const bob = await createUser('Bob Revocation')
    const charlie = await createUser('Charlie Revocation')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const created = await request(
      'POST',
      '/events',
      a,
      eventBody('PUBLIC')
    )

    assert.equal(
      created.status,
      201,
      JSON.stringify(created.body)
    )

    eventId = created.body.event.id

    // Bob est autorisé même après le passage en privé.
    await prisma.eventInvitation.create({
      data: {
        eventId,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    const socketA = await connect(a)
    const socketB = await connect(b)
    const socketC = await connect(c)

    const accessA = observeAccess(socketA)
    const accessB = observeAccess(socketB)
    const accessC = observeAccess(socketC)

    await t.test('trois utilisateurs rejoignent les trois salons publics', async () => {
      await expectChannels(socketA, true)
      await expectChannels(socketB, true)
      await expectChannels(socketC, true)
    })

    await t.test('passage public vers privé : Charlie révoqué', async () => {
      const mutation = await request(
        'PUT',
        `/events/${eventId}`,
        a,
        eventBody('PRIVATE')
      )

      assert.equal(
        mutation.status,
        200,
        JSON.stringify(mutation.body)
      )

      await accessC.waitFor(1)

      assert.deepEqual(
        accessC.received[0],
        { eventId }
      )

      // La réponse HTTP est émise après la réconciliation.
      await expectChannels(socketC, false)
    })

    await t.test('Alice et Bob restent autorisés', async () => {
      await expectChannels(socketA, true)
      await expectChannels(socketB, true)

      assert.equal(accessA.received.length, 0)
      assert.equal(accessB.received.length, 0)
    })

    await t.test('reconnexion de Charlie toujours refusée', async () => {
      socketC.disconnect()

      const newSocketC = await connect(c)

      await expectChannels(newSocketC, false)
    })

    await t.test('suppression : révocation des comptes autorisés', async () => {
      const mutation = await request(
        'DELETE',
        `/events/${eventId}`,
        a
      )

      assert.equal(
        mutation.status,
        200,
        JSON.stringify(mutation.body)
      )

      await Promise.all([
        accessA.waitFor(1),
        accessB.waitFor(1)
      ])

      assert.deepEqual(accessA.received[0], { eventId })
      assert.deepEqual(accessB.received[0], { eventId })

      await expectChannels(socketA, false)
      await expectChannels(socketB, false)

      eventId = null
    })

    await t.test('événement supprimé inaccessible par HTTP', async () => {
      const result = await request(
        'GET',
        `/events/${created.body.event.id}`,
        a
      )

      assert.equal(result.status, 404)
    })

    await t.test('une suppression interdite ne notifie personne', async () => {
      // Un tiers ne doit pas déclencher de mutation ni de
      // révocation en essayant de supprimer la soirée.
      const fresh = await request(
        'POST',
        '/events',
        a,
        eventBody('PRIVATE')
      )

      assert.equal(fresh.status, 201)

      eventId = fresh.body.event.id

      const before = [
        accessA.received.length,
        accessB.received.length,
        accessC.received.length
      ]

      const denied = await request(
        'DELETE',
        `/events/${eventId}`,
        c
      )

      assert.equal(denied.status, 404)

      await new Promise(resolve => setTimeout(resolve, 200))

      assert.deepEqual(
        [
          accessA.received.length,
          accessB.received.length,
          accessC.received.length
        ],
        before
      )
    })
  } finally {
    for (const socket of sockets) {
      socket.disconnect()
    }

    try {
      if (eventId) {
        await prisma.event.deleteMany({
          where: {
            id: eventId,
            organizerId: { in: userIds }
          }
        })
      }

      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        })
      }
    } finally {
      await prisma.$disconnect()
    }
  }
})
