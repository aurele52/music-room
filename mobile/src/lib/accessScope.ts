/**
 * Identité d'un écran contenant des données privées.
 *
 * Changer de JWT ou d'événement force React à démonter
 * l'ancien écran et à créer un état local neuf.
 *
 * Cette clé reste interne à React. Ne jamais la journaliser.
 */
export function accessScopeKey(
  token: string | null | undefined,
  eventId: string
): string {
  return JSON.stringify([token ?? null, eventId])
}
