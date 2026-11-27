const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface OfflineGuard {
  eventId: string
  baseRevision: number
}

export class OfflineGuardError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export function parseOfflineGuard(
  value: unknown
): OfflineGuard | null {
  // Les requetes en ligne ne necessitent pas de garde offline.
  if (value === undefined) return null

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new OfflineGuardError(
      400, 'Modification offline invalide'
    )
  }

  const input = value as Record<string, unknown>

  if (
    typeof input.eventId !== 'string' ||
    !uuid.test(input.eventId) ||
    typeof input.baseRevision !== 'number' ||
    !Number.isSafeInteger(input.baseRevision) ||
    input.baseRevision < 0
  ) {
    throw new OfflineGuardError(
      400, 'Modification offline invalide'
    )
  }

  return {
    eventId: input.eventId,
    baseRevision: input.baseRevision
  }
}

interface CurrentPlaylist {
  eventId: string
  visibility: string
  revision: number
}

export function assertOfflineGuard(
  guard: OfflineGuard | null,
  current: CurrentPlaylist
): void {
  if (!guard) return

  if (guard.eventId !== current.eventId) {
    throw new OfflineGuardError(
      409, 'Événement de référence modifié'
    )
  }

  if (current.visibility !== 'PUBLIC') {
    throw new OfflineGuardError(
      409, 'Événement non disponible hors ligne'
    )
  }

  if (guard.baseRevision !== current.revision) {
    throw new OfflineGuardError(
      409, 'Révision obsolète : modification en conflit'
    )
  }
}
