import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { prisma } from '../db.js'
import { availableCatalog } from '../services/musicCatalog.js'

export { musicCatalog } from '../services/musicCatalog.js'

export const catalogRouter = Router()

catalogRouter.get('/', requireAuth, async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: res.locals.userId },
      select: { subscription: true }
    })

    if (!user) {
      res.status(401).json({ error: 'Compte introuvable' })
      return
    }

    res.json({
      subscription: user.subscription,
      tracks: availableCatalog(user.subscription)
    })
  } catch (error) {
    console.error('Catalog API:', error)
    res.status(500).json({
      error: 'Catalogue indisponible'
    })
  }
})
