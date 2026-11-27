import { Switch, Text, View } from 'react-native'
import { Field, Notice } from '../../../ui/Controls'
import type { MusicPolicyState } from '../hooks/useMusicPolicy'
import { styles } from './policyStyles'

export default function LocationPolicy({
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
          Restriction géographique
        </Text>

        <Switch
          value={form.geoEnabled}
          disabled={!editable || busy}
          onValueChange={value =>
            update('geoEnabled', value)}
        />
      </View>

      <Notice>
        Les utilisateurs doivent se trouver
        dans la zone GPS autorisée pour voter.
      </Notice>

      {form.geoEnabled ? (
        <>
          <Field
            label="Latitude"
            value={form.latitude}
            onChangeText={value =>
              update('latitude', value)}
            keyboardType="numbers-and-punctuation"
            editable={!busy && editable}
            placeholder="48.8566"
          />

          <Field
            label="Longitude"
            value={form.longitude}
            onChangeText={value =>
              update('longitude', value)}
            keyboardType="numbers-and-punctuation"
            editable={!busy && editable}
            placeholder="2.3522"
          />

          <Field
            label="Rayon en mètres (1 à 50000)"
            value={form.radius}
            onChangeText={value =>
              update('radius', value)}
            keyboardType="number-pad"
            editable={!busy && editable}
            placeholder="500"
          />
        </>
      ) : null}
    </View>

  )
}
