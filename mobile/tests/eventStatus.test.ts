import test from 'node:test'
import assert from 'node:assert/strict'
import {
  participationStatusLabel,
  participationActionLabel
} from '../src/lib/eventStatus'

test('statut en attente', () => {
  assert.equal(
    participationStatusLabel('PENDING'),
    'En attente'
  )
})

test('statut accepté', () => {
  assert.equal(
    participationStatusLabel('ACCEPTED'),
    'Acceptée'
  )
})

test('statut refusé', () => {
  assert.equal(
    participationStatusLabel('REJECTED'),
    'Refusée'
  )
})

test('statut inconnu', () => {
  assert.equal(
    participationStatusLabel('UNKNOWN'),
    'Statut inconnu'
  )
})

test('action pour invitation en attente', () => {
  assert.equal(
    participationActionLabel('PENDING'),
    'Refuser l’invitation'
  )
})

test('action pour invitation acceptée', () => {
  assert.equal(
    participationActionLabel('ACCEPTED'),
    'Quitter cet événement'
  )
})
