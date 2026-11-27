import { OfflineHome } from '../offline/OfflineHome'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useSession } from '../../session/SessionProvider'
import { Screen } from '../../ui/Screen'
import { Action, Notice } from '../../ui/Controls'
import { theme } from '../../ui/theme'

export default function Index() {
  const { session, restore } = useSession()

  if (session.status === 'loading') {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        backgroundColor: theme.background
      }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    )
  }

  if (
    session.status === 'error' &&
    session.offlineUserId
  ) {
    return (
      <OfflineHome
        key={session.offlineUserId}
        userId={session.offlineUserId}
      />
    )
  }

  if (session.status === 'error') {
    return (
      <Screen
        title="Connexion indisponible"
        subtitle="Impossible de vérifier la session enregistrée."
      >
        <Notice error>{session.message}</Notice>
        <Action
          label="Réessayer"
          onPress={() => { void restore() }}
        />
      </Screen>
    )
  }

  return session.status === 'authenticated'
    ? <Redirect href="/home" />
    : <Redirect href="/login" />
}
