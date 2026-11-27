import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { notifyFriendsChanged } from '../realtime.js';

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pair(a: string, b: string) {
  return a < b
    ? { userLowId: a, userHighId: b }
    : { userLowId: b, userHighId: a };
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

// Amis, invitations reçues et invitations envoyées.
friendsRouter.get('/', async (_req, res) => {
  const userId: string = res.locals.userId;

  try {
    const relations = await prisma.friendship.findMany({
      where: {
        OR: [
          { userLowId: userId },
          { userHighId: userId }
        ]
      },
      include: {
        userLow: {
          select: { id: true, name: true, visibility: true }
        },
        userHigh: {
          select: { id: true, name: true, visibility: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const relation of relations) {
      const other = relation.userLowId === userId
        ? relation.userHigh
        : relation.userLow;

      const item = {
        id: relation.id,
        user: other,
        createdAt: relation.createdAt
      };

      if (relation.status === 'ACCEPTED') {
        friends.push(item);
      } else if (relation.requesterId === userId) {
        outgoing.push(item);
      } else {
        incoming.push(item);
      }
    }

    res.json({ friends, incoming, outgoing });
  } catch (error) {
    console.error('Friend list error:', error);
    res.status(500).json({ error: 'Impossible de lire les amis' });
  }
});

// Inviter un utilisateur dont le profil est public.
friendsRouter.post('/requests', async (req, res) => {
  const userId: string = res.locals.userId;
  const targetId = req.body?.userId;

  if (!validId(targetId) || targetId === userId) {
    res.status(400).json({ error: 'Destinataire invalide' });
    return;
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, visibility: true }
    });

    // Ne pas dévoiler l'existence de profils privés.
    if (!target || target.visibility !== 'PUBLIC') {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }

    const relation = await prisma.friendship.create({
      data: {
        ...pair(userId, targetId),
        requesterId: userId,
        status: 'PENDING'
      }
    });

    void notifyFriendsChanged([userId, targetId]);

    res.status(201).json({
      request: {
        id: relation.id,
        status: relation.status
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
      res.status(409).json({
        error: 'Une relation existe déjà entre ces utilisateurs'
      });
      return;
    }

    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Impossible d’envoyer la demande' });
  }
});

// Seul le destinataire peut accepter une invitation.
friendsRouter.post('/requests/:id/accept', async (req, res) => {
  const userId: string = res.locals.userId;
  const id = req.params.id;

  if (!validId(id)) {
    res.status(400).json({ error: 'Invitation invalide' });
    return;
  }

  try {
    const affected = await prisma.friendship.findUnique({
      where: { id },
      select: {
        userLowId: true,
        userHighId: true
      }
    });

    const result = await prisma.friendship.updateMany({
      where: {
        id,
        status: 'PENDING',
        requesterId: { not: userId },
        OR: [
          { userLowId: userId },
          { userHighId: userId }
        ]
      },
      data: { status: 'ACCEPTED' }
    });

    if (result.count !== 1) {
      res.status(404).json({
        error: 'Invitation introuvable ou déjà traitée'
      });
      return;
    }

    if (affected) {
      void notifyFriendsChanged([
        affected.userLowId,
        affected.userHighId
      ]);
    }

    res.json({ message: 'Invitation acceptée' });
  } catch (error) {
    console.error('Friend accept error:', error);
    res.status(500).json({ error: 'Impossible d’accepter la demande' });
  }
});

// Le destinataire peut refuser, l'expéditeur peut annuler.
friendsRouter.delete('/requests/:id', async (req, res) => {
  const userId: string = res.locals.userId;
  const id = req.params.id;

  if (!validId(id)) {
    res.status(400).json({ error: 'Invitation invalide' });
    return;
  }

  try {
    const affected = await prisma.friendship.findUnique({
      where: { id },
      select: {
        userLowId: true,
        userHighId: true
      }
    });

    const result = await prisma.friendship.deleteMany({
      where: {
        id,
        status: 'PENDING',
        OR: [
          { userLowId: userId },
          { userHighId: userId }
        ]
      }
    });

    if (result.count !== 1) {
      res.status(404).json({ error: 'Invitation introuvable' });
      return;
    }

    if (affected) {
      void notifyFriendsChanged([
        affected.userLowId,
        affected.userHighId
      ]);
    }

    res.json({ message: 'Invitation supprimée' });
  } catch (error) {
    console.error('Friend request delete error:', error);
    res.status(500).json({ error: 'Impossible de supprimer la demande' });
  }
});

// L'un des deux amis peut mettre fin à la relation.
friendsRouter.delete('/:userId', async (req, res) => {
  const userId: string = res.locals.userId;
  const otherId = req.params.userId;

  if (!validId(otherId) || otherId === userId) {
    res.status(400).json({ error: 'Utilisateur invalide' });
    return;
  }

  try {
    const result = await prisma.friendship.deleteMany({
      where: {
        ...pair(userId, otherId),
        status: 'ACCEPTED'
      }
    });

    if (result.count !== 1) {
      res.status(404).json({ error: 'Amitié introuvable' });
      return;
    }

    void notifyFriendsChanged([userId, otherId]);

    res.json({ message: 'Ami supprimé' });
  } catch (error) {
    console.error('Friend delete error:', error);
    res.status(500).json({ error: 'Impossible de supprimer cet ami' });
  }
});
