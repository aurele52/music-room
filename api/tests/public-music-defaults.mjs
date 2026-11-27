import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('V3.1A - conformite des droits publics par defaut', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const ids = []

  async function user(name) {
    const result = await prisma.user.create({
      data: {
        name,
        email: `${randomUUID()}@example.test`,
        emailVerifiedAt: new Date()
      }
    })

    ids.push(result.id)
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
    const organizer = await user('Organisateur public V31')
    const visitor = await user('Visiteur public V31')

    const o = token(organizer)
    const v = token(visitor)

    const startsAt = new Date(Date.now() + 86400000)
    const endsAt = new Date(Date.now() + 90000000)

    let publicEventId
    let privateEventId
    let trackId

    await t.test('Creation publique par defaut', async () => {
      const result = await request('POST', '/events', o, {
        title: 'Soiree publique V31',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.event.visibility, 'PUBLIC')

      publicEventId = result.body.event.id

      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: publicEventId }
      })

      assert.equal(stored.visibility, 'PUBLIC')
    })

    await t.test('Visiteur peut consulter le public', async () => {
      const result = await request(
        'GET', `/events/${publicEventId}`, v
      )

      assert.equal(result.status, 200)
    })

    await t.test('Organisateur ajoute un morceau', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${publicEventId}`,
        o,
        {
          catalogTrackId: 'blue-horizon'
        }
      )

      assert.equal(result.status, 201)
      trackId = result.body.track.id
    })

    await t.test('Visiteur voit son droit de vote', async () => {
      const result = await request(
        'GET', `/tracks/events/${publicEventId}`, v
      )

      assert.equal(result.status, 200)
      assert.equal(result.body.canVote, true)
      assert.equal(result.body.canParticipate, true)
    })

    await t.test('Visiteur vote sans invitation', async () => {
      const result = await request(
        'POST', `/tracks/${trackId}/vote`, v
      )

      assert.equal(result.status, 201)

      const stored = await prisma.trackVote.findUnique({
        where: {
          trackId_userId: {
            trackId,
            userId: visitor.id
          }
        }
      })

      assert.ok(stored)
    })

    await t.test('Visiteur propose sans invitation', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${publicEventId}`,
        v,
        {
          catalogTrackId: 'summer-night'
        }
      )

      assert.equal(result.status, 201)
      assert.equal(result.body.track.proposerId, visitor.id)

      const stored = await prisma.eventTrack.findUnique({
        where: { id: result.body.track.id }
      })

      assert.ok(stored)
      assert.equal(stored.proposerId, visitor.id)
    })

    await t.test('Visiteur ne supprime pas le morceau d un autre', async () => {
      const result = await request(
        'DELETE', `/tracks/${trackId}`, v
      )

      assert.equal(result.status, 403)
    })

    await t.test('Visiteur peut supprimer son propre morceau', async () => {
      const track = await prisma.eventTrack.findFirstOrThrow({
        where: {
          eventId: publicEventId,
          proposerId: visitor.id
        }
      })

      const result = await request(
        'DELETE', `/tracks/${track.id}`, v
      )

      assert.equal(result.status, 200)

      const stored = await prisma.eventTrack.findUnique({
        where: { id: track.id }
      })

      assert.equal(stored, null)
    })

    await t.test('Licence restrictive interdit les propositions publiques', async () => {
      await prisma.event.update({
        where: { id: publicEventId },
        data: { votePolicy: 'INVITED_ONLY' }
      })

      try {
        const listing = await request(
          'GET', `/tracks/events/${publicEventId}`, v
        )

        assert.equal(listing.status, 200)
        assert.equal(listing.body.canParticipate, false)
        assert.equal(listing.body.canVote, false)

        const result = await request(
          'POST',
          `/tracks/events/${publicEventId}`,
          v,
          {
            catalogTrackId: 'neon-city'
          }
        )

        assert.equal(result.status, 403)
      } finally {
        await prisma.event.update({
          where: { id: publicEventId },
          data: { votePolicy: 'PUBLIC' }
        })
      }
    })

    await t.test('Visiteur cree une playlist publique', async () => {
      const result = await request(
        'POST',
        `/playlists/events/${publicEventId}`,
        v,
        {
          title: 'Playlist publique V31'
        }
      )

      assert.equal(result.status, 201)
    })

    await t.test('Visiteur peut editer les playlists publiques', async () => {
      const result = await request(
        'GET',
        `/playlists/events/${publicEventId}`,
        v
      )

      assert.equal(result.status, 200)
      assert.equal(result.body.canEdit, true)
    })

    await t.test('Evenement prive cree explicitement', async () => {
      const result = await request('POST', '/events', o, {
        title: 'Soiree privee V31',
        visibility: 'PRIVATE',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.event.visibility, 'PRIVATE')
      privateEventId = result.body.event.id
    })

    await t.test('Evenement prive invisible au visiteur', async () => {
      const result = await request(
        'GET', `/events/${privateEventId}`, v
      )

      assert.equal(result.status, 404)
    })

    await t.test('Playlist privee protegee', async () => {
      const result = await request(
        'POST',
        `/playlists/events/${privateEventId}`,
        v,
        { title: 'Interdit' }
      )

      assert.equal(result.status, 404)
    })

    await t.test('Proposition privee protegee', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${privateEventId}`,
        v,
        {
          catalogTrackId: 'neon-city'
        }
      )

      assert.equal(result.status, 404)
    })

    await t.test('Vote prive protege', async () => {
      const track = await prisma.eventTrack.create({
        data: {
          eventId: privateEventId,
          proposerId: organizer.id,
          title: 'Secret',
          artist: 'Artiste secret'
        }
      })

      const result = await request(
        'POST', `/tracks/${track.id}/vote`, v
      )

      assert.equal(result.status, 404)
    })

    await t.test('Evenement termine interdit le vote public', async () => {
      await prisma.event.update({
        where: { id: publicEventId },
        data: {
          startsAt: new Date(Date.now() - 172800000),
          endsAt: new Date(Date.now() - 86400000)
        }
      })

      const result = await request(
        'DELETE', `/tracks/${trackId}/vote`, v
      )

      assert.equal(result.status, 409)
    })
  } finally {
    await prisma.event.deleteMany({
      where: { organizerId: { in: ids } }
    })

    await prisma.user.deleteMany({
      where: { id: { in: ids } }
    })

    await prisma.$disconnect()
  }
})
