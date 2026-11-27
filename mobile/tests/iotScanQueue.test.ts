import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createScanQueue } from '../src/lib/iot/scanQueue'

test('iot scan: serializes native start and stop', async () => {
  const queue = createScanQueue()
  const calls: string[] = []

  let release!: () => void

  const gate = new Promise<void>(resolve => {
    release = resolve
  })

  const start = queue.run(async () => {
    calls.push('start')
    await gate
    calls.push('started')
  })

  const stop = queue.run(async () => {
    calls.push('stop')
  })

  await Promise.resolve()

  assert.deepEqual(calls, ['start'])

  release()

  await Promise.all([start, stop])

  assert.deepEqual(calls, [
    'start',
    'started',
    'stop'
  ])
})

test('iot scan: continues after native error', async () => {
  const queue = createScanQueue()

  await assert.rejects(queue.run(async () => {
    throw new Error('Bluetooth unavailable')
  }))

  assert.equal(
    await queue.run(async () => 'stopped'),
    'stopped'
  )
})

test('iot scan: skips obsolete queued start', async () => {
  const queue = createScanQueue()

  let active = true
  let started = false

  const first = queue.run(async () => {
    active = false
  })

  const second = queue.run(async () => {
    if (active) started = true
  })

  await Promise.all([first, second])

  assert.equal(started, false)
})
