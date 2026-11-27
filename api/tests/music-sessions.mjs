import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

test('Music Room - session musicale en direct', async (t) => {
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
  const users = []

  async function makeUser(name) {
    const user = await prisma.user.create({
      data: {
        name,
        email: `${randomUUID()}@example.test`,
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
    const alice = await makeUser('Alice Session')
    const bob = await makeUser('Bob Session')
    const charlie = await makeUser('Charlie Session')

    const a = token(alice)
    const b = token(bob)
    const c = token(charlie)

    const event = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Session en direct',
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        visibility: 'PRIVATE'
      }
    })

    const future = await prisma.event.create({
      data: {
        organizerId: alice.id,
        title: 'Session future',
        startsAt: new Date(Date.now() + 3600000),
        endsAt: new Date(Date.now() + 7200000),
        visibility: 'PRIVATE'
      }
    })

    await prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId: bob.id,
        status: 'ACCEPTED'
      }
    })

    const titles = [
      'Blue Horizon',
      'Summer Night',
      'Morning Light'
    ]

    for (let index = 0; index < titles.length; index++) {
      const track = await prisma.eventTrack.create({
        data: {
          eventId: event.id,
          proposerId: alice.id,
          title: titles[index],
          artist: 'Music Room'
        }
      })

      // Respectivement 3, 2 et 1 votes.
      await prisma.trackVote.createMany({
        data: [alice, bob, charlie]
          .slice(0, 3 - index)
          .map(user => ({
            trackId: track.id,
            userId: user.id
          }))
      })
    }

    const url = `/sessions/events/${event.id}`
    const read = (auth) => request('GET', url, auth)
    const start = (auth, eventId = event.id) =>
      request(
        'POST',
        `/sessions/events/${eventId}/start`,
        auth,
        {}
      )

    const control = (auth, action, revision) =>
      request(
        'POST',
        `${url}/control`,
        auth,
        { action, revision }
      )

    let revision = 0

    await t.test('Lecture sans JWT refusée', async () => {
      assert.equal((await read(null)).status, 401)
    })

    await t.test('Participant lit une session absente', async () => {
      const result = await read(b)
      assert.equal(result.status, 200)
      assert.equal(result.body.session, null)
      assert.equal(result.body.canControl, false)
    })

    await t.test('Extérieur privé sans accès', async () => {
      assert.equal((await read(c)).status, 404)
    })

    await t.test('Participant ne peut pas démarrer', async () => {
      assert.equal((await start(b)).status, 403)
    })

    await t.test('Événement futur interdit', async () => {
      const result = await start(a, future.id)
      assert.equal(result.status, 409)
    })

    await t.test('Démarrage depuis le classement des votes', async () => {
      const result = await start(a)

      assert.equal(result.status, 201)
      assert.equal(result.body.session.state, 'PAUSED')
      assert.equal(result.body.session.currentIndex, 0)
      assert.equal(result.body.session.revision, 1)

      assert.deepEqual(
        result.body.session.items.map((item) => item.title),
        [
          'Blue Horizon',
          'Summer Night',
          'Morning Light'
        ]
      )

      revision = result.body.session.revision
    })

    await t.test('Participant voit le même état', async () => {
      const result = await read(b)

      assert.equal(result.status, 200)
      assert.equal(result.body.session.revision, revision)
      assert.equal(result.body.session.items.length, 3)
    })

    await t.test('Participant ne peut pas contrôler', async () => {
      const result = await control(b, 'play', revision)
      assert.equal(result.status, 403)
    })

    await t.test('Lecture puis pause', async () => {
      const playing = await control(a, 'play', revision)

      assert.equal(playing.status, 200)
      assert.equal(playing.body.session.state, 'PLAYING')
      revision = playing.body.session.revision

      const paused = await control(a, 'pause', revision)

      assert.equal(paused.status, 200)
      assert.equal(paused.body.session.state, 'PAUSED')
      revision = paused.body.session.revision
    })

    await t.test('Morceau suivant selon les votes', async () => {
      const next = await control(a, 'next', revision)

      assert.equal(next.status, 200)
      assert.equal(next.body.session.currentIndex, 1)

      assert.equal(
        next.body.session.items[1].title,
        'Summer Night'
      )

      revision = next.body.session.revision
    })

    await t.test('Ancienne navigation refusée', async () => {
      for (const action of ['previous', 'jump']) {
        const before = (await read(a)).body.session
        const result = await control(a, action, revision)

        assert.equal(result.status, 400)
        assert.deepEqual(
          (await read(a)).body.session,
          before
        )
      }
    })

    await t.test('Ancienne révision rejetée', async () => {
      const result = await control(a, 'play', revision - 1)

      assert.equal(result.status, 409)
      assert.match(result.body.error, /Révision obsolète/)
    })

    await t.test('Commandes concurrentes sérialisées', async () => {
      const results = await Promise.all([
        control(a, 'play', revision),
        control(a, 'next', revision)
      ])

      assert.deepEqual(
        results.map((result) => result.status).sort(
          (left, right) => left - right
        ),
        [200, 409]
      )

      const current = (await read(a)).body.session

      revision = current.revision
      assert.equal(revision, 5)
    })

    await t.test('Commande rejetée sans modification de session', async () => {
      const before = (await read(a)).body.session

      const rejected = await control(
        a, 'next', revision - 1
      )

      assert.equal(rejected.status, 409)
      assert.deepEqual(
        (await read(a)).body.session,
        before
      )
    })

    await t.test('Ancien démarrage par playlist refusé', async () => {
      const before = (await read(a)).body.session

      const rejected = await request(
        'POST',
        `${url}/start`,
        a,
        { playlistId: randomUUID() }
      )

      assert.equal(rejected.status, 400)
      assert.deepEqual(
        (await read(a)).body.session,
        before
      )
    })

    await t.test('Arrêt puis commandes refusées', async () => {
      const stopped = await control(a, 'stop', revision)

      assert.equal(stopped.status, 200)
      assert.equal(stopped.body.session.state, 'STOPPED')

      revision = stopped.body.session.revision

      assert.equal(
        (await control(a, 'play', revision)).status,
        409
      )
    })

    await t.test('Demarrage autonome depuis les votes', async () => {
      const rankedEvent = await prisma.event.create({
        data: {
          organizerId: alice.id,
          title: 'Session par classement',
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 3600000),
          visibility: 'PUBLIC'
        }
      })

      const route = `/sessions/events/${rankedEvent.id}/start`

      // Aucune playlist et aucun morceau.
      const empty = await request('POST', route, a, {})
      assert.equal(empty.status, 409)

      const low = await prisma.eventTrack.create({
        data: {
          eventId: rankedEvent.id,
          proposerId: alice.id,
          title: 'Blue Horizon',
          artist: 'Music Room'
        }
      })

      const high = await prisma.eventTrack.create({
        data: {
          eventId: rankedEvent.id,
          proposerId: alice.id,
          title: 'Summer Night',
          artist: 'Music Room'
        }
      })

      await prisma.trackVote.createMany({
        data: [
          { trackId: low.id, userId: alice.id },
          { trackId: high.id, userId: alice.id },
          { trackId: high.id, userId: bob.id }
        ]
      })

      // Un participant ne controle pas la session.
      const forbidden = await request('POST', route, b, {})
      assert.equal(forbidden.status, 403)

      const result = await request('POST', route, a, {})

      assert.equal(result.status, 201)
      assert.equal(result.body.session.state, 'PAUSED')
      assert.equal(result.body.session.currentIndex, 0)

      assert.deepEqual(
        result.body.session.items.map(item => item.title),
        ['Summer Night', 'Blue Horizon']
      )

      const playlists = await prisma.eventPlaylist.count({
        where: { eventId: rankedEvent.id }
      })

      assert.equal(playlists, 0)

      let current = result.body.session
      const controlRoute = `/sessions/events/${rankedEvent.id}/control`

      async function next() {
        const response = await request(
          'POST', controlRoute, a,
          {
            action: 'next',
            revision: current.revision
          }
        )

        assert.equal(response.status, 200)
        current = response.body.session

        return current.items[current.currentIndex].title
      }

      // Nouvelle proposition pendant la session.
      const proposed = await request(
        'POST',
        `/tracks/events/${rankedEvent.id}`,
        a,
        {
          catalogTrackId: 'neon-city'
        }
      )

      assert.equal(proposed.status, 201)

      const newId = proposed.body.track.id

      for (const auth of [a, b, c]) {
        const voted = await request(
          'POST', `/tracks/${newId}/vote`, auth
        )

        assert.equal(voted.status, 201)
      }

      // Le nouveau favori passe avant le morceau initial.
      assert.equal(await next(), 'Neon City')

      // Le morceau deja passe ne revient pas.
      assert.equal(await next(), 'Blue Horizon')

      const ended = await request(
        'POST', controlRoute, a,
        {
          action: 'next',
          revision: current.revision
        }
      )

      assert.equal(ended.status, 409)

      const stored = await request(
        'GET',
        `/sessions/events/${rankedEvent.id}`,
        a
      )

      assert.deepEqual(stored.body.session, current)
    })

    await t.test('Catalogue protege par authentification', async () => {
      assert.equal(
        (await request('GET', '/catalog', null)).status,
        401
      )

      const result = await request('GET', '/catalog', a)

      assert.equal(result.status, 200)
      assert.equal(result.body.tracks.length, 5)
    })

    await t.test('Fichiers WAV disponibles', async () => {
      const result = await request('GET', '/catalog', a)

      for (const track of result.body.tracks) {
        const response = await fetch(
          base + track.audioUrl
        )

        assert.equal(response.status, 200)
        assert.match(
          response.headers.get('content-type'),
          /audio/
        )

        const data = Buffer.from(
          await response.arrayBuffer()
        )

        assert.equal(data.toString('ascii', 0, 4), 'RIFF')
        assert.equal(data.toString('ascii', 8, 12), 'WAVE')
        assert.ok(data.length > 44)
      }
    })

    let audioEvent
    let audioSession

    await t.test('Association des morceaux aux fichiers audio', async () => {
      audioEvent = await prisma.event.create({
        data: {
          organizerId: alice.id,
          title: 'Session audio',
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 3600000),
          visibility: 'PUBLIC'
        }
      })

      for (const title of [
        'Blue Horizon',
        'Summer Night',
        'Morceau hors catalogue'
      ]) {
        const track = await prisma.eventTrack.create({
          data: {
            eventId: audioEvent.id,
            proposerId: alice.id,
            title,
            artist: 'Music Room'
          }
        })

        if (title === 'Blue Horizon') {
          await prisma.trackVote.create({
            data: {
              trackId: track.id,
              userId: alice.id
            }
          })
        }
      }

      const result = await start(a, audioEvent.id)

      assert.equal(result.status, 201)

      audioSession = result.body.session

      assert.equal(
        audioSession.items[0].audioUrl,
        '/api/audio/blue-horizon.wav'
      )

      assert.equal(
        audioSession.items.find(
          item => item.title === 'Summer Night'
        ).audioUrl,
        '/api/audio/summer-night.wav'
      )

      assert.equal(
        audioSession.items.some(
          item => item.title === 'Morceau hors catalogue'
        ),
        false
      )

      assert.equal(audioSession.items.length, 2)

      assert.equal(
        await prisma.eventTrack.count({
          where: { eventId: audioEvent.id }
        }),
        3
      )
    })

    async function audioControl(auth, action, rev) {
      return request(
        'POST',
        `/sessions/events/${audioEvent.id}/control`,
        auth,
        { action, revision: rev }
      )
    }

    await t.test('Participant ne peut signaler une fin', async () => {
      const result = await audioControl(
        b, 'ended', audioSession.revision
      )

      assert.equal(result.status, 403)
    })

    await t.test('Fin refusee lorsque la lecture est inactive', async () => {
      const result = await audioControl(
        a, 'ended', audioSession.revision
      )

      assert.equal(result.status, 409)
    })

    await t.test('Passage automatique concurrent protege', async () => {
      const playing = await audioControl(
        a, 'play', audioSession.revision
      )

      assert.equal(playing.status, 200)

      audioSession = playing.body.session

      const results = await Promise.all([
        audioControl(a, 'ended', audioSession.revision),
        audioControl(a, 'ended', audioSession.revision)
      ])

      assert.deepEqual(
        results.map(item => item.status).sort(),
        [200, 409]
      )

      audioSession = results.find(
        item => item.status === 200
      ).body.session

      assert.equal(audioSession.currentIndex, 1)
      assert.equal(audioSession.state, 'PLAYING')
    })

    await t.test('Arret automatique apres le dernier morceau', async () => {
      const stopped = await audioControl(
        a, 'ended', audioSession.revision
      )

      assert.equal(stopped.status, 200)
      assert.equal(stopped.body.session.state, 'STOPPED')
      assert.equal(stopped.body.session.currentIndex, 1)

      const stored = await request(
        'GET',
        `/sessions/events/${audioEvent.id}`,
        a
      )

      assert.deepEqual(
        stored.body.session,
        stopped.body.session
      )
    })

    await t.test('Fin d’événement : contrôle interdit', async () => {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          endsAt: new Date(Date.now() - 1000)
        }
      })

      assert.equal(
        (await control(a, 'next', revision)).status,
        409
      )

      assert.equal((await read(b)).status, 200)
    })
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: users } }
    })

    await prisma.$disconnect()
  }
})
