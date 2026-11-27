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

test('V3.1 - licences et notifications Socket.IO', async (t) => {
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
        name,
        email: `${randomUUID()}@example.test`,
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
        expiresIn: '1h',
        issuer: 'music-room',
        audience: 'music-room-api'
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
      timeout: 3500
    })

    sockets.push(socket)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.disconnect()
        reject(new Error('Connexion Socket.IO expiree'))
      }, 4000)

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

  async function join(socket, channel, eventId) {
    return new Promise((resolve, reject) => {
      socket.timeout(3500).emit(
        `${channel}:join`,
        eventId,
        (error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result?.ok === true)
          }
        }
      )
    })
  }

  // Installer les écouteurs AVANT la requête HTTP.
  // Chaque connexion doit recevoir les deux événements.
  async function changeAndExpectNotifications(
    listeners,
    operation
  ) {
    const pending = new Set(
      listeners.map(
        (_, index) => `${index}:tracks:changed,${index}:playlists:changed`
      ).flatMap((item) => item.split(','))
    )

    const handlers = []
    let timer

    const received = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(
          'Notifications manquantes : ' + [...pending].join(', ')
        ))
      }, 5000)

      listeners.forEach((socket, index) => {
        for (const event of ['tracks:changed', 'playlists:changed']) {
          const key = `${index}:${event}`

          const handler = (payload) => {
            try {
              assert.equal(payload, undefined)
              pending.delete(key)

              if (pending.size === 0) resolve()
            } catch (error) {
              reject(error)
            }
          }

          socket.on(event, handler)
          handlers.push({ socket, event, handler })
        }
      })
    })

    // Empêcher une promesse rejetée non observée
    // en cas d'erreur HTTP avant la notification.
    void received.catch(() => {})

    try {
      const response = await operation()
      assert.equal(response.status, 200, JSON.stringify(response))
      await received
      return response
    } finally {
      clearTimeout(timer)

      for (const { socket, event, handler } of handlers) {
        socket.off(event, handler)
      }
    }
  }

  try {
    const organizer = await createUser('Organisateur WebSocket V31')
    const visitor = await createUser('Visiteur WebSocket V31')
    const invited = await createUser('Invite WebSocket V31')

    const o = makeToken(organizer)
    const v = makeToken(visitor)
    const i = makeToken(invited)

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: 'Licences temps reel V31',
        visibility: 'PUBLIC',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000)
      }
    })

    await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: invited.id,
        status: 'ACCEPTED'
      }
    })

    const track = await prisma.eventTrack.create({
      data: {
        eventId: event.id,
        proposerId: organizer.id,
        title: 'Morceau WebSocket',
        artist: 'Artiste WebSocket'
      }
    })

    const endpoint = `/events/${event.id}/music-policies`

    let visitorSocket
    let invitedSocket

    await t.test('Deux comptes connectes et abonnés', async () => {
      visitorSocket = await connect(v)
      invitedSocket = await connect(i)

      for (const socket of [visitorSocket, invitedSocket]) {
        assert.equal(
          await join(socket, 'tracks', event.id), true
        )
        assert.equal(
          await join(socket, 'playlists', event.id), true
        )
      }
    })

    await t.test('Restrictions notifiees aux deux comptes', async () => {
      await changeAndExpectNotifications(
        [visitorSocket, invitedSocket],
        () => request('PUT', endpoint, o, {
          votePolicy: 'INVITED_ONLY',
          editPolicy: 'INVITED_ONLY'
        })
      )
    })

    await t.test('Droits relus apres notification', async () => {
      const visitorTracks = await request(
        'GET', `/tracks/events/${event.id}`, v
      )
      const visitorPlaylists = await request(
        'GET', `/playlists/events/${event.id}`, v
      )

      assert.equal(visitorTracks.status, 200)
      assert.equal(visitorTracks.body.canVote, false)

      assert.equal(visitorPlaylists.status, 200)
      assert.equal(visitorPlaylists.body.canEdit, false)

      const invitedTracks = await request(
        'GET', `/tracks/events/${event.id}`, i
      )
      const invitedPlaylists = await request(
        'GET', `/playlists/events/${event.id}`, i
      )

      assert.equal(invitedTracks.status, 200)
      assert.equal(invitedTracks.body.canVote, true)

      assert.equal(invitedPlaylists.status, 200)
      assert.equal(invitedPlaylists.body.canEdit, true)
    })

    await t.test('Actions interdites apres revocation', async () => {
      const vote = await request(
        'POST', `/tracks/${track.id}/vote`, v
      )

      const playlist = await request(
        'POST', `/playlists/events/${event.id}`, v,
        { title: 'Playlist interdite' }
      )

      assert.equal(vote.status, 403)
      assert.equal(playlist.status, 403)
    })

    await t.test('Visiteur ne peut modifier les licences', async () => {
      const result = await request('PUT', endpoint, v, {
        votePolicy: 'PUBLIC',
        editPolicy: 'PUBLIC'
      })

      assert.equal(result.status, 404)

      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        select: {
          votePolicy: true,
          editPolicy: true
        }
      })

      assert.equal(stored.votePolicy, 'INVITED_ONLY')
      assert.equal(stored.editPolicy, 'INVITED_ONLY')
    })

    await t.test('Reconnexion avec licences restrictives', async () => {
      visitorSocket.disconnect()

      visitorSocket = await connect(v)

      assert.equal(
        await join(visitorSocket, 'tracks', event.id), true
      )
      assert.equal(
        await join(visitorSocket, 'playlists', event.id), true
      )

      const result = await request(
        'GET', `/tracks/events/${event.id}`, v
      )

      assert.equal(result.body.canVote, false)
    })

    await t.test('Retour public notifie aux deux comptes', async () => {
      await changeAndExpectNotifications(
        [visitorSocket, invitedSocket],
        () => request('PUT', endpoint, o, {
          votePolicy: 'PUBLIC',
          editPolicy: 'PUBLIC'
        })
      )
    })

    await t.test('Droits retrouves et utilisables', async () => {
      const ranking = await request(
        'GET', `/tracks/events/${event.id}`, v
      )

      const playlists = await request(
        'GET', `/playlists/events/${event.id}`, v
      )

      assert.equal(ranking.body.canVote, true)
      assert.equal(playlists.body.canEdit, true)

      const vote = await request(
        'POST', `/tracks/${track.id}/vote`, v
      )
      assert.equal(vote.status, 201)

      const playlist = await request(
        'POST', `/playlists/events/${event.id}`, v,
        { title: 'Playlist publique' }
      )
      assert.equal(playlist.status, 201)
    })
  } finally {
    for (const socket of sockets) {
      socket.disconnect()
    }

    await prisma.event.deleteMany({
      where: { organizerId: { in: userIds } }
    })

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
