import { Redirect } from 'expo-router'
import { OfflineHome } from '../offline/OfflineHome'
import { Screen } from '../../ui/Screen'
import { useLogin } from './hooks/useLogin'
import LoginForm from './components/LoginForm'
import LoginAlternatives from './components/LoginAlternatives'

export default function Login() {
  const state = useLogin()
  const { session } = state

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

  if (session.status === 'authenticated') {
    return <Redirect href="/home" />
  }


  return (
    <Screen
      title="Connexion"
      subtitle="Retrouve tes événements et ta musique."
    >
      <LoginForm state={state} />
      <LoginAlternatives state={state} />
    </Screen>
  )
}
