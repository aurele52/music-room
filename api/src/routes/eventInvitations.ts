import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  refreshEventAccess,
  notifyEventParticipantsChanged
} from '../realtime.js'

export const eventInvitationsRouter = Router()

eventInvitationsRouter.use(requireAuth)

function validId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function pair(a: string, b: string) {
  return a < b
    ? { userLowId: a, userHighId: b }
    : { userLowId: b, userHighId: a }
}

// Invitations reçues, avec les informations nécessaires
// pour choisir d'accepter ou de refuser.
eventInvitationsRouter.get('/invitations/mine', async (_req, res) => {
  const userId: string = res.locals.userId

  try {
    const invitations = await prisma.eventInvitation.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            startsAt: true,
            endsAt: true,
            visibility: true,
            organizer: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    res.json({ invitations })
  } catch (error) {
    console.error('My event invitations error:', error)
    res.status(500).json({ error: 'Invitations indisponibles' })
  }
})

// Seul le destinataire accepte une invitation en attente.
eventInvitationsRouter.post('/invitations/:id/accept', async (req, res) => {
  const userId: string = res.locals.userId
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({ error: 'Invitation invalide' })
    return
  }

  try {
    const previous = await prisma.eventInvitation.findFirst({
      where: { id, userId, status: 'PENDING' },
      select: {
        eventId: true,
        event: {
          select: { organizerId: true }
        }
      }
    })

    const result = await prisma.eventInvitation.updateMany({
      where: {
        id,
        userId,
        status: 'PENDING'
      },
      data: { status: 'ACCEPTED' }
    })

    if (result.count !== 1) {
      res.status(404).json({ error: 'Invitation introuvable ou déjà traitée' })
      return
    }

    if (previous) {
      void notifyEventParticipantsChanged(
        previous.eventId,
        [previous.event.organizerId, userId]
      )
    }

    res.json({ message: 'Participation confirmée' })
  } catch (error) {
    console.error('Event invitation accept error:', error)
    res.status(500).json({ error: 'Acceptation impossible' })
  }
})

// Refuser une invitation ou quitter un événement accepté.
eventInvitationsRouter.delete('/invitations/:id', async (req, res) => {
  const userId: string = res.locals.userId
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({ error: 'Invitation invalide' })
    return
  }

  try {
    const previous = await prisma.eventInvitation.findFirst({
      where: { id, userId },
      select: {
        eventId: true,
        event: {
          select: { organizerId: true }
        }
      }
    })

    const result = await prisma.eventInvitation.deleteMany({
      where: { id, userId }
    })

    if (result.count !== 1) {
      res.status(404).json({ error: 'Participation introuvable' })
      return
    }

    if (previous && result.count === 1) {
      await refreshEventAccess(previous.eventId, userId)
    }

    if (previous) {
      void notifyEventParticipantsChanged(
        previous.eventId,
        [previous.event.organizerId, userId]
      )
    }

    res.json({ message: 'Invitation ou participation supprimée' })
  } catch (error) {
    console.error('Event invitation delete error:', error)
    res.status(500).json({ error: 'Suppression impossible' })
  }
})

// Voir les invitations d'un événement organisé.
eventInvitationsRouter.get('/:id/invitations', async (req, res) => {
  const organizerId: string = res.locals.userId
  const eventId = req.params.id

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
      select: { id: true }
    })

    if (!event) {
      res.status(404).json({ error: 'Événement introuvable' })
      return
    }

    const invitations = await prisma.eventInvitation.findMany({
      where: { eventId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ invitations })
  } catch (error) {
    console.error('Event participants error:', error)
    res.status(500).json({ error: 'Participants indisponibles' })
  }
})

// Inviter un ami confirmé.
eventInvitationsRouter.post('/:id/invitations', async (req, res) => {
  const organizerId: string = res.locals.userId
  const eventId = req.params.id
  const targetId = req.body?.userId

  if (!validId(eventId) ||
      !validId(targetId) ||
      targetId === organizerId) {
    res.status(400).json({ error: 'Invitation invalide' })
    return
  }

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
      select: { id: true, endsAt: true }
    })

    if (!event) {
      res.status(404).json({ error: 'Événement introuvable' })
      return
    }

    if (event.endsAt <= new Date()) {
      res.status(409).json({ error: 'Événement terminé' })
      return
    }

    const friendship = await prisma.friendship.findUnique({
      where: {
        userLowId_userHighId: pair(organizerId, targetId)
      },
      select: { status: true }
    })

    if (friendship?.status !== 'ACCEPTED') {
      res.status(403).json({
        error: 'Seuls les amis confirmés peuvent être invités'
      })
      return
    }

    const invitation = await prisma.eventInvitation.create({
      data: {
        eventId,
        userId: targetId,
        status: 'PENDING'
      },
      select: {
        id: true,
        status: true,
        userId: true
      }
    })

    void notifyEventParticipantsChanged(
      eventId,
      [organizerId, targetId]
    )

    res.status(201).json({ invitation })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
      res.status(409).json({ error: 'Utilisateur déjà invité' })
      return
    }

    console.error('Event invitation create error:', error)
    res.status(500).json({ error: 'Invitation impossible' })
  }
})

// L'organisateur peut retirer une invitation ou un participant.
eventInvitationsRouter.delete(
  '/:id/invitations/:invitationId',
  async (req, res) => {
    const organizerId: string = res.locals.userId
    const eventId = req.params.id
    const invitationId = req.params.invitationId

    if (!validId(eventId) || !validId(invitationId)) {
      res.status(400).json({ error: 'Identifiant invalide' })
      return
    }

    try {
      const previous = await prisma.eventInvitation.findFirst({
        where: {
          id: invitationId,
          eventId,
          event: { organizerId }
        },
        select: { userId: true }
      })

      const result = await prisma.eventInvitation.deleteMany({
        where: {
          id: invitationId,
          eventId,
          event: { organizerId }
        }
      })

      if (result.count !== 1) {
        res.status(404).json({ error: 'Invitation introuvable' })
        return
      }

      if (previous && result.count === 1) {
        await refreshEventAccess(eventId, previous.userId)
      }

      if (previous) {
        void notifyEventParticipantsChanged(
          eventId,
          [organizerId, previous.userId]
        )
      }

      res.json({ message: 'Participant retiré' })
    } catch (error) {
      console.error('Event participant removal error:', error)
      res.status(500).json({ error: 'Suppression impossible' })
    }
  }
)
