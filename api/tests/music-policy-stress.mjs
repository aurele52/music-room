import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('V3.1D - stress des permissions musicales', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const users = []

  async function createUser(name) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        emailVerifiedAt: new Date()
      }
    })

    users.push(user.id)
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

  function assertStatuses(results, status) {
    for (const result of results) {
      assert.equal(
        result.status,
        status,
        JSON.stringify(result)
      )
    }
  }

  try {
    const organizer = await createUser('Stress organisateur')

    const visitors = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createUser(`Stress visiteur ${index + 1}`)
      )
    )

    const organizerToken = token(organizer)
    const visitorTokens = visitors.map(token)

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: 'Stress licences musicales',
        visibility: 'PUBLIC',
        votePolicy: 'PUBLIC',
        editPolicy: 'PUBLIC',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000)
      }
    })

    const tracks = []

    for (let index = 0; index < visitors.length; index++) {
      tracks.push(await prisma.eventTrack.create({
        data: {
          eventId: event.id,
          proposerId: organizer.id,
          title: `Stress titre ${index + 1}`,
          artist: 'Stress artiste'
        }
      }))
    }

    const playlist = await prisma.eventPlaylist.create({
      data: {
        eventId: event.id,
        title: 'Playlist stress'
      }
    })

    const policyPath =
      `/events/${event.id}/music-policies`

    async function setPolicies(policy) {
      return request(
        'PUT',
        policyPath,
        organizerToken,
        {
          votePolicy: policy,
          editPolicy: policy
        }
      )
    }

    function concurrentVotes(method) {
      return visitorTokens.map((auth, index) =>
        request(
          method,
          `/tracks/${tracks[index].id}/vote`,
          auth
        )
      )
    }

    function concurrentItems(prefix) {
      return visitorTokens.map((auth, index) =>
        request(
          'POST',
          `/playlists/${playlist.id}/items`,
          auth,
          {
            title: `${prefix} morceau ${index + 1}`,
            artist: 'Artiste stress'
          }
        )
      )
    }

    await t.test(
      'Operations paralleles autorisees en mode public',
      async () => {
        const [votes, items] = await Promise.all([
          Promise.all(concurrentVotes('POST')),
          Promise.all(concurrentItems('Public'))
        ])

        assertStatuses(votes, 201)
        assertStatuses(items, 201)

        assert.equal(
          await prisma.trackVote.count({
            where: { trackId: { in: tracks.map(t => t.id) } }
          }),
          4
        )

        assert.equal(
          await prisma.playlistItem.count({
            where: { playlistId: playlist.id }
          }),
          4
        )
      }
    )

    await t.test(
      'Revocation des deux licences',
      async () => {
        const result = await setPolicies('INVITED_ONLY')
        assert.equal(result.status, 200, JSON.stringify(result))

        const eventState = await prisma.event.findUniqueOrThrow({
          where: { id: event.id }
        })

        assert.equal(eventState.votePolicy, 'INVITED_ONLY')
        assert.equal(eventState.editPolicy, 'INVITED_ONLY')
      }
    )

    await t.test(
      'Operations paralleles refusees apres revocation',
      async () => {
        const [votes, items] = await Promise.all([
          Promise.all(concurrentVotes('DELETE')),
          Promise.all(concurrentItems('Interdit'))
        ])

        assertStatuses(votes, 403)
        assertStatuses(items, 403)

        // Les quatre votes préexistants restent enregistrés.
        assert.equal(
          await prisma.trackVote.count({
            where: { trackId: { in: tracks.map(t => t.id) } }
          }),
          4
        )

        // Aucune insertion interdite n'a été créée.
        assert.equal(
          await prisma.playlistItem.count({
            where: { playlistId: playlist.id }
          }),
          4
        )
      }
    )

    await t.test(
      'Restauration des licences publiques',
      async () => {
        const result = await setPolicies('PUBLIC')
        assert.equal(result.status, 200, JSON.stringify(result))
      }
    )

    await t.test(
      'Operations simultanees apres restauration',
      async () => {
        const [votes, items] = await Promise.all([
          Promise.all(concurrentVotes('DELETE')),
          Promise.all(concurrentItems('Retour'))
        ])

        assertStatuses(votes, 200)
        assertStatuses(items, 201)

        assert.equal(
          await prisma.trackVote.count({
            where: { trackId: { in: tracks.map(t => t.id) } }
          }),
          0
        )

        assert.equal(
          await prisma.playlistItem.count({
            where: { playlistId: playlist.id }
          }),
          8
        )
      }
    )
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
