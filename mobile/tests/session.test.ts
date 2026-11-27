import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SessionManager,
  type SessionApi,
  type TokenStorage
} from '../src/session/SessionManager'

const user = {
  id: 'user-1',
  email: 'test@example.test',
  name: 'Utilisateur test'
}

function deferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

function fixture(initial: string | null = null) {
  let stored = initial

  const storage: TokenStorage = {
    async get() { return stored },
    async set(token) { stored = token },
    async remove() { stored = null }
  }

  const api: SessionApi = {
    async me() { return user },
    async login() {
      return { token: 'token-new', user }
    }
  }

  return {
    storage,
    api,
    getStored: () => stored
  }
}

test('restauration du JWT valide', async () => {
  const f = fixture('token-original')
  const manager = new SessionManager(f.storage, f.api)

  await manager.restore()

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-original')
})

test('JWT refuse : stockage efface', async () => {
  const f = fixture('token-expired')
  f.api.me = async () => {
    throw Object.assign(new Error('Expiré'), {
      status: 401
    })
  }

  const manager = new SessionManager(f.storage, f.api)
  await manager.restore()

  assert.equal(manager.current.status, 'guest')
  assert.equal(f.getStored(), null)
})

test('panne réseau : JWT conservé', async () => {
  const f = fixture('token-valid')
  f.api.me = async () => {
    throw new Error('Réseau indisponible')
  }

  const manager = new SessionManager(f.storage, f.api)
  await manager.restore()

  assert.equal(manager.current.status, 'error')
  assert.equal(f.getStored(), 'token-valid')
})

test('connexion et déconnexion', async () => {
  const f = fixture()
  const manager = new SessionManager(f.storage, f.api)

  await manager.login('a@example.test', 'password')

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-new')

  await manager.logout()

  assert.equal(manager.current.status, 'guest')
  assert.equal(f.getStored(), null)
})

test('ancien 401 ignore après nouvelle connexion', async () => {
  const f = fixture()
  const manager = new SessionManager(f.storage, f.api)

  await manager.login('a@example.test', 'password')

  manager.unauthorized('ancien-token')

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-new')
})

test('401 courant révoque la session', async () => {
  const f = fixture()
  const manager = new SessionManager(f.storage, f.api)

  await manager.login('a@example.test', 'password')

  manager.unauthorized('token-new')

  // La suppression est sérialisée et donc asynchrone.
  await manager.logout()

  assert.equal(manager.current.status, 'guest')
  assert.equal(f.getStored(), null)
})

test('ancienne restauration ne remplace pas une connexion', async () => {
  const f = fixture('token-old')
  const pending = deferred<typeof user>()

  f.api.me = () => pending.promise

  const manager = new SessionManager(f.storage, f.api)

  const restore = manager.restore()

  // Laisser la lecture du stockage démarrer.
  await new Promise<void>((resolve) => setImmediate(resolve))

  await manager.login('a@example.test', 'password')

  pending.resolve(user)
  await restore

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-new')

  if (manager.current.status === 'authenticated') {
    assert.equal(manager.current.token, 'token-new')
  }
})

test('déconnexion annule une connexion tardive', async () => {
  const f = fixture()
  const pending = deferred<{
    token: string
    user: typeof user
  }>()

  f.api.login = () => pending.promise

  const manager = new SessionManager(f.storage, f.api)

  const login = manager.login('a@example.test', 'password')
  const logout = manager.logout()

  pending.resolve({ token: 'token-late', user })

  await assert.rejects(login)
  await logout

  assert.equal(manager.current.status, 'guest')
  assert.equal(f.getStored(), null)
})

test('échec de connexion pendant une restauration', async () => {
  const f = fixture('token-old')
  const pending = deferred<typeof user>()

  f.api.me = () => pending.promise
  f.api.login = async () => {
    throw new Error('Mot de passe incorrect')
  }

  const manager = new SessionManager(f.storage, f.api)
  const restore = manager.restore()

  await new Promise<void>((resolve) => setImmediate(resolve))

  await assert.rejects(
    manager.login('test@example.test', 'wrong'),
    /Mot de passe incorrect/
  )

  // La restauration a été invalidée et ne doit pas
  // remettre l'application en mode authentifié.
  pending.resolve(user)
  await restore

  assert.equal(manager.current.status, 'guest')
})

