import type { AppStateStatus } from 'react-native'

export interface ForegroundStateSource {
  // React Native peut retourner null ou undefined au démarrage.
  currentState: string | null | undefined
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void
  ): { remove(): void }
}

/**
 * Rafraîchit après une transition vers le premier plan.
 *
 * Socket.IO peut manquer des notifications lorsque le
 * système suspend l'application.
 *
 * Le GET HTTP rétablit alors l'état serveur.
 *
 * TODO : mesurer le comportement sur appareils réels.
 */
export function subscribeForegroundRefresh(
  source: ForegroundStateSource,
  refresh: () => void
): () => void {
  let previousState = source.currentState
  let disposed = false

  const subscription = source.addEventListener(
    'change',
    nextState => {
      if (disposed) return

      const shouldRefresh =
        nextState === 'active' &&
        previousState !== 'active'

      previousState = nextState

      if (shouldRefresh) {
        refresh()
      }
    }
  )

  return () => {
    if (disposed) return
    disposed = true
    subscription.remove()
  }
}
