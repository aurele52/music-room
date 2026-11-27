import { Action, Field, Notice } from '../../../ui/Controls'
import type { LoginState } from '../hooks/useLogin'

export default function LoginForm({
  state
}: { state: LoginState }) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    busy,
    submit
  } = state

  return (
    <>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        secureTextEntry
        autoComplete="current-password"
      />
      {error ? <Notice error>{error}</Notice> : null}
      <Action
        label={busy ? 'Connexion…' : 'Se connecter'}
        disabled={busy}
        onPress={() => { void submit() }}
      />

    </>
  )
}