test('ancienne restauration 401 ne révoque pas une nouvelle connexion', async () => {
  const f = fixture('token-old')

  let rejectMe!: (error: Error) => void

  f.api.me = () => new Promise((_, reject) => {
    rejectMe = reject
  })

  const manager = new SessionManager(f.storage, f.api)
  const restore = manager.restore()

  await new Promise<void>((resolve) => setImmediate(resolve))

  await manager.login('test@example.test', 'password')

  rejectMe(
    Object.assign(new Error('JWT expiré'), { status: 401 })
  )

  await restore

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-new')
})

test('deux connexions : seule la plus récente gagne', async () => {
  const f = fixture()

  const first = deferred<{
    token: string
    user: typeof user
  }>()

  const second = deferred<{
    token: string
    user: typeof user
  }>()

  f.api.login = (email) =>
    email === 'first@example.test'
      ? first.promise
      : second.promise

  const manager = new SessionManager(f.storage, f.api)

  const a = manager.login('first@example.test', 'password')
  const b = manager.login('second@example.test', 'password')

  second.resolve({ token: 'token-second', user })
  await b

  first.resolve({ token: 'token-first', user })
  await assert.rejects(a, /remplacée/)

  assert.equal(f.getStored(), 'token-second')

  if (manager.current.status === 'authenticated') {
    assert.equal(manager.current.token, 'token-second')
  } else {
    assert.fail('La seconde connexion a été perdue')
  }
})

test('déconnexion pendant une écriture Secure Store', async () => {
  let stored: string | null = null

  const writing = deferred<void>()
  const release = deferred<void>()

  const storage: TokenStorage = {
    async get() { return stored },
    async set(token) {
      writing.resolve()
      await release.promise
      stored = token
    },
    async remove() { stored = null }
  }

  const f = fixture()
  const manager = new SessionManager(storage, f.api)

  const login = manager.login('test@example.test', 'password')

  await writing.promise

  const logout = manager.logout()

  release.resolve()

  await assert.rejects(login, /remplacée/)
  await logout

  assert.equal(manager.current.status, 'guest')
  assert.equal(stored, null)
})

test('un 401 ancien ne supprime pas un jeton plus récent', async () => {
  const f = fixture()
  const manager = new SessionManager(f.storage, f.api)

  await manager.login('test@example.test', 'password')

  manager.unauthorized('token-obsolete')

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'token-new')
})

test('échec de stockage : aucune session authentifiée publiée', async () => {
  const f = fixture()

  f.storage.set = async () => {
    throw new Error('Secure Store indisponible')
  }

  const manager = new SessionManager(f.storage, f.api)

  await assert.rejects(
    manager.login('test@example.test', 'password'),
    /Secure Store indisponible/
  )

  assert.notEqual(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), null)
})

test('connexion Google utilise le stockage sécurisé', async () => {
  const f = fixture()
  f.api.googleLogin = async credential => {
    assert.equal(credential, 'google-test-credential')
    return { token: 'google-session-token', user }
  }

  const manager = new SessionManager(f.storage, f.api)

  await manager.loginGoogle('google-test-credential')

  assert.equal(manager.current.status, 'authenticated')
  assert.equal(f.getStored(), 'google-session-token')
})

test('connexion Google tardive après déconnexion ignorée', async () => {
  const f = fixture()
  const pending = deferred<{
    token: string
    user: typeof user
  }>()

  f.api.googleLogin = () => pending.promise

  const manager = new SessionManager(f.storage, f.api)

  const login = manager.loginGoogle('google-test-credential')
  const logout = manager.logout()

  pending.resolve({
    token: 'google-late-token',
    user
  })

  await assert.rejects(login)
  await logout

  assert.equal(manager.current.status, 'guest')
  assert.equal(f.getStored(), null)
})
