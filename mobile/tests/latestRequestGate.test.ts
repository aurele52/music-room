import test from 'node:test'
import assert from 'node:assert/strict'
import { createLatestRequestGate } from '../src/lib/latestRequestGate'

function deferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>(done => {
    resolve = done
  })

  return { promise, resolve }
}

test('une ancienne réponse ne remplace pas la nouvelle', async () => {
  const gate = createLatestRequestGate()
  const first = deferred<string>()
  const second = deferred<string>()

  let displayed = ''

  const firstCurrent = gate.begin()
  const firstTask = first.promise.then(value => {
    if (firstCurrent()) displayed = value
  })

  const secondCurrent = gate.begin()
  const secondTask = second.promise.then(value => {
    if (secondCurrent()) displayed = value
  })

  second.resolve('récent')
  await secondTask

  first.resolve('obsolète')
  await firstTask

  assert.equal(displayed, 'récent')
})

test('une requête invalidée ne publie rien', async () => {
  const gate = createLatestRequestGate()
  const pending = deferred<string>()
  let displayed = 'initial'

  const current = gate.begin()

  const task = pending.promise.then(value => {
    if (current()) displayed = value
  })

  gate.invalidate()

  pending.resolve('ancien')
  await task

  assert.equal(displayed, 'initial')
  assert.equal(current(), false)
})

test('un nouveau chargement redevient autorisé', () => {
  const gate = createLatestRequestGate()

  const first = gate.begin()
  const second = gate.begin()

  assert.equal(first(), false)
  assert.equal(second(), true)

  gate.invalidate()

  assert.equal(second(), false)

  const third = gate.begin()
  assert.equal(third(), true)
})

// V3.3F3H3B : deux chargements indépendants sur un même écran.
test('une notification participants ne bloque pas les amis', () => {
  const participants = createLatestRequestGate()
  const friends = createLatestRequestGate()

  const oldParticipants = participants.begin()
  const currentFriends = friends.begin()

  const newParticipants = participants.begin()

  assert.equal(oldParticipants(), false)
  assert.equal(newParticipants(), true)
  assert.equal(currentFriends(), true)

  // Perte du focus : les deux chargements sont invalidés.
  participants.invalidate()
  friends.invalidate()

  assert.equal(newParticipants(), false)
  assert.equal(currentFriends(), false)
})

test('les réponses anciennes restent isolées entre deux flux', async () => {
  const participants = createLatestRequestGate()
  const friends = createLatestRequestGate()

  const oldMembers = deferred<string>()
  const newMembers = deferred<string>()
  const pendingFriends = deferred<string>()

  let displayedMembers = ''
  let displayedFriends = ''

  const oldMembersCurrent = participants.begin()
  const first = oldMembers.promise.then(value => {
    if (oldMembersCurrent()) displayedMembers = value
  })

  const friendsCurrent = friends.begin()
  const friendTask = pendingFriends.promise.then(value => {
    if (friendsCurrent()) displayedFriends = value
  })

  const newMembersCurrent = participants.begin()
  const second = newMembers.promise.then(value => {
    if (newMembersCurrent()) displayedMembers = value
  })

  newMembers.resolve('participants récents')
  await second

  pendingFriends.resolve('amis actuels')
  await friendTask

  oldMembers.resolve('participants obsolètes')
  await first

  assert.equal(displayedMembers, 'participants récents')
  assert.equal(displayedFriends, 'amis actuels')
})
