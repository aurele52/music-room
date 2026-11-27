import { Router } from 'express'
import { findCatalogTrackById } from '../services/musicCatalog.js'
import {
  isVoteTimeAllowed,
  isVoteLocationAllowed,
  needsVoteLocation
} from '../services/voteRestrictions.js'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { notifyTracksChanged } from '../realtime.js'
import { lockEventMusic } from '../services/eventMusicLock.js'

class TrackCreationError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

class VoteWriteError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export const tracksRouter = Router()

tracksRouter.use(requireAuth)

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

// Les invitations en attente ne donnent aucun droit musical.
async function eventAccess(
  eventId: string,
  userId: string,
  tx?: Prisma.TransactionClient
) {
  const event = await (tx ?? prisma).event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      visibility: true,
      votePolicy: true,
      voteWindowStart: true,
      voteWindowEnd: true,
      voteLatitude: true,
      voteLongitude: true,
      voteRadiusMeters: true,
      organizerId: true,
      endsAt: true,
      invitations: {
        where: {
          userId,
          status: 'ACCEPTED'
        },
        select: { id: true },
        take: 1
      }
    }
  })

  if (!event) return null

  const organizer = event.organizerId === userId
  const participant = event.invitations.length > 0

  return {
    readable: event.visibility === 'PUBLIC' || organizer || participant,
    writable: organizer || participant,
    publicVote: event.visibility === 'PUBLIC' && event.votePolicy === 'PUBLIC',
    restrictions: {
      voteWindowStart: event.voteWindowStart,
      voteWindowEnd: event.voteWindowEnd,
      voteLatitude: event.voteLatitude,
      voteLongitude: event.voteLongitude,
      voteRadiusMeters: event.voteRadiusMeters
    },
    finished: event.endsAt <= new Date(),
    organizer
  }
}

// Liste des propositions avec nombre de votes et vote personnel.
tracksRouter.get('/events/:eventId', async (req, res) => {
  const userId: string = res.locals.userId
  const eventId = req.params.eventId

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  try {
    const access = await eventAccess(eventId, userId)

    if (!access || !access.readable) {
      res.status(404).json({ error: 'Événement introuvable' })
      return
    }

    const tracks = await prisma.eventTrack.findMany({
      where: { eventId },
      select: {
        id: true,
        title: true,
        artist: true,
        createdAt: true,
        proposerId: true,
        proposer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { votes: true }
        },
        votes: {
          where: { userId },
          select: { id: true }
        }
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }
      ],
      take: 100
    })

    const ranking = tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      createdAt: track.createdAt,
      proposerId: track.proposerId,
      proposer: track.proposer,
      votes: track._count.votes,
      myVote: track.votes.length > 0
    }))

    ranking.sort((a, b) =>
      b.votes - a.votes ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id)
    )

    res.json({
      tracks: ranking,
      canParticipate:
        (access.writable || access.publicVote) &&
        !access.finished,
      canVote:
        (access.writable || access.publicVote) &&
        isVoteTimeAllowed(access.restrictions) &&
        !access.finished,
      requiresLocation: needsVoteLocation(access.restrictions),
      finished: access.finished
    })
  } catch (error) {
    console.error('Track listing error:', error)
    res.status(500).json({ error: 'Liste des morceaux indisponible' })
  }
})

// Les propositions respectent la licence musicale de l'événement.
tracksRouter.post('/events/:eventId', async (req, res) => {
  const userId: string = res.locals.userId
  const eventId = req.params.eventId

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  const selected = findCatalogTrackById(
    req.body?.catalogTrackId
  )

  if (!selected) {
    res.status(400).json({
      error: 'Morceau du catalogue obligatoire'
    })
    return
  }

  const { title, artist } = selected

  try {
    const track = await prisma.$transaction(async (tx) => {
      await lockEventMusic(tx, eventId)

      // Refaire les contrôles après acquisition du verrou.
      const access = await eventAccess(eventId, userId, tx)

      if (!access || !access.readable) {
        throw new TrackCreationError(
          404, 'Événement introuvable'
        )
      }

      if (!access.writable && !access.publicVote) {
        throw new TrackCreationError(
          403, 'Participation requise'
        )
      }

      if (access.finished) {
        throw new TrackCreationError(
          409, 'Événement terminé'
        )
      }

      if (selected.premium) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { subscription: true }
        })

        if (user?.subscription !== 'PREMIUM') {
          throw new TrackCreationError(
            403, 'Abonnement Premium requis'
          )
        }
      }

      const duplicate = await tx.eventTrack.findFirst({
        where: {
          eventId,
          title: {
            equals: selected.title,
            mode: 'insensitive'
          },
          artist: {
            equals: selected.artist,
            mode: 'insensitive'
          }
        }
      })

      if (duplicate) {
        throw new TrackCreationError(
          409, 'Morceau deja propose'
        )
      }

      const count = await tx.eventTrack.count({
        where: { eventId }
      })

      if (count >= 100) {
        throw new TrackCreationError(
          409, 'Maximum de 100 morceaux atteint'
        )
      }

      return tx.eventTrack.create({
        data: {
          eventId,
          proposerId: userId,
          title,
          artist
        },
        select: {
          id: true,
          title: true,
          artist: true,
          proposerId: true,
          createdAt: true
        }
      })
    })

    void notifyTracksChanged(eventId)
    res.status(201).json({ track })
  } catch (error) {
    if (error instanceof TrackCreationError) {
      res.status(error.status).json({ error: error.message })
      return
    }

    console.error('Track creation error:', error)
    res.status(500).json({ error: 'Proposition impossible' })
  }
})

