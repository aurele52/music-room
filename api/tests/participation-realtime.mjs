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

test('Socket.IO - invitations et participations', async t => {
  if (
    !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).pathname !== '/musicroom_test'
  ) {
    throw new Error('Base musicroom_test obligatoire')
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

  async function request(method, path, token, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
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

  async function connect(token) {
    const socket = io(base, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
      timeout: 3000
    })

    sockets.push(socket)

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion expiree'))
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

  function observe(socket, eventName) {
    const received = []
    const pending = new Set()

    socket.on(eventName, payload => {
      received.push(payload)

      for (const check of [...pending]) {
        check()
      }
    })

    return {
      received,
      count() {
        return received.length
      },
      waitFor(count) {
        if (received.length >= count) {
          return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
          const check = () => {
            if (received.length >= count) {
              clearTimeout(timer)
              pending.delete(check)
              resolve()
            }
          }

          const timer = setTimeout(() => {
            pending.delete(check)
            reject(new Error(
              `${eventName}: notification ${count} manquante`
            ))
          }, 4000)

          pending.add(check)
          check()
        })
      }
    }
  }

  async function expectMutation({
    method,
    path,
    token,
    body,
    status,
    targets,
    outsiders = []
  }) {
    const before = targets.map(observer => observer.count())
    const outsiderBefore = outsiders.map(
      observer => observer.count()
    )

    const result = await request(method, path, token, body)
    assert.equal(
      result.status,
      status,
      JSON.stringify(result.body)
    )

    await Promise.all(
      targets.map((observer, index) =>
        observer.waitFor(before[index] + 1)
      )
    )

    // Temporisation de test pour contrôler l'absence
    // de notification, pas un polling applicatif.
    await new Promise(resolve => setTimeout(resolve, 200))

    outsiders.forEach((observer, index) => {
      assert.equal(observer.count(), outsiderBefore[index])
    })

    return result
  }

  try {
    const alice = await createUser('Alice Participation')
    const bob = await createUser('Bob Participation')
    const charlie = await createUser('Charlie Participation')

    const a = makeToken(alice)
    const b = makeToken(bob)
    const c = makeToken(charlie)

    // Preparation de l'amitie necessaire pour inviter Bob.
    const friendshipRequest = await request(
      'POST',
      '/friends/requests',
      a,
      { userId: bob.id }
    )

    assert.equal(friendshipRequest.status, 201)

    const acceptedFriend = await request(
      'POST',
      `/friends/requests/${friendshipRequest.body.request.id}/accept`,
      b
    )

    assert.equal(acceptedFriend.status, 200)

    // Soiree publique pour tester les invitations.
    const startsAt = new Date(Date.now() + 86400000)
    const endsAt = new Date(Date.now() + 90000000)

    const event = await request(
      'POST',
      '/events',
      a,
      {
        title: 'Soiree test participation realtime',
        description: 'Tests Socket.IO',
        location: 'Salle de test',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        visibility: 'PUBLIC'
      }
    )

    assert.equal(event.status, 201, JSON.stringify(event.body))
    eventId = event.body.event.id

    const socketA = await connect(a)
    const socketB = await connect(b)
    const socketC = await connect(c)

    const eventsA = observe(socketA, 'events:changed')
    const eventsB = observe(socketB, 'events:changed')
    const eventsC = observe(socketC, 'events:changed')

    const participantsA = observe(
      socketA, 'event:participants-changed'
    )
    const participantsB = observe(
      socketB, 'event:participants-changed'
    )
    const participantsC = observe(
      socketC, 'event:participants-changed'
    )

    let invitationId

    await t.test('Alice invite Bob', async () => {
      const result = await expectMutation({
        method: 'POST',
        path: `/events/${eventId}/invitations`,
        token: a,
        body: { userId: bob.id },
        status: 201,
        targets: [
          eventsA, eventsB,
          participantsA, participantsB
        ],
        outsiders: [eventsC, participantsC]
      })

      invitationId = result.body.invitation.id
    })

    await t.test('Bob accepte et Alice est notifiee', async () => {
      await expectMutation({
        method: 'POST',
        path: `/events/invitations/${invitationId}/accept`,
        token: b,
        status: 200,
        targets: [
          eventsA, eventsB,
          participantsA, participantsB
        ],
        outsiders: [eventsC, participantsC]
      })
    })

    await t.test('Charlie ne peut pas retirer Bob', async () => {
      const counts = [
        participantsA.count(),
        participantsB.count(),
        participantsC.count()
      ]

      const result = await request(
        'DELETE',
        `/events/${eventId}/invitations/${invitationId}`,
        c
      )

      assert.ok([403, 404].includes(result.status))

      await new Promise(resolve => setTimeout(resolve, 250))

      assert.deepEqual([
        participantsA.count(),
        participantsB.count(),
        participantsC.count()
      ], counts)
    })

    await t.test('Alice retire Bob', async () => {
      await expectMutation({
        method: 'DELETE',
        path: `/events/${eventId}/invitations/${invitationId}`,
        token: a,
        status: 200,
        targets: [
          eventsA, eventsB,
          participantsA, participantsB
        ],
        outsiders: [eventsC, participantsC]
      })
    })

    await t.test('aucune donnee personnelle dans les signaux', () => {
      for (const observer of [eventsA, eventsB, eventsC]) {
        assert.ok(
          observer.received.every(
            payload => payload === undefined
          )
        )
      }

      for (const observer of [
        participantsA,
        participantsB,
        participantsC
      ]) {
        assert.ok(
          observer.received.every(payload =>
            payload &&
            Object.keys(payload).length === 1 &&
            payload.eventId === eventId
          )
        )
      }
    })
  } finally {
    for (const socket of sockets) {
      socket.disconnect()
    }

    try {
      if (eventId) {
        await prisma.event.deleteMany({
          where: { id: eventId }
        })
      }

      if (userIds.length) {
        await prisma.friendship.deleteMany({
          where: {
            OR: [
              { userLowId: { in: userIds } },
              { userHighId: { in: userIds } }
            ]
          }
        })

        await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        })
      }
    } finally {
      await prisma.$disconnect()
    }
  }
})
