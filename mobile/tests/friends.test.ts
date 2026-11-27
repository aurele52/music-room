import test from 'node:test'
import assert from 'node:assert/strict'
import {
  confirmedFriends,
  type FriendsResponse
} from '../src/lib/friends'

const aliceId = '123e4567-e89b-42d3-a456-426614174001'
const bobId = '123e4567-e89b-42d3-a456-426614174002'
const charlieId = '123e4567-e89b-42d3-a456-426614174003'

const alice = {
  id: aliceId,
  name: 'Alice',
  visibility: 'PUBLIC' as const
}

const bob = {
  id: bobId,
  name: 'Bob',
  visibility: 'PRIVATE' as const
}

const charlie = {
  id: charlieId,
  name: 'Charlie',
  visibility: 'PUBLIC' as const
}

const relation = (
  id: string,
  user: typeof alice | typeof bob | typeof charlie
) => ({
  id,
  user,
  createdAt: '2035-01-01T00:00:00.000Z'
})

function response(
  overrides: Partial<FriendsResponse> = {}
): FriendsResponse {
  return {
    friends: [],
    incoming: [],
    outgoing: [],
    ...overrides
  }
}

test('aucune relation retourne une liste vide', () => {
  assert.deepEqual(confirmedFriends(response()), [])
})

test('seuls les amis confirmes sont proposes', () => {
  const result = confirmedFriends(response({
    friends: [relation('friendship-1', alice)],
    incoming: [relation('friendship-2', bob)],
    outgoing: [relation('friendship-3', charlie)]
  }))

  assert.deepEqual(result.map(user => user.id), [aliceId])
})

test('utilise user.id et non friendship.id', () => {
  const result = confirmedFriends(response({
    friends: [relation('relationship-id', alice)]
  }))

  assert.equal(result[0]?.id, aliceId)
  assert.notEqual(result[0]?.id, 'relationship-id')
})

test('un ami confirme a profil prive reste invitables', () => {
  const result = confirmedFriends(response({
    friends: [relation('friendship-2', bob)]
  }))

  assert.equal(result[0]?.id, bobId)
})

test('ordre alphabetique des noms', () => {
  const result = confirmedFriends(response({
    friends: [
      relation('friendship-2', bob),
      relation('friendship-1', alice)
    ]
  }))

  assert.deepEqual(
    result.map(user => user.name),
    ['Alice', 'Bob']
  )
})

test('dedoublonne par identifiant utilisateur', () => {
  const result = confirmedFriends(response({
    friends: [
      relation('friendship-1', alice),
      relation('friendship-duplicate', alice)
    ]
  }))

  assert.equal(result.length, 1)
})

test('ignore un utilisateur sans identifiant valide', () => {
  const result = confirmedFriends(response({
    friends: [
      relation('friendship-invalid', {
        ...alice,
        id: 'invalid'
      })
    ]
  }))

  assert.equal(result.length, 0)
})

test('ignore un utilisateur sans nom', () => {
  const result = confirmedFriends(response({
    friends: [
      relation('friendship-1', {
        ...alice,
        name: ' '
      })
    ]
  }))

  assert.equal(result.length, 0)
})

test('normalise les espaces des noms', () => {
  const result = confirmedFriends(response({
    friends: [
      relation('friendship-1', {
        ...alice,
        name: '  Alice  '
      })
    ]
  }))

  assert.equal(result[0]?.name, 'Alice')
})

test('refuse une reponse sans tableau friends', () => {
  assert.throws(
    () => confirmedFriends({
      friends: null
    } as unknown as FriendsResponse),
    /Liste d’amis invalide/
  )
})

test('un ami avec visibilité FRIENDS reste invitables', () => {
  const result = confirmedFriends(response({
    friends: [{
      id: 'friendship-friends-visibility',
      user: {
        id: aliceId,
        name: 'Alice',
        visibility: 'FRIENDS'
      },
      createdAt: '2035-01-01T00:00:00.000Z'
    }]
  }))

  assert.equal(result.length, 1)
  assert.equal(result[0]?.id, aliceId)
  assert.equal(result[0]?.visibility, 'FRIENDS')
})
