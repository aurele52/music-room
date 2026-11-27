import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { configureMobileLogging } from '../lib/api'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '../session/SessionProvider'
import { theme } from '../ui/theme'
import NearbyEvents from '../features/discovery/NearbyEvents'

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background }
      }} />
      <NearbyEvents />
    </SessionProvider>
  )
}


// Métadonnées requises par le mandatory.
// Aucun accès au réseau n'est effectué ici.
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  const nativeConstants = Platform.constants as {
    Model?: string
    model?: string
  }

  configureMobileLogging({
    platform: Platform.OS,
    device:
      nativeConstants.Model ??
      nativeConstants.model ??
      'unknown',
    version: Constants.expoConfig?.version ?? '1.0.0'
  })
}
