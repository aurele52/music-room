import {
  parseOfflineGuard,
  assertOfflineGuard,
  OfflineGuardError,
  type OfflineGuard
} from '../services/offlinePlaylistGuard.js'
import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { notifyPlaylistsChanged } from '../realtime.js'
import { lockEventMusic } from '../services/eventMusicLock.js'

export const playlistsRouter = Router()
playlistsRouter.use(requireAuth)

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_PLAYLISTS = 20
const MAX_ITEMS = 100
const POSITION_OFFSET = 1000000

type Transaction = Prisma.TransactionClient

class PlaylistError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function cleanText(
  value: unknown,
  min: number,
  max: number
): string | null {
  if (typeof value !== 'string') return null

  const result = value.trim().replace(/\s+/gu, ' ')

  if (result.length < min || result.length > max) return null

  const invalid = [...result].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })

  return invalid ? null : result
}

async function eventAccess(
  tx: Transaction,
  eventId: string,
  userId: string
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      organizerId: true,
      title: true,
      visibility: true,
      editPolicy: true,
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

  if (!event) {
    throw new PlaylistError(404, 'Événement introuvable')
  }

  const organizer = event.organizerId === userId
  const participant = event.invitations.length > 0

  if (
    event.visibility !== 'PUBLIC' &&
    !organizer &&
    !participant
  ) {
    throw new PlaylistError(404, 'Événement introuvable')
  }

  return {
    organizer,
    participant,
    visibility: event.visibility,
    title: event.title,
    endsAt: event.endsAt,
    writable: organizer || participant || (event.visibility === 'PUBLIC' && event.editPolicy === 'PUBLIC'),
    finished: event.endsAt <= new Date()
  }
}

type EventAccess = Awaited<ReturnType<typeof eventAccess>>

type PlaylistPermissions = {
  visibility: 'PUBLIC' | 'PRIVATE'
  editPolicy: 'PUBLIC' | 'INVITED_ONLY'
}

function canReadPlaylist(
  access: EventAccess,
  playlist: PlaylistPermissions
): boolean {
  return (
    playlist.visibility === 'PUBLIC' ||
    access.organizer ||
    access.participant
  )
}

function canEditPlaylist(
  access: EventAccess,
  playlist: PlaylistPermissions
): boolean {
  return (
    canReadPlaylist(access, playlist) &&
    access.writable &&
    !access.finished &&
    (
      access.organizer ||
      access.participant ||
      playlist.editPolicy === 'PUBLIC'
    )
  )
}

function offlineVisibility(
  access: EventAccess,
  playlist: PlaylistPermissions
): 'PUBLIC' | 'PRIVATE' {
  return (
    access.visibility === 'PUBLIC' &&
    playlist.visibility === 'PUBLIC'
  ) ? 'PUBLIC' : 'PRIVATE'
}

async function checkWriteAccess(
  tx: Transaction,
  eventId: string,
  userId: string,
  organizerOnly = false,
  playlist?: PlaylistPermissions
) {
  // Le verrou est maintenu jusqu'à la fin de la transaction.
  await lockEventMusic(tx, eventId)
  const access = await eventAccess(tx, eventId, userId)

  if (playlist && !canReadPlaylist(access, playlist)) {
    throw new PlaylistError(404, 'Playlist introuvable')
  }

  if (
    !access.writable ||
    (organizerOnly && !access.organizer)
  ) {
    throw new PlaylistError(403, 'Modification interdite')
  }

  if (access.finished) {
    throw new PlaylistError(409, 'Événement terminé')
  }

  if (playlist && !canEditPlaylist(access, playlist)) {
    throw new PlaylistError(403, 'Modification interdite')
  }

  return access
}

async function checkOfflineRevision(
  tx: Transaction,
  playlist: { id: string; eventId: string },
  visibility: string,
  guard: OfflineGuard | null
) {
  if (!guard) return

  const current = await tx.eventPlaylist.findUniqueOrThrow({
    where: { id: playlist.id },
    select: { revision: true }
  })

  assertOfflineGuard(guard, {
    eventId: playlist.eventId,
    visibility,
    revision: current.revision
  })
}

async function getPlaylist(
  tx: Transaction,
  playlistId: string
) {
  const playlist = await tx.eventPlaylist.findUnique({
    where: { id: playlistId },
    select: {
      id: true,
      eventId: true,
      visibility: true,
      editPolicy: true
    }
  })

  if (!playlist) {
    throw new PlaylistError(404, 'Playlist introuvable')
  }

  return playlist
}

