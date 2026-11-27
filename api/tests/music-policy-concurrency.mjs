import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}
const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms))

test('V3.1D - concurrence entre licences et ecritures', async (t) => {
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
        email: `${randomUUID()}@example.test`,
        name,
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

  async function createEvent(organizerId) {
    return prisma.event.create({
      data: {
        title: 'Concurrence Music Room',
        organizerId,
        visibility: 'PUBLIC',
        votePolicy: 'PUBLIC',
        editPolicy: 'PUBLIC',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000)
      }
    })
  }

  async function createTrack(eventId, proposerId) {
    return prisma.eventTrack.create({
      data: {
        eventId,
        proposerId,
        title: 'Morceau concurrence',
        artist: 'Artiste concurrence'
      }
    })
  }

  // Une transaction extérieure verrouille l'événement.
  // La requête HTTP démarre pendant ce verrou.
  // La transaction change ensuite les licences,
  // puis libère le verrou au COMMIT.
  //
  // On vérifie que la requête ne termine pas pendant
  // la période de blocage et qu'elle relit les droits.
  async function revokeDuringRequest(eventId, operation) {
    let pendingRequest
    let completed = false

    try {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw`
          SELECT "id"
          FROM "Event"
          WHERE "id" = ${eventId}
          FOR UPDATE
        `

        assert.equal(locked.length, 1)

        pendingRequest = operation().then(
          (value) => {
            completed = true
            return value
          },
          (error) => {
            completed = true
            throw error
          }
        )

        // Éviter une promesse rejetée non observée
        // si l'assertion échoue avant le COMMIT.
        void pendingRequest.catch(() => {})

        await sleep(300)

        assert.equal(
          completed,
          false,
          'La requête a terminé alors que Event était verrouillé'
        )

        await tx.event.update({
          where: { id: eventId },
          data: {
            votePolicy: 'INVITED_ONLY',
            editPolicy: 'INVITED_ONLY'
          }
        })
      }, {
        maxWait: 5000,
        timeout: 10000
      })
    } catch (error) {
      if (pendingRequest) {
        await Promise.allSettled([pendingRequest])
      }
      throw error
    }

    assert.ok(pendingRequest)
    return pendingRequest
  }

  try {
    const organizer = await createUser('Organisateur concurrence')
    const visitor = await createUser('Visiteur concurrence')

    const organizerToken = token(organizer)
    const visitorToken = token(visitor)

    await t.test('Vote POST bloque puis refuse apres revocation', async () => {
      const event = await createEvent(organizer.id)
      const track = await createTrack(event.id, organizer.id)

      const result = await revokeDuringRequest(
        event.id,
        () => request(
          'POST',
          `/tracks/${track.id}/vote`,
          visitorToken
        )
      )

      assert.equal(result.status, 403, JSON.stringify(result))

      const votes = await prisma.trackVote.count({
        where: { trackId: track.id }
      })

      assert.equal(votes, 0)
    })

    await t.test('Vote DELETE bloque puis refuse apres revocation', async () => {
      const event = await createEvent(organizer.id)
      const track = await createTrack(event.id, organizer.id)

      await prisma.trackVote.create({
        data: {
          trackId: track.id,
          userId: visitor.id
        }
      })

      const result = await revokeDuringRequest(
        event.id,
        () => request(
          'DELETE',
          `/tracks/${track.id}/vote`,
          visitorToken
        )
      )

      assert.equal(result.status, 403, JSON.stringify(result))

      const votes = await prisma.trackVote.count({
        where: {
          trackId: track.id,
          userId: visitor.id
        }
      })

      assert.equal(votes, 1)
    })

    await t.test('Creation playlist refusee apres revocation', async () => {
      const event = await createEvent(organizer.id)

      const result = await revokeDuringRequest(
        event.id,
        () => request(
          'POST',
          `/playlists/events/${event.id}`,
          visitorToken,
          { title: 'Playlist concurrente' }
        )
      )

      assert.equal(result.status, 403, JSON.stringify(result))

      const playlists = await prisma.eventPlaylist.count({
        where: { eventId: event.id }
      })

      assert.equal(playlists, 0)
    })

    await t.test('Ajout playlist refuse apres revocation', async () => {
      const event = await createEvent(organizer.id)

      const playlist = await prisma.eventPlaylist.create({
        data: {
          eventId: event.id,
          title: 'Playlist existante'
        }
      })

      const result = await revokeDuringRequest(
        event.id,
        () => request(
          'POST',
          `/playlists/${playlist.id}/items`,
          visitorToken,
          {
            title: 'Morceau interdit',
            artist: 'Artiste interdit'
          }
        )
      )

      assert.equal(result.status, 403, JSON.stringify(result))

      const items = await prisma.playlistItem.count({
        where: { playlistId: playlist.id }
      })

      assert.equal(items, 0)
    })

    await t.test('Mise a jour des licences attend le verrou', async () => {
      const event = await createEvent(organizer.id)

      let completed = false
      let pending

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Event"
            WHERE "id" = ${event.id}
            FOR UPDATE
          `

          pending = request(
            'PUT',
            `/events/${event.id}/music-policies`,
            organizerToken,
            {
              votePolicy: 'INVITED_ONLY',
              editPolicy: 'INVITED_ONLY'
            }
          ).then(
            (result) => {
              completed = true
              return result
            },
            (error) => {
              completed = true
              throw error
            }
          )

          void pending.catch(() => {})

          await sleep(300)

          assert.equal(
            completed,
            false,
            'La modification des licences a ignore le verrou'
          )
        }, {
          maxWait: 5000,
          timeout: 10000
        })
      } catch (error) {
        if (pending) await Promise.allSettled([pending])
        throw error
      }

      const result = await pending
      assert.equal(result.status, 200, JSON.stringify(result))

      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        select: {
          votePolicy: true,
          editPolicy: true
        }
      })

      assert.equal(stored.votePolicy, 'INVITED_ONLY')
      assert.equal(stored.editPolicy, 'INVITED_ONLY')
    })
  } finally {
    // Uniquement les événements créés par ces utilisateurs
    // temporaires dans musicroom_test.
    await prisma.event.deleteMany({
      where: {
        organizerId: { in: userIds }
      }
    })

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
