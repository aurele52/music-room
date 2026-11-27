import { Platform } from 'react-native'
import Constants from 'expo-constants'

let configured = false

export async function getGoogleIdToken(): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('Connexion Google disponible sur Android.')
  }

  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

  if (!webClientId) {
    throw new Error('Client Google non configuré.')
  }

  // Expo Go ne contient pas le module natif Google.
  // Une compilation Android personnalisee est necessaire.
  if (Constants.executionEnvironment === 'storeClient') {
    throw new Error(
      'Connexion Google indisponible dans Expo Go. ' +
      'Utilise ton email ou installe la version Android de Music Room.'
    )
  }

  const { GoogleSignin } = await import(
    '@react-native-google-signin/google-signin'
  )

  if (!configured) {
    GoogleSignin.configure({ webClientId })
    configured = true
  }

  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true
  })

  const response = await GoogleSignin.signIn()

  if (response.type !== 'success') {
    throw new Error('Connexion Google annulée.')
  }

  const idToken = response.data.idToken

  if (!idToken) {
    throw new Error('Jeton Google introuvable.')
  }

  return idToken
}
