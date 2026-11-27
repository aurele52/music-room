/**
 * Empêche une ancienne requête de remplacer les
 * données d'une requête plus récente.
 *
 * Le contrôle est effectué après chaque opération
 * asynchrone, y compris dans catch et finally.
 *
 * Aucun polling.
 *
 * TODO : étudier la mutualisation web/mobile.
 */
export function createLatestRequestGate() {
  let generation = 0

  function begin(): () => boolean {
    const current = ++generation
    return () => current === generation
  }

  function invalidate(): void {
    generation++
  }

  return {
    begin,
    invalidate
  }
}
