import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { parseVoteRestrictions } from '../services/voteRestrictions.js'
import { lockEventMusic } from '../services/eventMusicLock.js'
import {
  notifyTracksChanged,
  notifyPlaylistsChanged
} from '../realtime.js'

export const eventMusicPoliciesRouter = Router()
eventMusicPoliciesRouter.use(requireAuth)

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const validPolicy = (value: unknown) =>
  value === 'PUBLIC' || value === 'INVITED_ONLY'

// La configuration est réservée à l'organisateur.
// Aucun visiteur ne peut lire les réglages d'une soirée privée.
eventMusicPoliciesRouter.get(
  '/:id/music-policies',
  async (req, res) => {
    const id = req.params.id
    const userId: string = res.locals.userId

    if (!uuid.test(id)) {
      res.status(400).json({ error: 'Événement invalide' })
      return
    }

    try {
      const event = await prisma.event.findFirst({
        where: { id, organizerId: userId },
        select: {
          votePolicy: true,
          editPolicy: true,
          voteWindowStart: true,
          voteWindowEnd: true,
          voteLatitude: true,
          voteLongitude: true,
          voteRadiusMeters: true
        }
      })

      if (!event) {
        res.status(404).json({ error: 'Événement introuvable' })
        return
      }

      res.json({ policies: event })
    } catch (error) {
      console.error('Music policies read:', error)
      res.status(500).json({ error: 'Lecture impossible' })
    }
  }
)

eventMusicPoliciesRouter.put(
  '/:id/music-policies',
  async (req, res) => {
    const id = req.params.id
    const userId: string = res.locals.userId
    const { votePolicy, editPolicy } = req.body ?? {}

    if (!uuid.test(id)) {
      res.status(400).json({ error: 'Événement invalide' })
      return
    }

    if (!validPolicy(votePolicy) || !validPolicy(editPolicy)) {
      res.status(400).json({ error: 'Politique invalide' })
      return
    }

    let restrictions

    try {
      restrictions = parseVoteRestrictions(req.body)
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error
          ? error.message
          : 'Restrictions invalides'
      })
      return
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        await lockEventMusic(tx, id)

        return tx.event.updateMany({
          where: {
            id,
            organizerId: userId,
            endsAt: { gt: new Date() }
          },
          data: {
            votePolicy,
            editPolicy,
            ...restrictions
          }
        })
      }, {
        maxWait: 5000,
        timeout: 10000
      })

      if (result.count !== 1) {
        res.status(404).json({
          error: 'Événement indisponible ou terminé'
        })
        return
      }

      const policies = await prisma.event.findUniqueOrThrow({
        where: { id },
        select: {
          votePolicy: true,
          editPolicy: true,
          voteWindowStart: true,
          voteWindowEnd: true,
          voteLatitude: true,
          voteLongitude: true,
          voteRadiusMeters: true
        }
      })

      // Les deux interfaces doivent relire leurs droits
      // immédiatement après une modification de licence.
      await Promise.all([
        notifyTracksChanged(id),
        notifyPlaylistsChanged(id)
      ])

      res.json({ policies })
    } catch (error) {
      console.error('Music policies update:', error)
      res.status(500).json({ error: 'Modification impossible' })
    }
  }
)
