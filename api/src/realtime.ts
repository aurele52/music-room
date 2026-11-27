import type { Server } from 'socket.io'
import { prisma } from './db.js'
import { verifySession } from './services/session.js'

let realtime: Server | null = null

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function room(eventId: string): string {
  return `event:${eventId}:tracks`
}

function playlistRoom(eventId: string): string {
  return `event:${eventId}:playlists`
}

function sessionRoom(eventId: string): string {
  return `event:${eventId}:session`
}

function userRoom(userId: string): string {
  return `user:${userId}:friends`
}

async function authenticatedUser(token: unknown): Promise<string | null> {
  if (typeof token !== 'string') return null

  try {
    const session = verifySession(token)

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { tokenVersion: true }
    })

    if (!user || user.tokenVersion !== session.tokenVersion) {
      return null
    }

    return session.userId
  } catch {
    return null
  }
}

async function canReadEvent(
  eventId: string,
  userId: string
): Promise<boolean> {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { visibility: 'PUBLIC' },
        { organizerId: userId },
        {
          invitations: {
            some: {
              userId,
              status: 'ACCEPTED'
            }
          }
        }
      ]
    },
    select: { id: true }
  })

  return Boolean(event)
}

export function setupRealtime(io: Server): void {
  realtime = io

  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth?.token
      const userId = await authenticatedUser(token)

      if (!userId) {
        next(new Error('Authentification requise'))
        return
      }

      socket.data.userId = userId
      socket.data.token = token
      next()
    } catch {
      next(new Error('Authentification impossible'))
    }
  })

  io.on('connection', (socket) => {
    // Le middleware a authentifié ce compte.
    // La salle ne peut pas être choisie par le client.
    const accountId: string = socket.data.userId
    void socket.join(userRoom(accountId))

    socket.on(
      'session:join',
      async (
        eventId: unknown,
        reply?: (result: { ok: boolean }) => void
      ) => {
        const respond = (ok: boolean) => {
          if (typeof reply === 'function') reply({ ok })
        }

        if (
          typeof eventId !== 'string' ||
          !uuidPattern.test(eventId)
        ) {
          respond(false)
          return
        }

        try {
          const userId = await authenticatedUser(socket.data.token)

          if (
            !userId ||
            userId !== socket.data.userId ||
            !(await canReadEvent(eventId, userId))
          ) {
            respond(false)
            return
          }

          await socket.join(sessionRoom(eventId))
          respond(true)
        } catch {
          respond(false)
        }
      }
    )

    socket.on('session:leave', (eventId: unknown) => {
      if (
        typeof eventId === 'string' &&
        uuidPattern.test(eventId)
      ) {
        socket.leave(sessionRoom(eventId))
      }
    })

    socket.on(
      'tracks:join',
      async (
        eventId: unknown,
        reply?: (result: { ok: boolean }) => void
      ) => {
        const respond = (ok: boolean) => {
          if (typeof reply === 'function') reply({ ok })
        }

        if (
          typeof eventId !== 'string' ||
          !uuidPattern.test(eventId)
        ) {
          respond(false)
          return
        }

        try {
          const userId = await authenticatedUser(socket.data.token)

          if (
            !userId ||
            userId !== socket.data.userId ||
            !(await canReadEvent(eventId, userId))
          ) {
            socket.leave(room(eventId))
            respond(false)
            return
          }

          await socket.join(room(eventId))
          respond(true)
        } catch {
          respond(false)
        }
      }
    )

    socket.on(
      'playlists:join',
      async (
        eventId: unknown,
        reply?: (result: { ok: boolean }) => void
      ) => {
        const respond = (ok: boolean) => {
          if (typeof reply === 'function') reply({ ok })
        }

        if (
          typeof eventId !== 'string' ||
          !uuidPattern.test(eventId)
        ) {
          respond(false)
          return
        }

        try {
          const userId = await authenticatedUser(socket.data.token)

          if (
            !userId ||
            userId !== socket.data.userId ||
            !(await canReadEvent(eventId, userId))
          ) {
            socket.leave(playlistRoom(eventId))
            respond(false)
            return
          }

          await socket.join(playlistRoom(eventId))
          respond(true)
        } catch {
          respond(false)
        }
      }
    )

    socket.on('playlists:leave', (eventId: unknown) => {
      if (typeof eventId === 'string' && uuidPattern.test(eventId)) {
        socket.leave(playlistRoom(eventId))
      }
    })

    socket.on('tracks:leave', (eventId: unknown) => {
      if (typeof eventId === 'string' && uuidPattern.test(eventId)) {
        socket.leave(room(eventId))
      }
    })
  })
}