// Identité logique d'un morceau dans une playlist.
function trackIdentity(title: string, artist: string): string {
  const normalize = (value: string) =>
    value.normalize('NFKC').trim().toLowerCase()

  return JSON.stringify([normalize(title), normalize(artist)])
}

async function lockPlaylist(
  tx: Transaction,
  playlistId: string
) {
  const playlist = await getPlaylist(tx, playlistId)

  await lockEventMusic(tx, playlist.eventId)

  return getPlaylist(tx, playlistId)
}

// Réorganisation à deux phases pour éviter les collisions uniques.
async function rewritePositions(
  tx: Transaction,
  playlistId: string,
  orderedIds: string[]
) {
  await tx.playlistItem.updateMany({
    where: { playlistId },
    data: {
      position: { increment: POSITION_OFFSET }
    }
  })

  for (let index = 0; index < orderedIds.length; index++) {
    await tx.playlistItem.update({
      where: { id: orderedIds[index] },
      data: { position: index }
    })
  }
}

async function transact<T>(
  operation: (tx: Transaction) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation, {
    maxWait: 5000,
    timeout: 10000
  })
}

function handleError(
  res: import('express').Response,
  error: unknown
) {
  if (
    error instanceof PlaylistError ||
    error instanceof OfflineGuardError
  ) {
    res.status(error.status).json({ error: error.message })
    return
  }

  console.error('Playlist API error:', error)
  res.status(500).json({ error: 'Opération playlist impossible' })
}

// Lecture des playlists et de leurs morceaux.
playlistsRouter.get('/events/:eventId', async (req, res) => {
  const eventId = req.params.eventId
  const userId: string = res.locals.userId

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const access = await eventAccess(tx, eventId, userId)

      const playlists = await tx.eventPlaylist.findMany({
        where: {
          eventId,
          ...(access.organizer || access.participant
            ? {}
            : { visibility: 'PUBLIC' as const })
        },
        select: {
          id: true,
          title: true,
          description: true,
          visibility: true,
          editPolicy: true,
          revision: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              title: true,
              artist: true,
              position: true,
              addedById: true,
              addedBy: {
                select: { id: true, name: true }
              }
            },
            orderBy: [
              { position: 'asc' },
              { id: 'asc' }
            ]
          }
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' }
        ]
      })

      return {
        event: {
          id: eventId,
          title: access.title,
          visibility: access.visibility,
          endsAt: access.endsAt
        },
        playlists: playlists.map(playlist => ({
          ...playlist,
          canEdit: canEditPlaylist(access, playlist)
        })),
        canEdit: access.writable && !access.finished,
        organizer: access.organizer,
        finished: access.finished
      }
    }, {
      isolationLevel: 'RepeatableRead',
      maxWait: 5000,
      timeout: 10000
    })

    res.json(result)
  } catch (error) {
    handleError(res, error)
  }
})

// Créer une playlist, limite atomique par événement.
playlistsRouter.post('/events/:eventId', async (req, res) => {
  const eventId = req.params.eventId
  const userId: string = res.locals.userId

  if (!validId(eventId)) {
    res.status(400).json({ error: 'Événement invalide' })
    return
  }

  const visibility = req.body?.visibility ?? 'PUBLIC'
  const editPolicy = req.body?.editPolicy ?? 'PUBLIC'

  if (
    (visibility !== 'PUBLIC' && visibility !== 'PRIVATE') ||
    (editPolicy !== 'PUBLIC' && editPolicy !== 'INVITED_ONLY')
  ) {
    res.status(400).json({ error: 'Permissions invalides' })
    return
  }

  const title = cleanText(req.body?.title, 2, 100)
  const description = cleanText(
    req.body?.description ?? '', 0, 500
  )

  if (!title || description === null) {
    res.status(400).json({ error: 'Informations invalides' })
    return
  }

  try {
    const playlist = await transact(async (tx) => {
      const access = await checkWriteAccess(
        tx, eventId, userId
      )

      if (
        !access.organizer &&
        (visibility !== 'PUBLIC' || editPolicy !== 'PUBLIC')
      ) {
        throw new PlaylistError(
          403, 'Configuration reservee a l organisateur'
        )
      }

      const count = await tx.eventPlaylist.count({
        where: { eventId }
      })

      if (count >= MAX_PLAYLISTS) {
        throw new PlaylistError(
          409, 'Maximum de 20 playlists atteint'
        )
      }

      return tx.eventPlaylist.create({
        data: {
          eventId,
          title,
          description,
          visibility,
          editPolicy
        },
        select: {
          id: true,
          eventId: true,
          title: true,
          description: true,
          visibility: true,
          editPolicy: true,
          revision: true
        }
      })
    })

    void notifyPlaylistsChanged(eventId)
    res.status(201).json({ playlist })
  } catch (error) {
    handleError(res, error)
  }
})

