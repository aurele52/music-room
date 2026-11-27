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

test('Socket.IO - révocation immédiate des invitations', async (t) => {
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
  const sockets = []
  const userIds = []

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
      secret,
      {
        expiresIn: '1h',
        issuer: 'music-room',
        audience: 'music-room-api'
      }
    )
  }

  async function connect(authToken) {
    const socket = io(base, {
      auth: { token: authToken },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false
    })

    sockets.push(socket)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Connexion expirée')),
        3000
      )

      socket.once('connect', () => {
        clearTimeout(timeout)
        resolve(socket)
      })

      socket.once('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      socket.connect()
    })
  }

  async function join(socket, kind, eventId) {
    return new Promise((resolve, reject) => {
      socket.timeout(3000).emit(
        `${kind}:join`,
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

  function expectAccessChanged(socket, eventId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Notification de révocation absente')),
        3000
      )

      socket.once('event:access-changed', (payload) => {
        clearTimeout(timer)

        try {
          assert.equal(payload.eventId, eventId)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  async function remove(path, authToken) {
    const response = await fetch(`${base}/api/events${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    assert.equal(response.status, 200)
  }

  try {
    const alice = await createUser('Alice Révocation')
    const bob = await createUser('Bob Révocation')

    const a = token(alice)
    const b = token(bob)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Événement privé révocation',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000),
        visibility: 'PRIVATE'
      }
    })

    let invitation = await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    const socket = await connect(b)

    await t.test('Bob rejoint les deux salons privés', async () => {
      assert.equal(await join(socket, 'tracks', event.id), true)
      assert.equal(await join(socket, 'playlists', event.id), true)
    })

    await t.test('Départ volontaire notifié immédiatement', async () => {
      const notification = expectAccessChanged(socket, event.id)

      await remove(`/invitations/${invitation.id}`, b)
      await notification
    })

    await t.test('Départ volontaire retire les deux accès', async () => {
      assert.equal(await join(socket, 'tracks', event.id), false)
      assert.equal(await join(socket, 'playlists', event.id), false)
    })

    await t.test('Bob rejoint après une nouvelle invitation', async () => {
      invitation = await prisma.eventInvitation.create({
        data: {
          eventId: event.id,
          userId: bob.id,
          status: 'ACCEPTED'
        }
      })

      assert.equal(await join(socket, 'tracks', event.id), true)
      assert.equal(await join(socket, 'playlists', event.id), true)
    })

    await t.test('Expulsion par Alice notifiée immédiatement', async () => {
      const notification = expectAccessChanged(socket, event.id)

      await remove(
        `/${event.id}/invitations/${invitation.id}`,
        a
      )

      await notification
    })

    await t.test('Expulsion retire les deux accès', async () => {
      assert.equal(await join(socket, 'tracks', event.id), false)
      assert.equal(await join(socket, 'playlists', event.id), false)
    })

    await t.test('Lecture HTTP privée également interdite', async () => {
      const response = await fetch(
        `${base}/api/playlists/events/${event.id}`,
        {
          headers: { Authorization: `Bearer ${b}` }
        }
      )

      assert.equal(response.status, 404)
    })
  } finally {
    for (const socket of sockets) socket.disconnect()

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
