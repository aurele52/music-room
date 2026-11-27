import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

// Interdiction absolue d'utiliser la base de production.

const base = process.env.TEST_API_URL
const rawDatabase = process.env.DATABASE_URL

if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire')
}

if (!rawDatabase) {
  throw new Error('DATABASE_URL obligatoire')
}

const database = new URL(rawDatabase)

if (
  !['127.0.0.1', 'localhost'].includes(database.hostname) ||
  database.port !== '5433' ||
  database.pathname !== '/musicroom_test'
) {
  throw new Error('Seule musicroom_test locale :5433 est autorisee')
}

process.loadEnvFile('.env')

assert.equal(process.env.DATABASE_URL, rawDatabase)

const secret = process.env.JWT_SECRET
assert.ok(secret, 'JWT_SECRET absent')

test(
  'Offline - API Express et PostgreSQL reels',
  { timeout: 60000 },
  async t => {
    const prisma = new PrismaClient()
    const userIds = []

    let eventId
    let playlistId

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
        {
          sub: user.id,
          ver: user.tokenVersion
        },
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
          ...(auth
            ? { Authorization: `Bearer ${auth}` }
            : {})
        },
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000)
      })

      return {
        status: response.status,
        body: await response.json()
      }
    }

    try {
      const alice = await createUser('Offline Alice')
      const bob = await createUser('Offline Bob')

      const a = token(alice)
      const b = token(bob)

      const event = await prisma.event.create({
        data: {
          organizerId: alice.id,
          title: 'Offline Integration Test',
          visibility: 'PUBLIC',
          editPolicy: 'PUBLIC',
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() + 3600000)
        }
      })

      eventId = event.id

      const eventPath = `/playlists/events/${eventId}`

      // Verification supplementaire : l'API doit voir
      // l'evenement cree dans la base de test isolee.
      const preflight = await request(
        'GET', eventPath, a
      )

      assert.equal(preflight.status, 200)
      assert.equal(preflight.body.event?.id, eventId)
      assert.equal(preflight.body.event?.title, event.title)

      const created = await request(
        'POST',
        eventPath,
        a,
        { title: 'Offline Test Playlist' }
      )

      assert.equal(created.status, 201, JSON.stringify(created.body))

      playlistId = created.body.playlist.id

      const path = `/playlists/${playlistId}`
      const itemsPath = `${path}/items`

      function guard(baseRevision, id = eventId) {
        return {
          eventId: id,
          baseRevision
        }
      }

      async function read(auth = a) {
        const result = await request(
          'GET', eventPath, auth
        )

        assert.equal(
          result.status,
          200,
          JSON.stringify(result.body)
        )

        return result.body
      }

      async function current() {
        const listing = await read()

        const playlist = listing.playlists.find(
          row => row.id === playlistId
        )

        assert.ok(playlist)

        return playlist
      }

      function persistentPlaylist(playlist) {
    const { canEdit, ...data } = playlist
    return data
  }

  async function unchanged(before) {
        assert.deepEqual(
          persistentPlaylist(await current()),
          persistentPlaylist(before)
        )
      }

      async function add(title, revision, auth = a) {
        return request('POST', itemsPath, auth, {
          title,
          artist: 'Offline Artist',
          offline: guard(revision)
        })
      }

      // ==========================================
      // 1. METADONNEES
      // ==========================================

      await t.test('Metadonnees coherentes', async () => {
        const result = await read()

        assert.deepEqual(result.event, {
          id: eventId,
          title: event.title,
          visibility: 'PUBLIC',
          endsAt: event.endsAt.toISOString()
        })

        assert.equal(result.canEdit, true)
        assert.equal(result.finished, false)
        assert.equal(result.organizer, true)
      })

      // ==========================================
      // 2. COMPATIBILITE ET AJOUT
      // ==========================================

      await t.test('Ancien client toujours compatible', async () => {
        const before = await current()

        const result = await request(
          'POST',
          itemsPath,
          a,
          {
            title: 'Online Track',
            artist: 'Offline Artist'
          }
        )

        assert.equal(result.status, 201)

        const after = await current()

        assert.equal(
          after.revision,
          before.revision + 1
        )
      })

      await t.test('Ajout offline valide', async () => {
        const before = await current()

        const result = await add(
          'Offline Track',
          before.revision
        )

        assert.equal(result.status, 201)

        const after = await current()

        assert.equal(
          after.revision,
          before.revision + 1
        )

        assert.equal(
          after.items.length,
          before.items.length + 1
        )
      })

      await t.test('Repetition apres reponse perdue', async () => {
        const before = await current()

        const result = await add(
          'Offline Track',
          before.revision - 1
        )

        assert.equal(result.status, 409)
        assert.match(result.body.error, /révision/i)

        await unchanged(before)
      })

      await t.test('Ajout avec revision obsolete', async () => {
        const before = await current()

        const result = await add(
          'Stale Track',
          before.revision - 1
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

      // ==========================================
      // 3. CONCURRENCE ENTRE DEUX UTILISATEURS
      // ==========================================

      await t.test('Deux ajouts concurrents', async () => {
        const before = await current()

        const results = await Promise.all([
          add('Concurrent Alice', before.revision, a),
          add('Concurrent Bob', before.revision, b)
        ])

        assert.deepEqual(
          results.map(result => result.status).sort(),
          [201, 409]
        )

        const after = await current()

        assert.equal(
          after.revision,
          before.revision + 1
        )

        assert.equal(
          after.items.length,
          before.items.length + 1
        )

        assert.equal(
          after.items.filter(item =>
            item.title.startsWith('Concurrent ')
          ).length,
          1
        )
      })

      // ==========================================
      // 4. SUPPRESSION
      // ==========================================

      await t.test('Suppression obsolete refusee', async () => {
        const before = await current()

        const result = await request(
          'DELETE',
          `${itemsPath}/${before.items[0].id}`,
          a,
          {
            offline: guard(before.revision - 1)
          }
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

      await t.test('Suppression valide et repetition', async () => {
        const before = await current()
        const itemId = before.items[0].id

        const body = {
          offline: guard(before.revision)
        }

        const result = await request(
          'DELETE',
          `${itemsPath}/${itemId}`,
          a,
          body
        )

        assert.equal(result.status, 200)

        const after = await current()

        assert.equal(
          after.revision,
          before.revision + 1
        )

        assert.equal(
          after.items.some(item => item.id === itemId),
          false
        )

        assert.deepEqual(
          after.items.map(item => item.position),
          after.items.map((_, index) => index)
        )

        const replay = await request(
          'DELETE',
          `${itemsPath}/${itemId}`,
          a,
          body
        )

        assert.equal(replay.status, 409)

        await unchanged(after)
      })

      // ==========================================
      // 5. REORGANISATION
      // ==========================================

      await t.test('Reorganisation obsolete refusee', async () => {
        const before = await current()

        const revision = before.revision - 1

        const result = await request(
          'PUT',
          `${path}/order`,
          a,
          {
            itemIds: before.items.map(item => item.id).reverse(),
            revision,
            offline: guard(revision)
          }
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

      await t.test('Reorganisation valide et repetition', async () => {
        const before = await current()

        assert.ok(before.items.length >= 2)

        const itemIds = before.items
          .map(item => item.id)
          .reverse()

        const body = {
          itemIds,
          revision: before.revision,
          offline: guard(before.revision)
        }

        const result = await request(
          'PUT',
          `${path}/order`,
          a,
          body
        )

        assert.equal(result.status, 200)

        const after = await current()

        assert.equal(
          after.revision,
          before.revision + 1
        )

        assert.deepEqual(
          after.items.map(item => item.id),
          itemIds
        )

        const replay = await request(
          'PUT',
          `${path}/order`,
          a,
          body
        )

        assert.equal(replay.status, 409)

        await unchanged(after)
      })

      // ==========================================
      // 6. VALIDATION DES DONNEES
      // ==========================================

      await t.test('Mauvais evenement de reference', async () => {
        const before = await current()

        const result = await request(
          'POST',
          itemsPath,
          a,
          {
            title: 'Wrong Event',
            artist: 'Offline Artist',
            offline: guard(
              before.revision,
              randomUUID()
            )
          }
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

      await t.test('Parametres offline invalides', async () => {
        const before = await current()

        for (const offline of [
          null,
          {},
          guard(-1),
          guard('invalid')
        ]) {
          const result = await request(
            'POST',
            itemsPath,
            a,
            {
              title: 'Invalid Operation',
              artist: 'Offline Artist',
              offline
            }
          )

          assert.equal(result.status, 400)
        }

        const order = await request(
          'PUT',
          `${path}/order`,
          a,
          {
            itemIds: before.items.map(item => item.id),
            revision: before.revision,
            offline: guard(before.revision + 1)
          }
        )

        assert.equal(order.status, 400)

        await unchanged(before)
      })

      // ==========================================
      // 7. VISIBILITE ET REVOCATION
      // ==========================================

      await t.test('Droits edition revoques sur evenement public', async () => {
        const before = await current()

        await prisma.event.update({
          where: { id: eventId },
          data: { editPolicy: 'INVITED_ONLY' }
        })

        try {
          const listing = await read(b)

          assert.equal(listing.event.visibility, 'PUBLIC')
          assert.equal(listing.canEdit, false)

          const result = await add(
            'Forbidden Track',
            before.revision,
            b
          )

          assert.equal(result.status, 403)

          await unchanged(before)
        } finally {
          await prisma.event.update({
            where: { id: eventId },
            data: { editPolicy: 'PUBLIC' }
          })
        }
      })

      await t.test('Evenement devenu prive', async () => {
        const before = await current()

        await prisma.event.update({
          where: { id: eventId },
          data: { visibility: 'PRIVATE' }
        })

        const listing = await read()

        assert.equal(
          listing.event.visibility,
          'PRIVATE'
        )

        const result = await add(
          'Private Track',
          before.revision
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

      await t.test('Acces de Bob revoque', async () => {
        const before = await current()

        const listing = await request(
          'GET',
          eventPath,
          b
        )

        assert.equal(listing.status, 404)

        const result = await add(
          'Revoked Track',
          before.revision,
          b
        )

        assert.equal(result.status, 404)

        await unchanged(before)
      })

      // ==========================================
      // 8. EVENEMENT TERMINE
      // ==========================================

      await t.test('Evenement termine', async () => {
        const before = await current()

        await prisma.event.update({
          where: { id: eventId },
          data: {
            visibility: 'PUBLIC',
            startsAt: new Date(Date.now() - 7200000),
            endsAt: new Date(Date.now() - 3600000)
          }
        })

        const listing = await read()

        assert.equal(listing.finished, true)
        assert.equal(listing.canEdit, false)

        const result = await add(
          'Late Track',
          before.revision
        )

        assert.equal(result.status, 409)

        await unchanged(before)
      })

    } finally {
      // Nettoyer uniquement nos donnees de test.

      try {
        if (eventId) {
          await prisma.event.deleteMany({
            where: { id: eventId }
          })
        }

        if (userIds.length) {
          await prisma.user.deleteMany({
            where: {
              id: { in: userIds }
            }
          })
        }
      } finally {
        await prisma.$disconnect()
      }
    }
  }
)
