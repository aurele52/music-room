import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const BASE = 'http://127.0.0.1:3102'
const levels = [1, 5, 10, 20, 50, 100, 200, 300, 500]
const rounds = 12

const url = new URL(process.env.DATABASE_URL || '')

if (
  url.pathname !== '/musicroom_test' ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '5433'
) {
  throw new Error('Base de test locale obligatoire')
}

const secret = process.env.JWT_SECRET
const apiPid = Number(process.env.LOAD_API_PID)

if (!secret || !Number.isSafeInteger(apiPid) || apiPid <= 0) {
  throw new Error('Configuration de test incomplete')
}

const prisma = new PrismaClient()
const users = []
const tokens = []
const results = []
const resources = []

let eventId
let timer
let previousCpu
let previousTime

function sampleResources() {
  try {
    const raw = readFileSync(`/proc/${apiPid}/stat`, 'utf8')
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ')
    const cpu = Number(fields[11]) + Number(fields[12])
    const now = performance.now()

    const status = readFileSync(`/proc/${apiPid}/status`, 'utf8')
    const rss = Number(status.match(/VmRSS:\s+(\d+)/)?.[1]) / 1024

    if (previousTime !== undefined) {
      resources.push({
        cpu: (cpu - previousCpu) /
          Number(process.env.LOAD_CLK_TCK) /
          ((now - previousTime) / 1000) * 100,
        ramMiB: rss
      })
    }

    previousCpu = cpu
    previousTime = now
  } catch {
    // Le processus peut avoir termine.
  }
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.ceil(sorted.length * p) - 1])
}

async function ensureUsers(count) {
  while (users.length < count) {
    const user = await prisma.user.create({
      data: {
        name: `Load Final ${users.length + 1}`,
        email: `${randomUUID()}@example.test`,
        emailVerifiedAt: new Date()
      }
    })

    users.push(user.id)

    tokens.push(jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      secret,
      {
        issuer: 'music-room',
        audience: 'music-room-api',
        expiresIn: '1h'
      }
    ))
  }
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

async function measure(service, path, clients) {
  const start = performance.now()

  const workers = tokens.slice(0, clients).map(async token => {
    const samples = []

    for (let i = 0; i < rounds; i++) {
      samples.push(await request(path, token))
    }

    return samples
  })

  const samples = (await Promise.all(workers)).flat()
  const duration = (performance.now() - start) / 1000

  const errors = samples.filter(x => x.status !== 200)
  const times = samples.map(x => x.ms)

  const result = {
    service,
    clients,
    requests: samples.length,
    errors: errors.length,
    errorStatuses: [...new Set(errors.map(x => x.status))],
    p50: percentile(times, 0.50),
    p95: percentile(times, 0.95),
    p99: percentile(times, 0.99),
    rps: Math.round(samples.length / duration)
  }

  results.push(result)

  console.log(
    `${service.padEnd(10)} ` +
    `clients=${String(clients).padStart(3)} ` +
    `req=${String(result.requests).padStart(5)} ` +
    `err=${result.errors} ` +
    `p50=${result.p50}ms ` +
    `p95=${result.p95}ms ` +
    `p99=${result.p99}ms ` +
    `rps=${result.rps}` +
    (errors.length ? ` HTTP=${result.errorStatuses}` : '')
  )

  return result.errors === 0 && result.p95 <= 2000
}

try {
  const database = await prisma.$queryRaw`
    SELECT current_database() AS name
  `

  if (database[0]?.name !== 'musicroom_test') {
    throw new Error('Base interdite')
  }

  await ensureUsers(1)

  const event = await prisma.event.create({
    data: {
      organizerId: users[0],
      title: 'Benchmark final temporaire',
      visibility: 'PUBLIC',
      votePolicy: 'PUBLIC',
      editPolicy: 'PUBLIC',
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 3600000)
    }
  })

  eventId = event.id

  await prisma.eventTrack.create({
    data: {
      eventId,
      proposerId: users[0],
      title: 'Blue Horizon',
      artist: 'Music Room'
    }
  })

  await prisma.eventPlaylist.create({
    data: {
      eventId,
      title: 'Playlist benchmark'
    }
  })

  const services = [
    ['vote', `/api/tracks/events/${eventId}`],
    ['playlist', `/api/playlists/events/${eventId}`],
    ['session', `/api/sessions/events/${eventId}`]
  ]

  let lastStable = 0

  console.log('===== MONTEE EN CHARGE =====')
  console.log('Un compte distinct par client concurrent')

  for (const clients of levels) {
    await ensureUsers(clients)

    previousTime = undefined
    sampleResources()
    timer = setInterval(sampleResources, 200)

    let stable = true

    try {
      for (const [service, path] of services) {
        if (!await measure(service, path, clients)) {
          stable = false
          break
        }
      }
    } finally {
      sampleResources()
      clearInterval(timer)
    }

    if (!stable) {
      console.log(`ARRET : palier ${clients} instable`)
      break
    }

    lastStable = clients
  }

  const average = values =>
    values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0

  const summary = {
    lastStable,
    requests: results.reduce((a, b) => a + b.requests, 0),
    errors: results.reduce((a, b) => a + b.errors, 0),
    accountsCreated: users.length,
    resourceSamples: resources.length,
    cpuAverage: average(resources.map(x => x.cpu)).toFixed(1),
    cpuMax: Math.max(0, ...resources.map(x => x.cpu)).toFixed(1),
    ramAverage: average(resources.map(x => x.ramMiB)).toFixed(1),
    ramMax: Math.max(0, ...resources.map(x => x.ramMiB)).toFixed(1)
  }

  console.log('\n===== BILAN =====')
  console.log(JSON.stringify(summary, null, 2))

  writeFileSync('/tmp/music-room-final-load.json',
    JSON.stringify({
      date: new Date().toISOString(),
      summary,
      results,
      resources
    }, null, 2)
  )

  if (lastStable === 0) process.exitCode = 1

} finally {
  clearInterval(timer)

  if (eventId) {
    await prisma.eventTrack.deleteMany({
      where: { eventId }
    })

    await prisma.eventPlaylist.deleteMany({
      where: { eventId }
    })

    await prisma.event.delete({
      where: { id: eventId }
    })
  }

  await prisma.user.deleteMany({
    where: { id: { in: users } }
  })

  await prisma.$disconnect()

  console.log('NETTOYAGE : comptes temporaires supprimes')
}
