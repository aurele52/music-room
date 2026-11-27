import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Amis - invitations et permissions', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('Base musicroom_test obligatoire')
  }

  process.loadEnvFile('.env')

  const secret = process.env.JWT_SECRET
  assert.ok(secret)

  const prisma = new PrismaClient()
  const ids = []

  async function createUser(name, visibility) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name,
        visibility,
        emailVerifiedAt: new Date()
      }
    })

    ids.push(user.id)
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

  async function request(method, path, token, body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : {
        body: JSON.stringify(body)
      })
    })

    return {
      status: response.status,
      body: await response.json()
    }
  }

  try {
    const alice = await createUser('Alice Amis', 'PUBLIC')
    const bob = await createUser('Bob Amis', 'PUBLIC')
    const charlie = await createUser('Charlie Amis', 'PRIVATE')

    const a = makeToken(alice)
    const b = makeToken(bob)
    const c = makeToken(charlie)

    await t.test('Liste sans JWT refusée', async () => {
      const result = await request('GET', '/friends', null)
      assert.equal(result.status, 401)
    })

    await t.test('Listes initialement vides', async () => {
      const result = await request('GET', '/friends', a)
      assert.equal(result.status, 200)
      assert.deepEqual(result.body, {
        friends: [], incoming: [], outgoing: []
      })
    })

    await t.test('Auto-invitation refusée', async () => {
      const result = await request('POST', '/friends/requests', a, {
        userId: alice.id
      })
      assert.equal(result.status, 400)
    })

    await t.test('Invitation vers un profil privé refusée', async () => {
      const result = await request('POST', '/friends/requests', a, {
        userId: charlie.id
      })
      assert.equal(result.status, 404)
    })

    let invitationId

    await t.test('Alice invite Bob', async () => {
      const result = await request('POST', '/friends/requests', a, {
        userId: bob.id
      })
      assert.equal(result.status, 201)
      assert.equal(result.body.request.status, 'PENDING')
      invitationId = result.body.request.id
    })

    await t.test('Invitation inverse refusée', async () => {
      const result = await request('POST', '/friends/requests', b, {
        userId: alice.id
      })
      assert.equal(result.status, 409)
    })

    await t.test('Invitation reçue visible par Bob', async () => {
      const result = await request('GET', '/friends', b)
      assert.equal(result.status, 200)
      assert.equal(result.body.incoming.length, 1)
      assert.equal(result.body.incoming[0].user.id, alice.id)
      assert.equal(result.body.incoming[0].user.email, undefined)
    })

    await t.test('Expéditeur ne peut pas accepter', async () => {
      const result = await request(
        'POST', `/friends/requests/${invitationId}/accept`, a
      )
      assert.equal(result.status, 404)
    })

    await t.test('Tiers ne peut pas accepter', async () => {
      const result = await request(
        'POST', `/friends/requests/${invitationId}/accept`, c
      )
      assert.equal(result.status, 404)
    })

    await t.test('Bob accepte', async () => {
      const result = await request(
        'POST', `/friends/requests/${invitationId}/accept`, b
      )
      assert.equal(result.status, 200)
    })

    await t.test('Acceptation répétée refusée', async () => {
      const result = await request(
        'POST', `/friends/requests/${invitationId}/accept`, b
      )
      assert.equal(result.status, 404)
    })

    await t.test('Amitié visible des deux côtés', async () => {
      const resultA = await request('GET', '/friends', a)
      const resultB = await request('GET', '/friends', b)
      assert.equal(resultA.body.friends.length, 1)
      assert.equal(resultB.body.friends.length, 1)
    })

    await t.test('Bob passe en FRIENDS', async () => {
      const result = await request(
        'PATCH', '/profile/me/visibility', b,
        { visibility: 'FRIENDS' }
      )
      assert.equal(result.status, 200)
    })

    await t.test('Alice peut consulter Bob', async () => {
      const result = await request('GET', `/profile/${bob.id}`, a)
      assert.equal(result.status, 200)
      assert.equal(result.body.user.id, bob.id)
    })

    await t.test('Charlie ne peut pas consulter Bob', async () => {
      const result = await request('GET', `/profile/${bob.id}`, c)
      assert.equal(result.status, 404)
    })

    await t.test('Bob apparaît dans la recherche d’Alice', async () => {
      const result = await request(
        'GET', '/profile/search?q=Bob', a
      )
      assert.equal(result.status, 200)
      assert.ok(result.body.users.some((user) => user.id === bob.id))
    })

    await t.test('Bob est absent de la recherche de Charlie', async () => {
      const result = await request(
        'GET', '/profile/search?q=Bob', c
      )
      assert.equal(result.status, 200)
      assert.ok(!result.body.users.some((user) => user.id === bob.id))
    })

    await t.test('Alice supprime Bob', async () => {
      const result = await request(
        'DELETE', `/friends/${bob.id}`, a
      )
      assert.equal(result.status, 200)
    })

    await t.test('Accès FRIENDS révoqué', async () => {
      const result = await request('GET', `/profile/${bob.id}`, a)
      assert.equal(result.status, 404)
    })

    await t.test('Bob redevient PUBLIC', async () => {
      const result = await request(
        'PATCH', '/profile/me/visibility', b,
        { visibility: 'PUBLIC' }
      )
      assert.equal(result.status, 200)
    })

    let secondId

    await t.test('Bob envoie une nouvelle invitation', async () => {
      const result = await request(
        'POST', '/friends/requests', b,
        { userId: alice.id }
      )
      assert.equal(result.status, 201)
      secondId = result.body.request.id
    })

    await t.test('Alice refuse cette invitation', async () => {
      const result = await request(
        'DELETE', `/friends/requests/${secondId}`, a
      )
      assert.equal(result.status, 200)
    })

    await t.test('Aucune amitié conservée', async () => {
      const result = await request('GET', '/friends', a)
      assert.deepEqual(result.body, {
        friends: [], incoming: [], outgoing: []
      })
    })
  } finally {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userLowId: { in: ids } },
          { userHighId: { in: ids } }
        ]
      }
    })

    await prisma.user.deleteMany({
      where: { id: { in: ids } }
    })

    await prisma.$disconnect()
  }
})
