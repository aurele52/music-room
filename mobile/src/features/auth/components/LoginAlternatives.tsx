import { router } from 'expo-router'
import { Action, Notice } from '../../../ui/Controls'
import type { LoginState } from '../hooks/useLogin'

export default function LoginAlternatives({
  state
}: { state: LoginState }) {
  const {
    busy,
    message,
    connectGoogle,
    requestEmailLink
  } = state

  return (
    <>
      <Action
        label="Se connecter avec Google"
        secondary
        disabled={busy}
        onPress={() => { void connectGoogle() }}
      />
      <Action
        label="Créer un compte"
        disabled={busy}
        secondary
        onPress={() => router.push('/register')}
      />
      <Action
        label="Mot de passe oublié"
        secondary
        disabled={busy}
        onPress={() => {
          void requestEmailLink('forgot')
        }}
      />
      <Action
        label="Renvoyer l'e-mail de vérification"
        secondary
        disabled={busy}
        onPress={() => {
          void requestEmailLink('verify')
        }}
      />
      {message ? <Notice>{message}</Notice> : null}
      <Notice>
        Le compte doit être vérifié par email avant la première connexion.
      </Notice>

    </>
  )
}