/**
 * Revalider les accès Socket.IO après un changement
 * de visibilité ou une suppression d'événement.
 *
 * La base vient déjà d'être modifiée : canReadEvent()
 * applique donc les permissions effectives.
 *
 * Une connexion autorisée garde ses abonnements.
 * Une connexion non autorisée reçoit un signal léger
 * puis quitte les trois salons.
 *
 * TODO : centraliser la logique des contrôles
 * d'accès aux salons musicaux.
 */
export async function reconcileEventSocketAccess(
  eventId: string
): Promise<void> {
  if (!realtime || !uuidPattern.test(eventId)) return

  const subscribers = await realtime
    .in(room(eventId))
    .in(playlistRoom(eventId))
    .in(sessionRoom(eventId))
    .fetchSockets()

  for (const socket of subscribers) {
    const userId = await authenticatedUser(socket.data.token)

    const authorized =
      userId !== null &&
      userId === socket.data.userId &&
      await canReadEvent(eventId, userId)

    if (authorized) continue

    socket.emit('event:access-changed', { eventId })

    await socket.leave(room(eventId))
    await socket.leave(playlistRoom(eventId))
    await socket.leave(sessionRoom(eventId))
  }
}

// Une notification ne contient aucune donnée musicale privée.
// Revalidation avant envoi : un ancien participant est retiré du salon.
export async function notifyTracksChanged(
  eventId: string
): Promise<void> {
  if (!realtime) return

  try {
    const subscribers = await realtime.in(room(eventId)).fetchSockets()

    for (const socket of subscribers) {
      const token: unknown = socket.data.token
      const userId = await authenticatedUser(token)

      if (
        !userId ||
        !(await canReadEvent(eventId, userId))
      ) {
        await socket.leave(room(eventId))
        continue
      }

      socket.emit('tracks:changed')
    }
  } catch (error) {
    console.error('Realtime notification error:', error)
  }
}


// Signaler un changement de playlist, sans envoyer de contenu privé.
export async function notifyPlaylistsChanged(
  eventId: string
): Promise<void> {
  if (!realtime) return

  try {
    const subscribers = await realtime
      .in(playlistRoom(eventId))
      .fetchSockets()

    for (const socket of subscribers) {
      const token: unknown = socket.data.token
      const userId = await authenticatedUser(token)

      if (
        !userId ||
        userId !== socket.data.userId ||
        !(await canReadEvent(eventId, userId))
      ) {
        await socket.leave(playlistRoom(eventId))
        continue
      }

      socket.emit('playlists:changed')
    }
  } catch (error) {
    console.error('Playlist notification error:', error)
  }
}


// Appelé après la suppression effective d'une invitation.
// Prévenir chaque connexion du compte et réévaluer son accès.
export async function refreshEventAccess(
  eventId: string,
  userId: string
): Promise<void> {
  // Révocation immédiate des abonnés du canal de session.
  if (realtime) {
    const subscribers = await realtime
      .in(sessionRoom(eventId))
      .fetchSockets()

    for (const socket of subscribers) {
      if (socket.data.userId !== userId) continue

      socket.emit('event:access-changed', { eventId })

      const tokenUser = await authenticatedUser(
        socket.data.token
      )

      if (
        tokenUser !== userId ||
        !(await canReadEvent(eventId, userId))
      ) {
        await socket.leave(sessionRoom(eventId))
      }
    }
  }


  if (!realtime) return

  try {
    const rooms = [
      room(eventId),
      playlistRoom(eventId)
    ]

    const processed = new Set<string>()

    // Une connexion peut appartenir aux deux salons.
    for (const roomName of rooms) {
      const subscribers = await realtime
        .in(roomName)
        .fetchSockets()

      for (const socket of subscribers) {
        if (
          socket.data.userId === userId &&
          !processed.has(socket.id)
        ) {
          processed.add(socket.id)
          socket.emit('event:access-changed', { eventId })

          const tokenUser = await authenticatedUser(
            socket.data.token
          )

          if (
            tokenUser !== userId ||
            !(await canReadEvent(eventId, userId))
          ) {
            await socket.leave(room(eventId))
            await socket.leave(playlistRoom(eventId))
          }
        }
      }
    }
  } catch (error) {
    console.error('Event access refresh error:', error)
  }
}


