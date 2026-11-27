export interface VoteCoordinates {
  latitude: number
  longitude: number
}

export function validateVoteCoordinates(
  input: unknown
): VoteCoordinates {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('Position GPS invalide.')
  }

  const value = input as Record<string, unknown>
  const latitude = value.latitude
  const longitude = value.longitude

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Coordonnées GPS invalides.')
  }

  return { latitude, longitude }
}

/**
 * Refuser une mesure manifestement ancienne ou datée
 * dans le futur. Ne constitue pas une preuve anti-fraude.
 */
export function validatePositionTimestamp(
  timestamp: number,
  now = Date.now()
): void {
  const maxAgeMs = 60_000
  const futureToleranceMs = 10_000

  if (
    !Number.isFinite(timestamp) ||
    timestamp > now + futureToleranceMs ||
    now - timestamp > maxAgeMs
  ) {
    throw new Error(
      'Position GPS trop ancienne ou invalide. Réessaie.'
    )
  }
}

/**
 * Le backend lit latitude et longitude directement
 * depuis req.body, y compris pour DELETE /vote.
 */
export function buildVoteBody(
  requiresLocation: boolean,
  coordinates?: VoteCoordinates
): VoteCoordinates | undefined {
  if (!requiresLocation) return undefined

  if (!coordinates) {
    throw new Error(
      'Une position GPS est nécessaire pour voter.'
    )
  }

  return validateVoteCoordinates(coordinates)
}
