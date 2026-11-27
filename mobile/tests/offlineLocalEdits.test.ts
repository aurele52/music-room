import {
  inspectResolution,
  canCloseSatisfied
} from '../src/lib/offline/conflictResolution'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  prepareOfflineEdit,
  projectPlaylist,
  moveOfflineTrack,
  findPendingForPlaylist,
  prepareCurrentOfflineEdit
} from '../src/lib/offline/localEdits'

import {
  readSnapshot,
  type PlaylistSnapshot
} from '../src/lib/offline/cachePolicy'

import type {
  QueueEntry
} from '../src/lib/offline/queue'

import type {
  MusicPlaylist
} from '../src/lib/musicPlaylists'

const userId = '00112233-4455-4677-8899-aabbccddee01'
const eventId = '00112233-4455-4677-8899-aabbccddee02'
const playlistId = '00112233-4455-4677-8899-aabbccddee03'
const firstId = '00112233-4455-4677-8899-aabbccddee04'
const secondId = '00112233-4455-4677-8899-aabbccddee05'

const now = 1800000000000

const playlist: MusicPlaylist = {
  visibility: 'PUBLIC',
  editPolicy: 'PUBLIC',
  canEdit: true,
  id: playlistId,
  title: 'Jazz',
  description: '',
  revision: 7,
  createdAt: new Date(now).toISOString(),
  items: [
    {
      id: firstId,
      title: 'Take Five',
      artist: 'Dave Brubeck',
      position: 0,
      addedById: userId,
      addedBy: null
    },
    {
      id: secondId,
      title: 'So What',
      artist: 'Miles Davis',
      position: 1,
      addedById: userId,
      addedBy: null
    }
  ]
}

const snapshot: PlaylistSnapshot = {
  cachedAt: now - 1000,
  expiresAt: now + 3600000,
  canQueueEdits: true,
  listing: {
    playlists: [playlist],
    canEdit: false,
    organizer: false,
    finished: false
  }
}

const options = {
  userId,
  eventId,
  playlistId,
  snapshot,
  pending: [],
  now,
  action: {
    type: 'add' as const,
    draft: {
      title: 'Blue in Green',
      artist: 'Miles Davis'
    }
  }
}

function entry(): QueueEntry {
  return {
    ...prepareOfflineEdit(options),
    id: 1,
    createdAt: now
  }
}

test('offline edit: keeps cached server permissions disabled', () => {
  const restored = readSnapshot(
    JSON.stringify(snapshot),
    now
  )

  assert.ok(restored)
  assert.equal(restored.canQueueEdits, true)
  assert.equal(restored.listing.canEdit, false)
  assert.equal(restored.listing.organizer, false)
})

test('offline edit: prepares an addition with base revision', () => {
  const result = prepareOfflineEdit(options)

  assert.equal(result.baseRevision, 7)
  assert.equal(result.action.type, 'add')
})

test('offline edit: projects an addition without mutating cache', () => {
  const before = JSON.stringify(playlist)

  const result = projectPlaylist(
    playlist,
    entry()
  )

  assert.equal(result.status, 'pending')
  assert.equal(result.items.length, 3)
  assert.equal(result.items[2].title, 'Blue in Green')
  assert.equal(result.items[2].pending, true)
  assert.equal(JSON.stringify(playlist), before)
})

test('offline edit: projects removal', () => {
  const result = projectPlaylist(playlist, {
    ...entry(),
    action: {
      type: 'remove',
      itemId: firstId
    }
  })

  assert.deepEqual(
    result.items.map(item => item.id),
    [secondId]
  )

  assert.equal(playlist.items.length, 2)
})

test('offline edit: projects reorder', () => {
  const result = projectPlaylist(playlist, {
    ...entry(),
    action: {
      type: 'reorder',
      itemIds: [secondId, firstId]
    }
  })

  assert.deepEqual(
    result.items.map(item => item.id),
    [secondId, firstId]
  )
})

test('offline edit: refuses missing cached permission', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      canQueueEdits: undefined
    }
  }))
})

test('offline edit: refuses expired snapshot', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    now: snapshot.expiresAt
  }))
})

test('offline edit: refuses duplicate track', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    action: {
      type: 'add',
      draft: {
        title: 'TAKE FIVE',
        artist: 'Dave Brubeck'
      }
    }
  }))
})

test('offline edit: refuses second pending operation', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    pending: [entry()]
  }))
})

test('offline edit: refuses invalid reorder', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    action: {
      type: 'reorder',
      itemIds: [firstId]
    }
  }))
})

test('offline edit: detects changed server revision', () => {
  const result = projectPlaylist({
    ...playlist,
    revision: 8
  }, entry())

  assert.equal(result.status, 'conflict')
  assert.equal(result.items.length, 2)
})