// Modifier les permissions individuelles.
playlistsRouter.patch('/:playlistId/policies', async (req, res) => {
  const playlistId = req.params.playlistId
  const userId: string = res.locals.userId
  const { visibility, editPolicy } = req.body ?? {}

  if (
    !validId(playlistId) ||
    (visibility !== 'PUBLIC' && visibility !== 'PRIVATE') ||
    (editPolicy !== 'PUBLIC' && editPolicy !== 'INVITED_ONLY')
  ) {
    res.status(400).json({ error: 'Permissions invalides' })
    return
  }

  try {
    const result = await transact(async tx => {
      const playlist = await lockPlaylist(tx, playlistId)

      await checkWriteAccess(
        tx, playlist.eventId, userId, true, playlist
      )

      return tx.eventPlaylist.update({
        where: { id: playlistId },
        data: {
          visibility,
          editPolicy,
          revision: { increment: 1 }
        },
        select: {
          id: true,
          eventId: true,
          visibility: true,
          editPolicy: true,
          revision: true
        }
      })
    })

    void notifyPlaylistsChanged(result.eventId)

    res.json({ playlist: result })
  } catch (error) {
    handleError(res, error)
  }
})

// Supprimer une playlist : organisateur uniquement.
playlistsRouter.delete('/:playlistId', async (req, res) => {
  const playlistId = req.params.playlistId
  const userId: string = res.locals.userId

  if (!validId(playlistId)) {
    res.status(400).json({ error: 'Playlist invalide' })
    return
  }

  try {
    const eventId = await transact(async (tx) => {
      const playlist = await lockPlaylist(tx, playlistId)

      await checkWriteAccess(
        tx,
        playlist.eventId,
        userId,
        true, playlist
      )

      await tx.eventPlaylist.delete({
        where: { id: playlistId }
      })

      return playlist.eventId
    })

    void notifyPlaylistsChanged(eventId)
    res.json({ message: 'Playlist supprimée' })
  } catch (error) {
    handleError(res, error)
  }
})

// Ajouter un morceau à la fin de la playlist.
playlistsRouter.post('/:playlistId/items', async (req, res) => {
  const playlistId = req.params.playlistId
  const userId: string = res.locals.userId

  if (!validId(playlistId)) {
    res.status(400).json({ error: 'Playlist invalide' })
    return
  }

  const title = cleanText(req.body?.title, 2, 150)
  const artist = cleanText(req.body?.artist, 2, 120)

  if (!title || !artist) {
    res.status(400).json({ error: 'Morceau invalide' })
    return
  }

  try {
    const guard = parseOfflineGuard(req.body?.offline)

    const result = await transact(async (tx) => {
      const playlist = await lockPlaylist(tx, playlistId)
      const access = await checkWriteAccess(
        tx, playlist.eventId, userId, false, playlist
      )

      await checkOfflineRevision(
        tx, playlist, offlineVisibility(access, playlist), guard
      )

      // Contrôle effectué sous le même verrou que l'insertion.
      const existing = await tx.playlistItem.findMany({
        where: { playlistId },
        select: { title: true, artist: true }
      })

      const identity = trackIdentity(title, artist)

      if (
        existing.some(
          (item) => trackIdentity(item.title, item.artist) === identity
        )
      ) {
        throw new PlaylistError(
          409,
          'Ce morceau est déjà présent dans la playlist'
        )
      }

      const count = existing.length

      if (count >= MAX_ITEMS) {
        throw new PlaylistError(
          409, 'Maximum de 100 morceaux atteint'
        )
      }

      const last = await tx.playlistItem.findFirst({
        where: { playlistId },
        select: { position: true },
        orderBy: { position: 'desc' }
      })

      const item = await tx.playlistItem.create({
        data: {
          playlistId,
          addedById: userId,
          title,
          artist,
          position: (last?.position ?? -1) + 1
        },
        select: {
          id: true,
          title: true,
          artist: true,
          position: true,
          addedById: true
        }
      })

      await tx.eventPlaylist.update({
        where: { id: playlistId },
        data: { revision: { increment: 1 } }
      })

      return { item, eventId: playlist.eventId }
    })

    void notifyPlaylistsChanged(result.eventId)
    res.status(201).json({ item: result.item })
  } catch (error) {
    handleError(res, error)
  }
})

