import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEventPayload,
  parseLocalDateTime,
  type EventDraft
} from '../src/lib/eventDraft'

const future: EventDraft = {
  title: '  Soirée test  ',
  description: '  Musique et amis  ',
  location: '  Nancy  ',
  startsAt: '2035-06-15 20:00',
  endsAt: '2035-06-16 02:00',
  visibility: 'PUBLIC'
}

const now = new Date('2035-06-01T00:00:00Z')

test('date locale valide', () => {
  const date = parseLocalDateTime('2035-06-15 20:00')
  assert.ok(date)
  assert.equal(date.getFullYear(), 2035)
  assert.equal(date.getHours(), 20)
})

test('date impossible refusée', () => {
  assert.equal(parseLocalDateTime('2035-02-30 20:00'), null)
})

test('heure impossible refusée', () => {
  assert.equal(parseLocalDateTime('2035-06-15 25:00'), null)
})

test('format invalide refusé', () => {
  assert.equal(parseLocalDateTime('15/06/2035 20h'), null)
})

test('payload normalisé et UTC', () => {
  const result = buildEventPayload(future, now)
  assert.equal(result.title, 'Soirée test')
  assert.equal(result.location, 'Nancy')
  assert.equal(result.description, 'Musique et amis')
  assert.equal(result.visibility, 'PUBLIC')
  assert.ok(result.startsAt.endsWith('Z'))
  assert.ok(result.endsAt.endsWith('Z'))
})

test('fin avant début refusée', () => {
  assert.throws(
    () => buildEventPayload({
      ...future,
      endsAt: '2035-06-15 19:00'
    }, now),
    /après le début/
  )
})

test('événement passé refusé', () => {
  assert.throws(
    () => buildEventPayload(
      future,
      new Date('2036-01-01T00:00:00Z')
    ),
    /futur/
  )
})

test('titre invalide refusé', () => {
  assert.throws(
    () => buildEventPayload({
      ...future,
      title: ' '
    }, now),
    /titre/
  )
})
