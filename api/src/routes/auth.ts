import { Router } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createSession } from '../services/session.js';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hashToken, sendAuthLink } from '../services/mail.js';
import type { TokenPurpose } from '../services/mail.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

authRouter.use(
  [
    '/register',
    '/login',
    '/resend-verification',
    '/forgot-password',
    '/reset-password',
    '/verify-email'
  ],
  authLimiter
);

function validEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 8
    && Buffer.byteLength(value, 'utf8') <= 72;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validToken(value: unknown): value is string {
  return typeof value === 'string'
    && /^[a-f0-9]{64}$/.test(value);
}

// Consommer un lien une seule fois, dans une transaction.
async function consumeToken(
  token: string,
  purpose: TokenPurpose,
  passwordHash?: string
): Promise<boolean> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) }
  });

  if (!record ||
      record.purpose !== purpose ||
      record.expiresAt <= new Date()) {
    return false;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.authToken.deleteMany({
        where: {
          id: record.id,
          purpose,
          expiresAt: { gt: new Date() }
        }
      });

      if (deleted.count !== 1) {
        throw new Error('Token déjà utilisé');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: purpose === 'verify'
          ? { emailVerifiedAt: new Date() }
          : { passwordHash, tokenVersion: { increment: 1 } }
      });
    });

    return true;
  } catch {
    return false;
  }
}

authRouter.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!validEmail(email) ||
      !validPassword(password) ||
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 100) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    await sendAuthLink(user.id, user.email, 'verify');

    res.status(201).json({
      message: 'Compte créé. Vérifie ton adresse email.',
      user
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }

    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!validEmail(email) || typeof password !== 'string') {
    res.status(400).json({ error: 'Identifiants invalides' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });

    if (!user?.passwordHash ||
        !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({
        error: 'Email ou mot de passe incorrect'
      });
      return;
    }

    if (!user.emailVerifiedAt) {
      res.status(403).json({
        error: 'Adresse email non vérifiée',
        code: 'EMAIL_NOT_VERIFIED'
      });
      return;
    }

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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const userId: string = res.locals.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      createdAt: true
    }
  });

  if (!user || !user.emailVerifiedAt) {
    res.status(401).json({ error: 'Compte non autorisé' });
    return;
  }

  res.json({ user });
});

authRouter.post('/verify-email', async (req, res) => {
  const token = req.body?.token;

  if (!validToken(token) ||
      !(await consumeToken(token, 'verify'))) {
    res.status(400).json({
      error: 'Lien invalide, expiré ou déjà utilisé'
    });
    return;
  }

  res.json({ message: 'Adresse email vérifiée' });
});

authRouter.post('/resend-verification', async (req, res) => {
  const email = req.body?.email;

  if (!validEmail(email)) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });

    if (user && !user.emailVerifiedAt) {
      await sendAuthLink(user.id, user.email, 'verify');
    }

    res.json({
      message: 'Si le compte existe, un lien a été envoyé.'
    });
  } catch {
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  const email = req.body?.email;

  if (!validEmail(email)) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });

    if (user) {
      await sendAuthLink(user.id, user.email, 'reset');
    }

    res.json({
      message: 'Si le compte existe, un lien a été envoyé.'
    });
  } catch {
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body ?? {};

  if (!validToken(token) || !validPassword(password)) {
    res.status(400).json({ error: 'Données invalides' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const success = await consumeToken(token, 'reset', passwordHash);

  if (!success) {
    res.status(400).json({
      error: 'Lien invalide, expiré ou déjà utilisé'
    });
    return;
  }

  res.json({ message: 'Mot de passe modifié' });
});
