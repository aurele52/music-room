import { Text, View } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import type {
  ResolutionPreview
} from '../../../lib/offline/resolutionService'
import type {
  SynchronisationState
} from '../hooks/useSynchronisation'
import { styles } from './synchronisationStyles'

interface Props {
  preview: ResolutionPreview
  state: SynchronisationState
}

export default function ConflictComparison({
  preview,
  state
}: Props) {
  const {
    busy,
    closeComparison,
    confirmReapply
  } = state

  return (
    <View style={styles.comparison}>
      <Text style={styles.heading}>
        {preview.playlist.title}
      </Text>

      <Text style={styles.detail}>
        Révision serveur : {preview.playlist.revision}
      </Text>

      {preview.playlist.items.map((item, index) => (
        <Text key={item.id} style={styles.detail}>
          {index + 1}. {item.title} — {item.artist}
        </Text>
      ))}

      {preview.resolution === 'satisfied' ? (
        <Notice>
          Le résultat demandé est déjà présent
          sur le serveur.
        </Notice>
      ) : null}

      {preview.canClose ? (
        <Action
          label="Clôturer la modification"
          disabled={busy}
          onPress={() => closeComparison(preview)}
        />
      ) : null}

      {preview.resolution === 'reapply' &&
      preview.canEdit ? (
        <Action
          label="Réappliquer la modification"
          disabled={busy}
          onPress={() => confirmReapply(preview)}
        />
      ) : null}

      {preview.resolution === 'blocked' ? (
        <Notice>
          Réapplication impossible sur cet état
          de la playlist.
        </Notice>
      ) : null}
    </View>
  )
}
