import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { io } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'
import {
  createEventRealtimeManager
} from '../../mobile/src/lib/eventRealtime'

const base = process.env.TEST_API_URL
if (base !== 'http://127.0.0.1:3199') {
  throw new Error('API de test isolee obligatoire sur le port 3199')
}

type NotificationCounts = {
  tracks: number
  playlists: number
  access: number
}

async function waitFor(
  label: string,
  predicate: () => boolean,
  timeoutMs = 7000
): Promise<void> {
  const started = Date.now()

  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timeout : ${label}`)
    }

    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

test(
  'V3.2D - client mobile face au serveur Socket.IO réel',
  { timeout: 45000 },
  async t => {
    const raw = process.env.DATABASE_URL

    if (!raw) {
      throw new Error('DATABASE_URL obligatoire')
    }

    const database = new URL(raw)

    if (
      database.pathname !== '/musicroom_test' ||
      !['localhost', '127.0.0.1'].includes(database.hostname) ||
      database.port !== '5433'
    ) {
      throw new Error(
        'SECURITE : seule musicroom_test locale :5433 est autorisée'
      )
    }

    process.loadEnvFile('.env')

    const secret = process.env.JWT_SECRET
    assert.ok(secret, 'JWT_SECRET absent')

    const health = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(3000)
    })

    assert.equal(health.status, 200)

    const prisma = new PrismaClient()
    const userIds: string[] = []
    const unsubscribe: Array<() => void> = []

    let eventId: string | null = null

    function makeToken(user: {
      id: string
      tokenVersion: number
    }): string {
      return jwt.sign(
        {
          sub: user.id,
          ver: user.tokenVersion
        },
        secret!,
        {
          issuer: 'music-room',
          audience: 'music-room-api',
          expiresIn: '1h'
        }
      )
    }

    async function createUser(name: string) {
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

    async function request(
      method: string,
      path: string,
      token: string,
      body?: unknown
    ) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000)
      })

      return {
        status: response.status,
        body: await response.json() as Record<string, any>
      }
    }

    const observedSockets: ReturnType<typeof io>[] = []

    function createManager() {
      return createEventRealtimeManager(
        token => {
          const socket = io(base, {
          auth: { token },
          path: '/socket.io',
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 2500,
          reconnectionDelayMax: 2500,
          timeout: 3000,
          autoConnect: false
          })
          observedSockets.push(socket)
          return socket
        }
      )
    }

    try {
      const alice = await createUser('D1C Alice Mobile')
      const bob = await createUser('D1C Bob Mobile')

      const tokenAlice = makeToken(alice)
      const tokenBob = makeToken(bob)

      const event = await prisma.event.create({
        data: {
          organizerId: alice.id,
          title: 'D1C Synchronisation Mobile',
          visibility: 'PRIVATE',
          startsAt: new Date(Date.now() + 3600000),
          endsAt: new Date(Date.now() + 7200000)
        }
      })

      eventId = event.id

      const invitation = await prisma.eventInvitation.create({
        data: {
          eventId: event.id,
          userId: bob.id,
          status: 'ACCEPTED'
        }
      })

      const managerAlice = createManager()
      const managerBob = createManager()
      let playlistId: string | null = null

      const countsAlice: NotificationCounts = {
        tracks: 0,
        playlists: 0,
        access: 0
      }

      const countsBob: NotificationCounts = {
        tracks: 0,
        playlists: 0,
        access: 0
      }

      function subscribe(
        manager: ReturnType<typeof createManager>,
        token: string,
        channel: 'tracks' | 'playlists',
        counts: NotificationCounts
      ) {
        unsubscribe.push(manager.subscribe(
          token,
          event.id,
          channel,
          {
            onChanged: () => {
              counts[channel]++
            },
            onAccessChanged: () => {
              counts.access++
            }
          }
        ))
      }

      await t.test(
        'Deux clients mobiles rejoignent les deux salons',
        async () => {
          subscribe(
            managerAlice, tokenAlice, 'tracks', countsAlice
          )
          subscribe(
            managerAlice, tokenAlice, 'playlists', countsAlice
          )
          subscribe(
            managerBob, tokenBob, 'tracks', countsBob
          )
          subscribe(
            managerBob, tokenBob, 'playlists', countsBob
          )

          await waitFor(
            'ACK des quatre abonnements',
            () =>
              countsAlice.tracks >= 1 &&
              countsAlice.playlists >= 1 &&
              countsBob.tracks >= 1 &&
              countsBob.playlists >= 1
          )
        }
      )

      await t.test(
        'Proposition Alice : notification et lecture Bob',
        async () => {
          const previous = countsBob.tracks
          const title = 'Blue Horizon'

          const created = await request(
            'POST',
            `/tracks/events/${event.id}`,
            tokenAlice,
            {
              catalogTrackId: 'blue-horizon'
            }
          )

          assert.equal(
            created.status,
            201,
            JSON.stringify(created)
          )

          await waitFor(
            'notification tracks Bob',
            () => countsBob.tracks > previous
          )

          const listing = await request(
            'GET',
            `/tracks/events/${event.id}`,
            tokenBob
          )

          assert.equal(listing.status, 200)
          assert.ok(
            Array.isArray(listing.body.tracks)
          )
          assert.ok(
            listing.body.tracks.some(
              (track: { title: string }) =>
                track.title === title
            )
          )
        }
      )

      await t.test(
        'Playlist Bob : notification et lecture Alice',
        async () => {
          const previous = countsAlice.playlists
          const title = `Playlist D1C ${randomUUID()}`

          const created = await request(
            'POST',
            `/playlists/events/${event.id}`,
            tokenBob,
            {
              title,
              description: 'Intégration mobile réelle'
            }
          )

          assert.equal(
            created.status,
            201,
            JSON.stringify(created)
          )

          playlistId = created.body.playlist.id

          await waitFor(
            'notification playlists Alice',
            () => countsAlice.playlists > previous
          )

          const listing = await request(
            'GET',
            `/playlists/events/${event.id}`,
            tokenAlice
          )

          assert.equal(listing.status, 200)
          assert.ok(
            Array.isArray(listing.body.playlists)
          )
          assert.ok(
            listing.body.playlists.some(
              (playlist: { title: string }) =>
                playlist.title === title
            )
          )
        }
      )


      // V3.2D2C - reconnexion apres modification hors ligne
      await t.test(
        'Bob recupere une playlist modifiee hors ligne',
        async () => {
          assert.ok(playlistId)
          assert.equal(observedSockets.length, 2)

          const bobSocket = observedSockets[1]!
          assert.equal(bobSocket.connected, true)

          // Déconnexion explicite pour rendre le test
          // indépendant du système réseau de la machine.
          bobSocket.disconnect()

          await waitFor(
            'deconnexion Bob',
            () => !bobSocket.connected
          )

          const previous = countsBob.playlists
          const title = `Hors ligne D2C ${randomUUID()}`

          const added = await request(
            'POST',
            `/playlists/${playlistId}/items`,
            tokenAlice,
            {
              title,
              artist: 'Test reconnexion'
            }
          )

          assert.equal(
            added.status,
            201,
            JSON.stringify(added)
          )

          // Bob n'est plus connecté et ne reçoit pas
          // la notification envoyée pendant la coupure.
          assert.equal(countsBob.playlists, previous)

          bobSocket.connect()

          await waitFor(
            'reconnexion du socket Bob',
            () => bobSocket.connected
          )

          // Le gestionnaire mobile doit rejoindre le salon
          // et déclencher onChanged à la réception de l'ACK.
          await waitFor(
            'rafraichissement apres reconnexion Bob',
            () => countsBob.playlists > previous
          )

          const listing = await request(
            'GET',
            `/playlists/events/${event.id}`,
            tokenBob
          )

          assert.equal(listing.status, 200)

          const updated = listing.body.playlists.find(
            (playlist: { id: string }) =>
              playlist.id === playlistId
          )

          assert.ok(updated, 'Playlist absente apres reprise')

          // Vérifier également l'état effectivement
          // enregistré en base, indépendamment du cache.
          const persisted = await prisma.playlistItem.findFirst({
            where: {
              playlistId,
              title
            }
          })

          assert.ok(
            persisted,
            'Modification non retrouvee apres reconnexion'
          )

        }
      )


      // V3.2D2D - reconnexion automatique transport
      await t.test(
        'Rupture WebSocket : reconnexion automatique et rattrapage',
        async () => {
          assert.equal(observedSockets.length, 2)

          const bobSocket = observedSockets[1]!

          assert.equal(
            bobSocket.connected,
            true,
            'Bob doit etre connecte avant la rupture'
          )

          const previous = countsBob.tracks

          // Fermer uniquement le transport.
          // NE PAS appeler socket.disconnect() :
          // celui-ci désactive la reconnexion automatique.
          const transport = bobSocket.io.engine.transport

          assert.ok(
            transport,
            'Transport WebSocket introuvable'
          )

          transport.close()

          await waitFor(
            'perte de connexion Bob',
            () => !bobSocket.connected
          )

          const title = 'Summer Night'

          // Modification pendant que Bob est hors ligne.
          const created = await request(
            'POST',
            `/tracks/events/${event.id}`,
            tokenAlice,
            {
              catalogTrackId: 'summer-night'
            }
          )

          assert.equal(
            created.status,
            201,
            JSON.stringify(created)
          )

          assert.equal(
            countsBob.tracks,
            previous,
            'Bob ne doit pas recevoir de notification hors ligne'
          )

          // Aucune reconnexion explicite ici.
          await waitFor(
            'reconnexion automatique Bob',
            () => bobSocket.connected,
            12000
          )

          // Le gestionnaire mobile rejoint tracks et
          // déclenche onChanged après l'ACK du serveur.
          await waitFor(
            'rattrapage apres reconnexion automatique',
            () => countsBob.tracks > previous,
            12000
          )

          // La notification ne contient aucune donnée
          // privée : le serveur HTTP reste la référence.
          const listing = await request(
            'GET',
            `/tracks/events/${event.id}`,
            tokenBob
          )

          assert.equal(listing.status, 200)

          assert.ok(
            Array.isArray(listing.body.tracks)
          )

          assert.ok(
            listing.body.tracks.some(
              (track: { title: string }) =>
                track.title === title
            ),
            'Morceau manqué non retrouvé par HTTP'
          )
        }
      )

      await t.test(
        'Expulsion Bob : notification et refus HTTP',
        async () => {
          const previous = countsBob.access

          const removed = await request(
            'DELETE',
            `/events/${event.id}/invitations/${invitation.id}`,
            tokenAlice
          )

          assert.equal(removed.status, 200)

          await waitFor(
            'notification de révocation Bob',
            () => countsBob.access > previous
          )

          const listing = await request(
            'GET',
            `/playlists/events/${event.id}`,
            tokenBob
          )

          assert.equal(listing.status, 404)
        }
      )


      // V3.2D3D - remplacement de session apres revocation
      await t.test(
        'Revocation Bob et nouvelle session Charlie',
        async () => {
          const bobSocket = observedSockets[1]!
          const bobTrackCount = countsBob.tracks
          const bobPlaylistCount = countsBob.playlists

          // La révocation HTTP a été vérifiée dans
          // le scénario précédent. On ferme ici les
          // ressources de la session révoquée.
          managerBob.closeToken(tokenBob)

          assert.equal(bobSocket.connected, false)

          await waitFor(
            'fermeture du socket Bob',
            () => !bobSocket.connected
          )

          // Un nouveau compte a ses propres droits.
          const charlie = await createUser(
            'D3D Charlie Nouvelle Session'
          )

          const tokenCharlie = makeToken(charlie)

          await prisma.eventInvitation.create({
            data: {
              eventId: event.id,
              userId: charlie.id,
              status: 'ACCEPTED'
            }
          })

          const countsCharlie = {
            changed: 0,
            access: 0
          }

          const socketCountBefore = observedSockets.length

          const stopCharlie = managerBob.subscribe(
            tokenCharlie,
            event.id,
            'playlists',
            {
              onChanged: () => {
                countsCharlie.changed++
              },
              onAccessChanged: () => {
                countsCharlie.access++
              }
            }
          )

          unsubscribe.push(stopCharlie)

          await waitFor(
            'abonnement Charlie au salon',
            () => countsCharlie.changed > 0
          )

          assert.equal(
            observedSockets.length,
            socketCountBefore + 1
          )

          const charlieSocket = observedSockets.at(-1)!

          assert.equal(charlieSocket.connected, true)
          assert.notEqual(charlieSocket, bobSocket)

          const previousCharlie = countsCharlie.changed
          const title = `Playlist D3D ${randomUUID()}`

          const created = await request(
            'POST',
            `/playlists/events/${event.id}`,
            tokenAlice,
            {
              title,
              description: 'Test changement de compte'
            }
          )

          assert.equal(
            created.status,
            201,
            JSON.stringify(created)
          )

          await waitFor(
            'notification recue par Charlie',
            () => countsCharlie.changed > previousCharlie
          )

          // Bob ne doit plus recevoir de notifications.
          assert.equal(countsBob.tracks, bobTrackCount)
          assert.equal(
            countsBob.playlists,
            bobPlaylistCount
          )

          const bobResponse = await request(
            'GET',
            `/playlists/events/${event.id}`,
            tokenBob
          )

          assert.equal(bobResponse.status, 404)

          const charlieResponse = await request(
            'GET',
            `/playlists/events/${event.id}`,
            tokenCharlie
          )

          assert.equal(charlieResponse.status, 200)

          assert.ok(
            charlieResponse.body.playlists.some(
              (playlist: { title: string }) =>
                playlist.title === title
            )
          )

          // Une fermeture tardive de l'abonnement Bob
          // ne doit pas affecter la session Charlie.
          assert.equal(charlieSocket.connected, true)
        }
      )

      await t.test(
        'Désabonnement et nettoyage des sockets',
        () => {
          while (unsubscribe.length > 0) {
            unsubscribe.pop()!()
          }

          assert.equal(unsubscribe.length, 0)
        }
      )
    } finally {
      while (unsubscribe.length > 0) {
        try {
          unsubscribe.pop()!()
        } catch {
          // TODO V3.2D : instrumenter les erreurs de fermeture.
        }
      }

      try {
        if (eventId) {
          await prisma.event.deleteMany({
            where: { id: eventId }
          })
        }

        await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        })
      } finally {
        await prisma.$disconnect()
      }
    }
  }
)
