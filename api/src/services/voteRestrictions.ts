export type VoteRestrictions = {
  voteWindowStart: Date | null
  voteWindowEnd: Date | null
  voteLatitude: number | null
  voteLongitude: number | null
  voteRadiusMeters: number | null
}

type Input = Record<string, unknown>

function has(data: Input, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function parseDate(value: unknown): Date | null {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new Error('Date invalide')
  }

  const parsed = new Date(value)

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    throw new Error('Date UTC ISO invalide')
  }

  return parsed
}

export function parseVoteRestrictions(
  input: unknown
): Partial<VoteRestrictions> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration invalide')
  }

  const data = input as Input
  const result: Partial<VoteRestrictions> = {}

  const start = has(data, 'voteWindowStart')
  const end = has(data, 'voteWindowEnd')

  if (start !== end) {
    throw new Error('Plage horaire incomplete')
  }

  if (start && end) {
    const a = parseDate(data.voteWindowStart)
    const b = parseDate(data.voteWindowEnd)

    if (
      (a === null) !== (b === null) ||
      (a !== null && b !== null && a >= b)
    ) {
      throw new Error('Plage horaire invalide')
    }

    result.voteWindowStart = a
    result.voteWindowEnd = b
  }

  const keys = [
    'voteLatitude',
    'voteLongitude',
    'voteRadiusMeters'
  ]

  const present = keys.filter(key => has(data, key)).length

  if (present !== 0 && present !== 3) {
    throw new Error('Configuration GPS incomplete')
  }

  if (present === 3) {
    const lat = data.voteLatitude
    const lon = data.voteLongitude
    const radius = data.voteRadiusMeters

    if (lat === null && lon === null && radius === null) {
      result.voteLatitude = null
      result.voteLongitude = null
      result.voteRadiusMeters = null
    } else {
      if (
        typeof lat !== 'number' ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        typeof lon !== 'number' ||
        !Number.isFinite(lon) ||
        lon < -180 ||
        lon > 180 ||
        typeof radius !== 'number' ||
        !Number.isInteger(radius) ||
        radius < 1 ||
        radius > 50000
      ) {
        throw new Error('Zone GPS invalide')
      }

      result.voteLatitude = lat
      result.voteLongitude = lon
      result.voteRadiusMeters = radius
    }
  }

  return result
}

export function isVoteTimeAllowed(
  policy: VoteRestrictions,
  now = new Date()
): boolean {
  const start = policy.voteWindowStart
  const end = policy.voteWindowEnd

  if (start === null && end === null) return true
  if (start === null || end === null) return false

  return now >= start && now <= end
}

export function needsVoteLocation(
  policy: VoteRestrictions
): boolean {
  return (
    policy.voteLatitude !== null ||
    policy.voteLongitude !== null ||
    policy.voteRadiusMeters !== null
  )
}

export function isVoteLocationAllowed(
  policy: VoteRestrictions,
  input: unknown
): boolean {
  if (!needsVoteLocation(policy)) return true

  const lat = policy.voteLatitude
  const lon = policy.voteLongitude
  const radius = policy.voteRadiusMeters

  if (lat === null || lon === null || radius === null) {
    return false
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  const coordinates = input as Input
  const userLat = coordinates.latitude
  const userLon = coordinates.longitude

  if (
    typeof userLat !== 'number' ||
    !Number.isFinite(userLat) ||
    userLat < -90 ||
    userLat > 90 ||
    typeof userLon !== 'number' ||
    !Number.isFinite(userLon) ||
    userLon < -180 ||
    userLon > 180
  ) {
    return false
  }

  const rad = Math.PI / 180
  const dLat = (userLat - lat) * rad
  const dLon = (userLon - lon) * rad

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * rad) *
    Math.cos(userLat * rad) *
    Math.sin(dLon / 2) ** 2

  const distance = 6371000 * 2 *
    Math.asin(Math.sqrt(Math.min(1, a)))

  return distance <= radius
}
