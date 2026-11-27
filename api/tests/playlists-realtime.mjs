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

test('Playlist Editor - synchronisation Socket.IO', async (t) => {
  const databaseUrl = process.env.DATABASE_URL

  if (
    !databaseUrl ||
    new URL(databaseUrl).pathname !== '/musicroom_test'
  ) {
    throw new Error('musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const userIds = []
  const sockets = []

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
      const timer = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion Socket.IO expirée'))
      }, 3500)

      socket.once('connect', () => {
        clearTimeout(timer)
        resolve(socket)
      })

      socket.once('connect_error', (error) => {
        clearTimeout(timer)
        socket.disconnect()
        reject(error)
      })

      socket.connect()
    })
  }

  async function join(socket, eventId) {
    return new Promise((resolve, reject) => {
      socket.timeout(3000).emit(
        'playlists:join',
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

  async function expectNotification(socket, operation) {
    let timer

    const notification = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Notification playlist manquante'))
      }, 3000)

      socket.once('playlists:changed', (payload) => {
        clearTimeout(timer)
        resolve(payload)
      })
    })

    try {
      const result = await operation()
      assert.ok(
        result.status === 200 || result.status === 201,
        JSON.stringify(result)
      )

      assert.equal(await notification, undefined)
      return result
    } finally {
      clearTimeout(timer)
      socket.removeAllListeners('playlists:changed')
    }
  }

  try {
    const alice = await createUser('Alice Playlist Socket')
    const bob = await createUser('Bob Playlist Socket')
    const charlie = await createUser('Charlie Playlist Socket')

    const a = makeToken(alice)
    const b = makeToken(bob)
    const c = makeToken(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Playlist temps réel privée',
        startsAt: new Date(Date.now() + 48 * 3600000),
        endsAt: new Date(Date.now() + 52 * 3600000),
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
    let playlistId
    let firstId
    let secondId

    await t.test('Connexion sans JWT refusée', async () => {
      await assert.rejects(connect(undefined))
    })

    await t.test('Connexions authentifiées acceptées', async () => {
      aliceSocket = await connect(a)
      bobSocket = await connect(b)
      charlieSocket = await connect(c)

      assert.equal(aliceSocket.connected, true)
      assert.equal(bobSocket.connected, true)
    })

    await t.test('Organisateur rejoint le salon privé', async () => {
      assert.equal(await join(aliceSocket, event.id), true)
    })

    await t.test('Participant rejoint le salon privé', async () => {
      assert.equal(await join(bobSocket, event.id), true)
    })

    await t.test('Utilisateur extérieur refusé', async () => {
      assert.equal(await join(charlieSocket, event.id), false)
    })

    await t.test('Salon invalide refusé', async () => {
      assert.equal(await join(aliceSocket, 'invalid-id'), false)
    })

    await t.test('Création notifiée au participant', async () => {
      const result = await expectNotification(
        bobSocket,
        () => request(
          'POST',
          `/playlists/events/${event.id}`,
          a,
          { title: 'Playlist Rock', description: 'Test' }
        )
      )

      playlistId = result.body.playlist.id
    })

    await t.test('Ajout notifié à l’organisateur', async () => {
      const result = await expectNotification(
        aliceSocket,
        () => request(
          'POST',
          `/playlists/${playlistId}/items`,
          b,
          { title: 'Starlight', artist: 'Muse' }
        )
      )

      firstId = result.body.item.id
    })

    await t.test('Second ajout notifié au participant', async () => {
      const result = await expectNotification(
        bobSocket,
        () => request(
          'POST',
          `/playlists/${playlistId}/items`,
          a,
          { title: 'One More Time', artist: 'Daft Punk' }
        )
      )

      secondId = result.body.item.id
    })

    await t.test('Réorganisation notifiée', async () => {
      await expectNotification(
        bobSocket,
        () => request(
          'PUT',
          `/playlists/${playlistId}/order`,
          a,
          { itemIds: [secondId, firstId], revision: 2 }
        )
      )

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' }
      })

      assert.deepEqual(
        stored.map((item) => item.id),
        [secondId, firstId]
      )
    })

    await t.test('Retrait de morceau notifié', async () => {
      await expectNotification(
        aliceSocket,
        () => request(
          'DELETE',
          `/playlists/${playlistId}/items/${firstId}`,
          b
        )
      )
    })

    await t.test('Suppression de playlist notifiée', async () => {
      await expectNotification(
        bobSocket,
        () => request(
          'DELETE',
          `/playlists/${playlistId}`,
          a
        )
      )
    })

    await t.test('Accès révoqué après retrait', async () => {
      await prisma.eventInvitation.delete({
        where: { id: invitation.id }
      })

      assert.equal(await join(bobSocket, event.id), false)
    })

    await t.test('Session invalidée refuse le salon', async () => {
      await prisma.user.update({
        where: { id: charlie.id },
        data: {
          tokenVersion: { increment: 1 }
        }
      })

      assert.equal(await join(charlieSocket, event.id), false)
    })

    await t.test('API HTTP toujours cohérente', async () => {
      const result = await request(
        'GET',
        `/playlists/events/${event.id}`,
        a
      )

      assert.equal(result.status, 200)
      assert.deepEqual(result.body.playlists, [])
    })
  } finally {
    for (const socket of sockets) {
      socket.disconnect()
    }

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
