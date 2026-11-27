import { Text, View } from 'react-native'
import { Action } from '../../../ui/Controls'
import type { MusicAccessPolicy } from '../../../lib/musicPolicies'
import { styles } from './policyStyles'

export default function PolicyChoice({
  label,
  current,
  disabled,
  onSelect
}: {
  label: string
  current: MusicAccessPolicy
  disabled: boolean
  onSelect: (value: MusicAccessPolicy) => void
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{label}</Text>

      <Action
        label="Tous les utilisateurs autorisés"
        secondary={current !== 'PUBLIC'}
        disabled={disabled}
        onPress={() => onSelect('PUBLIC')}
      />

      <Action
        label="Participants invités uniquement"
        secondary={current !== 'INVITED_ONLY'}
        disabled={disabled}
        onPress={() => onSelect('INVITED_ONLY')}
      />
    </View>
  )
}
