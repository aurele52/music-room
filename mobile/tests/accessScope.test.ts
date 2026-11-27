import test from 'node:test'
import assert from 'node:assert/strict'
import { accessScopeKey } from '../src/lib/accessScope'

const eventA = '11111111-1111-4111-8111-111111111111'
const eventB = '22222222-2222-4222-8222-222222222222'

test('meme session et evenement : meme identite', () => {
  assert.equal(
    accessScopeKey('jwt-alice', eventA),
    accessScopeKey('jwt-alice', eventA)
  )
})

test('changement de compte : nouvel etat React', () => {
  assert.notEqual(
    accessScopeKey('jwt-alice', eventA),
    accessScopeKey('jwt-bob', eventA)
  )
})

test('changement de soiree : nouvel etat React', () => {
  assert.notEqual(
    accessScopeKey('jwt-alice', eventA),
    accessScopeKey('jwt-alice', eventB)
  )
})

test('deconnexion et reconnexion : etats distincts', () => {
  const loggedIn = accessScopeKey('jwt-alice', eventA)
  const guest = accessScopeKey(null, eventA)
  const loggedInAgain = accessScopeKey('jwt-alice-new', eventA)

  assert.notEqual(loggedIn, guest)
  assert.notEqual(guest, loggedInAgain)
  assert.notEqual(loggedIn, loggedInAgain)
})
