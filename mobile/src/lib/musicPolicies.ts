import { api } from './api'

// Le backend conserve toujours l'autorité finale.

// L'éditeur natif travaille en heure locale, contrairement
// à l'API qui utilise des dates ISO UTC.
import {
  formatLocalDateTime,
  parseLocalDateTime
} from './eventDraft'

export type MusicAccessPolicy = 'PUBLIC' | 'INVITED_ONLY'

export interface MusicPolicies {
  votePolicy: MusicAccessPolicy
  editPolicy: MusicAccessPolicy
  voteWindowStart: string | null
  voteWindowEnd: string | null
  voteLatitude: number | null
  voteLongitude: number | null
  voteRadiusMeters: number | null
}

export interface MusicPolicyForm {
  votePolicy: MusicAccessPolicy
  editPolicy: MusicAccessPolicy
  timeEnabled: boolean
  timeStart: string
  timeEnd: string
  geoEnabled: boolean
  latitude: string
  longitude: string
  radius: string
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validMusicPolicyEventId(
  eventId: string
): boolean {
  return uuid.test(eventId)
}

function requireEventId(eventId: string): string {
  if (!validMusicPolicyEventId(eventId)) {
    throw new Error('Identifiant d’événement invalide')
  }

  return eventId
}

export function isMusicAccessPolicy(
  value: unknown
): value is MusicAccessPolicy {
  return value === 'PUBLIC' || value === 'INVITED_ONLY'
}

export function musicPoliciesToForm(
  policies: MusicPolicies
): MusicPolicyForm {
  return {
    votePolicy: policies.votePolicy,
    editPolicy: policies.editPolicy,
    timeEnabled:
      policies.voteWindowStart !== null &&
      policies.voteWindowEnd !== null,
    timeStart: policies.voteWindowStart ?? '',
    timeEnd: policies.voteWindowEnd ?? '',
    geoEnabled:
      policies.voteLatitude !== null &&
      policies.voteLongitude !== null &&
      policies.voteRadiusMeters !== null,
    latitude: policies.voteLatitude === null
      ? '' : String(policies.voteLatitude),
    longitude: policies.voteLongitude === null
      ? '' : String(policies.voteLongitude),
    radius: policies.voteRadiusMeters === null
      ? '' : String(policies.voteRadiusMeters)
  }
}

function parseIsoDate(value: string): string {
  const date = new Date(value)

  if (
    !value ||
    !Number.isFinite(date.getTime())
  ) {
    throw new Error('Date ou heure invalide')
  }

  return date.toISOString()
}

function parseCoordinate(
  value: string,
  min: number,
  max: number
): number {
  if (!value.trim()) {
    throw new Error('Coordonnées GPS incomplètes')
  }

  const result = Number(value.trim())

  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max
  ) {
    throw new Error('Coordonnées GPS invalides')
  }

  return result
}

export function buildMusicPolicies(
  form: MusicPolicyForm
): MusicPolicies {
  if (
    !isMusicAccessPolicy(form.votePolicy) ||
    !isMusicAccessPolicy(form.editPolicy)
  ) {
    throw new Error('Autorisation musicale invalide')
  }

  let voteWindowStart: string | null = null
  let voteWindowEnd: string | null = null

  if (form.timeEnabled) {
    voteWindowStart = parseIsoDate(form.timeStart)
    voteWindowEnd = parseIsoDate(form.timeEnd)

    if (
      new Date(voteWindowStart).getTime() >=
      new Date(voteWindowEnd).getTime()
    ) {
      throw new Error(
        'La fin de la plage horaire doit suivre son début'
      )
    }
  }

  let voteLatitude: number | null = null
  let voteLongitude: number | null = null
  let voteRadiusMeters: number | null = null

  if (form.geoEnabled) {
    voteLatitude = parseCoordinate(
      form.latitude, -90, 90
    )

    voteLongitude = parseCoordinate(
      form.longitude, -180, 180
    )

    if (!form.radius.trim()) {
      throw new Error('Rayon GPS manquant')
    }

    const radius = Number(form.radius.trim())

    if (
      !Number.isSafeInteger(radius) ||
      radius < 1 ||
      radius > 50000
    ) {
      throw new Error(
        'Le rayon GPS doit être compris entre 1 et 50000 mètres'
      )
    }

    voteRadiusMeters = radius
  }

  return {
    votePolicy: form.votePolicy,
    editPolicy: form.editPolicy,
    voteWindowStart,
    voteWindowEnd,
    voteLatitude,
    voteLongitude,
    voteRadiusMeters
  }
}

export function canEditMusicPolicies(
  organizer: boolean,
  endsAt: string,
  now: Date = new Date()
): boolean {
  const end = new Date(endsAt)

  return (
    organizer &&
    Number.isFinite(end.getTime()) &&
    now < end
  )
}

export async function fetchMusicPolicies(
  eventId: string,
  token: string
): Promise<MusicPolicies> {
  const result = await api<{ policies: MusicPolicies }>(
    `/events/${requireEventId(eventId)}/music-policies`,
    { token }
  )

  return result.policies
}

export async function updateMusicPolicies(
  eventId: string,
  token: string,
  form: MusicPolicyForm
): Promise<MusicPolicies> {
  const body = buildMusicPolicies(form)

  const result = await api<{ policies: MusicPolicies }>(
    `/events/${requireEventId(eventId)}/music-policies`,
    {
      method: 'PUT',
      token,
      body
    }
  )

  return result.policies
}

export function musicPoliciesToLocalForm(
  policies: MusicPolicies
): MusicPolicyForm {
  const form = musicPoliciesToForm(policies)

  return {
    ...form,
    timeStart: form.timeStart
      ? formatLocalDateTime(form.timeStart)
      : '',
    timeEnd: form.timeEnd
      ? formatLocalDateTime(form.timeEnd)
      : ''
  }
}

export function localMusicPolicyFormToApiForm(
  form: MusicPolicyForm
): MusicPolicyForm {
  if (!form.timeEnabled) {
    return {
      ...form,
      timeStart: '',
      timeEnd: ''
    }
  }

  const start = parseLocalDateTime(form.timeStart)
  const end = parseLocalDateTime(form.timeEnd)

  if (!start || !end) {
    throw new Error(
      'Sélectionne deux dates et heures valides.'
    )
  }

  if (start.getTime() >= end.getTime()) {
    throw new Error(
      'La fin de la plage horaire doit suivre son début.'
    )
  }

  return {
    ...form,
    timeStart: start.toISOString(),
    timeEnd: end.toISOString()
  }
}

// TODO : traiter explicitement les heures ambiguës
// lors du passage de l'heure d'été à l'heure d'hiver.
