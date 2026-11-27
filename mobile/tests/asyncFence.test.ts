import test from 'node:test'
import assert from 'node:assert/strict'
import { createAsyncFence } from '../src/lib/asyncFence'

function deferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>(res => {
    resolve = res
  })

  return { promise, resolve }
}

test('resultat valide pendant la session courante', () => {
  const fence = createAsyncFence()
  const scope = fence.capture()

  assert.equal(fence.isCurrent(scope), true)
})

test('ancienne reponse ignoree apres invalidation', async () => {
  const fence = createAsyncFence()
  const scope = fence.capture()
  const pending = deferred<string>()

  let displayed = ''

  const load = pending.promise.then(value => {
    if (fence.isCurrent(scope)) displayed = value
  })

  fence.invalidate()
  pending.resolve('donnees privees ancien compte')

  await load
  assert.equal(displayed, '')
})

test('nouvelle session accepte ses propres resultats', async () => {
  const fence = createAsyncFence()

  const oldScope = fence.capture()
  fence.invalidate()
  const newScope = fence.capture()

  assert.equal(fence.isCurrent(oldScope), false)
  assert.equal(fence.isCurrent(newScope), true)
})

test('plusieurs invalidations ignorent les anciens resultats', () => {
  const fence = createAsyncFence()
  const first = fence.capture()

  fence.invalidate()
  const second = fence.capture()

  fence.invalidate()
  const third = fence.capture()

  assert.equal(fence.isCurrent(first), false)
  assert.equal(fence.isCurrent(second), false)
  assert.equal(fence.isCurrent(third), true)
})
