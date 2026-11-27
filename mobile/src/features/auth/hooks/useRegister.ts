import { useState } from 'react'
import { useSession } from '../../../session/SessionProvider'
import { api } from '../../../lib/api'
import { useAuthOperation } from './useAuthOperation'

export function useRegister() {
  const { session } = useSession()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const operation = useAuthOperation()

  async function submit() {
    if (!operation.canSubmit() || operation.message) {
      return
    }

    if (name.trim().length < 2 || password.length < 8) {
      operation.setError(
        'Nom : 2 caractères minimum. Mot de passe : 8 minimum.'
      )
      return
    }

    await operation.perform(async current => {
      const result = await api<{ message: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: {
            name: name.trim(),
            email: email.trim(),
            password
          }
        }
      )

      if (!current()) return

      operation.setMessage(result.message)
      setPassword('')
    })
  }

  return {
    session,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    busy: operation.busy,
    error: operation.error,
    message: operation.message,
    submit
  }
}

export type RegisterState =
  ReturnType<typeof useRegister>
