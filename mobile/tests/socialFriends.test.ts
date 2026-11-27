import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeSearchQuery,
  relationStatus,
  canRequestFriend,
  validSocialId,
  type SocialLists,
  type SearchUser
} from '../src/lib/socialFriends'

const alice =
  '12345678-1234-4234-8234-123456789abc'

const bob =
  '12345678-1234-4234-8234-123456789abd'

const charlie =
  '12345678-1234-4234-8234-123456789abe'

function empty(): SocialLists {
  return {
    friends: [],
    incoming: [],
    outgoing: []
  }
}

function user(
  id: string,
  visibility: SearchUser['visibility'] = 'PUBLIC'
): SearchUser {
  return {
    id,
    name: 'Utilisateur',
    visibility,
    createdAt: '2026-11-26T12:00:00.000Z'
  }
}

function relation(id: string, userId: string) {
  return {
    id,
    user: {
      id: userId,
      name: 'Utilisateur',
      visibility: 'PUBLIC' as const
    },
    createdAt: '2026-11-26T12:00:00.000Z'
  }
}

test('UUID valides et invalides', () => {
  assert.equal(validSocialId(alice), true)
  assert.equal(validSocialId('../users'), false)
})

test('recherche : espaces périphériques supprimés', () => {
  assert.equal(
    normalizeSearchQuery('  Alice  '),
    'Alice'
  )
})

test('recherche : taille minimale et maximale', () => {
  assert.throws(() => normalizeSearchQuery('A'))
  assert.doesNotThrow(() =>
    normalizeSearchQuery('A'.repeat(50))
  )
  assert.throws(() =>
    normalizeSearchQuery('A'.repeat(51))
  )
})

test('recherche : caractères de contrôle refusés', () => {
  assert.throws(() =>
    normalizeSearchQuery('Alice\nBob')
  )
  assert.throws(() =>
    normalizeSearchQuery('Alice\u0000Bob')
  )
})

test('absence de relation', () => {
  assert.equal(
    relationStatus(empty(), alice),
    'NONE'
  )
})

test('différencier amis, reçues et envoyées', () => {
  const lists = empty()

  lists.friends.push(relation(alice, alice))
  lists.incoming.push(relation(bob, bob))
  lists.outgoing.push(relation(charlie, charlie))

  assert.equal(relationStatus(lists, alice), 'FRIEND')
  assert.equal(relationStatus(lists, bob), 'INCOMING')
  assert.equal(relationStatus(lists, charlie), 'OUTGOING')
})

test('une demande exige un profil public sans relation', () => {
  const lists = empty()

  assert.equal(
    canRequestFriend(user(alice), lists),
    true
  )
  assert.equal(
    canRequestFriend(user(alice, 'PRIVATE'), lists),
    false
  )
  assert.equal(
    canRequestFriend(user(alice, 'FRIENDS'), lists),
    false
  )

  lists.outgoing.push(relation(bob, alice))

  assert.equal(
    canRequestFriend(user(alice), lists),
    false
  )
})

test('demande impossible si déjà ami ou invitation reçue', () => {
  const lists = empty()
  lists.friends.push(relation(bob, alice))

  assert.equal(
    canRequestFriend(user(alice), lists),
    false
  )

  lists.friends = []
  lists.incoming.push(relation(charlie, alice))

  assert.equal(
    canRequestFriend(user(alice), lists),
    false
  )
})
