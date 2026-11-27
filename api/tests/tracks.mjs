import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Music Track Vote - API et permissions', async (t) => {
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

  async function request(method, path, authToken, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken
          ? { Authorization: `Bearer ${authToken}` }
          : {})
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
    const alice = await createUser('Alice Track Vote')
    const bob = await createUser('Bob Track Vote')
    const charlie = await createUser('Charlie Track Vote')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Soirée Music Track Vote',
        description: 'Tests musicaux',
        startsAt: new Date(Date.now() + 48 * 3600000),
        endsAt: new Date(Date.now() + 52 * 3600000),
        visibility: 'PRIVATE'
      }
    })

    const invitation = await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'PENDING'
      }
    })

    const path = `/tracks/events/${event.id}`
    let firstTrackId
    let secondTrackId

    await t.test('Lecture sans JWT refusée', async () => {
      const result = await request('GET', path, null)
      assert.equal(result.status, 401)
    })

    await t.test('Alice consulte une liste vide', async () => {
      const result = await request('GET', path, a)
      assert.equal(result.status, 200)
      assert.deepEqual(result.body.tracks, [])
      assert.equal(result.body.canParticipate, true)
    })

    await t.test('Invitation en attente sans accès privé', async () => {
      const result = await request('GET', path, b)
      assert.equal(result.status, 404)
    })

    await t.test('Charlie ne peut pas consulter le privé', async () => {
      const result = await request('GET', path, c)
      assert.equal(result.status, 404)
    })

    await t.test('Alice propose un morceau', async () => {
      const result = await request('POST', path, a, {
        catalogTrackId: 'blue-horizon',
        proposerId: charlie.id
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.track.title, 'Blue Horizon')
      assert.equal(result.body.track.artist, 'Music Room')
      assert.equal(result.body.track.proposerId, alice.id)

      firstTrackId = result.body.track.id
    })

    await t.test('Proposition invalide refusée', async () => {
      const result = await request('POST', path, a, {
        catalogTrackId: 'inexistant'
      })

      assert.equal(result.status, 400)
    })

    await t.test('Alice vote pour son morceau', async () => {
      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, a
      )

      assert.equal(result.status, 201)
    })

    await t.test('Second vote identique refusé', async () => {
      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, a
      )

      assert.equal(result.status, 409)
    })

    await t.test('Invitation en attente sans droit de vote', async () => {
      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, b
      )

      assert.equal(result.status, 404)
    })

    await t.test('Bob accepte son invitation', async () => {
      await prisma.eventInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      })

      const result = await request('GET', path, b)

      assert.equal(result.status, 200)
      assert.equal(result.body.canParticipate, true)
    })

    await t.test('Bob propose un deuxième morceau', async () => {
      const result = await request('POST', path, b, {
        catalogTrackId: 'summer-night'
      })

      assert.equal(result.status, 201)
      secondTrackId = result.body.track.id
    })

    await t.test('Bob vote pour les deux morceaux', async () => {
      const first = await request(
        'POST', `/tracks/${firstTrackId}/vote`, b
      )
      const second = await request(
        'POST', `/tracks/${secondTrackId}/vote`, b
      )

      assert.equal(first.status, 201)
      assert.equal(second.status, 201)
    })

    await t.test('Classement décroissant correct', async () => {
      const result = await request('GET', path, b)

      assert.equal(result.status, 200)
      assert.equal(result.body.tracks.length, 2)
      assert.equal(result.body.tracks[0].id, firstTrackId)
      assert.equal(result.body.tracks[0].votes, 2)
      assert.equal(result.body.tracks[0].myVote, true)
      assert.equal(result.body.tracks[1].votes, 1)
    })

    await t.test('Vote personnel propre à chaque compte', async () => {
      const result = await request('GET', path, a)

      const second = result.body.tracks.find(
        (track) => track.id === secondTrackId
      )

      assert.equal(second.myVote, false)
    })

    await t.test('Charlie ne peut pas voter', async () => {
      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, c
      )

      assert.equal(result.status, 404)
    })

    await t.test('Bob ne peut supprimer le morceau d’Alice', async () => {
      const result = await request(
        'DELETE', `/tracks/${firstTrackId}`, b
      )

      assert.equal(result.status, 403)
    })

    await t.test('Bob retire uniquement son vote', async () => {
      const result = await request(
        'DELETE', `/tracks/${firstTrackId}/vote`, b
      )

      assert.equal(result.status, 200)

      const votes = await prisma.trackVote.count({
        where: { trackId: firstTrackId }
      })

      assert.equal(votes, 1)
    })

    await t.test('Retrait répété refusé', async () => {
      const result = await request(
        'DELETE', `/tracks/${firstTrackId}/vote`, b
      )

      assert.equal(result.status, 404)
    })

    await t.test('Un extérieur peut lire un événement public', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: { visibility: 'PUBLIC' }
      })

      const result = await request('GET', path, c)

      assert.equal(result.status, 200)
      assert.equal(result.body.canParticipate, true)
      assert.equal(result.body.tracks.length, 2)
    })

    await t.test('Un extérieur peut proposer dans le public', async () => {
      const result = await request('POST', path, c, {
        catalogTrackId: 'neon-city'
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.track.proposerId, charlie.id)

      const deletion = await request(
        'DELETE',
        `/tracks/${result.body.track.id}`,
        c
      )

      assert.equal(deletion.status, 200)
    })

    await t.test('Un extérieur peut voter dans le public', async () => {
      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, c
      )

      assert.equal(result.status, 201)

      const stored = await prisma.trackVote.findFirst({
        where: {
          trackId: firstTrackId,
          userId: charlie.id
        }
      })

      assert.ok(stored)
    })

    await t.test('L’organisatrice supprime un morceau', async () => {
      const result = await request(
        'DELETE', `/tracks/${secondTrackId}`, a
      )

      assert.equal(result.status, 200)

      const votes = await prisma.trackVote.count({
        where: { trackId: secondTrackId }
      })

      assert.equal(votes, 0)
    })

    await t.test('Bob perd ses droits avec licence restrictive après retrait', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: { votePolicy: 'INVITED_ONLY' }
      })

      try {
        await prisma.eventInvitation.delete({
          where: { id: invitation.id }
        })

        const result = await request('POST', path, b, {
          catalogTrackId: 'morning-light'
        })

        assert.equal(result.status, 403)
      } finally {
        await prisma.event.update({
          where: { id: event.id },
          data: { votePolicy: 'PUBLIC' }
        })
      }
    })

    await t.test('Ancien invite conserve les droits publics', async () => {
      const listing = await request('GET', path, b)

      assert.equal(listing.status, 200)
      assert.equal(listing.body.canParticipate, true)
      assert.equal(listing.body.canVote, true)

      const result = await request('POST', path, b, {
        catalogTrackId: 'morning-light'
      })

      assert.equal(result.status, 201)

      const deletion = await request(
        'DELETE',
        `/tracks/${result.body.track.id}`,
        b
      )

      assert.equal(deletion.status, 200)
    })


    await t.test('Événement terminé : vote interdit', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          startsAt: new Date(Date.now() - 48 * 3600000),
          endsAt: new Date(Date.now() - 24 * 3600000)
        }
      })

      const result = await request(
        'POST', `/tracks/${firstTrackId}/vote`, b
      )

      assert.equal(result.status, 409)

      const organizerResult = await request(
        'POST', `/tracks/${firstTrackId}/vote`, a
      )

      assert.equal(organizerResult.status, 409)
    })

    await t.test('Événement terminé : proposition interdite', async () => {
      const result = await request('POST', path, a, {
        catalogTrackId: 'midnight-groove'
      })

      assert.equal(result.status, 409)
    })

    await t.test('Événement terminé : retrait de vote interdit', async () => {
      const result = await request(
        'DELETE', `/tracks/${firstTrackId}/vote`, a
      )

      assert.equal(result.status, 409)
    })

    await t.test('Événement terminé : suppression interdite', async () => {
      const result = await request(
        'DELETE', `/tracks/${firstTrackId}`, a
      )

      assert.equal(result.status, 409)
    })

    await t.test('Lecture du classement après la fin', async () => {
      const result = await request('GET', path, a)

      assert.equal(result.status, 200)
      assert.equal(result.body.finished, true)
      assert.equal(result.body.canParticipate, false)
      assert.equal(result.body.tracks.length, 1)
    })
  } finally {
    await prisma.event.deleteMany({
      where: { organizerId: { in: userIds } }
    })

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
