import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { rateLimit } from 'express-rate-limit';
import { createSession } from '../services/session.js';
import { checkGoogleLink } from '../services/googleLinkPolicy.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRecentAuth } from '../middleware/requireRecentAuth.js';

export const googleRouter = Router();
const googleClient = new OAuth2Client();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

googleRouter.use(['/login', '/link'], limiter);

async function verifyGoogle(credential: unknown) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('GOOGLE_NOT_CONFIGURED');
  }

  if (typeof credential !== 'string' ||
      credential.length > 10000) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: clientId
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email ||
      payload.email_verified !== true) {
    throw new Error('INVALID_GOOGLE_ACCOUNT');
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0]
  };
}

googleRouter.post('/login', async (req, res) => {
  try {
    const google = await verifyGoogle(req.body?.credential);

    let account = await prisma.googleAccount.findUnique({
      where: { googleSub: google.sub },
      include: { user: true }
    });

    if (!account) {
      // Ne jamais fusionner automatiquement deux comptes.
      const existing = await prisma.user.findUnique({
        where: { email: google.email }
      });

      if (existing) {
        res.status(409).json({
          error: 'Un compte utilise déjà cet email. Connecte-toi avec ton mot de passe, puis associe Google depuis ton profil.'
        });
        return;
      }

      const user = await prisma.user.create({
        data: {
          email: google.email,
          name: google.name,
          emailVerifiedAt: new Date(),
          googleAccount: {
            create: { googleSub: google.sub }
          }
        }
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        },
        token: createSession(user.id, user.tokenVersion)
      });
      return;
    }

    const user = account.user;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token: createSession(user.id, user.tokenVersion)
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
      res.status(409).json({
        error: 'Un compte existe déjà avec cette identité'
      });
      return;
    }

    if (error instanceof Error &&
        error.message === 'GOOGLE_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Google non configuré' });
      return;
    }

    console.error('Google login error:', error);
    res.status(401).json({
      error: 'Connexion Google impossible'
    });
  }
});

// Lier Google à un compte Music Room connecté.
googleRouter.post('/link', requireAuth, requireRecentAuth, async (req, res) => {
  const userId: string = res.locals.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }

    // verifyGoogle vérifie la signature, l'audience et email_verified.
    const google = await verifyGoogle(req.body?.credential);

    const [currentLink, existingGoogle] = await Promise.all([
      prisma.googleAccount.findUnique({
        where: { userId }
      }),
      prisma.googleAccount.findUnique({
        where: { googleSub: google.sub }
      })
    ]);

    const decision = checkGoogleLink(
      user.email,
      google.email,
      Boolean(currentLink),
      Boolean(existingGoogle)
    );

    if (decision === 'already-linked') {
      res.status(409).json({
        error: 'Ce compte Music Room est déjà associé à Google'
      });
      return;
    }

    if (decision === 'email-mismatch') {
      res.status(403).json({
        error: 'Le compte Google doit utiliser la même adresse email que Music Room'
      });
      return;
    }

    if (decision === 'google-in-use') {
      res.status(409).json({
        error: 'Ce compte Google est déjà associé'
      });
      return;
    }

    // Les contraintes uniques PostgreSQL protègent également
    // contre deux associations créées simultanément.
    await prisma.googleAccount.create({
      data: {
        userId,
        googleSub: google.sub
      }
    });

    res.json({ message: 'Compte Google associé' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
      res.status(409).json({
        error: 'Association Google déjà existante'
      });
      return;
    }

    console.error('Google link error:', error);
    res.status(400).json({
      error: 'Association Google impossible'
    });
  }
});

// Voir si le compte est associé à Google.
googleRouter.get('/status', requireAuth, async (_req, res) => {
  const userId: string = res.locals.userId;

  const account = await prisma.googleAccount.findUnique({
    where: { userId }
  });

  res.json({ linked: Boolean(account) });
});

// Dissocier Google uniquement si un mot de passe existe.
googleRouter.delete('/link', requireAuth, requireRecentAuth, async (req, res) => {
  const userId: string = res.locals.userId;
  const password = req.body?.password;

  if (typeof password !== 'string') {
    res.status(400).json({ error: 'Mot de passe requis' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { googleAccount: true }
    });

    if (!user?.googleAccount) {
      res.status(404).json({ error: 'Aucun compte Google associé' });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({
        error: 'Définis un mot de passe avant de dissocier Google'
      });
      return;
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }

    await prisma.googleAccount.delete({
      where: { userId }
    });

    res.json({ message: 'Compte Google dissocié' });
  } catch (error) {
    console.error('Google unlink error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});
