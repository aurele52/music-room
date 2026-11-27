import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceAudioCompletion
} from '../src/features/player/audioCompletion'

test('aucune commande pendant la lecture', () => {
  const state = advanceAudioCompletion(
    'idle', false, true,
    () => {
      assert.fail('Commande prematuree')
    }
  )

  assert.equal(state, 'idle')
})

test('fin de lecture disponible immediatement', () => {
  let calls = 0

  const state = advanceAudioCompletion(
    'idle', true, true,
    () => {
      calls++
      return true
    }
  )

  assert.equal(state, 'sent')
  assert.equal(calls, 1)
})

test('fin de lecture pendant une actualisation', () => {
  const state = advanceAudioCompletion(
    'idle', true, false,
    () => {
      assert.fail('Commande pendant actualisation')
    }
  )

  assert.equal(state, 'pending')
})

test('fin memorisee apres disparition du signal audio', () => {
  const state = advanceAudioCompletion(
    'pending', false, true,
    () => true
  )

  assert.equal(state, 'sent')
})

test('fin toujours en attente si serveur indisponible', () => {
  const state = advanceAudioCompletion(
    'pending', false, false,
    () => {
      assert.fail('Commande indisponible')
    }
  )

  assert.equal(state, 'pending')
})

test('commande non acceptee reste en attente', () => {
  const state = advanceAudioCompletion(
    'idle', true, true,
    () => false
  )

  assert.equal(state, 'pending')
})

test('commande acceptee apres attente', () => {
  let calls = 0

  const first = advanceAudioCompletion(
    'idle', true, true,
    () => {
      calls++
      return false
    }
  )

  const second = advanceAudioCompletion(
    first, false, true,
    () => {
      calls++
      return true
    }
  )

  assert.equal(second, 'sent')
  assert.equal(calls, 2)
})

test('aucune repetition apres envoi', () => {
  const state = advanceAudioCompletion(
    'sent', true, true,
    () => {
      assert.fail('Commande dupliquee')
    }
  )

  assert.equal(state, 'sent')
})

test('plusieurs actualisations ne perdent pas la fin', () => {
  let state = advanceAudioCompletion(
    'idle', true, false,
    () => false
  )

  for (let i = 0; i < 10; i++) {
    state = advanceAudioCompletion(
      state, false, false,
      () => {
        assert.fail('Commande prematuree')
      }
    )
  }

  assert.equal(state, 'pending')

  state = advanceAudioCompletion(
    state, false, true,
    () => true
  )

  assert.equal(state, 'sent')
})

test('chaque nouveau morceau possede son propre etat', () => {
  let calls = 0

  const send = () => {
    calls++
    return true
  }

  const first = advanceAudioCompletion(
    'idle', true, true, send
  )

  const second = advanceAudioCompletion(
    'idle', true, true, send
  )

  assert.equal(first, 'sent')
  assert.equal(second, 'sent')
  assert.equal(calls, 2)
})
