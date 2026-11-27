import type { RequestHandler } from 'express';
import {
  verifySession,
  isRecentSession
} from '../services/session.js';

// À utiliser après requireAuth.
// requireAuth a déjà vérifié la signature, la version et l'utilisateur.
export const requireRecentAuth: RequestHandler = (req, res, next) => {
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

    if (!isRecentSession(session.issuedAt)) {
      res.status(403).json({
        code: 'REAUTH_REQUIRED',
        error: 'Reconnecte-toi avant de modifier ton compte Google'
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      error: 'Session invalide ou expirée'
    });
  }
};
