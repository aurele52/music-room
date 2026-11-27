import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { catalogRouter } from './routes/catalog.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { setupRealtime } from './realtime.js';
import { prisma } from './db.js';
import { authRouter } from './routes/auth.js';
import { googleRouter } from './routes/google.js';
import { profileRouter } from './routes/profile.js';
import { friendsRouter } from './routes/friends.js';
import { eventsRouter } from './routes/events.js';
import { tracksRouter } from './routes/tracks.js';
import { playlistsRouter } from './routes/playlists.js';
import { musicSessionsRouter } from './routes/musicSessions.js';
import { eventInvitationsRouter } from './routes/eventInvitations.js';
import { eventMusicPoliciesRouter } from './routes/eventMusicPolicies.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = Number(process.env.PORT || 3100);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Mandatory : journal des actions mobiles reçues par l'API.
// Aucune donnée d'authentification ni corps de requête.
app.use('/api', (req, res, next) => {
  const platform = req.get('X-MusicRoom-Platform');

  if (platform !== 'android' && platform !== 'ios') {
    next();
    return;
  }

  const sanitize = (value: string | undefined) =>
    (value ?? 'unknown')
      .slice(0, 100)
      .replace(/[\r\n\t]/g, ' ');

  const device = sanitize(req.get('X-MusicRoom-Device'));
  const version = sanitize(req.get('X-MusicRoom-Version'));

  // Conserver le chemin complet avant les routeurs.
  // Exclure les parametres potentiellement sensibles.
  const requestPath = req.originalUrl.split('?')[0];

  res.once('finish', () => {
    console.log(JSON.stringify({
      type: 'mobile-action',
      at: new Date().toISOString(),
      platform,
      device,
      version,
      method: req.method,
      path: requestPath,
      status: res.statusCode
    }));
  });

  next();
});

app.use('/api/auth/google', googleRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/events', eventInvitationsRouter);
app.use('/api/events', eventMusicPoliciesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/subscription', subscriptionsRouter);

app.use('/api/audio', express.static(
  fileURLToPath(new URL('../audio/', import.meta.url)),
  {
    index: false,
    redirect: false,
    dotfiles: 'deny'
  }
));

app.use('/api/tracks', tracksRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/sessions', musicSessionsRouter);

app.get('/', (_req, res) => {
  res.json({
    name: 'Music Room API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      api: 'ok',
      database: 'ok'
    });
  } catch {
    res.status(503).json({
      status: 'error',
      api: 'ok',
      database: 'unavailable'
    });
  }
});

// Salons événementiels authentifiés.
setupRealtime(io);

server.listen(port, '127.0.0.1', () => {
  console.log(`Music Room API : http://localhost:${port}`);
});

async function shutdown() {
  io.close();
  server.close();
  await prisma.$disconnect();
}

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});
