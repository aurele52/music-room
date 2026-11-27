import { router } from 'expo-router'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import type {
  SynchronisationState
} from '../hooks/useSynchronisation'
import PendingOperationCard from './PendingOperationCard'

export default function SynchronisationContent({
  state
}: { state: SynchronisationState }) {
  const {
    token,
    entries,
    busy,
    loading,
    error,
    message,
    synchronizeNow,
    reload
  } = state

  return (
    <Screen
      title="Synchronisation"
      subtitle="Modifications locales et conflits"
    >
      <Action
        label="Retour"
        secondary
        onPress={() => router.replace(
          token ? '/events' : '/'
        )}
      />

      {!token ? (
        <Notice>
          Mode hors ligne. Les comparaisons avec le
          serveur nécessitent une connexion vérifiée.
        </Notice>
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {loading ? (
        <Notice>Lecture des opérations locales…</Notice>
      ) : null}

      {!loading && entries.length === 0 ? (
        <Notice>Aucune modification en attente.</Notice>
      ) : null}


      {entries.map(entry => (
        <PendingOperationCard
          key={entry.id}
          entry={entry}
          state={state}
        />
      ))}

      <Action
        label={busy
          ? 'Traitement en cours…'
          : 'Synchroniser maintenant'}
        disabled={!token || busy || loading}
        onPress={synchronizeNow}
      />

      <Action
        label="Actualiser les opérations locales"
        secondary
        disabled={busy}
        onPress={reload}
      />
    </Screen>
  )
}
