import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Playlist Editor - déduplication commune', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
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

  async function request(method, path, auth, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {})
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

  async function countItems(playlistId) {
    return prisma.playlistItem.count({
      where: { playlistId }
    })
  }

  async function revision(playlistId) {
    const playlist = await prisma.eventPlaylist.findUniqueOrThrow({
      where: { id: playlistId },
      select: { revision: true }
    })

    return playlist.revision
  }

  try {
    const alice = await createUser('Alice Déduplication')
    const bob = await createUser('Bob Déduplication')
    const charlie = await createUser('Charlie Déduplication')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Déduplication musicale',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000),
        visibility: 'PRIVATE'
      }
    })

    await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    const first = await prisma.eventPlaylist.create({
      data: {
        eventId: event.id,
        title: 'Playlist principale'
      }
    })

    const second = await prisma.eventPlaylist.create({
      data: {
        eventId: event.id,
        title: 'Playlist indépendante'
      }
    })

    const path = (id) => `/playlists/${id}/items`

    await t.test('Premier ajout individuel accepté', async () => {
      const result = await request(
        'POST', path(first.id), a,
        { title: 'One More Time', artist: 'Daft Punk' }
      )

      assert.equal(result.status, 201)
      assert.equal(await countItems(first.id), 1)
      assert.equal(await revision(first.id), 1)
    })

    await t.test('Même titre et artiste refusés', async () => {
      const result = await request(
        'POST', path(first.id), b,
        { title: 'One More Time', artist: 'Daft Punk' }
      )

      assert.equal(result.status, 409)
      assert.equal(await countItems(first.id), 1)
      assert.equal(await revision(first.id), 1)
    })

    await t.test('Casse et espaces ignorés', async () => {
      const result = await request(
        'POST', path(first.id), b,
        { title: '  ONE MORE TIME  ', artist: 'daft punk' }
      )

      assert.equal(result.status, 409)
      assert.equal(await countItems(first.id), 1)
      assert.equal(await revision(first.id), 1)
    })

    await t.test('Artiste différent autorisé', async () => {
      const result = await request(
        'POST', path(first.id), b,
        { title: 'One More Time', artist: 'Another Artist' }
      )

      assert.equal(result.status, 201)
      assert.equal(await countItems(first.id), 2)
      assert.equal(await revision(first.id), 2)
    })

    await t.test('Autre playlist indépendante', async () => {
      const result = await request(
        'POST', path(second.id), a,
        { title: 'One More Time', artist: 'Daft Punk' }
      )

      assert.equal(result.status, 201)
      assert.equal(await countItems(second.id), 1)
    })

    await t.test('Deux ajouts simultanés du même morceau', async () => {
      const results = await Promise.all([
        request(
          'POST', path(first.id), a,
          { title: 'Starlight', artist: 'Muse' }
        ),
        request(
          'POST', path(first.id), b,
          { title: 'starlight', artist: 'MUSE' }
        )
      ])

      assert.deepEqual(
        results.map((result) => result.status).sort(
          (left, right) => left - right
        ),
        [201, 409]
      )

      assert.equal(await countItems(first.id), 3)
      assert.equal(await revision(first.id), 3)
    })

    await t.test('Utilisateur extérieur toujours refusé', async () => {
      const result = await request(
        'POST', path(first.id), c,
        { title: 'Forbidden Song', artist: 'Test Artist' }
      )

      assert.equal(result.status, 404)
      assert.equal(await countItems(first.id), 3)
    })

    await t.test('Fin d’événement : ajout interdit', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          startsAt: new Date(Date.now() - 7200000),
          endsAt: new Date(Date.now() - 3600000)
        }
      })

      const result = await request(
        'POST', path(first.id), a,
        { title: 'Late Song', artist: 'Late Artist' }
      )

      assert.equal(result.status, 409)
    })
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
