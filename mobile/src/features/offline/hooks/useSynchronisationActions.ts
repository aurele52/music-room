import { Alert } from 'react-native'
import { errorMessage } from '../../../lib/api'
import {
  compareOperation,
  reapplyOperation,
  discardOperation,
  closeSatisfiedOperation,
  type ResolutionPreview
} from '../../../lib/offline/resolutionService'
import {
  synchronizePendingOperations
} from '../../../lib/offline/syncService'
import type { QueueEntry } from '../../../lib/offline/queue'
import type { SynchronisationData } from './useSynchronisationData'

export function useSynchronisationActions(
  data: SynchronisationData
) {
  const {
    token,
    userId,
    current,
    active,
    busyRef,
    screenFence,
    comparisonFence,
    entries,
    preview,
    setBusy,
    setError,
    setMessage,
    setPreview,
    refresh
  } = data

  function available(): boolean {
    return (
      !busyRef.current &&
      active.current &&
      current()
    )
  }

  async function perform(
    operation: (
      uiCurrent: () => boolean
    ) => Promise<void>
  ) {
    if (!available()) return

    const snapshot = screenFence.capture()

    const uiCurrent = () =>
      active.current &&
      current() &&
      screenFence.isCurrent(snapshot)

    comparisonFence.invalidate()

    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation(uiCurrent)
    } catch (failure) {
      if (uiCurrent()) {
        setError(errorMessage(failure))
      }
    } finally {
      // La requete conserve son verrou jusqu'a sa fin.
      busyRef.current = false

      if (active.current && current()) {
        setBusy(false)
        await refresh()
      }
    }
  }

  async function synchronize(
    uiCurrent: () => boolean
  ) {
    if (!token || !current()) return

    const report = await synchronizePendingOperations(
      userId,
      token,
      current
    )

    if (!uiCurrent()) return

    setPreview(null)

    if (report.stopped === 'busy') {
      setMessage('Synchronisation déjà en cours.')
      return
    }

    setMessage(
      `${report.synced.length} modification(s) synchronisée(s), ` +
      `${report.conflicts.length} nouveau(x) conflit(s).`
    )

    if (report.stopped) {
      setError(
        'Synchronisation interrompue. ' +
        'Les opérations restantes sont conservées.'
      )
    }
  }

  function synchronizeNow() {
    if (!token) return

    void perform(async uiCurrent => {
      setPreview(null)
      await synchronize(uiCurrent)
    })
  }

  function compareEntry(id: number) {
    if (
      !token ||
      !entries.some(entry => entry.id === id)
    ) return

    void perform(async uiCurrent => {
      setPreview(null)

      const snapshot = comparisonFence.capture()

      const result = await compareOperation(
        userId,
        id,
        token,
        current
      )

      if (
        uiCurrent() &&
        comparisonFence.isCurrent(snapshot)
      ) {
        setPreview(result)
      }
    })
  }

  function closeComparison(comparison: ResolutionPreview) {
    if (
      !token ||
      preview !== comparison ||
      !comparison.canClose
    ) return

    void perform(async uiCurrent => {
      setPreview(null)

      await closeSatisfiedOperation(
        userId,
        comparison.entry.id,
        comparison.playlist.revision,
        token,
        current
      )

      if (uiCurrent()) {
        setMessage(
          'Résultat confirmé sur le serveur. Modification locale clôturée.'
        )
      }
    })
  }

  // Une confirmation ne doit pas survivre a une
  // modification locale ou a un changement d'ecran.
  function confirmationCurrent() {
    const screen = screenFence.capture()
    const comparison = comparisonFence.capture()

    return () =>
      available() &&
      screenFence.isCurrent(screen) &&
      comparisonFence.isCurrent(comparison)
  }

  function confirmDiscard(entry: QueueEntry) {
    if (
      !available() ||
      entry.syncState === 'attempted' ||
      !entries.includes(entry)
    ) return

    const confirmed = confirmationCurrent()

    Alert.alert(
      'Abandonner la modification ?',
      'Seule la modification locale sera retirée. ' +
      'Une opération déjà exécutée sur le serveur ne sera pas annulée.',
      [
        {
          text: 'Retour',
          style: 'cancel'
        },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => {
            if (!confirmed()) return

            void perform(async uiCurrent => {
              setPreview(null)

              await discardOperation(
                userId,
                entry.id,
                current
              )

              if (uiCurrent()) {
                setMessage('Modification locale retirée.')
              }
            })
          }
        }
      ]
    )
  }

  function confirmReapply(comparison: ResolutionPreview) {
    if (
      !token ||
      !available() ||
      preview !== comparison ||
      comparison.resolution !== 'reapply' ||
      !comparison.canEdit
    ) return

    const confirmed = confirmationCurrent()

    Alert.alert(
      'Confirmer la réapplication',
      'La modification sera envoyée avec la nouvelle révision.',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Confirmer',
          onPress: () => {
            if (!confirmed()) return

            void perform(async uiCurrent => {
              setPreview(null)

              await reapplyOperation(
                userId,
                comparison.entry.id,
                comparison.playlist.revision,
                token,
                current
              )

              // Terminer le traitement metier si la
              // session est toujours autorisee.
              if (!current()) return

              await synchronize(uiCurrent)
            })
          }
        }
      ]
    )
  }

  return {
    compareEntry,
    synchronizeNow,
    closeComparison,
    confirmDiscard,
    confirmReapply
  }
}
