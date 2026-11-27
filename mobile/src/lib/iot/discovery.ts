import type { MusicEvent } from '../api'
import { decodeBeacon } from './beacon'

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Notre paquet de 21 octets donne exactement 28 caractères Base64.
export function decodeAdvertisement(
  data: string | null
): string | null {
  if (!data || data.length !== 28) return null

  const bytes = new Uint8Array(21)

  for (let i = 0, j = 0; i < data.length; i += 4) {
    const a = alphabet.indexOf(data[i])
    const b = alphabet.indexOf(data[i + 1])
    const c = alphabet.indexOf(data[i + 2])
    const d = alphabet.indexOf(data[i + 3])

    if ([a, b, c, d].some(value => value < 0)) {
      return null
    }

    bytes[j++] = (a << 2) | (b >> 4)
    bytes[j++] = (b << 4) | (c >> 2)
    bytes[j++] = (c << 6) | d
  }

  return decodeBeacon(bytes)
}

export function isNearbyEvent(
  event: MusicEvent,
  id: string,
  now = Date.now()
): boolean {
  return event.id === id &&
    event.visibility === 'PUBLIC' &&
    Date.parse(event.startsAt) <= now &&
    Date.parse(event.endsAt) > now
}

export function createDiscovery(
  fetchEvent: (id: string) => Promise<MusicEvent>,
  clock: () => number = Date.now
) {
  const attempts = new Map<string, number>()
  const notified = new Set<string>()

  let pending = false
  let nextRequestAt = 0

  return {
    async receive(
      id: string,
      active: () => boolean
    ): Promise<MusicEvent | null> {
      const now = clock()

      if (
        !active() ||
        pending ||
        notified.has(id) ||
        now < nextRequestAt ||
        now < (attempts.get(id) ?? 0)
      ) return null

      // Une seule requête simultanée.
      pending = true

      // Maximum une nouvelle requête toutes les 2 secondes.
      nextRequestAt = now + 2000

      // Attendre 30 secondes avant de retester un événement.
      attempts.set(id, now + 30000)

      if (attempts.size > 128) {
        const oldest = attempts.keys().next().value
        if (oldest !== undefined) attempts.delete(oldest)
      }

      try {
        const event = await fetchEvent(id)

        if (
          !active() ||
          !isNearbyEvent(event, id, clock())
        ) return null

        // Une notification par événement et par session du scanner.
        notified.add(id)

        return event
      } catch {
        // Serveur indisponible, événement supprimé ou accès refusé.
        return null
      } finally {
        pending = false
      }
    }
  }
}
