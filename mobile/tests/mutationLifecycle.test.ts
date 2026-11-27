import test from 'node:test'
import assert from 'node:assert/strict'
import { createAsyncFence } from '../src/lib/asyncFence'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

test('mutation terminee sur ecran actif : navigation autorisee', async () => {
  const fence = createAsyncFence()
  const scope = fence.capture()
  const pending = deferred<void>()

  let navigation = 0

  const operation = pending.promise.then(() => {
    if (fence.isCurrent(scope)) navigation++
  })

  pending.resolve()
  await operation

  assert.equal(navigation, 1)
})

test('ancienne suppression : navigation ignoree', async () => {
  const fence = createAsyncFence()
  const scope = fence.capture()
  const pending = deferred<void>()

  let navigation = 0

  const operation = pending.promise.then(() => {
    if (fence.isCurrent(scope)) navigation++
  })

  fence.invalidate()
  pending.resolve()
  await operation

  assert.equal(navigation, 0)
})

test('ancienne sauvegarde : erreur ignoree', async () => {
  const fence = createAsyncFence()
  const scope = fence.capture()
  const pending = deferred<void>()

  let displayedError = ''

  const operation = pending.promise.catch(error => {
    if (fence.isCurrent(scope)) {
      displayedError = String(error)
    }
  })

  fence.invalidate()
  pending.reject(new Error('Ancienne session'))

  await operation
  assert.equal(displayedError, '')
})

test('mutation nouvelle session : ancienne reponse rejetee', async () => {
  const fence = createAsyncFence()
  const alice = fence.capture()
  fence.invalidate()
  const bob = fence.capture()

  assert.equal(fence.isCurrent(alice), false)
  assert.equal(fence.isCurrent(bob), true)
})
