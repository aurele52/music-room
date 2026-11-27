import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('V3.1B - licences musicales', async (t) => {
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

  async function user(name) {
    const result = await prisma.user.create({
      data: {
        name,
        email: `${randomUUID()}@example.test`,
        emailVerifiedAt: new Date()
      }
    })
    users.push(result.id)
    return result
  }

  function token(value) {
    return jwt.sign(
      { sub: value.id, ver: value.tokenVersion },
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

  try {
    const organizer = await user('Organisateur politique')
    const visitor = await user('Visiteur politique')
    const invited = await user('Invite politique')

    const o = token(organizer)
    const v = token(visitor)
    const i = token(invited)

    const event = await prisma.event.create({
      data: {
        title: 'Licences musicales V31B',
        organizerId: organizer.id,
        visibility: 'PUBLIC',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000)
      }
    })

    const track = await prisma.eventTrack.create({
      data: {
        eventId: event.id,
        proposerId: organizer.id,
        title: 'Musique de test',
        artist: 'Artiste de test'
      }
    })

    const root = `/events/${event.id}/music-policies`

    await t.test('Politiques publiques par defaut', async () => {
      const result = await request('GET', root, o)
      assert.equal(result.status, 200)
      assert.equal(result.body.policies.votePolicy, 'PUBLIC')
      assert.equal(result.body.policies.editPolicy, 'PUBLIC')
    })

    await t.test('Visiteur ne configure pas les licences', async () => {
      const result = await request('PUT', root, v, {
        votePolicy: 'INVITED_ONLY',
        editPolicy: 'INVITED_ONLY'
      })
      assert.equal(result.status, 404)
    })

    await t.test('Valeurs invalides refusees', async () => {
      const result = await request('PUT', root, o, {
        votePolicy: 'INVALID',
        editPolicy: 'PUBLIC'
      })
      assert.equal(result.status, 400)
    })

    await t.test('Organisateur restreint les licences', async () => {
      const result = await request('PUT', root, o, {
        votePolicy: 'INVITED_ONLY',
        editPolicy: 'INVITED_ONLY'
      })
      assert.equal(result.status, 200)
    })

    await t.test('Visiteur ne peut plus voter', async () => {
      const result = await request(
        'POST', `/tracks/${track.id}/vote`, v
      )
      assert.equal(result.status, 403)
    })

    await t.test('Visiteur ne peut plus editer', async () => {
      const result = await request(
        'POST', `/playlists/events/${event.id}`, v,
        { title: 'Interdite' }
      )
      assert.equal(result.status, 403)
    })

    await t.test('Invite accepte conserve ses droits', async () => {
      await prisma.eventInvitation.create({
        data: {
          eventId: event.id,
          userId: invited.id,
          status: 'ACCEPTED'
        }
      })

      const vote = await request(
        'POST', `/tracks/${track.id}/vote`, i
      )
      assert.equal(vote.status, 201)

      const playlist = await request(
        'POST', `/playlists/events/${event.id}`, i,
        { title: 'Playlist invite' }
      )
      assert.equal(playlist.status, 201)
    })

    await t.test('Retour au mode public', async () => {
      const result = await request('PUT', root, o, {
        votePolicy: 'PUBLIC',
        editPolicy: 'PUBLIC'
      })

      assert.equal(result.status, 200)

      const vote = await request(
        'POST', `/tracks/${track.id}/vote`, v
      )
      assert.equal(vote.status, 201)

      const playlist = await request(
        'POST', `/playlists/events/${event.id}`, v,
        { title: 'Playlist visiteur' }
      )
      assert.equal(playlist.status, 201)
    })

    await t.test('Lecture des licences protegee', async () => {
      const result = await request('GET', root, v)
      assert.equal(result.status, 404)
    })
  } finally {
    await prisma.event.deleteMany({
      where: { organizerId: { in: users } }
    })
    await prisma.user.deleteMany({
      where: { id: { in: users } }
    })
    await prisma.$disconnect()
  }
})