test('offline edit: cancellation restores original view', () => {
  const result = projectPlaylist(playlist)

  assert.equal(result.status, 'clean')
  assert.equal(result.items.length, 2)
  assert.ok(result.items.every(item => !item.pending))
})

test('offline editor: moves track up', () => {
  assert.deepEqual(
    moveOfflineTrack(playlist, secondId, -1),
    {
      type: 'reorder',
      itemIds: [secondId, firstId]
    }
  )
})

test('offline editor: moves track down', () => {
  assert.deepEqual(
    moveOfflineTrack(playlist, firstId, 1),
    {
      type: 'reorder',
      itemIds: [secondId, firstId]
    }
  )
})

test('offline editor: refuses movement outside playlist', () => {
  assert.equal(
    moveOfflineTrack(playlist, firstId, -1),
    null
  )

  assert.equal(
    moveOfflineTrack(playlist, secondId, 1),
    null
  )
})

test('offline editor: refuses unknown track', () => {
  assert.equal(
    moveOfflineTrack(playlist, 'unknown', 1),
    null
  )
})

test('offline editor: isolates pending operations by scope', () => {
  const operation = entry()

  assert.equal(
    findPendingForPlaylist(
      [operation], userId, eventId, playlistId
    ),
    operation
  )

  assert.equal(
    findPendingForPlaylist(
      [operation], 'other-user', eventId, playlistId
    ),
    undefined
  )

  assert.equal(
    findPendingForPlaylist(
      [operation], userId, 'other-event', playlistId
    ),
    undefined
  )

  assert.equal(
    findPendingForPlaylist(
      [operation], userId, eventId, 'other-playlist'
    ),
    undefined
  )
})

test('offline editor: accepts unchanged stored snapshot', () => {
  assert.deepEqual(
    prepareCurrentOfflineEdit(options, snapshot),
    prepareOfflineEdit(options)
  )
})

test('offline editor: refuses deleted snapshot', () => {
  assert.throws(() =>
    prepareCurrentOfflineEdit(options, null)
  )
})

test('offline editor: refuses replaced snapshot', () => {
  assert.throws(() =>
    prepareCurrentOfflineEdit(options, {
      ...snapshot,
      cachedAt: snapshot.cachedAt + 1
    })
  )
})

test('offline editor: refuses changed revision', () => {
  assert.throws(() =>
    prepareCurrentOfflineEdit(options, {
      ...snapshot,
      listing: {
        ...snapshot.listing,
        playlists: [{
          ...playlist,
          revision: 8
        }]
      }
    })
  )
})

test('offline editor: refuses revoked cached permission', () => {
  assert.throws(() =>
    prepareCurrentOfflineEdit(options, {
      ...snapshot,
      canQueueEdits: false
    })
  )
})

function conflicted(): QueueEntry {
  return {
    ...entry(),
    syncState: 'conflict',
    syncStatus: 409,
    syncMessage: 'Revision obsolete'
  }
}

test('offline resolution: detects an already added track', () => {
  const operation = conflicted()

  const current = {
    ...playlist,
    revision: 8,
    items: [
      ...playlist.items,
      {
        ...playlist.items[0],
        id: '00112233-4455-4677-8899-aabbccddee09',
        title: 'Blue in Green',
        artist: 'Miles Davis',
        position: 2
      }
    ]
  }

  assert.equal(
    inspectResolution(operation, current),
    'satisfied'
  )
})

test('offline resolution: permits explicit addition on newer revision', () => {
  assert.equal(
    inspectResolution(conflicted(), {
      ...playlist,
      revision: 8
    }),
    'reapply'
  )
})

test('offline resolution: never reapplies uncertain attempt', () => {
  assert.equal(
    inspectResolution({
      ...entry(),
      syncState: 'attempted'
    }, {
      ...playlist,
      revision: 8
    }),
    'blocked'
  )
})

test('offline resolution: refuses unchanged revision', () => {
  assert.equal(
    inspectResolution(conflicted(), playlist),
    'blocked'
  )
})

test('offline resolution: refuses permission conflict', () => {
  assert.equal(
    inspectResolution({
      ...conflicted(),
      syncStatus: 403
    }, {
      ...playlist,
      revision: 8
    }),
    'blocked'
  )
})

test('offline resolution: detects already removed track', () => {
  assert.equal(
    inspectResolution({
      ...conflicted(),
      action: {
        type: 'remove',
        itemId: firstId
      }
    }, {
      ...playlist,
      revision: 8,
      items: [playlist.items[1]]
    }),
    'satisfied'
  )
})

test('offline resolution: refuses reorder with changed tracks', () => {
  assert.equal(
    inspectResolution({
      ...conflicted(),
      action: {
        type: 'reorder',
        itemIds: [secondId, firstId]
      }
    }, {
      ...playlist,
      revision: 8,
      items: [playlist.items[1]]
    }),
    'blocked'
  )
})

