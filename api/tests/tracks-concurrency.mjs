import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Music Track Vote - concurrence', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()

  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      name: 'Test Concurrence',
      emailVerifiedAt: new Date()
    }
  })

  try {
    const event = await prisma.event.create({
      data: {
        organizerId: user.id,
        title: 'Test limite musicale',
        startsAt: new Date(Date.now() + 48 * 3600000),
        endsAt: new Date(Date.now() + 52 * 3600000),
        visibility: 'PRIVATE'
      }
    })

    const token = jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      secret,
      {
        expiresIn: '1h',
        issuer: 'music-room',
        audience: 'music-room-api'
      }
    )

    await prisma.eventTrack.createMany({
      data: Array.from({ length: 98 }, (_, index) => ({
        eventId: event.id,
        proposerId: user.id,
        title: `Morceau initial ${index + 1}`,
        artist: 'Artiste de test'
      }))
    })

    async function propose(index) {
      const response = await fetch(
        `${base}/api/tracks/events/${event.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            catalogTrackId: [
              'blue-horizon',
              'summer-night',
              'neon-city',
              'morning-light',
              'midnight-groove'
            ][index % 5]
          })
        }
      )

      return {
        status: response.status,
        body: await response.json()
      }
    }

    let responses = []

    await t.test('98 morceaux initialement présents', async () => {
      const count = await prisma.eventTrack.count({
        where: { eventId: event.id }
      })

      assert.equal(count, 98)
    })

    await t.test('Six propositions simultanées', async () => {
      responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) => propose(index))
      )

      assert.equal(responses.length, 6)

      assert.ok(
        responses.every((result) =>
          result.status === 201 || result.status === 409
        ),
        JSON.stringify(responses)
      )
    })

    await t.test('Deux créations et quatre refus', async () => {
      const accepted = responses.filter(
        (result) => result.status === 201
      )
      const rejected = responses.filter(
        (result) => result.status === 409
      )

      assert.equal(accepted.length, 2)
      assert.equal(rejected.length, 4)
    })

    await t.test('Limite de 100 respectée en base', async () => {
      const count = await prisma.eventTrack.count({
        where: { eventId: event.id }
      })

      assert.equal(count, 100)
    })

    await t.test('Proposition supplémentaire refusée', async () => {
      const result = await propose(999)
      assert.equal(result.status, 409)

      const count = await prisma.eventTrack.count({
        where: { eventId: event.id }
      })

      assert.equal(count, 100)
    })
    await t.test('Doublons simultanes refuses', async () => {
      await prisma.eventTrack.deleteMany({
        where: { eventId: event.id }
      })

      const results = await Promise.all(
        Array.from({ length: 6 }, () => propose(0))
      )

      assert.equal(
        results.filter(result => result.status === 201).length,
        1
      )

      assert.equal(
        results.filter(result => result.status === 409).length,
        5
      )

      assert.equal(
        await prisma.eventTrack.count({
          where: { eventId: event.id }
        }),
        1
      )
    })

  } finally {
    await prisma.user.delete({
      where: { id: user.id }
    })

    await prisma.$disconnect()
  }
})
