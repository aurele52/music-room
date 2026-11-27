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

test('Socket.IO - authentification et salons musicaux', async (t) => {
  const databaseUrl = process.env.DATABASE_URL

  if (
    !databaseUrl ||
    new URL(databaseUrl).pathname !== '/musicroom_test'
  ) {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const users = []
  const sockets = []

  async function createUser(name) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        emailVerifiedAt: new Date()
      }
    })

    users.push(user.id)
    return user
  }

  function makeToken(user) {
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

  async function connect(token) {
    const socket = io(base, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
      autoConnect: false
    })

    sockets.push(socket)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion Socket.IO expirée'))
      }, 3500)

      socket.once('connect', () => {
        clearTimeout(timeout)
        resolve(socket)
      })

      socket.once('connect_error', (error) => {
        clearTimeout(timeout)
        socket.disconnect()
        reject(error)
      })

      socket.connect()
    })
  }

  async function join(socket, eventId) {
    return new Promise((resolve, reject) => {
      socket.timeout(3000).emit(
        'tracks:join',
        eventId,
        (error, result) => {
          if (error) {
            reject(error)
            return
          }

          resolve(result.ok)
        }
      )
    })
  }

  async function postTrack(eventId, token, catalogTrackId) {
    const response = await fetch(
      `${base}/api/tracks/events/${eventId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          catalogTrackId
        })
      }
    )

    return response.status
  }

  try {
    const alice = await createUser('Alice Socket')
    const bob = await createUser('Bob Socket')
    const charlie = await createUser('Charlie Socket')

    const a = makeToken(alice)
    const b = makeToken(bob)
    const c = makeToken(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Concert Socket.IO privé',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000),
        visibility: 'PRIVATE'
      }
    })

    const invitation = await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    let aliceSocket
    let bobSocket
    let charlieSocket

    await t.test('Connexion sans JWT refusée', async () => {
      await assert.rejects(connect(undefined))
    })

    await t.test('JWT invalide refusé', async () => {
      await assert.rejects(connect('invalid-token'))
    })

    await t.test('Connexions JWT valides acceptées', async () => {
      aliceSocket = await connect(a)
      bobSocket = await connect(b)
      charlieSocket = await connect(c)

      assert.equal(aliceSocket.connected, true)
      assert.equal(bobSocket.connected, true)
      assert.equal(charlieSocket.connected, true)
    })

    await t.test('Organisateur rejoint le salon privé', async () => {
      assert.equal(await join(aliceSocket, event.id), true)
    })

    await t.test('Participant confirmé rejoint le salon', async () => {
      assert.equal(await join(bobSocket, event.id), true)
    })

    await t.test('Utilisateur extérieur refusé', async () => {
      assert.equal(await join(charlieSocket, event.id), false)
    })

    await t.test('Identifiant de salon invalide refusé', async () => {
      assert.equal(await join(aliceSocket, 'invalid-id'), false)
    })

    await t.test('Notification reçue après une proposition', async () => {
      const received = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Notification manquante')),
          3000
        )

        bobSocket.once('tracks:changed', (payload) => {
          clearTimeout(timeout)
          resolve(payload)
        })
      })

      assert.equal(
        await postTrack(event.id, a, 'blue-horizon'),
        201
      )

      assert.equal(await received, undefined)
    })

    await t.test('Retrait de participant révoque le salon', async () => {
      await prisma.eventInvitation.delete({
        where: { id: invitation.id }
      })

      assert.equal(await join(bobSocket, event.id), false)
    })

    await t.test('Session invalidée refuse un abonnement', async () => {
      await prisma.user.update({
        where: { id: charlie.id },
        data: { tokenVersion: { increment: 1 } }
      })

      assert.equal(await join(charlieSocket, event.id), false)
    })

    await t.test('Morceaux toujours accessibles en HTTP', async () => {
      const response = await fetch(
        `${base}/api/tracks/events/${event.id}`,
        {
          headers: { Authorization: `Bearer ${a}` }
        }
      )

      assert.equal(response.status, 200)

      const data = await response.json()
      assert.equal(data.tracks.length, 1)
    })
  } finally {
    for (const socket of sockets) socket.disconnect()

    await prisma.event.deleteMany({
      where: { organizerId: { in: users } }
    })

    await prisma.user.deleteMany({
      where: { id: { in: users } }
    })

    await prisma.$disconnect()
  }
})
