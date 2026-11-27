import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSessionControl,
  currentSessionTrack,
  validSessionEventId,
  type MusicSession
} from '../src/lib/musicSessions'

const eventId =
  '12345678-1234-4234-8234-123456789abc'

test('identifiant UUID valide', () => {
  assert.equal(validSessionEventId(eventId), true)
  assert.equal(validSessionEventId('../events'), false)
})

test('les commandes conservent la revision', () => {
  assert.deepEqual(buildSessionControl('play', 7), {
    action: 'play',
    revision: 7
  })

  for (const action of ['pause', 'next', 'ended', 'stop'] as const) {
    assert.deepEqual(buildSessionControl(action, 7), {
      action,
      revision: 7
    })
  }
})

test('les revisions invalides sont rejetees', () => {
  assert.throws(() => buildSessionControl('next', -1))
  assert.throws(() => buildSessionControl('next', 1.5))
})

test('morceau courant et session absente', () => {
  assert.equal(currentSessionTrack(null), null)

  const session = {
    currentIndex: 1,
    items: [
      {
        id: 'a',
        title: 'A',
        artist: 'Artiste A',
        position: 0
      },
      {
        id: 'b',
        title: 'B',
        artist: 'Artiste B',
        position: 1
      }
    ]
  } as MusicSession

  assert.equal(currentSessionTrack(session)?.title, 'B')

  session.currentIndex = 5
  assert.equal(currentSessionTrack(session), null)
})
