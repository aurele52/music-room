import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { io } from 'socket.io-client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Evenements - notifications Socket.IO privees', async t => {
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
  const users = []
  const sockets = []
  let eventId = null

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
        reject(new Error('Connexion Socket.IO expiree'))
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

  function observe(socket, event) {
    const notifications = []
    const pending = new Set()

    socket.on(event, payload => {
      notifications.push(payload)
      for (const callback of [...pending]) callback()
    })

    return {
      notifications,
      count: () => notifications.length,
      waitFor(count) {
        if (notifications.length >= count) {
          return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(check)
            reject(new Error(
              `Notification ${event} manquante (${count})`
            ))
          }, 4000)

          const check = () => {
            if (notifications.length >= count) {
              clearTimeout(timer)
              pending.delete(check)
              resolve()
            }
          }

          pending.add(check)
          check()
        })
      }
    }
  }

  async function request(method, path, auth, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
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

  function eventBody(visibility, title) {
    return {
      title,
      description: 'Test de notification',
      location: 'Salle de test',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      visibility
    }
  }

  try {
    const alice = await createUser('Alice Events Realtime')
    const bob = await createUser('Bob Events Realtime')
    const charlie = await createUser('Charlie Events Realtime')

    const a = token(alice)
    const c = token(charlie)

    const aliceSocket = await connect(a)
    const bobSocket = await connect(token(bob))
    const charlieSocket = await connect(c)

    const personalA = observe(aliceSocket, 'events:changed')
    const personalB = observe(bobSocket, 'events:changed')
    const personalC = observe(charlieSocket, 'events:changed')

    const discoveryA = observe(
      aliceSocket, 'events:discovery-changed'
    )
    const discoveryB = observe(
      bobSocket, 'events:discovery-changed'
    )
    const discoveryC = observe(
      charlieSocket, 'events:discovery-changed'
    )

    await t.test('creation publique notifiee', async () => {
      const result = await request(
        'POST', '/events', a,
        eventBody('PUBLIC', 'Evenement realtime public')
      )

      assert.equal(result.status, 201, JSON.stringify(result.body))
      eventId = result.body.event.id

      await Promise.all([
        personalA.waitFor(1),
        discoveryA.waitFor(1),
        discoveryB.waitFor(1),
        discoveryC.waitFor(1)
      ])

      assert.equal(personalB.count(), 0)
      assert.equal(personalC.count(), 0)
    })

    await t.test('ajout d un invite en base de test', async () => {
      await prisma.eventInvitation.create({
        data: {
          eventId,
          userId: bob.id,
          status: 'PENDING'
        }
      })
    })

    await t.test('passage public vers prive', async () => {
      const result = await request(
        'PUT',
        `/events/${eventId}`,
        a,
        eventBody('PRIVATE', 'Evenement realtime prive')
      )

      assert.equal(result.status, 200, JSON.stringify(result.body))

      await Promise.all([
        personalA.waitFor(2),
        personalB.waitFor(1),
        discoveryA.waitFor(2),
        discoveryB.waitFor(2),
        discoveryC.waitFor(2)
      ])

      assert.equal(personalC.count(), 0)
    })

    await t.test('modification interdite sans notification', async () => {
      const before = [
        personalA.count(),
        personalB.count(),
        personalC.count(),
        discoveryA.count()
      ]

      const result = await request(
        'PUT',
        `/events/${eventId}`,
        c,
        eventBody('PUBLIC', 'Modification interdite')
      )

      assert.equal(result.status, 404)

      // Delai borne uniquement pour verifier l'absence
      // de notification. Aucun polling applicatif.
      await new Promise(resolve => setTimeout(resolve, 300))

      assert.deepEqual([
        personalA.count(),
        personalB.count(),
        personalC.count(),
        discoveryA.count()
      ], before)
    })

    await t.test('suppression privee notifiee', async () => {
      const discoveryBefore = discoveryA.count()

      const result = await request(
        'DELETE',
        `/events/${eventId}`,
        a
      )

      assert.equal(result.status, 200, JSON.stringify(result.body))
      eventId = null

      await Promise.all([
        personalA.waitFor(3),
        personalB.waitFor(2)
      ])

      assert.equal(personalC.count(), 0)
      assert.equal(discoveryA.count(), discoveryBefore)
    })

    await t.test('notifications sans donnees privees', () => {
      for (const observer of [
        personalA, personalB, discoveryA,
        discoveryB, discoveryC
      ]) {
        assert.ok(
          observer.notifications.every(
            payload => payload === undefined
          )
        )
      }
    })
  } finally {
    for (const socket of sockets) socket.disconnect()

    try {
      if (eventId) {
        await prisma.event.deleteMany({
          where: {
            id: eventId,
            organizerId: { in: users }
          }
        })
      }

      if (users.length) {
        await prisma.user.deleteMany({
          where: { id: { in: users } }
        })
      }
    } finally {
      await prisma.$disconnect()
    }
  }
})
