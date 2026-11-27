import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatLocalDateTime,
  parseLocalDateTime,
  suggestedEventDate,
  withCalendarDate,
  withClockTime
} from '../src/lib/eventDraft'

test('changement de date conserve heure et minute', () => {
  const current = new Date(2035, 5, 15, 20, 45)
  const selected = new Date(2035, 6, 19, 8, 10)

  const result = withCalendarDate(current, selected)

  assert.equal(result.getFullYear(), 2035)
  assert.equal(result.getMonth(), 6)
  assert.equal(result.getDate(), 19)
  assert.equal(result.getHours(), 20)
  assert.equal(result.getMinutes(), 45)
})

test('changement heure conserve jour et mois', () => {
  const current = new Date(2035, 5, 15, 20, 45)
  const selected = new Date(2035, 7, 20, 14, 30)

  const result = withClockTime(current, selected)

  assert.equal(result.getMonth(), 5)
  assert.equal(result.getDate(), 15)
  assert.equal(result.getHours(), 14)
  assert.equal(result.getMinutes(), 30)
})

test('suggestion debut est dans le futur', () => {
  const now = new Date(2035, 5, 15, 20, 40)
  const result = suggestedEventDate('start', now)

  assert.ok(result.getTime() > now.getTime())
  assert.equal(result.getMinutes(), 0)
})

test('suggestion fin est apres debut', () => {
  const now = new Date(2035, 5, 15, 20, 40)

  const start = suggestedEventDate('start', now)
  const end = suggestedEventDate('end', now)

  assert.ok(end.getTime() > start.getTime())
})

test('formatage et parsing conservent heure locale', () => {
  const original = new Date(2035, 5, 15, 20, 45)

  const formatted = formatLocalDateTime(original.toISOString())
  const parsed = parseLocalDateTime(formatted)

  assert.ok(parsed)
  assert.equal(parsed.getHours(), 20)
  assert.equal(parsed.getMinutes(), 45)
})

test('format local conserve les minutes à deux chiffres', () => {
  const original = new Date(2035, 5, 15, 8, 5)
  const result = formatLocalDateTime(original.toISOString())

  assert.match(result, /08:05$/)
})

test('années et mois correctement formatés', () => {
  const original = new Date(2035, 0, 9, 8, 5)
  const result = formatLocalDateTime(original.toISOString())

  assert.equal(result, '2035-01-09 08:05')
})

test('passage au jour suivant conservé', () => {
  const current = new Date(2035, 5, 15, 23, 30)
  const next = new Date(2035, 5, 16, 12, 0)

  const result = withCalendarDate(current, next)

  assert.equal(result.getDate(), 16)
  assert.equal(result.getHours(), 23)
})
