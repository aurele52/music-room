import { useState } from 'react'
import { useSession } from '../../../session/SessionProvider'
import { api } from '../../../lib/api'
import { getGoogleIdToken } from '../../../lib/googleSignIn'
import { useAuthOperation } from './useAuthOperation'

export function useLogin() {
  const { session, login, loginGoogle } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const operation = useAuthOperation()

  async function submit() {
    if (!operation.canSubmit()) return

    operation.setMessage('')

    if (!email.trim() || !password) {
      operation.setError(
        'Renseigne ton email et ton mot de passe.'
      )
      return
    }

    await operation.perform(async () => {
      await login(email.trim(), password)
    })
  }

  async function connectGoogle() {
    await operation.perform(async current => {
      const credential = await getGoogleIdToken()

      // Le compte ou l'ecran peut avoir change
      // pendant l'ouverture de Google Sign-In.
      if (!current()) return

      await loginGoogle(credential)
    })
  }

  async function requestEmailLink(
    kind: 'forgot' | 'verify'
  ) {
    if (!operation.canSubmit()) return

    const address = email.trim()

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      operation.setError(
        'Renseigne une adresse e-mail valide.'
      )
      return
    }

    await operation.perform(async current => {
      const path = kind === 'forgot'
        ? '/auth/forgot-password'
        : '/auth/resend-verification'

      const result = await api<{ message: string }>(
        path,
        {
          method: 'POST',
          body: { email: address }
        }
      )

      if (!current()) return

      operation.setMessage(
        result.message +
        ' Ouvre le lien reçu dans ton navigateur.'
      )
    })
  }

  return {
    session,
    email,
    setEmail,
    password,
    setPassword,
    busy: operation.busy,
    error: operation.error,
    message: operation.message,
    submit,
    connectGoogle,
    requestEmailLink
  }
}

export type LoginState =
  ReturnType<typeof useLogin>
