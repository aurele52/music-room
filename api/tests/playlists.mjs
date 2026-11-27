import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Music Playlist Editor - API et concurrence', async (t) => {
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
        : { body: JSON.stringify(body) })
    })

    return {
      status: response.status,
      body: await response.json()
    }
  }

  try {
    const alice = await createUser('Alice Playlist')
    const bob = await createUser('Bob Playlist')
    const charlie = await createUser('Charlie Playlist')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Soirée Playlist Collaborative',
        startsAt: new Date(Date.now() + 48 * 3600000),
        endsAt: new Date(Date.now() + 52 * 3600000),
        visibility: 'PRIVATE'
      }
    })

    const eventPath = `/playlists/events/${event.id}`

    const invitation = await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'PENDING'
      }
    })

    let playlistId
    let firstId
    let secondId
    let thirdId

    async function currentRevision() {
      const playlist = await prisma.eventPlaylist.findUniqueOrThrow({
        where: { id: playlistId },
        select: { revision: true }
      })

      return playlist.revision
    }

    await t.test('Liste sans JWT refusée', async () => {
      const result = await request('GET', eventPath, null)
      assert.equal(result.status, 401)
    })

    await t.test('Alice consulte une liste vide', async () => {
      const result = await request('GET', eventPath, a)
      assert.equal(result.status, 200)
      assert.deepEqual(result.body.playlists, [])
      assert.equal(result.body.canEdit, true)
    })

    await t.test('Invitation en attente sans accès', async () => {
      const result = await request('GET', eventPath, b)
      assert.equal(result.status, 404)
    })

    await t.test('Extérieur sans accès au privé', async () => {
      const result = await request('GET', eventPath, c)
      assert.equal(result.status, 404)
    })

    await t.test('Titre invalide refusé', async () => {
      const result = await request('POST', eventPath, a, {
        title: 'A'
      })
      assert.equal(result.status, 400)
    })

    await t.test('Alice crée sa playlist', async () => {
      const result = await request('POST', eventPath, a, {
        title: '  Playlist Rock  ',
        description: 'Les meilleurs morceaux'
      })

      assert.equal(result.status, 201)
      assert.equal(result.body.playlist.title, 'Playlist Rock')
      assert.equal(result.body.playlist.eventId, event.id)

      playlistId = result.body.playlist.id
    })

    await t.test('Bob accepte son invitation', async () => {
      await prisma.eventInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      })

      const result = await request('GET', eventPath, b)
      assert.equal(result.status, 200)
      assert.equal(result.body.canEdit, true)
      assert.equal(result.body.playlists.length, 1)
    })

    await t.test('Bob ajoute un morceau', async () => {
      const result = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        b,
        {
          title: ' Starlight ',
          artist: ' Muse '
        }
      )

      assert.equal(result.status, 201)
      assert.equal(result.body.item.title, 'Starlight')
      assert.equal(result.body.item.artist, 'Muse')
      assert.equal(result.body.item.position, 0)
      assert.equal(result.body.item.addedById, bob.id)

      firstId = result.body.item.id
    })

    await t.test('Alice ajoute deux morceaux', async () => {
      const first = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        a,
        {
          title: 'One More Time',
          artist: 'Daft Punk'
        }
      )

      const second = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        a,
        {
          title: 'Around the World',
          artist: 'Daft Punk'
        }
      )

      assert.equal(first.status, 201)
      assert.equal(second.status, 201)
      assert.equal(first.body.item.position, 1)
      assert.equal(second.body.item.position, 2)

      secondId = first.body.item.id
      thirdId = second.body.item.id
    })

    await t.test('Liste ordonnée et auteurs protégés', async () => {
      const result = await request('GET', eventPath, b)
      const items = result.body.playlists[0].items

      assert.deepEqual(
        items.map((item) => item.id),
        [firstId, secondId, thirdId]
      )

      assert.deepEqual(
        items.map((item) => item.position),
        [0, 1, 2]
      )

      assert.equal(items[0].addedBy.name, bob.name)
      assert.equal(items[0].addedBy.email, undefined)
    })

    await t.test('Bob ne supprime pas la playlist', async () => {
      const result = await request(
        'DELETE',
        `/playlists/${playlistId}`,
        b
      )

      assert.equal(result.status, 403)
    })

    await t.test('Charlie ne peut pas ajouter de morceau', async () => {
      const result = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        c,
        {
          title: 'Forbidden Song',
          artist: 'Forbidden Artist'
        }
      )

      assert.equal(result.status, 404)
    })

    await t.test('Réorganisation complète', async () => {
      const result = await request(
        'PUT',
        `/playlists/${playlistId}/order`,
        b,
        {
          itemIds: [thirdId, firstId, secondId],
          revision: await currentRevision()
        }
      )

      assert.equal(result.status, 200)

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' }
      })

      assert.deepEqual(
        stored.map((item) => item.id),
        [thirdId, firstId, secondId]
      )
    })

    await t.test('Ordre avec doublon refusé', async () => {
      const result = await request(
        'PUT',
        `/playlists/${playlistId}/order`,
        a,
        {
          itemIds: [firstId, firstId, secondId],
          revision: await currentRevision()
        }
      )

      assert.equal(result.status, 400)
    })

    await t.test('Ordre incomplet refusé sans changement', async () => {
      const result = await request(
        'PUT',
        `/playlists/${playlistId}/order`,
        a,
        {
          itemIds: [firstId, secondId],
          revision: await currentRevision()
        }
      )

      assert.equal(result.status, 409)

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' }
      })

      assert.deepEqual(
        stored.map((item) => item.id),
        [thirdId, firstId, secondId]
      )
    })

    await t.test('Retrait et compactage des positions', async () => {
      const result = await request(
        'DELETE',
        `/playlists/${playlistId}/items/${firstId}`,
        b
      )

      assert.equal(result.status, 200)

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' }
      })

      assert.deepEqual(
        stored.map((item) => item.id),
        [thirdId, secondId]
      )
      assert.deepEqual(
        stored.map((item) => item.position),
        [0, 1]
      )
    })

    await t.test('Ancienne révision refusée', async () => {
      const revision = await currentRevision()

      const before = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' },
        select: { id: true }
      })

      const result = await request(
        'PUT',
        `/playlists/${playlistId}/order`,
        a,
        {
          itemIds: before.map((item) => item.id).reverse(),
          revision: revision - 1
        }
      )

      assert.equal(result.status, 409)
      assert.equal(await currentRevision(), revision)

      const after = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' },
        select: { id: true }
      })

      assert.deepEqual(after, before)
    })

    await t.test('Deux réorganisations concurrentes', async () => {
      const revision = await currentRevision()

      const responses = await Promise.all([
        request(
          'PUT',
          `/playlists/${playlistId}/order`,
          a,
          {
            itemIds: [thirdId, secondId],
            revision
          }
        ),
        request(
          'PUT',
          `/playlists/${playlistId}/order`,
          a,
          {
            itemIds: [secondId, thirdId],
            revision
          }
        )
      ])

      const statuses = responses
        .map((result) => result.status)
        .sort((left, right) => left - right)

      assert.deepEqual(
        statuses,
        [200, 409],
        JSON.stringify(responses)
      )

      assert.equal(await currentRevision(), revision + 1)

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' },
        select: { id: true }
      })

      const ids = stored.map((item) => item.id)

      assert.ok(
        (
          ids[0] === thirdId &&
          ids[1] === secondId
        ) || (
          ids[0] === secondId &&
          ids[1] === thirdId
        )
      )
    })

    await t.test('Extérieur lit et peut éditer le public', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: { visibility: 'PUBLIC' }
      })

      const result = await request('GET', eventPath, c)
      assert.equal(result.status, 200)
      assert.equal(result.body.canEdit, true)
      assert.equal(result.body.playlists.length, 1)
    })

    await t.test('Extérieur peut éditer le public', async () => {
      const result = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        c,
        {
          title: 'Another Song',
          artist: 'Another Artist'
        }
      )

      assert.equal(result.status, 201)

      // Nettoyer le morceau créé par ce scénario :
      // les tests de concurrence suivants restent indépendants.
      const removed = await prisma.playlistItem.deleteMany({
        where: {
          playlistId,
          title: 'Another Song',
          artist: 'Another Artist'
        }
      })

      assert.equal(removed.count, 1)
    })

    await t.test('Retrait des droits sur un privé', async () => {
      // Une révocation ne doit pas bloquer les droits
      // publics par défaut. Tester donc le cas privé.
      await prisma.event.update({
        where: { id: event.id },
        data: { visibility: 'PRIVATE' }
      })

      try {
        await prisma.eventInvitation.delete({
          where: { id: invitation.id }
        })

        const result = await request(
          'PUT',
          `/playlists/${playlistId}/order`,
          b,
          {
            itemIds: [secondId, thirdId],
            revision: await currentRevision()
          }
        )

        assert.equal(result.status, 404)
      } finally {
        await prisma.event.update({
          where: { id: event.id },
          data: { visibility: 'PUBLIC' }
        })
      }
    })

    await t.test('Ajouts simultanés sans collision', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(
            'POST',
            `/playlists/${playlistId}/items`,
            a,
            {
              title: `Concurrent Song ${index}`,
              artist: 'Concurrent Artist'
            }
          )
        )
      )

      assert.ok(
        results.every((result) => result.status === 201),
        JSON.stringify(results)
      )

      const stored = await prisma.playlistItem.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' }
      })

      assert.equal(stored.length, 8)
      assert.deepEqual(
        stored.map((item) => item.position),
        Array.from({ length: 8 }, (_, index) => index)
      )
    })

    await t.test('Limite de 100 sous concurrence', async () => {
      const count = await prisma.playlistItem.count({
        where: { playlistId }
      })

      await prisma.playlistItem.createMany({
        data: Array.from({ length: 98 - count }, (_, index) => ({
          playlistId,
          addedById: alice.id,
          title: `Remplissage ${index}`,
          artist: 'Test Artist',
          position: count + index
        }))
      })

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(
            'POST',
            `/playlists/${playlistId}/items`,
            a,
            {
              title: `Limite Song ${index}`,
              artist: 'Limite Artist'
            }
          )
        )
      )

      assert.equal(
        responses.filter((result) => result.status === 201).length,
        2,
        JSON.stringify(responses)
      )

      assert.equal(
        responses.filter((result) => result.status === 409).length,
        4
      )

      const finalCount = await prisma.playlistItem.count({
        where: { playlistId }
      })

      assert.equal(finalCount, 100)
    })

    await t.test('Permissions individuelles des playlists', async (t) => {
      const room = await prisma.event.create({
        data: {
          organizerId: alice.id,
          title: 'Permissions playlists',
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 3600000),
          visibility: 'PUBLIC'
        }
      })

      const path = `/playlists/events/${room.id}`

      await prisma.eventInvitation.create({
        data: {
          eventId: room.id,
          userId: bob.id,
          status: 'ACCEPTED'
        }
      })

      const created = await request('POST', path, a, {
        title: 'Playlist test'
      })

      assert.equal(created.status, 201)

      const id = created.body.playlist.id
      const resource = `/playlists/${id}`
      const policies = `${resource}/policies`

      const draft = {
        title: 'Starlight',
        artist: 'Muse'
      }

      async function setPolicies(visibility, editPolicy) {
        const result = await request('PATCH', policies, a, {
          visibility,
          editPolicy
        })

        assert.equal(result.status, 200)

        return result.body.playlist
      }

      await t.test('Playlist publique par defaut', async () => {
        const result = await request('GET', path, c)

        assert.equal(result.status, 200)
        assert.equal(result.body.playlists.length, 1)

        const playlist = result.body.playlists[0]

        assert.equal(playlist.visibility, 'PUBLIC')
        assert.equal(playlist.editPolicy, 'PUBLIC')
        assert.equal(playlist.canEdit, true)
      })

      await t.test('Visiteur ne change pas les permissions', async () => {
        const result = await request('PATCH', policies, c, {
          visibility: 'PRIVATE',
          editPolicy: 'INVITED_ONLY'
        })

        assert.equal(result.status, 403)
      })

      await t.test('Permissions invalides refusees', async () => {
        const result = await request('PATCH', policies, a, {
          visibility: 'INVALID',
          editPolicy: 'PUBLIC'
        })

        assert.equal(result.status, 400)
      })

      let itemId

      await t.test('Edition publique autorisee', async () => {
        const result = await request(
          'POST', `${resource}/items`, c, draft
        )

        assert.equal(result.status, 201)
        itemId = result.body.item.id
      })

      await t.test('Licence restrictive : lecture seule', async () => {
        await setPolicies('PUBLIC', 'INVITED_ONLY')

        const result = await request('GET', path, c)

        assert.equal(result.status, 200)
        assert.equal(result.body.playlists.length, 1)
        assert.equal(result.body.playlists[0].canEdit, false)
      })

      await t.test('Licence restrictive : mutations refusees', async () => {
        const added = await request(
          'POST', `${resource}/items`, c,
          { title: 'Another Song', artist: 'Muse' }
        )

        assert.equal(added.status, 403)

        const removed = await request(
          'DELETE', `${resource}/items/${itemId}`, c
        )

        assert.equal(removed.status, 403)

        const reordered = await request(
          'PUT', `${resource}/order`, c,
          { itemIds: [itemId], revision: 0 }
        )

        assert.equal(reordered.status, 403)
      })

      await t.test('Playlist privee invisible au visiteur', async () => {
        await setPolicies('PRIVATE', 'PUBLIC')

        const result = await request('GET', path, c)

        assert.equal(result.status, 200)
        assert.deepEqual(result.body.playlists, [])
      })

      await t.test('Acces direct prive refuse', async () => {
        const added = await request(
          'POST', `${resource}/items`, c, draft
        )

        assert.equal(added.status, 404)

        const removed = await request(
          'DELETE', `${resource}/items/${itemId}`, c
        )

        assert.equal(removed.status, 404)

        const reordered = await request(
          'PUT', `${resource}/order`, c,
          { itemIds: [itemId], revision: 0 }
        )

        assert.equal(reordered.status, 404)
      })

      await t.test('Invite conserve acces au prive', async () => {
        const result = await request('GET', path, b)

        assert.equal(result.status, 200)
        assert.equal(result.body.playlists.length, 1)
        assert.equal(result.body.playlists[0].canEdit, true)
      })

      await t.test('Modification offline privee refusee', async () => {
        const playlist = await prisma.eventPlaylist.findUniqueOrThrow({
          where: { id }
        })

        const result = await request(
          'POST', `${resource}/items`, b,
          {
            title: 'Offline Song',
            artist: 'Offline Artist',
            offline: {
              eventId: room.id,
              baseRevision: playlist.revision
            }
          }
        )

        assert.equal(result.status, 409)
      })

      await t.test('Changement de licence invalide les revisions', async () => {
        const before = await prisma.eventPlaylist.findUniqueOrThrow({
          where: { id }
        })

        const after = await setPolicies('PUBLIC', 'PUBLIC')

        assert.equal(after.revision, before.revision + 1)

        const result = await request(
          'POST', `${resource}/items`, b,
          {
            title: 'Offline Song',
            artist: 'Offline Artist',
            offline: {
              eventId: room.id,
              baseRevision: before.revision
            }
          }
        )

        assert.equal(result.status, 409)
      })
    })

    await t.test('Événement terminé : écriture refusée', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          startsAt: new Date(Date.now() - 48 * 3600000),
          endsAt: new Date(Date.now() - 24 * 3600000)
        }
      })

      const result = await request(
        'POST',
        `/playlists/${playlistId}/items`,
        a,
        {
          title: 'Late Song',
          artist: 'Late Artist'
        }
      )

      assert.equal(result.status, 409)
    })

    await t.test('Classement conservé après la fin', async () => {
      const result = await request('GET', eventPath, a)
      assert.equal(result.status, 200)
      assert.equal(result.body.finished, true)
      assert.equal(result.body.canEdit, false)
      assert.equal(result.body.playlists[0].items.length, 100)
    })

    await t.test('Suppression de playlist par organisateur', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          startsAt: new Date(Date.now() + 48 * 3600000),
          endsAt: new Date(Date.now() + 52 * 3600000)
        }
      })

      const result = await request(
        'DELETE',
        `/playlists/${playlistId}`,
        a
      )

      assert.equal(result.status, 200)

      const remaining = await prisma.playlistItem.count({
        where: { playlistId }
      })

      assert.equal(remaining, 0)
    })
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    })

    await prisma.$disconnect()
  }
})
