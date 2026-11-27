import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const BASE = 'http://127.0.0.1:3102'
const smoke = process.argv.includes('--smoke')
const levels = smoke ? [1, 5] : [1, 5, 10, 20, 50]
const rounds = smoke ? 4 : 12

// Sécurité : ne jamais utiliser la DB de production.
const config = dotenv.parse(fs.readFileSync('.env'))
const raw = config.DATABASE_URL

if (!raw || !config.JWT_SECRET) {
  throw new Error('DATABASE_URL ou JWT_SECRET absent')
}

const url = new URL(raw)

if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  throw new Error('PostgreSQL doit etre local')
}

url.hostname = '127.0.0.1'
url.port = '5433'
url.pathname = '/musicroom_test'

if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '5433' ||
  url.pathname !== '/musicroom_test'
) {
  throw new Error('Base de test non valide')
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: url.toString() }
  }
})

const ids = { user: null, event: null }
const report = []

function percentile(values, percentage) {
  if (!values.length) return 0
  const ordered = [...values].sort((a, b) => a - b)
  const index = Math.ceil(ordered.length * percentage) - 1
  return Math.round(ordered[Math.max(0, index)])
}

async function request(path, token) {
  const start = performance.now()

  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(5000)
    })

    await response.arrayBuffer()

    return {
      status: response.status,
      ms: performance.now() - start
    }
  } catch {
    return {
      status: 0,
      ms: performance.now() - start
    }
  }
}

async function measure(name, path, token, clients) {
  const started = performance.now()

  const workers = Array.from(
    { length: clients },
    async () => {
      const samples = []

      for (let i = 0; i < rounds; i++) {
        samples.push(await request(path, token))
      }

      return samples
    }
  )

  const results = (await Promise.all(workers)).flat()
  const elapsed = (performance.now() - started) / 1000
  const times = results.map(r => r.ms)
  const errors = results.filter(r => r.status !== 200)
  const row = {
    service: name,
    clients,
    requests: results.length,
    errors: errors.length,
    statusErrors: [...new Set(errors.map(r => r.status))],
    p50ms: percentile(times, 0.50),
    p95ms: percentile(times, 0.95),
    rps: Number((results.length / elapsed).toFixed(1))
  }

  report.push(row)

  console.log(
    `${name.padEnd(10)} clients=${String(clients).padStart(2)}` +
    ` req=${row.requests}` +
    ` erreurs=${row.errors}` +
    ` p50=${row.p50ms}ms` +
    ` p95=${row.p95ms}ms` +
    ` debit=${row.rps} req/s`
  )

  return row
}

async function cleanup() {
  if (ids.event) {
    // Données créées exclusivement par ce script.
    await prisma.eventTrack.deleteMany({
      where: { eventId: ids.event }
    })

    await prisma.eventPlaylist.deleteMany({
      where: { eventId: ids.event }
    })

    await prisma.event.deleteMany({
      where: { id: ids.event }
    })
  }

  if (ids.user) {
    await prisma.user.deleteMany({
      where: { id: ids.user }
    })
  }
}

try {
  const database = await prisma.$queryRaw`
    SELECT current_database() AS name
  `

  if (database[0]?.name !== 'musicroom_test') {
    throw new Error('Connexion a une base non autorisee')
  }

  console.log('BASE : musicroom_test')
  console.log('API :', BASE)
  console.log('MODE :', smoke ? 'VALIDATION' : 'CHARGE')
  console.log('PALIERS :', levels.join(', '))

  const health = await fetch(`${BASE}/api/health`, {
    signal: AbortSignal.timeout(3000)
  })

  if (!health.ok) {
    throw new Error(`API indisponible : HTTP ${health.status}`)
  }

  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      name: 'Load Test Music Room',
      emailVerifiedAt: new Date()
    }
  })
  ids.user = user.id

  const event = await prisma.event.create({
    data: {
      organizerId: user.id,
      title: 'Load Test Temporaire',
      visibility: 'PUBLIC',
      votePolicy: 'PUBLIC',
      editPolicy: 'PUBLIC',
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 3600000)
    }
  })
  ids.event = event.id

  await prisma.eventTrack.create({
    data: {
      eventId: event.id,
      proposerId: user.id,
      title: 'Titre de test',
      artist: 'Artiste de test'
    }
  })

  await prisma.eventPlaylist.create({
    data: {
      eventId: event.id,
      title: 'Playlist de test'
    }
  })

  const token = jwt.sign(
    { sub: user.id, ver: user.tokenVersion },
    config.JWT_SECRET,
    {
      issuer: 'music-room',
      audience: 'music-room-api',
      expiresIn: '1h'
    }
  )

  const services = [
    ['vote', `/api/tracks/events/${event.id}`],
    ['playlist', `/api/playlists/events/${event.id}`],
    ['session', `/api/sessions/events/${event.id}`]
  ]

  console.log('\n===== VERIFICATION DES ENDPOINTS =====')

  for (const [name, path] of services) {
    const result = await request(path, token)
    console.log(name, 'HTTP', result.status)

    if (result.status !== 200) {
      throw new Error(`Endpoint ${name} : HTTP ${result.status}`)
    }
  }

  console.log('\n===== MESURES =====')

  let stable = true

  for (const clients of levels) {
    for (const [name, path] of services) {
      const result = await measure(
        name, path, token, clients
      )

      if (result.errors > 0 || result.p95ms > 2000) {
        stable = false
      }
    }

    if (!stable) {
      console.log('ARRET : palier instable')
      break
    }
  }

  const output = '/tmp/music-room-load-results.json'

  fs.writeFileSync(
    output,
    JSON.stringify({
      date: new Date().toISOString(),
      mode: smoke ? 'smoke' : 'load',
      database: 'musicroom_test',
      api: BASE,
      rounds,
      results: report
    }, null, 2) + '\n'
  )

  console.log('\nRESULTATS :', output)
  console.log('STABILITE :', stable ? 'OK' : 'A INVESTIGUER')

  if (!stable) process.exitCode = 1
} catch (error) {
  console.error('ECHEC :', error.message)
  process.exitCode = 1
} finally {
  try {
    await cleanup()
    console.log('NETTOYAGE : TERMINE')
  } catch (error) {
    console.error('NETTOYAGE : ECHEC', error.message)
    console.error('Identifiants temporaires :', ids)
    process.exitCode = 1
  }

  await prisma.$disconnect()
}
