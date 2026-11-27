import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Evenements - découverte publique', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const userIds = []
  const marker = `mrdisc${randomUUID().slice(0, 8)}`

  const future = (hours) =>
    new Date(Date.now() + hours * 3600000)

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

  async function request(path, token) {
    const response = await fetch(`${base}/api${path}`, {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {}
    })

    return {
      status: response.status,
      body: await response.json()
    }
  }

  try {
    const organizer = await createUser('Organisateur Discovery')
    const viewer = await createUser('Visiteur Discovery')
    const token = makeToken(viewer)

    const events = []

    // 23 événements futurs publics.
    for (let index = 1; index <= 23; index++) {
      events.push({
        title: index === 1
          ? `Electro ${marker}`
          : `Concert ${marker} ${index}`,
        description: 'Événement de test',
        location: index === 1 ? 'Lyon' : 'Bordeaux',
        startsAt: future(index + 24),
        endsAt: future(index + 27),
        visibility: 'PUBLIC',
        organizerId: organizer.id
      })
    }

    // Un événement actuellement en cours.
    events.push({
      title: `En cours ${marker}`,
      location: 'Lyon',
      startsAt: future(-1),
      endsAt: future(2),
      visibility: 'PUBLIC',
      organizerId: organizer.id
    })

    // Un événement privé.
    events.push({
      title: `Secret ${marker}`,
      location: 'Lyon',
      startsAt: future(40),
      endsAt: future(44),
      visibility: 'PRIVATE',
      organizerId: organizer.id
    })

    // Un événement public déjà terminé.
    events.push({
      title: `Termine ${marker}`,
      location: 'Lyon',
      startsAt: future(-48),
      endsAt: future(-44),
      visibility: 'PUBLIC',
      organizerId: organizer.id
    })

    await prisma.event.createMany({ data: events })

    const stored = await prisma.event.findMany({
      where: { organizerId: organizer.id }
    })

    const secretEvent = stored.find((e) =>
      e.title.startsWith('Secret')
    )
    const publicEvent = stored.find((e) =>
      e.title.startsWith('Electro')
    )

    assert.ok(secretEvent)
    assert.ok(publicEvent)

    const searchPath =
      `/events/discover?q=${encodeURIComponent(marker)}`

    await t.test('Recherche sans JWT refusée', async () => {
      const result = await request('/events/discover', null)
      assert.equal(result.status, 401)
    })

    await t.test('Découverte accessible avec JWT', async () => {
      const result = await request('/events/discover', token)
      assert.equal(result.status, 200)
      assert.ok(Array.isArray(result.body.events))
      assert.ok(result.body.events.length <= 20)
    })

    await t.test('Maximum 20 événements par page', async () => {
      const result = await request(searchPath, token)
      assert.equal(result.status, 200)
      assert.equal(result.body.events.length, 20)
      assert.equal(result.body.hasMore, true)
      assert.equal(result.body.page, 1)
    })

    await t.test('Deuxième page', async () => {
      const result = await request(`${searchPath}&page=2`, token)
      assert.equal(result.status, 200)
      assert.equal(result.body.events.length, 4)
      assert.equal(result.body.hasMore, false)
      assert.equal(result.body.page, 2)
    })

    await t.test('Aucun doublon entre les pages', async () => {
      const a = await request(searchPath, token)
      const b = await request(`${searchPath}&page=2`, token)
      const ids = [
        ...a.body.events.map((e) => e.id),
        ...b.body.events.map((e) => e.id)
      ]
      assert.equal(new Set(ids).size, 24)
    })

    await t.test('Événements privés exclus', async () => {
      const result = await request(searchPath, token)
      assert.ok(
        result.body.events.every((e) => e.visibility === 'PUBLIC')
      )
      const second = await request(`${searchPath}&page=2`, token)
      assert.ok(
        ![...result.body.events, ...second.body.events].some(
          (e) => e.id === secretEvent.id
        )
      )
    })

    await t.test('Événements terminés exclus', async () => {
      const result = await request(
        `/events/discover?q=Termine%20${marker}`,
        token
      )
      assert.equal(result.status, 200)
      assert.deepEqual(result.body.events, [])
    })

    await t.test('Événement en cours visible', async () => {
      const result = await request(
        `/events/discover?q=En%20cours%20${marker}`,
        token
      )
      assert.equal(result.status, 200)
      assert.equal(result.body.events.length, 1)
    })

    await t.test('Recherche insensible à la casse', async () => {
      const result = await request(
        `/events/discover?q=ELECTRO%20${marker.toUpperCase()}`,
        token
      )
      assert.equal(result.status, 200)
      assert.equal(result.body.events.length, 1)
    })

    await t.test('Filtre par lieu', async () => {
      const result = await request(
        `${searchPath}&location=LYON`,
        token
      )
      assert.equal(result.status, 200)
      assert.equal(result.body.events.length, 2)
    })

    await t.test('Combinaison titre et lieu', async () => {
      const result = await request(
        `/events/discover?q=Electro&location=Lyon`,
        token
      )
      assert.equal(result.status, 200)
      assert.ok(result.body.events.some(
        (e) => e.id === publicEvent.id
      ))
    })

    await t.test('Organisateur sans email exposé', async () => {
      const result = await request(
        `/events/discover?q=Electro%20${marker}`,
        token
      )
      const item = result.body.events[0]
      assert.equal(item.organizer.name, organizer.name)
      assert.equal(item.organizer.email, undefined)
      assert.equal(item.passwordHash, undefined)
    })

    await t.test('Titre trop long refusé', async () => {
      const result = await request(
        `/events/discover?q=${'x'.repeat(81)}`,
        token
      )
      assert.equal(result.status, 400)
    })

    await t.test('Lieu trop long refusé', async () => {
      const result = await request(
        `/events/discover?location=${'x'.repeat(121)}`,
        token
      )
      assert.equal(result.status, 400)
    })

    await t.test('Page invalide refusée', async () => {
      for (const page of ['0', '-1', 'abc', '51']) {
        const result = await request(
          `/events/discover?page=${page}`,
          token
        )
        assert.equal(result.status, 400)
      }
    })

    await t.test('Accès direct au public autorisé', async () => {
      const result = await request(
        `/events/${publicEvent.id}`,
        token
      )
      assert.equal(result.status, 200)
    })

    await t.test('Accès direct au privé interdit', async () => {
      const result = await request(
        `/events/${secretEvent.id}`,
        token
      )
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
