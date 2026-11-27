import { OfflineHome } from '../offline/OfflineHome'
import { Fragment, type ReactNode } from 'react'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useSession } from '../../session/SessionProvider'
import { Screen } from '../../ui/Screen'
import { Action, Notice } from '../../ui/Controls'
import { theme } from '../../ui/theme'

export function Authenticated({
  children
}: {
  children: ReactNode
}) {
  const { session, restore } = useSession()

  if (session.status === 'loading') {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        backgroundColor: theme.background
      }}>
        <ActivityIndicator color={theme.primary} />
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
      <Screen title="Session indisponible">
        <Notice error>{session.message}</Notice>
        <Action
          label="Réessayer"
          onPress={() => { void restore() }}
        />
      </Screen>
    )
  }

  if (session.status === 'guest') {
    return <Redirect href="/login" />
  }

  // Un changement de JWT remonte tous les composants
  // protégés et détruit leur état React précédent.
  // Ne jamais afficher cette clé dans les logs.
  return (
    <Fragment key={session.token}>
      {children}
    </Fragment>
  )
}
