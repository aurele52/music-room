import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SessionManager,
  type SessionUser
} from '../src/session/SessionManager'

const user: SessionUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Ancien nom'
}

function deferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>(done => {
    resolve = done
  })

  return { promise, resolve }
}

function setup() {
  let token: string | null = null
  let reads = 0
  let writes = 0

  let me = async (): Promise<SessionUser> => user

  const manager = new SessionManager(
    {
      get: async () => {
        reads++
        return token
      },
      set: async value => {
        writes++
        token = value
      },
      remove: async () => {
        token = null
      }
    },
    {
      me: () => me(),
      login: async email => ({
        token: email,
        user: {
          ...user,
          id: email
        }
      })
    }
  )

  return {
    manager,
    setMe: (fn: () => Promise<SessionUser>) => {
      me = fn
    },
    storageCalls: () => ({ reads, writes })
  }
}

test('refreshUser conserve la session authentifiee', async () => {
  const { manager, setMe, storageCalls } = setup()

  await manager.login('user-1', 'password')

  const before = storageCalls()
  const statuses: string[] = []

  const unsubscribe = manager.subscribe(state => {
    statuses.push(state.status)
  })

  setMe(async () => ({
    ...user,
    name: 'Nouveau nom'
  }))

  await manager.refreshUser('user-1')

  const state = manager.current

  if (state.status !== 'authenticated') {
    throw new Error('Session perdue')
  }

  assert.equal(state.token, 'user-1')
  assert.equal(state.user.name, 'Nouveau nom')
  assert.deepEqual(statuses, ['authenticated', 'authenticated'])
  assert.deepEqual(storageCalls(), before)

  unsubscribe()
})

test('refreshUser ignore une session differente', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  let called = false

  setMe(async () => {
    called = true
    return user
  })

  await manager.refreshUser('ancien-token')

  assert.equal(called, false)
})

test('refreshUser ne restaure pas un utilisateur deconnecte', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  const response = deferred<SessionUser>()
  setMe(() => response.promise)

  const refresh = manager.refreshUser('user-1')

  await manager.logout()

  response.resolve(user)
  await refresh

  assert.equal(manager.current.status, 'guest')
})

test('refreshUser ne remplace pas un nouveau compte', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  const response = deferred<SessionUser>()
  setMe(() => response.promise)

  const refresh = manager.refreshUser('user-1')

  await manager.login('user-2', 'password')

  response.resolve(user)
  await refresh

  const state = manager.current

  if (state.status !== 'authenticated') {
    throw new Error('Session perdue')
  }

  assert.equal(state.token, 'user-2')
  assert.equal(state.user.id, 'user-2')
})

test('refreshUser ignore les reponses obsoletes', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  const oldResponse = deferred<SessionUser>()
  const newResponse = deferred<SessionUser>()

  setMe(() => oldResponse.promise)
  const oldRefresh = manager.refreshUser('user-1')

  setMe(() => newResponse.promise)
  const newRefresh = manager.refreshUser('user-1')

  newResponse.resolve({ ...user, name: 'Recent' })
  await newRefresh

  oldResponse.resolve({ ...user, name: 'Obsolete' })
  await oldRefresh

  const state = manager.current

  if (state.status !== 'authenticated') {
    throw new Error('Session perdue')
  }

  assert.equal(state.user.name, 'Recent')
})

test('refreshUser refuse une identite incoherente', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  setMe(async () => ({
    ...user,
    id: 'autre-utilisateur'
  }))

  await assert.rejects(
    manager.refreshUser('user-1'),
    /Identité de session incohérente/
  )

  const state = manager.current

  if (state.status !== 'authenticated') {
    throw new Error('Session perdue')
  }

  assert.equal(state.user.id, 'user-1')
})

test('refreshUser conserve la session sur erreur reseau', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  setMe(async () => {
    throw new Error('Reseau indisponible')
  })

  await assert.rejects(
    manager.refreshUser('user-1'),
    /Reseau indisponible/
  )

  assert.equal(manager.current.status, 'authenticated')
})

test('refreshUser traite une session refusee', async () => {
  const { manager, setMe } = setup()

  await manager.login('user-1', 'password')

  setMe(async () => {
    throw Object.assign(
      new Error('Session expiree'),
      { status: 401 }
    )
  })

  await assert.rejects(
    manager.refreshUser('user-1'),
    /Session expiree/
  )

  assert.equal(manager.current.status, 'guest')
})
