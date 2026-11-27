import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeBeacon } from '../src/lib/iot/beacon'

const uuid = '00112233-4455-4677-8899-aabbccddeeff'
const packet = Buffer.from(
  'ffff4d523100112233445546778899aabbccddeeff',
  'hex'
)

test('decodes a valid Music Room beacon', () => {
  assert.equal(decodeBeacon(packet), uuid)
})

test('rejects truncated packets', () => {
  assert.equal(decodeBeacon(packet.subarray(0, 20)), null)
})

test('rejects another manufacturer', () => {
  const wrong = Buffer.from(packet)
  wrong[0] = 0
  assert.equal(decodeBeacon(wrong), null)
})

test('rejects unknown protocol versions', () => {
  const wrong = Buffer.from(packet)
  wrong[4] = 0x32
  assert.equal(decodeBeacon(wrong), null)
})

test('rejects the old prototype packet', () => {
  const old = Buffer.from(
    'ffff4d55534943524f4f4d3a3432',
    'hex'
  )
  assert.equal(decodeBeacon(old), null)
})
