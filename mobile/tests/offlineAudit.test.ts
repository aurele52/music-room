import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  api,
  ApiError,
  setUnauthorizedHandler
} from '../src/lib/api'

import {
  cacheUserGeneration,
  invalidateUserCacheGeneration,
  cacheSessionIsCurrent,
  setCacheSessionGuard,
  subscribeSyncChanges,
  notifySyncChange
} from '../src/lib/offline/syncChanges'

test('offline audit: invalidates all old loads for one account', () => {
  const alice = cacheUserGeneration('alice')
  const bob = cacheUserGeneration('bob')

  invalidateUserCacheGeneration('alice')

  assert.equal(
    cacheUserGeneration('alice'),
    alice + 1
  )

  assert.equal(cacheUserGeneration('bob'), bob)
})

test('offline audit: verifies current account immediately', t => {
  let current = 'alice'

  setCacheSessionGuard(userId => userId === current)

  t.after(() => {
    setCacheSessionGuard(() => true)
  })

  assert.equal(cacheSessionIsCurrent('alice'), true)
  assert.equal(cacheSessionIsCurrent('bob'), false)

  current = 'bob'

  assert.equal(cacheSessionIsCurrent('alice'), false)
  assert.equal(cacheSessionIsCurrent('bob'), true)
})

test('offline audit: continues notifications after failure', t => {
  let received = false

  const stopFirst = subscribeSyncChanges(() => {
    throw new Error('Listener failure')
  })

  const stopSecond = subscribeSyncChanges(() => {
    received = true
  })

  t.after(stopFirst)
  t.after(stopSecond)

  notifySyncChange('alice', 'event')

  assert.equal(received, true)
})

test('offline audit: handles HTTP 401 without JSON', async t => {
  const originalFetch = globalThis.fetch
  const previousUrl = process.env.EXPO_PUBLIC_API_URL

  process.env.EXPO_PUBLIC_API_URL = 'https://example.test'

  globalThis.fetch = async () =>
    new Response('<html>Unauthorized</html>', {
      status: 401
    })

  let rejectedToken: string | null = null

  const unsubscribe = setUnauthorizedHandler(token => {
    rejectedToken = token
  })

  t.after(() => {
    globalThis.fetch = originalFetch
    unsubscribe()

    if (previousUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL
    } else {
      process.env.EXPO_PUBLIC_API_URL = previousUrl
    }
  })

  await assert.rejects(
    api('/auth/me', { token: 'old-token' }),
    error =>
      error instanceof ApiError &&
      error.status === 401
  )

  assert.equal(rejectedToken, 'old-token')
})

test('offline audit: login refusal does not invalidate session', async t => {
  const originalFetch = globalThis.fetch
  const previousUrl = process.env.EXPO_PUBLIC_API_URL

  process.env.EXPO_PUBLIC_API_URL = 'https://example.test'

  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      error: 'Identifiants invalides'
    }), {
      status: 401
    })

  let invalidated = false

  const unsubscribe = setUnauthorizedHandler(() => {
    invalidated = true
  })

  t.after(() => {
    globalThis.fetch = originalFetch
    unsubscribe()

    if (previousUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL
    } else {
      process.env.EXPO_PUBLIC_API_URL = previousUrl
    }
  })

  await assert.rejects(
    api('/auth/login', {
      method: 'POST',
      body: {}
    })
  )

  assert.equal(invalidated, false)
})
