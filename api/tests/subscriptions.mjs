import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL

if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire')
}

test('Music Room - abonnements et catalogue Premium', async t => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const prisma = new PrismaClient()

  const user = await prisma.user.create({
    data: {
      name: 'Test Premium',
      email: `${randomUUID()}@example.test`,
      emailVerifiedAt: new Date()
    }
  })

  const token = jwt.sign(
    { sub: user.id, ver: user.tokenVersion },
    process.env.JWT_SECRET,
    {
      expiresIn: '1h',
      issuer: 'music-room',
      audience: 'music-room-api'
    }
  )

  async function request(
    method,
    path,
    body,
    auth = token
  ) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth
          ? { Authorization: `Bearer ${auth}` }
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
    const event = await prisma.event.create({
      data: {
        organizerId: user.id,
        title: 'Test catalogue Premium',
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 3600000)
      }
    })

    const propose = () => request(
      'POST',
      `/tracks/events/${event.id}`,
      {
        catalogTrackId: 'cosmic-journey'
      }
    )

    await t.test('Abonnement protege par JWT', async () => {
      assert.equal(
        (await request(
          'GET', '/subscription', undefined, null
        )).status,
        401
      )
    })

    await t.test('Modification sans JWT refusee', async () => {
      assert.equal(
        (await request(
          'PATCH',
          '/subscription',
          { subscription: 'PREMIUM' },
          null
        )).status,
        401
      )
    })

    await t.test('Nouveau compte gratuit', async () => {
      const result = await request('GET', '/subscription')

      assert.equal(result.status, 200)
      assert.equal(result.body.subscription, 'FREE')
    })

    await t.test('Catalogue gratuit de cinq morceaux', async () => {
      const result = await request('GET', '/catalog')

      assert.equal(result.status, 200)
      assert.equal(result.body.tracks.length, 5)

      assert.ok(
        result.body.tracks.every(track => !track.premium)
      )
    })

    await t.test('Proposition Premium refusee en gratuit', async () => {
      assert.equal((await propose()).status, 403)
    })

    await t.test('Offre invalide refusee', async () => {
      const result = await request(
        'PATCH', '/subscription',
        { subscription: 'ADMIN' }
      )

      assert.equal(result.status, 400)
    })

    await t.test('Activation Premium', async () => {
      const result = await request(
        'PATCH', '/subscription',
        { subscription: 'PREMIUM' }
      )

      assert.equal(result.status, 200)
      assert.equal(result.body.subscription, 'PREMIUM')
    })

    await t.test('Abonnement persistant en base', async () => {
      const stored = await prisma.user.findUnique({
        where: { id: user.id }
      })

      assert.equal(stored.subscription, 'PREMIUM')
    })

    await t.test('Catalogue Premium de neuf morceaux', async () => {
      const result = await request('GET', '/catalog')

      assert.equal(result.status, 200)
      assert.equal(result.body.tracks.length, 9)

      assert.equal(
        result.body.tracks.filter(track => track.premium).length,
        4
      )
    })

    await t.test('Neuf identifiants uniques', async () => {
      const result = await request('GET', '/catalog')

      assert.equal(
        new Set(result.body.tracks.map(track => track.id)).size,
        9
      )
    })

    await t.test('Proposition Premium autorisee', async () => {
      assert.equal((await propose()).status, 201)
    })


    await t.test('Proposition libre refusee', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${event.id}`,
        {
          title: 'Blue Horizon',
          artist: 'Music Room'
        }
      )

      assert.equal(result.status, 400)
    })

    await t.test('Identifiant catalogue inconnu refuse', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${event.id}`,
        { catalogTrackId: 'inexistant' }
      )

      assert.equal(result.status, 400)
    })

    await t.test('Identifiant catalogue valide accepte', async () => {
      const result = await request(
        'POST',
        `/tracks/events/${event.id}`,
        {
          catalogTrackId: 'blue-horizon',
          title: 'Titre falsifie',
          artist: 'Artiste falsifie'
        }
      )

      assert.equal(result.status, 201)
      assert.equal(result.body.track.title, 'Blue Horizon')
      assert.equal(result.body.track.artist, 'Music Room')

      const duplicate = await request(
        'POST',
        `/tracks/events/${event.id}`,
        { catalogTrackId: 'blue-horizon' }
      )

      assert.equal(duplicate.status, 409)

      const removed = await request(
        'DELETE',
        `/tracks/${result.body.track.id}`
      )

      assert.equal(removed.status, 200)
    })

    await t.test('Retour vers offre gratuite', async () => {
      const result = await request(
        'PATCH', '/subscription',
        { subscription: 'FREE' }
      )

      assert.equal(result.status, 200)
      assert.equal(result.body.subscription, 'FREE')
    })

    await t.test('Catalogue de nouveau restreint', async () => {
      const result = await request('GET', '/catalog')

      assert.equal(result.body.tracks.length, 5)
    })

    await t.test('Ancienne proposition conservee', async () => {
      const result = await request(
        'GET',
        `/tracks/events/${event.id}`
      )

      assert.equal(result.status, 200)
      assert.equal(result.body.tracks.length, 1)

      assert.equal(
        result.body.tracks[0].title,
        'Cosmic Journey'
      )
    })

    await t.test('Nouvelle proposition Premium refusee', async () => {
      assert.equal((await propose()).status, 403)
    })

    await t.test('Session conserve son audio Premium', async () => {
      const result = await request(
        'POST',
        `/sessions/events/${event.id}/start`,
        {}
      )

      assert.equal(result.status, 201)

      assert.equal(
        result.body.session.items[0].audioUrl,
        '/api/audio/cosmic-journey.wav'
      )
    })

  } finally {
    await prisma.user.delete({
      where: { id: user.id }
    })

    await prisma.$disconnect()
  }
})
