import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSession } from '../../session/SessionProvider'
import { Authenticated } from '../auth/Authenticated'
import { Screen } from '../../ui/Screen'
import { Action } from '../../ui/Controls'
import { theme } from '../../ui/theme'

function DashboardContent() {
  const { session } = useSession()

  if (session.status !== 'authenticated') {
    return null
  }

  return (
    <Screen
      title={`Bonjour, ${session.user.name}`}
      subtitle="Organise tes soirées et partage ta musique."
    >
      <View style={styles.card}>
        <Text style={styles.heading}>
          Ta prochaine soirée
        </Text>

        <Action
          label="Créer un événement"
          onPress={() => router.push('/event/new')}
        />

        <Action
          label="Découvrir les événements publics"
          secondary
          onPress={() => router.navigate('/discover')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          Ton espace
        </Text>

        <Action
          label="Mes événements"
          secondary
          onPress={() => router.navigate('/events')}
        />

        <Action
          label="Mes invitations"
          secondary
          onPress={() => router.push('/invitations')}
        />

        <Action
          label="Synchronisation"
          secondary
          onPress={() => router.push('/synchronisation')}
        />
      </View>
    </Screen>
  )
}

export default function DashboardScreen() {
  return (
    <Authenticated>
      <DashboardContent />
    </Authenticated>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12
  },
  heading: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.text
  }
})
