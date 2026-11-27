import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { io } from 'socket.io-client'

// Test d'intégration strictement isolé.
// Ne jamais utiliser le service mobile du port 3100.
const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Socket.IO - notifications privées des amis', async t => {
  const databaseUrl = process.env.DATABASE_URL

  if (
    !databaseUrl ||
    new URL(databaseUrl).pathname !== '/musicroom_test'
  ) {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret, 'JWT_SECRET obligatoire')

  const prisma = new PrismaClient()
  const userIds = []
  const sockets = []

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

  async function connect(authToken) {
    const socket = io(base, {
      auth: { token: authToken },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      timeout: 3000
    })

    sockets.push(socket)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion Socket.IO expirée'))
      }, 4000)

      socket.once('connect', () => {
        clearTimeout(timer)
        resolve(socket)
      })

      socket.once('connect_error', error => {
        clearTimeout(timer)
        socket.disconnect()
        reject(error)
      })

      socket.connect()
    })
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

  function observe(socket) {
    const notifications = []

    socket.on('friends:changed', payload => {
      notifications.push(payload)
    })

    return {
      notifications,
      next() {
        const previousCount = notifications.length

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            socket.off('friends:changed', handler)
            reject(new Error('Notification friends:changed absente'))
          }, 4000)

          const handler = payload => {
            clearTimeout(timer)
            socket.off('friends:changed', handler)
            resolve(payload)
          }

          socket.on('friends:changed', handler)

          // Une notification peut être arrivée juste
          // avant la création de cet observateur.
          if (notifications.length > previousCount) {
            clearTimeout(timer)
            socket.off('friends:changed', handler)
            resolve(notifications.at(-1))
          }
        })
      }
    }
  }

  // Il s'agit d'un délai borné pour vérifier une absence
  // de message dans le test, pas de polling applicatif.
  async function assertNoNotificationChange(
    observer,
    before,
    duration = 350
  ) {
    await new Promise(resolve => setTimeout(resolve, duration))
    assert.equal(observer.notifications.length, before)
  }

  try {
    const alice = await createUser('Alice Friends Realtime')
    const bob = await createUser('Bob Friends Realtime')
    const charlie = await createUser('Charlie Friends Realtime')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const aliceSocket = await connect(a)
    const bobSocket = await connect(b)
    const charlieSocket = await connect(c)

    const aliceObserver = observe(aliceSocket)
    const bobObserver = observe(bobSocket)
    const charlieObserver = observe(charlieSocket)

    let requestId

    await t.test('demande envoyée aux deux comptes', async () => {
      const aliceBefore = aliceObserver.notifications.length
      const bobBefore = bobObserver.notifications.length
      const charlieBefore = charlieObserver.notifications.length

      const [aliceNotification, bobNotification] = [
        aliceObserver.next(),
        bobObserver.next()
      ]

      const result = await request(
        'POST',
        '/friends/requests',
        a,
        { userId: bob.id }
      )

      assert.equal(result.status, 201)
      requestId = result.body.request.id

      assert.equal(await aliceNotification, undefined)
      assert.equal(await bobNotification, undefined)

      assert.equal(
        aliceObserver.notifications.length,
        aliceBefore + 1
      )
      assert.equal(
        bobObserver.notifications.length,
        bobBefore + 1
      )

      await assertNoNotificationChange(
        charlieObserver,
        charlieBefore
      )
    })

    await t.test('mutation refusée sans notification', async () => {
      const before = [
        aliceObserver.notifications.length,
        bobObserver.notifications.length,
        charlieObserver.notifications.length
      ]

      const result = await request(
        'POST',
        `/friends/requests/${requestId}/accept`,
        a
      )

      assert.equal(result.status, 404)

      await new Promise(resolve => setTimeout(resolve, 350))

      assert.deepEqual(
        [
          aliceObserver.notifications.length,
          bobObserver.notifications.length,
          charlieObserver.notifications.length
        ],
        before
      )
    })

    await t.test('acceptation notifiée aux deux comptes', async () => {
      const [receivedA, receivedB] = [
        aliceObserver.next(),
        bobObserver.next()
      ]

      const result = await request(
        'POST',
        `/friends/requests/${requestId}/accept`,
        b
      )

      assert.equal(result.status, 200)
      await Promise.all([receivedA, receivedB])

      const lists = await request('GET', '/friends', a)
      assert.equal(lists.status, 200)
      assert.equal(lists.body.friends.length, 1)
    })

    await t.test('suppression notifiée aux deux comptes', async () => {
      const [receivedA, receivedB] = [
        aliceObserver.next(),
        bobObserver.next()
      ]

      const result = await request(
        'DELETE',
        `/friends/${bob.id}`,
        a
      )

      assert.equal(result.status, 200)
      await Promise.all([receivedA, receivedB])

      const lists = await request('GET', '/friends', b)
      assert.equal(lists.status, 200)
      assert.equal(lists.body.friends.length, 0)
    })

    await t.test('Charlie ne reçoit aucune notification', async () => {
      assert.deepEqual(charlieObserver.notifications, [])
    })
  } finally {
    for (const socket of sockets) {
      socket.disconnect()
    }

    try {
      if (userIds.length > 0) {
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
