import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { lockEventMusic } from '../services/eventMusicLock.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { notifySessionChanged } from '../realtime.js'
import { findCatalogTrack } from '../services/musicCatalog.js'

export const musicSessionsRouter = Router()
musicSessionsRouter.use(requireAuth)

type Transaction = Prisma.TransactionClient

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ControlAction =
  | 'play'
  | 'pause'
  | 'next'
  | 'ended'
  | 'stop'

class SessionError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && uuidPattern.test(id)
}

function handleError(
  res: import('express').Response,
  error: unknown
): void {
  if (error instanceof SessionError) {
    res.status(error.status).json({ error: error.message })
    return
  }

  console.error('Music Session API:', error)
  res.status(500).json({ error: 'Session musicale indisponible' })
}

async function transact<T>(
  operation: (tx: Transaction) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation, {
    maxWait: 5000,
    timeout: 10000
  })
}

async function access(
  tx: Transaction,
  eventId: string,
  userId: string
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
      invitations: {
        where: { userId, status: 'ACCEPTED' },
        select: { id: true },
        take: 1
      }
    }
  })

  if (!event) {
    throw new SessionError(404, 'Événement introuvable')
  }

  const organizer = event.organizerId === userId
  const participant = event.invitations.length > 0

  if (
    event.visibility !== 'PUBLIC' &&
    !organizer &&
    !participant
  ) {
    throw new SessionError(404, 'Événement introuvable')
  }

  return { event, organizer }
}

function checkControl(
  event: { startsAt: Date; endsAt: Date },
  organizer: boolean
): void {
  if (!organizer) {
    throw new SessionError(
      403,
      "Seul l'organisateur peut contrôler la session"
    )
  }

  const now = new Date()

  if (now < event.startsAt) {
    throw new SessionError(
      409,
      "L'événement n'a pas encore commencé"
    )
  }

  if (now >= event.endsAt) {
    throw new SessionError(
      409,
      "L'événement est terminé"
    )
  }
}

const sessionSelect = {
  id: true,
  eventId: true,
  state: true,
  currentIndex: true,
  revision: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      position: true,
      title: true,
      artist: true
    },
    orderBy: { position: 'asc' as const }
  },
} satisfies Prisma.MusicSessionSelect

// Associer uniquement les morceaux du catalogue local.
function withAudio<T extends {
  items: { title: string; artist: string }[]
}>(session: T) {
  return {
    ...session,
    items: session.items.map(item => ({
      ...item,
      audioUrl: findCatalogTrack(
        item.title, item.artist
      )?.audioUrl ?? null
    }))
  }
}

// État lisible avec les mêmes permissions qu'un événement.
musicSessionsRouter.get('/events/:eventId', async (req, res) => {
  const eventId = req.params.eventId
  const userId: string = res.locals.userId

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  try {
    const result = await transact(async (tx) => {
      const { event, organizer } = await access(
        tx, eventId, userId
      )

      const session = await tx.musicSession.findUnique({
        where: { eventId },
        select: sessionSelect
      })

      const now = new Date()

      return {
        session,
        organizer,
        canControl:
          organizer &&
          event.startsAt <= now &&
          now < event.endsAt,
        finished: now >= event.endsAt
      }
    })

    res.json({
      ...result,
      session: result.session
        ? withAudio(result.session)
        : null
    })
  } catch (error) {
    handleError(res, error)
  }
})

// Snapshot atomique du classement des votes.
// Recommencer remplace la session existante.
musicSessionsRouter.post('/events/:eventId/start', async (req, res) => {
  const eventId = req.params.eventId
  const userId: string = res.locals.userId

  if (!validId(eventId) || req.body?.playlistId !== undefined) {
    res.status(400).json({ error: 'Identifiants invalides' })
    return
  }

  try {
    const session = await transact(async (tx) => {
      await lockEventMusic(tx, eventId)

      const { event, organizer } = await access(
        tx, eventId, userId
      )

      checkControl(event, organizer)

      const proposedTracks = await tx.eventTrack.findMany({
        where: { eventId },
        select: {
          id: true,
          title: true,
          artist: true
        },
        orderBy: [
          { votes: { _count: 'desc' } },
          { createdAt: 'asc' },
          { id: 'asc' }
        ],
        take: 100
      })

      const tracks = proposedTracks.filter(track =>
        findCatalogTrack(track.title, track.artist)
      )

      if (tracks.length === 0) {
        throw new SessionError(409, 'Aucun morceau du catalogue disponible')
      }

      const existing = await tx.musicSession.findUnique({
        where: { eventId },
        select: { id: true }
      })

      if (existing) {

        await tx.musicSessionItem.deleteMany({
          where: { sessionId: existing.id }
        })
      }

      await tx.musicSession.upsert({
        where: { eventId },
        create: {
          eventId,
          state: 'PAUSED',
          currentIndex: 0,
          revision: 1,
          items: {
            create: tracks.map((item, index) => ({
              title: item.title,
              artist: item.artist,
              sourceTrackId: item.id,
              position: index
            }))
          }
        },
        update: {
          state: 'PAUSED',
          currentIndex: 0,
          revision: { increment: 1 },
          items: {
            create: tracks.map((item, index) => ({
              title: item.title,
              artist: item.artist,
              sourceTrackId: item.id,
              position: index
            }))
          }
        }
      })

      return tx.musicSession.findUniqueOrThrow({
        where: { eventId },
        select: sessionSelect
      })
    })

    void notifySessionChanged(eventId)
    res.status(201).json({ session: withAudio(session) })
  } catch (error) {
    handleError(res, error)
  }
})

