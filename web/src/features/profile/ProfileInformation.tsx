import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Information = {
  publicBio: string
  friendsBio: string
  privateNote: string
}

type Props = {
  request: <T>(
    path: string,
    options?: RequestInit
  ) => Promise<T>
  onAuthError: (error: unknown) => boolean
}

export default function ProfileInformation({
  request,
  onAuthError
}: Props) {
  const [information, setInformation] =
    useState<Information | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    setError('')

    request<{ user: Information }>('/profile/me')
      .then(({ user }) => {
        if (!active) return

        setInformation({
          publicBio: user.publicBio,
          friendsBio: user.friendsBio,
          privateNote: user.privateNote
        })
      })
      .catch(reason => {
        if (!active || onAuthError(reason)) return

        setError(
          reason instanceof Error
            ? reason.message
            : 'Chargement impossible'
        )
      })

    return () => { active = false }
  }, [attempt])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!information || busy) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await request<{
        information: Information
      }>('/profile/me/information', {
        method: 'PUT',
        body: JSON.stringify(information)
      })

      setInformation(result.information)
      setMessage('Informations enregistrées.')
    } catch (reason) {
      if (!onAuthError(reason)) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Enregistrement impossible'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const fields: {
    key: keyof Information
    label: string
  }[] = [
    {
      key: 'publicBio',
      label: 'Présentation publique'
    },
    {
      key: 'friendsBio',
      label: 'Présentation réservée aux amis'
    },
    {
      key: 'privateNote',
      label: 'Note privée'
    }
  ]

  return (
    <section className="profile">
      <h2>Mes informations personnelles</h2>

      <p className="notice">
        La visibilité générale de ton profil reste
        prioritaire. Ta note privée n'est visible
        que par toi.
      </p>

      {error && (
        <p className="error" role="alert">{error}</p>
      )}

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      {information ? (
        <form className="form-content" onSubmit={save}>
          {fields.map(({ key, label }) => (
            <label key={key}>
              {label}
              <input
                type="text"
                value={information[key]}
                maxLength={500}
                disabled={busy}
                onChange={event => {
                  const value = event.target.value

                  setInformation(previous => previous
                    ? { ...previous, [key]: value }
                    : previous
                  )
                }}
              />
            </label>
          ))}

          <button type="submit" disabled={busy}>
            {busy
              ? 'Enregistrement...'
              : 'Enregistrer mes informations'}
          </button>
        </form>
      ) : error ? (
        <button
          type="button"
          onClick={() => setAttempt(value => value + 1)}
        >
          Réessayer
        </button>
      ) : (
        <p>Chargement des informations...</p>
      )}
    </section>
  )
}
