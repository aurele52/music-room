import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Événements - invitations et participants', async (t) => {
  const url = process.env.DATABASE_URL

  if (!url || new URL(url).pathname !== '/musicroom_test') {
    throw new Error('musicroom_test obligatoire')
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
        ...(auth ? { Authorization: `Bearer ${auth}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })

    return {
      status: response.status,
      body: await response.json()
    }
  }

  try {
    const alice = await createUser('Alice Invitation')
    const bob = await createUser('Bob Invitation')
    const charlie = await createUser('Charlie Invitation')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const [userLowId, userHighId] = [alice.id, bob.id].sort()

    await prisma.friendship.create({
      data: {
        userLowId,
        userHighId,
        requesterId: alice.id,
        status: 'ACCEPTED'
      }
    })

    const start = new Date(Date.now() + 48 * 3600000)
    const end = new Date(Date.now() + 52 * 3600000)

    const event = await prisma.event.create({
      data: {
        title: 'Concert privé invitation',
        description: 'Soirée entre amis',
        startsAt: start,
        endsAt: end,
        visibility: 'PRIVATE',
        organizerId: alice.id
      }
    })

    const invitationsPath = `/events/${event.id}/invitations`
    let invitationId

    await t.test('Liste des invitations protégée', async () => {
      const result = await request('GET', '/events/invitations/mine', null)
      assert.equal(result.status, 401)
    })

    await t.test('Utilisateur extérieur ne peut pas inviter', async () => {
      const result = await request(
        'POST', invitationsPath, c, { userId: bob.id }
      )
      assert.equal(result.status, 404)
    })

    await t.test('Invitation à soi-même refusée', async () => {
      const result = await request(
        'POST', invitationsPath, a, { userId: alice.id }
      )
      assert.equal(result.status, 400)
    })

    await t.test('Invitation d’un non-ami refusée', async () => {
      const result = await request(
        'POST', invitationsPath, a, { userId: charlie.id }
      )
      assert.equal(result.status, 403)
    })

    await t.test('Alice invite Bob', async () => {
      const result = await request(
        'POST', invitationsPath, a, { userId: bob.id }
      )
      assert.equal(result.status, 201)
      assert.equal(result.body.invitation.status, 'PENDING')
      invitationId = result.body.invitation.id
    })

    await t.test('Doublon refusé', async () => {
      const result = await request(
        'POST', invitationsPath, a, { userId: bob.id }
      )
      assert.equal(result.status, 409)
    })

    await t.test('Bob retrouve son invitation', async () => {
      const result = await request('GET', '/events/invitations/mine', b)
      assert.equal(result.status, 200)

      const found = result.body.invitations.find(
        (item) => item.id === invitationId
      )

      assert.equal(found.status, 'PENDING')
      assert.equal(found.event.title, 'Concert privé invitation')
      assert.equal(found.event.organizer.id, alice.id)
      assert.equal(found.event.organizer.email, undefined)
    })

    await t.test('Invitation en attente : accès privé refusé', async () => {
      const result = await request('GET', `/events/${event.id}`, b)
      assert.equal(result.status, 404)
    })

    await t.test('Charlie ne peut pas accepter', async () => {
      const result = await request(
        'POST', `/events/invitations/${invitationId}/accept`, c
      )
      assert.equal(result.status, 404)
    })

    await t.test('Alice ne peut pas accepter pour Bob', async () => {
      const result = await request(
        'POST', `/events/invitations/${invitationId}/accept`, a
      )
      assert.equal(result.status, 404)
    })

    await t.test('Bob accepte son invitation', async () => {
      const result = await request(
        'POST', `/events/invitations/${invitationId}/accept`, b
      )
      assert.equal(result.status, 200)
    })

    await t.test('Acceptation répétée refusée', async () => {
      const result = await request(
        'POST', `/events/invitations/${invitationId}/accept`, b
      )
      assert.equal(result.status, 404)
    })

    await t.test('Bob consulte désormais le privé', async () => {
      const result = await request('GET', `/events/${event.id}`, b)
      assert.equal(result.status, 200)
      assert.equal(result.body.event.id, event.id)
    })

    await t.test('Charlie ne consulte toujours pas le privé', async () => {
      const result = await request('GET', `/events/${event.id}`, c)
      assert.equal(result.status, 404)
    })

    await t.test('Bob ne peut pas modifier l’événement', async () => {
      const result = await request(
        'DELETE', `/events/${event.id}`, b
      )
      assert.equal(result.status, 404)
    })

    await t.test('Seule Alice consulte les participants', async () => {
      const bobResult = await request('GET', invitationsPath, b)
      assert.equal(bobResult.status, 404)

      const aliceResult = await request('GET', invitationsPath, a)
      assert.equal(aliceResult.status, 200)
      assert.equal(aliceResult.body.invitations.length, 1)
      assert.equal(aliceResult.body.invitations[0].status, 'ACCEPTED')
    })

    await t.test('Charlie ne peut pas retirer Bob', async () => {
      const result = await request(
        'DELETE', `${invitationsPath}/${invitationId}`, c
      )
      assert.equal(result.status, 404)
    })

    await t.test('Alice retire Bob', async () => {
      const result = await request(
        'DELETE', `${invitationsPath}/${invitationId}`, a
      )
      assert.equal(result.status, 200)
    })

    await t.test('Accès au privé immédiatement révoqué', async () => {
      const result = await request('GET', `/events/${event.id}`, b)
      assert.equal(result.status, 404)
    })

    await t.test('Alice réinvite Bob', async () => {
      const result = await request(
        'POST', invitationsPath, a, { userId: bob.id }
      )
      assert.equal(result.status, 201)
      invitationId = result.body.invitation.id
    })

    await t.test('Bob refuse l’invitation', async () => {
      const result = await request(
        'DELETE', `/events/invitations/${invitationId}`, b
      )
      assert.equal(result.status, 200)
    })

    await t.test('Refus retiré des invitations', async () => {
      const result = await request('GET', '/events/invitations/mine', b)
      assert.equal(result.status, 200)
      assert.ok(
        !result.body.invitations.some((item) => item.id === invitationId)
      )
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
