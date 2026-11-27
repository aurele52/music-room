import { Redirect } from 'expo-router'
import { Screen } from '../../ui/Screen'
import { useRegister } from './hooks/useRegister'
import RegisterForm from './components/RegisterForm'

export default function Register() {
  const state = useRegister()
  const { session } = state

  if (session.status === 'authenticated') {
    return <Redirect href="/home" />
  }

  return (
    <Screen
      title="Créer un compte"
      subtitle="Rejoins Music Room."
    >
      <RegisterForm state={state} />
    </Screen>
  )
}
