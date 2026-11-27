import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Evenements - API et permissions', async (t) => {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl ||
      new URL(databaseUrl).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const userIds = []

  const future = (hours) =>
    new Date(Date.now() + hours * 3600000).toISOString()

  const validEvent = {
    title: 'Soiree Rock',
    description: 'Concert et playlist collaborative',
    location: 'Lyon',
    startsAt: future(48),
    endsAt: future(52),
    visibility: 'PRIVATE'
  }

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
    const alice = await createUser('Alice Events')
    const bob = await createUser('Bob Events')

    const a = token(alice)
    const b = token(bob)

    let eventId

    await t.test('Création sans JWT refusée', async () => {
      const result = await request('POST', '/events', null, validEvent)
      assert.equal(result.status, 401)
    })

    await t.test('Titre trop court refusé', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        title: 'A'
      })
      assert.equal(result.status, 400)
    })

    await t.test('Visibilité incorrecte refusée', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        visibility: 'FRIENDS'
      })
      assert.equal(result.status, 400)
    })

    await t.test('Date passée refusée', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        startsAt: future(-2)
      })
      assert.equal(result.status, 400)
    })

    await t.test('Fin avant début refusée', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        endsAt: future(24)
      })
      assert.equal(result.status, 400)
    })

    await t.test('Date non UTC refusée', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        startsAt: '2027-01-01T20:00:00'
      })
      assert.equal(result.status, 400)
    })

    await t.test('Alice crée un événement', async () => {
      const result = await request('POST', '/events', a, {
        ...validEvent,
        organizerId: bob.id
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.event.title, 'Soiree Rock')
      assert.equal(result.body.event.organizerId, alice.id)
      assert.equal(result.body.event.visibility, 'PRIVATE')
      assert.equal(result.body.event.email, undefined)

      eventId = result.body.event.id
    })

    await t.test('Alice retrouve son événement', async () => {
      const result = await request('GET', '/events/mine', a)
      assert.equal(result.status, 200)
      assert.ok(result.body.events.some((e) => e.id === eventId))
    })

    await t.test('Bob ne le voit pas dans ses événements', async () => {
      const result = await request('GET', '/events/mine', b)
      assert.equal(result.status, 200)
      assert.ok(!result.body.events.some((e) => e.id === eventId))
    })

    await t.test('Bob ne peut consulter le privé', async () => {
      const result = await request('GET', `/events/${eventId}`, b)
      assert.equal(result.status, 404)
    })

    await t.test('Bob ne peut modifier le privé', async () => {
      const result = await request('PUT', `/events/${eventId}`, b, {
        ...validEvent,
        title: 'Modification frauduleuse'
      })
      assert.equal(result.status, 404)
    })

    await t.test('Bob ne peut supprimer le privé', async () => {
      const result = await request('DELETE', `/events/${eventId}`, b)
      assert.equal(result.status, 404)
    })

    await t.test('Alice rend son événement public', async () => {
      const result = await request('PUT', `/events/${eventId}`, a, {
        ...validEvent,
        title: 'Concert public',
        visibility: 'PUBLIC',
        organizerId: bob.id
      })

      assert.equal(result.status, 200)
      assert.equal(result.body.event.title, 'Concert public')
      assert.equal(result.body.event.organizerId, alice.id)
      assert.equal(result.body.event.visibility, 'PUBLIC')
    })

    await t.test('Bob consulte le public', async () => {
      const result = await request('GET', `/events/${eventId}`, b)
      assert.equal(result.status, 200)
      assert.equal(result.body.event.title, 'Concert public')
      assert.equal(result.body.event.email, undefined)
    })

    await t.test('Bob ne peut modifier le public', async () => {
      const result = await request('PUT', `/events/${eventId}`, b, {
        ...validEvent,
        visibility: 'PUBLIC'
      })
      assert.equal(result.status, 404)
    })

    await t.test('Modification persistée', async () => {
      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: eventId }
      })

      assert.equal(stored.title, 'Concert public')
      assert.equal(stored.organizerId, alice.id)
    })

    await t.test('Alice supprime son événement', async () => {
      const result = await request('DELETE', `/events/${eventId}`, a)
      assert.equal(result.status, 200)
    })

    await t.test('Événement supprimé inaccessible', async () => {
      const result = await request('GET', `/events/${eventId}`, a)
      assert.equal(result.status, 404)
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
