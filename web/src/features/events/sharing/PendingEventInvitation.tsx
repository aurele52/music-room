import { useEffect, useState } from 'react'
import { subscribeAccountRealtime } from '../../../services/realtime/friendsRealtime'

type MyEventInvitation = {
  id: string
  status: 'PENDING' | 'ACCEPTED'
  event: {
    id: string
    title: string
  }
}

type InvitationLookupResponse = {
  invitations: MyEventInvitation[]
}

export default function PendingEventInvitation({
  eventId,
  token,
  onAccepted,
  onUnauthorized
}: {
  eventId: string
  token: string
  onAccepted: () => void
  onUnauthorized: () => void
}) {
  const [invitation, setInvitation] =
    useState<MyEventInvitation | null>(null)

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setInvitation(null)
    setError('')

    void fetch('/api/events/invitations/mine', {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) onUnauthorized()
          return
        }

        if (!response.ok) {
          throw new Error(
            'Impossible de consulter tes invitations.'
          )
        }

        const data =
          await response.json() as InvitationLookupResponse

        if (!active) return

        // Ne consulter que les invitations du compte connecté.
        // Ne jamais effectuer de recherche d'événements privés.
        const match = data.invitations.find(
          (item) =>
            item.event.id === eventId &&
            item.status === 'PENDING'
        )

        setInvitation(match ?? null)
      })
      .catch((reason: unknown) => {
        if (!active) return

        if (
          reason instanceof Error &&
          reason.name === 'AbortError'
        ) return

        setError('Invitations momentanément indisponibles.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [eventId, token, revision, onUnauthorized])

  // Une invitation nouvelle ou retirée réactualise
  // uniquement les invitations du compte authentifié.
  useEffect(() => {
    return subscribeAccountRealtime(
      token,
      'events:changed',
      () => setRevision(value => value + 1)
    )
  }, [token])

  async function accept() {
    if (!invitation || working) return

    setWorking(true)
    setError('')

    try {
      const response = await fetch(
        `/api/events/invitations/${invitation.id}/accept`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (response.status === 401) {
        onUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error('Acceptation impossible')
      }

      // Revalider les droits auprès de l'API après acceptation.
      // Aucun accès n'est accordé sur la seule base du clic.
      onAccepted()
    } catch {
      setError(
        "L'invitation n'a pas pu être acceptée. Réessaie."
      )
      setRevision((value) => value + 1)
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <p role="status">
        Recherche de tes invitations...
      </p>
    )
  }

  if (!invitation) {
    return (
      <div className="music-invitation-direct">
        <p>
          Aucune invitation en attente pour cette soirée
          n'est disponible sur ton compte.
        </p>

        <p>
          Les permissions de participation sont définies
          par l'organisateur de la soirée.
        </p>

        {error && <p role="alert">{error}</p>}

      </div>
    )
  }

  return (
    <div className="music-invitation-direct">
      <h4>Invitation trouvée</h4>

      <p>
        Une invitation à cette soirée est en attente
        sur ton compte.
      </p>

      <button
        type="button"
        disabled={working}
        onClick={() => void accept()}
      >
        {working
          ? 'Acceptation en cours...'
          : 'Accepter mon invitation'}
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  )
}
