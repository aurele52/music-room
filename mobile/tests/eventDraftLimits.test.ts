import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEventPayload,
  type EventDraft
} from '../src/lib/eventDraft'

const now = new Date('2030-01-01T00:00:00.000Z')

const valid: EventDraft = {
  title: 'Soirée test',
  description: '',
  location: '',
  startsAt: '2035-06-15 20:00',
  endsAt: '2035-06-16 02:00',
  visibility: 'PUBLIC'
}

function build(overrides: Partial<EventDraft>) {
  return buildEventPayload({ ...valid, ...overrides }, now)
}

test('titre minimal de trois caractères accepté', () => {
  assert.equal(build({ title: 'ABC' }).title, 'ABC')
})

test('titre de deux caractères refusé', () => {
  assert.throws(
    () => build({ title: 'AB' }),
    /titre/
  )
})

test('description de 2000 caractères acceptée', () => {
  assert.equal(
    build({ description: 'x'.repeat(2000) })
      .description.length,
    2000
  )
})

test('description de 2001 caractères refusée', () => {
  assert.throws(
    () => build({ description: 'x'.repeat(2001) }),
    /description/
  )
})

test('lieu vide accepté', () => {
  assert.equal(build({ location: '' }).location, '')
})

test('lieu de 120 caractères accepté', () => {
  assert.equal(
    build({ location: 'x'.repeat(120) }).location.length,
    120
  )
})

test('lieu de 121 caractères refusé', () => {
  assert.throws(
    () => build({ location: 'x'.repeat(121) }),
    /lieu/
  )
})

test('retour à la ligne dans la description autorisé', () => {
  assert.equal(
    build({ description: 'Ligne 1\nLigne 2' }).description,
    'Ligne 1\nLigne 2'
  )
})

test('tabulation interdite dans la description', () => {
  assert.throws(
    () => build({ description: 'Bonjour\tsoirée' }),
    /contrôle/
  )
})

test('caractère NUL interdit dans le titre', () => {
  assert.throws(
    () => build({ title: 'Soirée\u0000test' }),
    /contrôle/
  )
})

test('visibilité invalide refusée', () => {
  assert.throws(
    () => build({
      visibility: 'UNKNOWN' as EventDraft['visibility']
    }),
    /Visibilité/
  )
})

test('visibilité privée acceptée', () => {
  assert.equal(
    build({ visibility: 'PRIVATE' }).visibility,
    'PRIVATE'
  )
})
