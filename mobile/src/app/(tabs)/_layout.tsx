import { Redirect, Tabs } from 'expo-router'
import { Text, StyleSheet, type ColorValue } from 'react-native'
import { useSession } from '../../session/SessionProvider'
import { theme } from '../../ui/theme'

function TabIcon({
  symbol,
  color
}: {
  symbol: string
  color: ColorValue
}) {
  return (
    <Text style={[styles.icon, { color: color ?? theme.muted }]}>
      {symbol}
    </Text>
  )
}

export default function MainTabs() {
  const { session } = useSession()

  // La route racine conserve la gestion des erreurs,
  // de la restauration et du mode hors ligne.
  if (session.status !== 'authenticated') {
    return <Redirect href="/" />
  }

  return (
    <Tabs
      key={session.token}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingTop: 5
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        sceneStyle: {
          backgroundColor: theme.background
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="⌂" color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: 'Événements',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="♫" color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: 'Découvrir',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="⌕" color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="friends"
        options={{
          title: 'Amis',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="♧" color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="◎" color={color} />
          )
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 25,
    fontWeight: '600'
  }
})
