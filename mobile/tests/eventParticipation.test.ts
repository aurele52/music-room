import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requireEventId,
  requireFriendId
} from '../src/lib/eventParticipation'
import {
  buildEventPayload,
  formatLocalDateTime,
  type EventDraft
} from '../src/lib/eventDraft'

const id = '123e4567-e89b-42d3-a456-426614174000'

test('identifiant événement valide', () => {
  assert.equal(requireEventId(id), id)
})

test('identifiant événement invalide refusé', () => {
  assert.throws(() => requireEventId('invalid'))
})

test('identifiant ami normalisé', () => {
  assert.equal(requireFriendId(` ${id} `), id)
})

test('identifiant ami invalide refusé', () => {
  assert.throws(() => requireFriendId('unknown'))
})

test('formulaire compatible avec un lieu vide', () => {
  const draft: EventDraft = {
    title: 'Soirée',
    description: '',
    location: '',
    startsAt: '2035-05-01 20:00',
    endsAt: '2035-05-01 23:00',
    visibility: 'PUBLIC'
  }

  assert.equal(
    buildEventPayload(
      draft,
      new Date('2035-01-01T00:00:00Z')
    ).location,
    ''
  )
})

test('titre de deux caractères refusé', () => {
  const draft: EventDraft = {
    title: 'AB',
    description: '',
    location: '',
    startsAt: '2035-05-01 20:00',
    endsAt: '2035-05-01 23:00',
    visibility: 'PUBLIC'
  }

  assert.throws(
    () => buildEventPayload(
      draft,
      new Date('2035-01-01T00:00:00Z')
    ),
    /titre/
  )
})

test('formatage local d une date ISO', () => {
  const value = formatLocalDateTime('2035-05-01T20:00:00.000Z')
  assert.match(value, /^2035-05-01 \d{2}:\d{2}$/)
})

test('formatage refuse les dates invalides', () => {
  assert.throws(() => formatLocalDateTime('pas une date'))
})
