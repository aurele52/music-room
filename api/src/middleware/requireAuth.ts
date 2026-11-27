import type { RequestHandler } from 'express';
import { prisma } from '../db.js';
import { verifySession } from '../services/session.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentification requise'
    });
    return;
  }

  try {
    const token = authorization.slice(7);
    const session = verifySession(token);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        tokenVersion: true,
        emailVerifiedAt: true
      }
    });

    if (
      !user ||
      !user.emailVerifiedAt ||
      user.tokenVersion !== session.tokenVersion
    ) {
      res.status(401).json({
        error: 'Session invalide ou révoquée'
      });
      return;
    }

    res.locals.userId = user.id;
    next();
  } catch (error) {
    if (error instanceof Error &&
        error.message === 'JWT_SECRET manquant') {
      next(error);
      return;
    }

    res.status(401).json({
      error: 'Token invalide ou expiré'
    });
  }
};
