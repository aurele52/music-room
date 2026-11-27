import { router } from 'expo-router'
import { Action, Field, Notice } from '../../../ui/Controls'
import type { RegisterState } from '../hooks/useRegister'

export default function RegisterForm({
  state
}: { state: RegisterState }) {
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    busy,
    error,
    message,
    submit
  } = state

  return (
    <>
      <Field
        label="Nom"
        value={name}
        onChangeText={setName}
        editable={!busy}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Mot de passe (8 caractères minimum)"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        secureTextEntry
        autoComplete="new-password"
      />
      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <Action
        label={busy ? 'Création…' : 'Créer mon compte'}
        disabled={busy || !!message}
        onPress={() => { void submit() }}
      />
      <Action
        label="Retour à la connexion"
        disabled={busy}
        secondary
        onPress={() => router.replace('/login')}
      />

    </>
  )
}
