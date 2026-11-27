import test from 'node:test'
import assert from 'node:assert/strict'
import { parseList } from '../src/features/profile/profilePreferences'

test('preferences : liste vide', () => {
  assert.deepEqual(parseList(''), [])
})

test('preferences : separation par virgules', () => {
  assert.deepEqual(
    parseList('Rock,Jazz,Blues'),
    ['Rock', 'Jazz', 'Blues']
  )
})

test('preferences : suppression des espaces', () => {
  assert.deepEqual(
    parseList(' Rock , Jazz  '),
    ['Rock', 'Jazz']
  )
})

test('preferences : suppression des doublons', () => {
  assert.deepEqual(
    parseList('Rock,Jazz,Rock'),
    ['Rock', 'Jazz']
  )
})

test('preferences : valeurs vides ignorees', () => {
  assert.deepEqual(
    parseList(',,Rock, ,Jazz,,'),
    ['Rock', 'Jazz']
  )
})

test('preferences : casse conservee', () => {
  assert.deepEqual(
    parseList('Rock,rock'),
    ['Rock', 'rock']
  )
})