// Une notification légère, après validation des permissions.
// Aucun titre musical privé n'est transmis dans l'événement.
export async function notifySessionChanged(
  eventId: string
): Promise<void> {
  if (!realtime) return

  try {
    const subscribers = await realtime
      .in(sessionRoom(eventId))
      .fetchSockets()

    for (const socket of subscribers) {
      const userId = await authenticatedUser(socket.data.token)

      if (
        !userId ||
        userId !== socket.data.userId ||
        !(await canReadEvent(eventId, userId))
      ) {
        await socket.leave(sessionRoom(eventId))
        continue
      }

      socket.emit('session:changed')
    }
  } catch (error) {
    console.error('Notification de session impossible:', error)
  }
}


/**
 * Notification privée après une modification effective
 * d'une relation d'amitié.
 *
 * Aucun nom, email ou état de relation n'est envoyé :
 * les clients relisent GET /friends avec leurs droits.
 *
 * TODO : regrouper les notifications par domaine métier
 * dans un module commun lors de la mutualisation.
 */
export async function notifyFriendsChanged(
  userIds: readonly string[]
): Promise<void> {
  if (!realtime) return

  try {
    const unique = [...new Set(userIds)].filter(
      id => uuidPattern.test(id)
    )

    for (const userId of unique) {
      const subscribers = await realtime
        .in(userRoom(userId))
        .fetchSockets()

      for (const socket of subscribers) {
        const authenticated = await authenticatedUser(
          socket.data.token
        )

        if (
          authenticated !== userId ||
          socket.data.userId !== userId
        ) {
          await socket.leave(userRoom(userId))
          continue
        }

        socket.emit('friends:changed')
      }
    }
  } catch (error) {
    console.error('Friend change notification error:', error)
  }
}


/**
 * Invalidation de la liste personnelle des événements
 * et invitations après une mutation enregistrée.
 */
export async function notifyEventsChanged(
  userIds: readonly string[]
): Promise<void> {
  if (!realtime) return

  try {
    const unique = [...new Set(userIds)].filter(
      id => uuidPattern.test(id)
    )

    for (const userId of unique) {
      const subscribers = await realtime
        .in(userRoom(userId))
        .fetchSockets()

      for (const socket of subscribers) {
        const authenticated = await authenticatedUser(
          socket.data.token
        )

        if (
          authenticated !== userId ||
          socket.data.userId !== userId
        ) {
          await socket.leave(userRoom(userId))
          continue
        }

        socket.emit('events:changed')
      }
    }
  } catch (error) {
    console.error('Event notification error:', error)
  }
}

/**
 * Invalidation de la découverte publique.
 * Aucun contenu ni identifiant d'événement transmis.
 */
export function notifyPublicEventsChanged(): void {
  if (!realtime) return
  realtime.emit('events:discovery-changed')
}


/**
 * Signaler une modification des participants.
 * Seuls les comptes concernes recoivent le signal.
 *
 * Aucun nom, email ou statut n'est transporte.
 */
export async function notifyEventParticipantsChanged(
  eventId: string,
  userIds: readonly string[]
): Promise<void> {
  if (!uuidPattern.test(eventId)) return

  await notifyEventsChanged(userIds)

  if (!realtime) return

  try {
    const unique = [...new Set(userIds)].filter(
      id => uuidPattern.test(id)
    )

    for (const userId of unique) {
      const sockets = await realtime
        .in(userRoom(userId))
        .fetchSockets()

      for (const socket of sockets) {
        const authenticated = await authenticatedUser(
          socket.data.token
        )

        if (
          authenticated !== userId ||
          socket.data.userId !== userId
        ) {
          await socket.leave(userRoom(userId))
          continue
        }

        socket.emit('event:participants-changed', {
          eventId
        })
      }
    }
  } catch (error) {
    console.error(
      'Event participants notification error:',
      error
    )
  }
}
