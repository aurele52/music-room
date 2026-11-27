import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMusicPolicies,
  canEditMusicPolicies,
  isMusicAccessPolicy,
  musicPoliciesToForm,
  validMusicPolicyEventId,
  type MusicPolicies,
  type MusicPolicyForm
} from '../src/lib/musicPolicies'

import {
  musicPoliciesToLocalForm,
  localMusicPolicyFormToApiForm
} from '../src/lib/musicPolicies'

const eventId = '12345678-1234-4234-8234-123456789abc'

function base(): MusicPolicyForm {
  return {
    votePolicy: 'PUBLIC',
    editPolicy: 'INVITED_ONLY',
    timeEnabled: false,
    timeStart: '',
    timeEnd: '',
    geoEnabled: false,
    latitude: '',
    longitude: '',
    radius: ''
  }
}

test('identifiant événement UUID', () => {
  assert.equal(validMusicPolicyEventId(eventId), true)
  assert.equal(validMusicPolicyEventId('../test'), false)
})

test('seules deux autorisations existent', () => {
  assert.equal(isMusicAccessPolicy('PUBLIC'), true)
  assert.equal(isMusicAccessPolicy('INVITED_ONLY'), true)
  assert.equal(isMusicAccessPolicy('PRIVATE'), false)
  assert.equal(isMusicAccessPolicy(null), false)
})

test('configuration sans restriction', () => {
  assert.deepEqual(buildMusicPolicies(base()), {
    votePolicy: 'PUBLIC',
    editPolicy: 'INVITED_ONLY',
    voteWindowStart: null,
    voteWindowEnd: null,
    voteLatitude: null,
    voteLongitude: null,
    voteRadiusMeters: null
  })
})

test('restriction horaire UTC', () => {
  const form = base()

  form.timeEnabled = true
  form.timeStart = '2026-11-26T18:00:00.000Z'
  form.timeEnd = '2026-11-26T21:00:00.000Z'

  const result = buildMusicPolicies(form)

  assert.equal(
    result.voteWindowStart,
    '2026-11-26T18:00:00.000Z'
  )
  assert.equal(
    result.voteWindowEnd,
    '2026-11-26T21:00:00.000Z'
  )
})

test('plage horaire invalide rejetée', () => {
  const form = base()

  form.timeEnabled = true
  form.timeStart = '2026-11-26T21:00:00.000Z'
  form.timeEnd = '2026-11-26T18:00:00.000Z'

  assert.throws(() => buildMusicPolicies(form))

  form.timeEnd = 'date-invalide'
  assert.throws(() => buildMusicPolicies(form))
})

test('restriction GPS valide', () => {
  const form = base()

  form.geoEnabled = true
  form.latitude = '48.8566'
  form.longitude = '2.3522'
  form.radius = '500'

  const result = buildMusicPolicies(form)

  assert.equal(result.voteLatitude, 48.8566)
  assert.equal(result.voteLongitude, 2.3522)
  assert.equal(result.voteRadiusMeters, 500)
})

test('restriction GPS invalide rejetée', () => {
  const form = base()
  form.geoEnabled = true
  form.latitude = '91'
  form.longitude = '2'
  form.radius = '100'

  assert.throws(() => buildMusicPolicies(form))

  form.latitude = '48'
  form.radius = '50001'
  assert.throws(() => buildMusicPolicies(form))

  form.radius = '10.5'
  assert.throws(() => buildMusicPolicies(form))

  form.radius = ''
  assert.throws(() => buildMusicPolicies(form))
})

test('conversion depuis les valeurs serveur', () => {
  const data: MusicPolicies = {
    votePolicy: 'INVITED_ONLY',
    editPolicy: 'PUBLIC',
    voteWindowStart: '2026-11-26T18:00:00.000Z',
    voteWindowEnd: '2026-11-26T20:00:00.000Z',
    voteLatitude: 48.8566,
    voteLongitude: 2.3522,
    voteRadiusMeters: 100
  }

  const form = musicPoliciesToForm(data)

  assert.equal(form.timeEnabled, true)
  assert.equal(form.geoEnabled, true)
  assert.equal(form.latitude, '48.8566')
  assert.deepEqual(buildMusicPolicies(form), data)
})

test('aucune modification après la fin', () => {
  const now = new Date('2026-11-26T20:00:00.000Z')

  assert.equal(
    canEditMusicPolicies(
      true,
      '2026-11-26T21:00:00.000Z',
      now
    ),
    true
  )

  assert.equal(
    canEditMusicPolicies(
      false,
      '2026-11-26T21:00:00.000Z',
      now
    ),
    false
  )

  assert.equal(
    canEditMusicPolicies(
      true,
      '2026-11-26T20:00:00.000Z',
      now
    ),
    false
  )
})

test('aller-retour UTC et heure locale', () => {
  const data: MusicPolicies = {
    votePolicy: 'PUBLIC',
    editPolicy: 'INVITED_ONLY',
    voteWindowStart: '2026-11-26T18:00:00.000Z',
    voteWindowEnd: '2026-11-26T21:00:00.000Z',
    voteLatitude: null,
    voteLongitude: null,
    voteRadiusMeters: null
  }

  const local = musicPoliciesToLocalForm(data)
  const utc = localMusicPolicyFormToApiForm(local)

  assert.deepEqual(buildMusicPolicies(utc), data)
})

test('date locale impossible rejetée', () => {
  const form = base()
  form.timeEnabled = true
  form.timeStart = '2026-02-30 19:00'
  form.timeEnd = '2026-03-01 21:00'

  assert.throws(() =>
    localMusicPolicyFormToApiForm(form)
  )
})

test('restriction horaire désactivée', () => {
  const form = base()
  form.timeStart = 'date invalide'
  form.timeEnd = 'date invalide'

  const result = localMusicPolicyFormToApiForm(form)

  assert.equal(result.timeStart, '')
  assert.equal(result.timeEnd, '')
  assert.equal(buildMusicPolicies(result).voteWindowStart, null)
})