// Chaque commande porte la révision lue par son émetteur.
musicSessionsRouter.post('/events/:eventId/control', async (req, res) => {
  const eventId = req.params.eventId
  const action: unknown = req.body?.action
  const revision: unknown = req.body?.revision
  const userId: string = res.locals.userId

  const allowed: ControlAction[] = [
    'play', 'pause', 'next', 'ended', 'stop'
  ]

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  if (
    typeof action !== 'string' ||
    !allowed.includes(action as ControlAction) ||
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    res.status(400).json({ error: 'Commande invalide' })
    return
  }

  try {
    const session = await transact(async (tx) => {
      await lockEventMusic(tx, eventId)

      const { event, organizer } = await access(
        tx, eventId, userId
      )

      checkControl(event, organizer)

      const current = await tx.musicSession.findUnique({
        where: { eventId },
        select: {
          id: true,
          state: true,
          currentIndex: true,
          revision: true,
        }
      })

      if (!current) {
        throw new SessionError(404, 'Aucune session musicale')
      }

      if (current.revision !== revision) {
        throw new SessionError(
          409,
          'Révision obsolète : actualise la session'
        )
      }

      if (current.state === 'STOPPED') {
        throw new SessionError(
          409,
          'La session est arrêtée : redémarre le classement'
        )
      }

      let state: 'PAUSED' | 'PLAYING' | 'STOPPED' = current.state
      let currentIndex = current.currentIndex

      switch (action as ControlAction) {
        case 'play':
          if (state === 'PLAYING') {
            throw new SessionError(409, 'Lecture déjà en cours')
          }
          state = 'PLAYING'
          break

        case 'pause':
          if (state !== 'PLAYING') {
            throw new SessionError(409, 'Session déjà en pause')
          }
          state = 'PAUSED'
          break

        case 'ended':
        case 'next': {
          if (action === 'ended' && state !== 'PLAYING') {
            throw new SessionError(409, 'Lecture inactive')
          }

          const consumed = await tx.musicSessionItem.findMany({
            where: {
              sessionId: current.id,
              position: { lte: currentIndex }
            },
            select: { sourceTrackId: true }
          })

          const consumedIds = consumed
            .map(item => item.sourceTrackId)
            .filter((id): id is string => id !== null)

          const proposedRemaining = await tx.eventTrack.findMany({
            where: {
              eventId,
              id: { notIn: consumedIds }
            },
            select: {
              id: true,
              title: true,
              artist: true
            },
            orderBy: [
              { votes: { _count: 'desc' } },
              { createdAt: 'asc' },
              { id: 'asc' }
            ]
          })

          const remaining = proposedRemaining.filter(track =>
            findCatalogTrack(track.title, track.artist)
          )

          if (remaining.length === 0) {
            if (action === 'ended') {
              state = 'STOPPED'
              break
            }

            throw new SessionError(409, 'Dernier morceau atteint')
          }

          // Garder le morceau courant et les morceaux passes.
          await tx.musicSessionItem.deleteMany({
            where: {
              sessionId: current.id,
              position: { gt: currentIndex }
            }
          })

          // Reconstruire uniquement la suite de la file.
          await tx.musicSessionItem.createMany({
            data: remaining.map((track, index) => ({
              sessionId: current.id,
              sourceTrackId: track.id,
              title: track.title,
              artist: track.artist,
              position: currentIndex + index + 1
            }))
          })

          currentIndex++
          break
        }

        case 'stop':
          state = 'STOPPED'
          break
      }

      await tx.musicSession.update({
        where: { id: current.id },
        data: {
          state,
          currentIndex,
          revision: { increment: 1 }
        }
      })

      return tx.musicSession.findUniqueOrThrow({
        where: { id: current.id },
        select: sessionSelect
      })
    })

    void notifySessionChanged(eventId)
    res.json({ session: withAudio(session) })
  } catch (error) {
    handleError(res, error)
  }
})
