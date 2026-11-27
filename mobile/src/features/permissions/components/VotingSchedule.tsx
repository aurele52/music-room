import { Switch, Text, View } from 'react-native'
import { Notice } from '../../../ui/Controls'
import { DateTimeField } from '../../../ui/DateTimeField'
import type { MusicPolicyState } from '../hooks/useMusicPolicy'
import { styles } from './policyStyles'

export default function VotingSchedule({
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
      <View style={styles.toggle}>
        <Text style={styles.heading}>
          Restriction horaire
        </Text>

        <Switch
          value={form.timeEnabled}
          disabled={!editable || busy}
          onValueChange={value =>
            update('timeEnabled', value)}
        />
      </View>

      <Notice>
        Limite les votes à une plage horaire.
        Les heures affichées sont locales au téléphone.
      </Notice>

      {form.timeEnabled ? (
        <>
          <DateTimeField
            label="Début des votes"
            kind="start"
            value={form.timeStart}
            disabled={!editable || busy}
            onChangeText={value =>
              update('timeStart', value)}
          />

          <DateTimeField
            label="Fin des votes"
            kind="end"
            value={form.timeEnd}
            disabled={!editable || busy}
            onChangeText={value =>
              update('timeEnd', value)}
          />
        </>
      ) : null}
    </View>

  )
}
