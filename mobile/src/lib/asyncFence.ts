/**
 * Invalide les résultats d'opérations déjà lancées.
 *
 * Ne prétend pas annuler les requêtes HTTP : seul leur
 * résultat local est ignoré après un changement d'accès.
 */
export function createAsyncFence() {
  let generation = 0

  return {
    capture(): number {
      return generation
    },

    isCurrent(snapshot: number): boolean {
      return snapshot === generation
    },

    invalidate(): void {
      generation++
    }
  }
}
