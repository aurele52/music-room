import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('V3.1C - controle horaire et geographique des votes', async (t) => {
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
        issuer: 'music-room',
        audience: 'music-room-api',
        expiresIn: '1h'
      }
    )
  }

  async function request(method, path, auth, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
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

  const publicPolicy = {
    votePolicy: 'PUBLIC',
    editPolicy: 'PUBLIC'
  }

  const gpsPolicy = {
    voteLatitude: 48.6900,
    voteLongitude: 6.1800,
    voteRadiusMeters: 1000
  }

  const removeGps = {
    voteLatitude: null,
    voteLongitude: null,
    voteRadiusMeters: null
  }

  const removeTime = {
    voteWindowStart: null,
    voteWindowEnd: null
  }

  try {
    const organizer = await createUser('V31C Organisateur')
    const visitor = await createUser('V31C Visiteur')

    const o = token(organizer)
    const v = token(visitor)

    const event = await prisma.event.create({
      data: {
        title: 'Restrictions V31C',
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
        title: 'Musique test restrictions',
        artist: 'Artiste test restrictions'
      }
    })

    const policiesPath = `/events/${event.id}/music-policies`
    const rankingPath = `/tracks/events/${event.id}`
    const votePath = `/tracks/${track.id}/vote`

    const updatePolicy = (auth, fields) =>
      request('PUT', policiesPath, auth, {
        ...publicPolicy,
        ...fields
      })

    await t.test('1. Restrictions desactivees par defaut', async () => {
      const result = await request('GET', policiesPath, o)

      assert.equal(result.status, 200)

      for (const field of [
        'voteWindowStart',
        'voteWindowEnd',
        'voteLatitude',
        'voteLongitude',
        'voteRadiusMeters'
      ]) {
        assert.equal(result.body.policies[field], null)
      }
    })

    await t.test('2. Vote libre sans restrictions', async () => {
      const ranking = await request('GET', rankingPath, v)

      assert.equal(ranking.status, 200)
      assert.equal(ranking.body.canVote, true)
      assert.equal(ranking.body.requiresLocation, false)

      const result = await request('POST', votePath, v)
      assert.equal(result.status, 201, JSON.stringify(result))
    })

    await t.test('3. Plage future bloque le vote', async () => {
      const result = await updatePolicy(o, {
        voteWindowStart: new Date(
          Date.now() + 15 * 60000
        ).toISOString(),
        voteWindowEnd: new Date(
          Date.now() + 30 * 60000
        ).toISOString()
      })

      assert.equal(result.status, 200, JSON.stringify(result))

      const ranking = await request('GET', rankingPath, v)
      assert.equal(ranking.body.canVote, false)

      const vote = await request('DELETE', votePath, v)
      assert.equal(vote.status, 403)
    })

    await t.test('4. Plage inversee refusee', async () => {
      const result = await updatePolicy(o, {
        voteWindowStart: new Date(
          Date.now() + 3600000
        ).toISOString(),
        voteWindowEnd: new Date(
          Date.now() + 1800000
        ).toISOString()
      })

      assert.equal(result.status, 400)
    })

    await t.test('5. Plage incomplete refusee', async () => {
      const result = await updatePolicy(o, {
        voteWindowStart: new Date().toISOString()
      })

      assert.equal(result.status, 400)
    })

    await t.test('6. Plage ouverte autorise le retrait', async () => {
      const result = await updatePolicy(o, {
        voteWindowStart: new Date(
          Date.now() - 3600000
        ).toISOString(),
        voteWindowEnd: new Date(
          Date.now() + 3600000
        ).toISOString()
      })

      assert.equal(result.status, 200)

      const vote = await request('DELETE', votePath, v)
      assert.equal(vote.status, 200, JSON.stringify(vote))
    })

    await t.test('7. Activation d une zone GPS', async () => {
      const result = await updatePolicy(o, gpsPolicy)

      assert.equal(result.status, 200, JSON.stringify(result))

      const ranking = await request('GET', rankingPath, v)

      assert.equal(ranking.status, 200)
      assert.equal(ranking.body.requiresLocation, true)
    })

    await t.test('8. Vote sans GPS refuse', async () => {
      const result = await request('POST', votePath, v)
      assert.equal(result.status, 403)
    })

    await t.test('9. Vote hors rayon refuse', async () => {
      const result = await request('POST', votePath, v, {
        latitude: 48.7500,
        longitude: 6.2000
      })

      assert.equal(result.status, 403)
    })

    await t.test('10. Coordonnees non numeriques refusees', async () => {
      const result = await request('POST', votePath, v, {
        latitude: '48.69',
        longitude: 6.18
      })

      assert.equal(result.status, 403)
    })

    await t.test('11. Vote dans le rayon autorise', async () => {
      const result = await request('POST', votePath, v, {
        latitude: 48.6905,
        longitude: 6.1805
      })

      assert.equal(result.status, 201, JSON.stringify(result))
    })

    await t.test('12. Retrait du vote controle par GPS', async () => {
      const outside = await request('DELETE', votePath, v, {
        latitude: 48.7500,
        longitude: 6.2000
      })

      assert.equal(outside.status, 403)

      const inside = await request('DELETE', votePath, v, {
        latitude: 48.6905,
        longitude: 6.1805
      })

      assert.equal(inside.status, 200)
    })

    await t.test('13. Zone invalide refusee', async () => {
      const result = await updatePolicy(o, {
        voteLatitude: 91,
        voteLongitude: 6.18,
        voteRadiusMeters: -1
      })

      assert.equal(result.status, 400)
    })

    await t.test('14. Visiteur ne configure pas la zone', async () => {
      const result = await updatePolicy(v, gpsPolicy)

      assert.equal(result.status, 404)

      const stored = await request('GET', policiesPath, o)

      assert.equal(stored.body.policies.voteLatitude, 48.69)
      assert.equal(stored.body.policies.voteRadiusMeters, 1000)
    })

    await t.test('15. Desactivation restaure le vote libre', async () => {
      const updated = await updatePolicy(o, {
        ...removeTime,
        ...removeGps
      })

      assert.equal(updated.status, 200)

      const ranking = await request('GET', rankingPath, v)

      assert.equal(ranking.body.canVote, true)
      assert.equal(ranking.body.requiresLocation, false)

      const vote = await request('POST', votePath, v)
      assert.equal(vote.status, 201)
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
