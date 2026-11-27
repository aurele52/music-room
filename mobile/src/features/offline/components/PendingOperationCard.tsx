import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type { QueueEntry } from '../../../lib/offline/queue'
import {
  describeOperation
} from '../../../lib/offline/conflictResolution'
import type {
  SynchronisationState
} from '../hooks/useSynchronisation'
import ConflictComparison from './ConflictComparison'
import { styles } from './synchronisationStyles'

function statusLabel(entry: QueueEntry): string {
  if (entry.syncState === 'attempted') {
    return 'Envoi tenté — résultat incertain'
  }

  if (entry.syncState === 'conflict') {
    return `Conflit — HTTP ${entry.syncStatus}`
  }

  return 'En attente'
}


interface Props {
  entry: QueueEntry
  state: SynchronisationState
}

export default function PendingOperationCard({
  entry,
  state
}: Props) {
  const {
    token,
    preview,
    busy,
    compareEntry,
    confirmDiscard
  } = state

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {describeOperation(entry)}
      </Text>

      <Text style={styles.detail}>
        {statusLabel(entry)}
      </Text>

      <Text style={styles.detail}>
        Révision locale : {entry.baseRevision}
      </Text>

      <Text style={styles.detail}>
        Enregistrée le :
        {' '}{new Date(entry.createdAt).toLocaleString('fr-FR')}
      </Text>

      <Text style={styles.detail}>
        Playlist : {entry.playlistId}
      </Text>

      {entry.syncMessage ? (
        <Notice error>{entry.syncMessage}</Notice>
      ) : null}

      {token ? (
        <Action
          label="Comparer avec le serveur"
          secondary
          disabled={busy}
          onPress={() => compareEntry(entry.id)}
        />
      ) : null}

      {preview?.entry.id === entry.id ? (
        <ConflictComparison
          preview={preview}
          state={state}
        />
      ) : null}

      {entry.syncState !== 'attempted' ? (
        <Action
          label={entry.syncState === 'conflict'
            ? 'Conserver la version serveur'
            : 'Annuler la modification'}
          secondary
          disabled={busy}
          onPress={() => confirmDiscard(entry)}
        />
      ) : null}
    </View>
  )
}
