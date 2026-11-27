import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

export const subscriptionsRouter = Router()

subscriptionsRouter.use(requireAuth)

subscriptionsRouter.get('/', async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: res.locals.userId },
      select: { subscription: true }
    })

    if (!user) {
      res.status(401).json({ error: 'Compte introuvable' })
      return
    }

    res.json(user)
  } catch (error) {
    console.error('Subscription read:', error)
    res.status(500).json({
      error: 'Abonnement indisponible'
    })
  }
})

// Changement d'abonnement sans transaction financiere.
subscriptionsRouter.patch('/', async (req, res) => {
  const subscription = req.body?.subscription

  if (
    subscription !== 'FREE' &&
    subscription !== 'PREMIUM'
  ) {
    res.status(400).json({
      error: 'Offre invalide'
    })
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id: res.locals.userId },
      data: { subscription },
      select: { subscription: true }
    })

    res.json(user)
  } catch (error) {
    console.error('Subscription update:', error)
    res.status(500).json({
      error: 'Modification impossible'
    })
  }
})