test('offline resolution: permits reorder with same tracks', () => {
  assert.equal(
    inspectResolution({
      ...conflicted(),
      action: {
        type: 'reorder',
        itemIds: [secondId, firstId]
      }
    }, {
      ...playlist,
      revision: 8
    }),
    'reapply'
  )
})

test('offline resolution: detects already applied order', () => {
  assert.equal(
    inspectResolution({
      ...conflicted(),
      action: {
        type: 'reorder',
        itemIds: [secondId, firstId]
      }
    }, {
      ...playlist,
      revision: 8,
      items: [
        playlist.items[1],
        playlist.items[0]
      ]
    }),
    'satisfied'
  )
})

test('offline audit: conflict never projects rejected edits', () => {
  const result = projectPlaylist(
    playlist,
    conflicted()
  )

  assert.equal(result.status, 'conflict')

  assert.deepEqual(
    result.items.map(item => item.id),
    playlist.items.map(item => item.id)
  )

  assert.ok(
    result.items.every(item => !item.pending)
  )
})

function attemptedRemoval(): QueueEntry {
  return {
    ...entry(),
    syncState: 'attempted',
    action: {
      type: 'remove',
      itemId: firstId
    }
  }
}

function satisfiedPlaylist(
  revision = 8
): MusicPlaylist {
  return {
    ...playlist,
    revision,
    items: [playlist.items[1]]
  }
}

test('offline audit: closes satisfied uncertain operation', () => {
  assert.equal(
    canCloseSatisfied(
      attemptedRemoval(),
      satisfiedPlaylist()
    ),
    true
  )
})

test('offline audit: refuses closure at original revision', () => {
  assert.equal(
    canCloseSatisfied(
      attemptedRemoval(),
      satisfiedPlaylist(7)
    ),
    false
  )
})

test('offline audit: refuses unsatisfied closure', () => {
  assert.equal(
    canCloseSatisfied(
      attemptedRemoval(),
      {
        ...playlist,
        revision: 8
      }
    ),
    false
  )
})

test('offline audit: refuses closure of another playlist', () => {
  assert.equal(
    canCloseSatisfied(
      attemptedRemoval(),
      {
        ...satisfiedPlaylist(),
        id: firstId
      }
    ),
    false
  )
})

test('offline audit: pending operation must be cancelled instead', () => {
  assert.equal(
    canCloseSatisfied(
      {
        ...attemptedRemoval(),
        syncState: undefined
      },
      satisfiedPlaylist()
    ),
    false
  )
})

test('offline audit: closes satisfied persistent conflict', () => {
  assert.equal(
    canCloseSatisfied(
      {
        ...attemptedRemoval(),
        syncState: 'conflict',
        syncStatus: 409
      },
      satisfiedPlaylist()
    ),
    true
  )
})

test('offline audit: rejects invalid cache timestamps', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      expiresAt: NaN
    }
  }))

  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      expiresAt: Infinity
    }
  }))
})

test('offline audit: rejects invalid clock', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    now: NaN
  }))

  assert.equal(
    readSnapshot(JSON.stringify(snapshot), NaN),
    null
  )
})

test('offline audit: rejects negative cached timestamp', () => {
  assert.equal(
    readSnapshot(
      JSON.stringify({
        ...snapshot,
        cachedAt: -1,
        expiresAt: 2000
      }),
      1000
    ),
    null
  )
})

test('offline edit: refuses private playlist', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      listing: {
        ...snapshot.listing,
        playlists: [{
          ...playlist,
          visibility: 'PRIVATE'
        }]
      }
    }
  }), /non autorisée/)
})

test('offline edit: refuses individual read-only permission', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      listing: {
        ...snapshot.listing,
        playlists: [{
          ...playlist,
          canEdit: false
        }]
      }
    }
  }), /non autorisée/)
})

test('offline edit: refuses unknown playlist permissions', () => {
  assert.throws(() => prepareOfflineEdit({
    ...options,
    snapshot: {
      ...snapshot,
      listing: {
        ...snapshot.listing,
        playlists: [{
          ...playlist,
          visibility: undefined,
          canEdit: undefined
        }]
      }
    }
  }), /non autorisée/)
})

test('offline cache: removes private playlists on restoration', () => {
  const restored = readSnapshot(JSON.stringify({
    ...snapshot,
    listing: {
      ...snapshot.listing,
      playlists: [
        playlist,
        {
          ...playlist,
          id: '00112233-4455-4677-8899-aabbccddee99',
          visibility: 'PRIVATE'
        }
      ]
    }
  }), now)

  assert.ok(restored)

  assert.deepEqual(
    restored.listing.playlists.map(item => item.id),
    [playlistId]
  )
})
