type Listener = (
  userId: string,
  eventId: string
) => void

const listeners = new Set<Listener>()

export function subscribeSyncChanges(
  listener: Listener
) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function notifySyncChange(
  userId: string,
  eventId: string
) {
  for (const listener of listeners) {
    try {
      listener(userId, eventId)
    } catch {
      console.warn('Notification de synchronisation impossible.')
    }
  }
}

// Les generations empechent une ancienne requete
// de restaurer un cache invalide pendant la synchronisation.

const generations = new Map<string, number>()

function key(userId: string, eventId: string) {
  return `${userId}:${eventId}`
}

export function cacheGeneration(
  userId: string,
  eventId: string
): number {
  return generations.get(key(userId, eventId)) ?? 0
}

export function invalidateCacheGeneration(
  userId: string,
  eventId: string
) {
  generations.set(
    key(userId, eventId),
    cacheGeneration(userId, eventId) + 1
  )
}

let cacheQueue: Promise<void> = Promise.resolve()

export function serializeCache<T>(
  operation: () => Promise<T>
): Promise<T> {
  const result = cacheQueue.then(operation)

  cacheQueue = result.then(
    () => undefined,
    () => undefined
  )

  return result
}

const userGenerations = new Map<string, number>()

export function cacheUserGeneration(userId: string): number {
  return userGenerations.get(userId) ?? 0
}

export function invalidateUserCacheGeneration(userId: string) {
  userGenerations.set(
    userId,
    cacheUserGeneration(userId) + 1
  )
}

let cacheSessionGuard = (_userId: string) => true

export function setCacheSessionGuard(
  guard: (userId: string) => boolean
) {
  cacheSessionGuard = guard
}

export function cacheSessionIsCurrent(
  userId: string
): boolean {
  return cacheSessionGuard(userId)
}