// Auteur de la proposition ou organisateur uniquement.
tracksRouter.delete('/:trackId', async (req, res) => {
  const userId: string = res.locals.userId
  const trackId = req.params.trackId

  if (!validId(trackId)) {
    res.status(400).json({ error: 'Morceau invalide' })
    return
  }

  try {
    const track = await prisma.eventTrack.findUnique({
      where: { id: trackId },
      select: { eventId: true, proposerId: true }
    })

    if (!track) {
      res.status(404).json({ error: 'Morceau introuvable' })
      return
    }

    await prisma.$transaction(async (tx) => {
      await lockEventMusic(tx, track.eventId)

      const current = await tx.eventTrack.findUnique({
        where: { id: trackId },
        select: { proposerId: true }
      })

      const access = await eventAccess(
        track.eventId, userId, tx
      )

      if (!current || !access || !access.readable) {
        throw new VoteWriteError(404, 'Morceau introuvable')
      }

      if (
        (!access.writable && !access.publicVote) ||
        (current.proposerId !== userId && !access.organizer)
      ) {
        throw new VoteWriteError(403, 'Suppression interdite')
      }

      if (access.finished) {
        throw new VoteWriteError(409, 'Événement terminé')
      }

      await tx.eventTrack.delete({
        where: { id: trackId }
      })
    })

    void notifyTracksChanged(track.eventId)
    res.json({ message: 'Morceau supprimé' })
  } catch (error) {
    if (error instanceof VoteWriteError) {
      res.status(error.status).json({ error: error.message })
      return
    }

    console.error('Track deletion error:', error)
    res.status(500).json({ error: 'Suppression impossible' })
  }
})

// Un vote positif maximum par utilisateur et par morceau.
tracksRouter.post('/:trackId/vote', async (req, res) => {
  const userId: string = res.locals.userId
  const trackId = req.params.trackId

  if (!validId(trackId)) {
    res.status(400).json({ error: 'Morceau invalide' })
    return
  }

  try {
    const track = await prisma.eventTrack.findUnique({
      where: { id: trackId },
      select: { eventId: true }
    })

    if (!track) {
      res.status(404).json({ error: 'Morceau introuvable' })
      return
    }

    await prisma.$transaction(async (tx) => {
      // POST : verrou avant relecture des droits.
      await lockEventMusic(tx, track.eventId)

      const access = await eventAccess(
        track.eventId, userId, tx
      )

      if (!access || !access.readable) {
        throw new VoteWriteError(404, 'Morceau introuvable')
      }

      if (!access.writable && !access.publicVote) {
        throw new VoteWriteError(403, 'Participation requise')
      }

      if (access.finished) {
        throw new VoteWriteError(409, 'Événement terminé')
      }

      if (!isVoteTimeAllowed(access.restrictions)) {
        throw new VoteWriteError(
          403, 'Vote hors de la plage horaire'
        )
      }

      if (!isVoteLocationAllowed(
        access.restrictions, req.body
      )) {
        throw new VoteWriteError(
          403, 'Position GPS absente ou hors zone'
        )
      }

      await tx.trackVote.create({
        data: { trackId, userId }
      })
    }, {
      maxWait: 5000,
      timeout: 10000
    })

    // Notifications uniquement après COMMIT.
    void notifyTracksChanged(track.eventId)
    res.status(201).json({ message: 'Vote enregistré' })
  } catch (error) {
    if (error instanceof VoteWriteError) {
      res.status(error.status).json({ error: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res.status(409).json({ error: 'Vote déjà enregistré' })
      return
    }

    console.error('Track vote error:', error)
    res.status(500).json({ error: 'Vote impossible' })
  }
})

// Retirer uniquement son propre vote.
tracksRouter.delete('/:trackId/vote', async (req, res) => {
  const userId: string = res.locals.userId
  const trackId = req.params.trackId

  if (!validId(trackId)) {
    res.status(400).json({ error: 'Morceau invalide' })
    return
  }

  try {
    const track = await prisma.eventTrack.findUnique({
      where: { id: trackId },
      select: { eventId: true }
    })

    if (!track) {
      res.status(404).json({ error: 'Morceau introuvable' })
      return
    }

    await prisma.$transaction(async (tx) => {
      // DELETE : verrou avant relecture des droits.
      await lockEventMusic(tx, track.eventId)

      const access = await eventAccess(
        track.eventId, userId, tx
      )

      if (!access || !access.readable) {
        throw new VoteWriteError(404, 'Morceau introuvable')
      }

      if (!access.writable && !access.publicVote) {
        throw new VoteWriteError(403, 'Participation requise')
      }

      if (access.finished) {
        throw new VoteWriteError(409, 'Événement terminé')
      }

      if (!isVoteTimeAllowed(access.restrictions)) {
        throw new VoteWriteError(
          403, 'Vote hors de la plage horaire'
        )
      }

      if (!isVoteLocationAllowed(
        access.restrictions, req.body
      )) {
        throw new VoteWriteError(
          403, 'Position GPS absente ou hors zone'
        )
      }

      const deleted = await tx.trackVote.deleteMany({
        where: { trackId, userId }
      })

      if (deleted.count !== 1) {
        throw new VoteWriteError(404, 'Vote introuvable')
      }
    }, {
      maxWait: 5000,
      timeout: 10000
    })

    // Notifications uniquement après COMMIT.
    void notifyTracksChanged(track.eventId)
    res.json({ message: 'Vote retiré' })
  } catch (error) {
    if (error instanceof VoteWriteError) {
      res.status(error.status).json({ error: error.message })
      return
    }

    console.error('Track vote error:', error)
    res.status(500).json({ error: 'Retrait du vote impossible' })
  }
})
