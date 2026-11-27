import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateMusicPreferences } from '../services/musicPreferences.js';

export const profileRouter = Router();

// Modifier les informations simples de son propre profil.
profileRouter.patch('/me', requireAuth, async (req, res) => {
  const userId: string = res.locals.userId;
  const { name } = req.body ?? {};

  if (typeof name !== 'string') {
    res.status(400).json({
      error: 'Le nom doit être une chaîne de caractères'
    });
    return;
  }

  const cleanName = name.trim();

  if (
    cleanName.length < 2 ||
    cleanName.length > 50 ||
    /[\u0000-\u001f\u007f]/u.test(cleanName)
  ) {
    res.status(400).json({
      error: 'Le nom doit contenir entre 2 et 50 caractères valides'
    });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: cleanName },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Impossible de modifier le profil'
    });
  }
});


// Lire son propre profil, y compris sa visibilité.
profileRouter.get('/me', requireAuth, async (_req, res) => {
  const userId: string = res.locals.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        visibility: true,
        publicBio: true,
        friendsBio: true,
        privateNote: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile read error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

// Remplacer les informations personnelles de son profil.
profileRouter.put('/me/information', requireAuth, async (req, res) => {
  const userId: string = res.locals.userId;
  const { publicBio, friendsBio, privateNote } = req.body ?? {};

  function validInformation(value: unknown): value is string {
    return typeof value === 'string'
      && value.length <= 500
      && !/[\u0000-\u001f\u007f]/u.test(value);
  }

  if (
    !validInformation(publicBio) ||
    !validInformation(friendsBio) ||
    !validInformation(privateNote)
  ) {
    res.status(400).json({
      error: 'Informations invalides : 500 caractères maximum par champ'
    });
    return;
  }

  try {
    const information = await prisma.user.update({
      where: { id: userId },
      data: {
        publicBio: publicBio.trim(),
        friendsBio: friendsBio.trim(),
        privateNote: privateNote.trim()
      },
      select: {
        publicBio: true,
        friendsBio: true,
        privateNote: true
      }
    });

    res.json({ information });
  } catch (error) {
    console.error('Profile information update:', error);
    res.status(500).json({
      error: 'Impossible de modifier les informations'
    });
  }
});

// Changer uniquement la visibilité de son propre profil.
profileRouter.patch('/me/visibility', requireAuth, async (req, res) => {
  const userId: string = res.locals.userId;
  const visibility = req.body?.visibility;

  if (
    visibility !== 'PUBLIC' &&
    visibility !== 'FRIENDS' &&
    visibility !== 'PRIVATE'
  ) {
    res.status(400).json({
      error: 'Visibilité invalide : PUBLIC, FRIENDS ou PRIVATE attendu'
    });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { visibility },
      select: {
        id: true,
        visibility: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Visibility update error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

// Lire ses propres goûts musicaux.
profileRouter.get('/me/music', requireAuth, async (_req, res) => {
  const userId: string = res.locals.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        favoriteGenres: true,
        favoriteArtists: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }

    res.json({ preferences: user });
  } catch (error) {
    console.error('Music preferences read error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

// Remplacer ses genres et artistes favoris.
profileRouter.put('/me/music', requireAuth, async (req, res) => {
  const userId: string = res.locals.userId;

  let preferences;

  try {
    preferences = validateMusicPreferences(req.body);
  } catch {
    res.status(400).json({
      error: 'Préférences invalides : maximum 15 éléments par liste'
    });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: preferences,
      select: {
        favoriteGenres: true,
        favoriteArtists: true
      }
    });

    res.json({ preferences: user });
  } catch (error) {
    console.error('Music preferences update error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});

// Rechercher les profils accessibles à l'utilisateur.
profileRouter.get('/search', requireAuth, async (req, res) => {
  const viewerId: string = res.locals.userId;
  const rawQuery = req.query.q;

  if (typeof rawQuery !== 'string') {
    res.status(400).json({ error: 'Recherche invalide' });
    return;
  }

  const query = rawQuery.trim();

  const hasControlCharacter = [...query].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });

  if (
    query.length < 2 ||
    query.length > 50 ||
    hasControlCharacter
  ) {
    res.status(400).json({
      error: 'La recherche doit contenir entre 2 et 50 caractères valides'
    });
    return;
  }

  try {
    const relations = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userLowId: viewerId },
          { userHighId: viewerId }
        ]
      },
      select: {
        userLowId: true,
        userHighId: true
      }
    });

    const friendIds = relations.map((relation) =>
      relation.userLowId === viewerId
        ? relation.userHighId
        : relation.userLowId
    );

    const users = await prisma.user.findMany({
      where: {
        id: { not: viewerId },
        OR: [
          { visibility: 'PUBLIC' },
          {
            visibility: 'FRIENDS',
            id: { in: friendIds }
          }
        ],
        name: {
          contains: query,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true
      },
      orderBy: [
        { name: 'asc' },
        { id: 'asc' }
      ],
      take: 20
    });

    res.json({ users });
  } catch (error) {
    console.error('Profile search error:', error);
    res.status(500).json({
      error: 'Recherche impossible'
    });
  }
});

// Lire le profil d'un autre utilisateur.
profileRouter.get('/:userId', requireAuth, async (req, res) => {
  const viewerId: string = res.locals.userId;
  const userId = req.params.userId;

  if (typeof userId !== 'string') {
    res.status(400).json({ error: 'Identifiant invalide' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        visibility: true,
        publicBio: true,
        friendsBio: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }

    const owner = user.id === viewerId;
    let friend = false;

    if (!owner && user.visibility !== 'PRIVATE') {
      const [userLowId, userHighId] = [viewerId, user.id].sort();

      const relation = await prisma.friendship.findUnique({
        where: {
          userLowId_userHighId: {
            userLowId,
            userHighId
          }
        },
        select: { status: true }
      });

      friend = relation?.status === 'ACCEPTED';
    }

    const authorized =
      owner ||
      user.visibility === 'PUBLIC' ||
      (user.visibility === 'FRIENDS' && friend);

    if (!authorized) {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }

    // La note privée et l'email ne sont jamais sélectionnés ici.
    const { friendsBio, publicBio, ...profile } = user;

    res.json({
      user: {
        ...profile,
        publicBio,
        ...(owner || friend ? { friendsBio } : {})
      }
    });
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ error: 'Erreur du serveur' });
  }
});
