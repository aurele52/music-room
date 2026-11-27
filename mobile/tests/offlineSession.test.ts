import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/lib/api'
import {
  SessionManager
} from '../src/session/SessionManager'
import {
  parseSessionRecord,
  encodeSessionRecord,
  offlineIdentity
} from '../src/session/sessionRecord'

const user = {
  id: 'alice',
  name: 'Alice',
  email: 'alice@example.test'
}

function fixture(initial: string | null) {
  let raw = initial
  let failure: Error | null = null

  const manager = new SessionManager(
    {
      get: async () =>
        parseSessionRecord(raw)?.token ?? null,

      set: async (token, userId) => {
        raw = encodeSessionRecord(token, userId)
      },

      remove: async () => {
        raw = null
      },

      getOfflineUserId: async token =>
        offlineIdentity(raw, token)
    },
    {
      me: async () => {
        if (failure) throw failure
        return user
      },

      login: async () => ({
        token: 'new-token',
        user
      })
    }
  )

  return {
    manager,
    stored: () => raw,
    fail: (error: Error) => {
      failure = error
    }
  }
}

test('offline session: reads legacy JWT', () => {
  assert.deepEqual(
    parseSessionRecord('legacy-token'),
    {
      token: 'legacy-token',
      userId: null
    }
  )
})

test('offline session: reads verified identity', () => {
  const raw = encodeSessionRecord('token', 'alice')

  assert.equal(
    offlineIdentity(raw, 'token'),
    'alice'
  )
})

test('offline session: rejects unrelated token', () => {
  const raw = encodeSessionRecord('token', 'alice')

  assert.equal(
    offlineIdentity(raw, 'another-token'),
    null
  )
})

test('offline session: rejects corrupt record', () => {
  assert.equal(parseSessionRecord('{broken'), null)
  assert.equal(parseSessionRecord('{}'), null)
})

test('offline session: upgrades legacy session online', async () => {
  const f = fixture('legacy-token')

  await f.manager.restore()

  assert.equal(
    f.manager.current.status,
    'authenticated'
  )

  assert.equal(
    offlineIdentity(f.stored(), 'legacy-token'),
    'alice'
  )
})

test('offline session: remembers identity after login', async () => {
  const f = fixture(null)

  await f.manager.login(user.email, 'password')

  assert.equal(
    offlineIdentity(f.stored(), 'new-token'),
    'alice'
  )
})

test('offline session: restores identity without authenticating', async () => {
  const f = fixture(
    encodeSessionRecord('token', 'alice')
  )

  f.fail(new ApiError(
    0, 'Connexion au serveur impossible'
  ))

  await f.manager.restore()

  assert.deepEqual(f.manager.current, {
    status: 'error',
    message: 'Connexion au serveur impossible',
    offlineUserId: 'alice'
  })
})

test('offline session: no identity for legacy token without network', async () => {
  const f = fixture('legacy-token')

  f.fail(new ApiError(
    0, 'Connexion au serveur impossible'
  ))

  await f.manager.restore()

  assert.deepEqual(f.manager.current, {
    status: 'error',
    message: 'Connexion au serveur impossible'
  })
})

test('offline session: revoked JWT removes local identity', async () => {
  const f = fixture(
    encodeSessionRecord('token', 'alice')
  )

  f.fail(new ApiError(401, 'Unauthorized'))

  await f.manager.restore()

  assert.equal(f.manager.current.status, 'guest')
  assert.equal(f.stored(), null)
})

test('offline session: server error does not grant offline access', async () => {
  const f = fixture(
    encodeSessionRecord('token', 'alice')
  )

  f.fail(new ApiError(500, 'Server error'))

  await f.manager.restore()

  assert.deepEqual(f.manager.current, {
    status: 'error',
    message: 'Server error'
  })
})

test('offline session: logout removes identity', async () => {
  const f = fixture(
    encodeSessionRecord('token', 'alice')
  )

  await f.manager.logout()

  assert.equal(f.manager.current.status, 'guest')
  assert.equal(f.stored(), null)
})