// Retirer un morceau et compacter les positions.
playlistsRouter.delete(
  '/:playlistId/items/:itemId',
  async (req, res) => {
    const playlistId = req.params.playlistId
    const itemId = req.params.itemId
    const userId: string = res.locals.userId

    if (!validId(playlistId) || !validId(itemId)) {
      res.status(400).json({ error: 'Identifiant invalide' })
      return
    }

    try {
      const guard = parseOfflineGuard(req.body?.offline)

      const eventId = await transact(async (tx) => {
        const playlist = await lockPlaylist(tx, playlistId)
        const access = await checkWriteAccess(
          tx, playlist.eventId, userId, false, playlist
        )

        await checkOfflineRevision(
          tx, playlist, offlineVisibility(access, playlist), guard
        )

        const deleted = await tx.playlistItem.deleteMany({
          where: { id: itemId, playlistId }
        })

        if (deleted.count !== 1) {
          throw new PlaylistError(404, 'Morceau introuvable')
        }

        const remaining = await tx.playlistItem.findMany({
          where: { playlistId },
          select: { id: true },
          orderBy: [
            { position: 'asc' },
            { id: 'asc' }
          ]
        })

        await rewritePositions(
          tx,
          playlistId,
          remaining.map((item) => item.id)
        )

        await tx.eventPlaylist.update({
          where: { id: playlistId },
          data: { revision: { increment: 1 } }
        })

        return playlist.eventId
      })

      void notifyPlaylistsChanged(eventId)
      res.json({ message: 'Morceau supprimé' })
    } catch (error) {
      handleError(res, error)
    }
  }
)

// Remplacer l'ordre complet, sans ajout ou disparition.
playlistsRouter.put('/:playlistId/order', async (req, res) => {
  const playlistId = req.params.playlistId
  const userId: string = res.locals.userId
  const itemIds: unknown = req.body?.itemIds
  const revision: unknown = req.body?.revision

  if (!validId(playlistId)) {
    res.status(400).json({ error: 'Playlist invalide' })
    return
  }

  if (
    !Array.isArray(itemIds) ||
    itemIds.length > MAX_ITEMS ||
    !itemIds.every(validId) ||
    new Set(itemIds).size !== itemIds.length ||
    !Number.isSafeInteger(revision) ||
    (revision as number) < 0
  ) {
    res.status(400).json({ error: 'Ordre invalide' })
    return
  }

  try {
    const guard = parseOfflineGuard(req.body?.offline)

    if (guard && guard.baseRevision !== revision) {
      throw new OfflineGuardError(
        400, 'Révisions offline incohérentes'
      )
    }

    const eventId = await transact(async (tx) => {
      const playlist = await lockPlaylist(tx, playlistId)
      const access = await checkWriteAccess(
        tx, playlist.eventId, userId, false, playlist
      )

      const current = await tx.eventPlaylist.findUniqueOrThrow({
        where: { id: playlistId },
        select: { revision: true }
      })

      assertOfflineGuard(guard, {
        eventId: playlist.eventId,
        visibility: offlineVisibility(access, playlist),
        revision: current.revision
      })

      if (current.revision !== revision) {
        throw new PlaylistError(
          409, 'Révision obsolète : actualise la playlist'
        )
      }

      const stored = await tx.playlistItem.findMany({
        where: { playlistId },
        select: { id: true }
      })

      const storedIds = new Set(
        stored.map((item) => item.id)
      )

      if (
        stored.length !== itemIds.length ||
        !itemIds.every((id) => storedIds.has(id))
      ) {
        throw new PlaylistError(
          409, 'La playlist a changé, actualise la liste'
        )
      }

      await rewritePositions(tx, playlistId, itemIds)

      await tx.eventPlaylist.update({
        where: { id: playlistId },
        data: { revision: { increment: 1 } }
      })

      return playlist.eventId
    })

    void notifyPlaylistsChanged(eventId)
    res.json({ message: 'Ordre enregistré' })
  } catch (error) {
    handleError(res, error)
  }
})
