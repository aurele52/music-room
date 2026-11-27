import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MusicEvent } from '../src/lib/api'
import {
  createDiscovery,
  decodeAdvertisement,
  isNearbyEvent
} from '../src/lib/iot/discovery'

const id = '00112233-4455-4677-8899-aabbccddeeff'
const now = Date.parse('2026-11-27T12:00:00Z')

const event: MusicEvent = {
  id,
  title: 'Jazz Night',
  description: 'Concert jazz',
  location: 'Paris',
  startsAt: '2026-11-27T10:00:00Z',
  endsAt: '2026-11-27T18:00:00Z',
  visibility: 'PUBLIC',
  organizerId: 'organizer'
}

test('decodes BLE Base64 manufacturer data', () => {
  const data = Buffer.from(
    'ffff4d523100112233445546778899aabbccddeeff',
    'hex'
  )

  assert.equal(
    decodeAdvertisement(data.toString('base64')),
    id
  )
})

test('rejects invalid Base64', () => {
  assert.equal(decodeAdvertisement(null), null)
  assert.equal(decodeAdvertisement('invalid'), null)
  assert.equal(decodeAdvertisement('!'.repeat(28)), null)
})

test('accepts a current public event', () => {
  assert.equal(isNearbyEvent(event, id, now), true)
})

test('rejects private events', () => {
  assert.equal(isNearbyEvent({
    ...event,
    visibility: 'PRIVATE'
  }, id, now), false)
})

test('rejects past and future events', () => {
  assert.equal(isNearbyEvent(
    event, id, now - 86400000
  ), false)

  assert.equal(isNearbyEvent(
    event, id, now + 86400000
  ), false)
})

test('rejects an unrelated event', () => {
  assert.equal(isNearbyEvent(event, 'other', now), false)
})

test('does not notify twice for the same event', async () => {
  let time = now
  let requests = 0

  const discovery = createDiscovery(async () => {
    requests++
    return event
  }, () => time)

  assert.deepEqual(
    await discovery.receive(id, () => true),
    event
  )

  time += 60000

  assert.equal(
    await discovery.receive(id, () => true),
    null
  )

  assert.equal(requests, 1)
})

test('prevents simultaneous requests', async () => {
  let requests = 0

  const discovery = createDiscovery(async () => {
    requests++
    return event
  }, () => now)

  const first = discovery.receive(id, () => true)
  const second = discovery.receive(id, () => true)

  assert.deepEqual(await first, event)
  assert.equal(await second, null)
  assert.equal(requests, 1)
})

test('ignores a response received after logout', async () => {
  let active = true

  const discovery = createDiscovery(async () => {
    active = false
    return event
  }, () => now)

  assert.equal(
    await discovery.receive(id, () => active),
    null
  )
})

test('retries after a network failure', async () => {
  let time = now
  let requests = 0

  const discovery = createDiscovery(async () => {
    if (++requests === 1) throw new Error('Offline')
    return event
  }, () => time)

  assert.equal(
    await discovery.receive(id, () => true),
    null
  )

  assert.equal(
    await discovery.receive(id, () => true),
    null
  )

  assert.equal(requests, 1)

  time += 31000

  assert.deepEqual(
    await discovery.receive(id, () => true),
    event
  )
})
