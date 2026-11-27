import { StyleSheet, Text, View } from 'react-native'
import { Action, Notice } from '../../ui/Controls'
import { theme } from '../../ui/theme'
import { useSubscription } from './useSubscription'

export default function SubscriptionSettings({
  token
}: { token: string }) {
  const {
    plan,
    loading,
    busy,
    error,
    message,
    change,
    retry
  } = useSubscription(token)

  const disabled = loading || busy || !plan

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mon abonnement</Text>

      <Notice>
        Offre actuelle : {
          loading
            ? 'Chargement…'
            : plan === 'PREMIUM'
              ? 'Premium'
              : plan === 'FREE'
                ? 'Gratuite'
                : 'Indisponible'
        }
      </Notice>

      <Action
        label="Gratuit — 5 morceaux"
        secondary={plan !== 'FREE'}
        disabled={disabled || plan === 'FREE'}
        onPress={() => void change('FREE')}
      />

      <Action
        label="Premium — 9 morceaux"
        secondary={plan !== 'PREMIUM'}
        disabled={disabled || plan === 'PREMIUM'}
        onPress={() => void change('PREMIUM')}
      />

      <Text style={styles.detail}>
        Abonnement simulé. Aucun paiement réel.
      </Text>

      {busy ? (
        <Notice>Modification de l’abonnement…</Notice>
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {!loading && !busy && !plan ? (
        <Action
          label="Réessayer"
          secondary
          onPress={retry}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface
  },
  title: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '800'
  },
  detail: {
    color: theme.muted,
    fontSize: 13
  }
})
