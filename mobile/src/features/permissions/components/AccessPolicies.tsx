import { View } from 'react-native'
import type { MusicPolicyState } from '../hooks/useMusicPolicy'
import PolicyChoice from './PolicyChoice'
import { styles } from './policyStyles'

export default function AccessPolicies({
  state
}: { state: MusicPolicyState }) {
  const {
    form,
    editable,
    busy,
    update
  } = state

  if (!form) return null

  return (
    <View style={styles.card}>
      <PolicyChoice
        label="Qui peut voter ?"
        current={form.votePolicy}
        disabled={!editable || busy}
        onSelect={value => update('votePolicy', value)}
      />

      <PolicyChoice
        label="Qui peut modifier les playlists ?"
        current={form.editPolicy}
        disabled={!editable || busy}
        onSelect={value => update('editPolicy', value)}
      />
    </View>

  )
}
