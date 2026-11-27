import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  notifyEventsChanged,
  notifyPublicEventsChanged,
  reconcileEventSocketAccess
} from '../realtime.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateEvent } from '../services/eventValidation.js'

export const eventsRouter = Router()

eventsRouter.use(requireAuth)

const eventFields = {
  id: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  visibility: true,
  organizerId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.EventSelect

function validId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length === 36 &&
    /^[0-9a-f-]+$/i.test(value)
}

// Créer un événement.
eventsRouter.post('/', async (req, res) => {
  const organizerId: string = res.locals.userId

  let data

  try {
    data = validateEvent(req.body)
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error
        ? error.message
        : 'Evenement invalide'
    })
    return
  }

  try {
    const event = await prisma.event.create({
      data: {
        ...data,
        organizerId
      },
      select: eventFields
    })

    void notifyEventsChanged([organizerId])

    if (event.visibility === 'PUBLIC') {
      notifyPublicEventsChanged()
    }

    res.status(201).json({ event })
  } catch (error) {
    console.error('Event creation error:', error)
    res.status(500).json({ error: 'Creation impossible' })
  }
})

// Lister uniquement ses propres événements.
eventsRouter.get('/mine', async (_req, res) => {
  const organizerId: string = res.locals.userId

  try {
    const events = await prisma.event.findMany({
      where: { organizerId },
      select: eventFields,
      orderBy: [
        { startsAt: 'asc' },
        { id: 'asc' }
      ],
      take: 100
    })

    res.json({ events })
  } catch (error) {
    console.error('My events error:', error)
    res.status(500).json({ error: 'Liste indisponible' })
  }
})

// Découvrir les événements publics non terminés.
eventsRouter.get('/discover', async (req, res) => {
  const rawQuery = req.query.q
  const rawLocation = req.query.location
  const rawPage = req.query.page

  function readFilter(value: unknown, max: number): string | null {
    if (value === undefined) return ''

    if (typeof value !== 'string') return null

    const result = value.trim()

    const invalid = [...result].some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })

    if (result.length > max || invalid) return null

    return result
  }

  const query = readFilter(rawQuery, 80)
  const location = readFilter(rawLocation, 120)

  const pageText = rawPage === undefined ? '1' : rawPage

  if (
    query === null ||
    location === null ||
    typeof pageText !== 'string' ||
    !/^[1-9][0-9]*$/.test(pageText)
  ) {
    res.status(400).json({ error: 'Paramètres de recherche invalides' })
    return
  }

  const page = Number(pageText)

  if (!Number.isSafeInteger(page) || page > 50) {
    res.status(400).json({ error: 'Page invalide' })
    return
  }

  try {
    const events = await prisma.event.findMany({
      where: {
        visibility: 'PUBLIC',
        endsAt: { gt: new Date() },
        ...(query
          ? { title: { contains: query, mode: 'insensitive' as const } }
          : {}),
        ...(location
          ? { location: { contains: location, mode: 'insensitive' as const } }
          : {})
      },
      select: {
        ...eventFields,
        organizer: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { startsAt: 'asc' },
        { id: 'asc' }
      ],
      skip: (page - 1) * 20,
      take: 21
    })

    res.json({
      events: events.slice(0, 20),
      page,
      hasMore: events.length > 20
    })
  } catch (error) {
    console.error('Event discovery error:', error)
    res.status(500).json({ error: 'Découverte indisponible' })
  }
})

// Consulter un événement public ou un événement dont on est organisateur.
eventsRouter.get('/:id', async (req, res) => {
  const viewerId: string = res.locals.userId
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({ error: 'Identifiant invalide' })
    return
  }

  try {
    const event = await prisma.event.findFirst({
      where: {
        id,
        OR: [
          { organizerId: viewerId },
          { visibility: 'PUBLIC' },
          {
            invitations: {
              some: {
                userId: viewerId,
                status: 'ACCEPTED'
              }
            }
          }
        ]
      },
      select: eventFields
    })

    if (!event) {
      res.status(404).json({ error: 'Evenement introuvable' })
      return
    }

    res.json({ event })
  } catch (error) {
    console.error('Event read error:', error)
    res.status(500).json({ error: 'Lecture impossible' })
  }
})

// Modifier uniquement un événement dont on est organisateur.
eventsRouter.put('/:id', async (req, res) => {
  const organizerId: string = res.locals.userId
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({ error: 'Identifiant invalide' })
    return
  }

  let data

  try {
    data = validateEvent(req.body)
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error
        ? error.message
        : 'Evenement invalide'
    })
    return
  }

  try {
    const previous = await prisma.event.findFirst({
      where: { id, organizerId },
      select: {
        visibility: true,
        invitations: {
          select: { userId: true }
        }
      }
    })

    const changed = await prisma.event.updateMany({
      where: { id, organizerId },
      data
    })

    if (changed.count !== 1) {
      res.status(404).json({ error: 'Evenement introuvable' })
      return
    }

    const event = await prisma.event.findUnique({
      where: { id },
      select: eventFields
    })

    if (
      event &&
      previous &&
      previous.visibility === 'PUBLIC' &&
      event.visibility === 'PRIVATE'
    ) {
      await reconcileEventSocketAccess(id)
    }

    if (event && previous) {
      void notifyEventsChanged([
        organizerId,
        ...previous.invitations.map(item => item.userId)
      ])

      if (
        previous.visibility === 'PUBLIC' ||
        event.visibility === 'PUBLIC'
      ) {
        notifyPublicEventsChanged()
      }
    }

    res.json({ event })
  } catch (error) {
    console.error('Event update error:', error)
    res.status(500).json({ error: 'Modification impossible' })
  }
})

// Supprimer uniquement un événement dont on est organisateur.
eventsRouter.delete('/:id', async (req, res) => {
  const organizerId: string = res.locals.userId
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({ error: 'Identifiant invalide' })
    return
  }

  try {
    const previous = await prisma.event.findFirst({
      where: { id, organizerId },
      select: {
        visibility: true,
        invitations: {
          select: { userId: true }
        }
      }
    })

    const deleted = await prisma.event.deleteMany({
      where: { id, organizerId }
    })

    if (deleted.count !== 1) {
      res.status(404).json({ error: 'Evenement introuvable' })
      return
    }

    await reconcileEventSocketAccess(id)

    if (previous) {
      void notifyEventsChanged([
        organizerId,
        ...previous.invitations.map(item => item.userId)
      ])

      if (previous.visibility === 'PUBLIC') {
        notifyPublicEventsChanged()
      }
    }

    res.json({ message: 'Evenement supprime' })
  } catch (error) {
    console.error('Event deletion error:', error)
    res.status(500).json({ error: 'Suppression impossible' })
  }
})
