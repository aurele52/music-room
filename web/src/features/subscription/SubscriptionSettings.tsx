import { useEffect, useState } from 'react'
import type { Auth } from '../auth/useAuth'

type Plan = 'FREE' | 'PREMIUM'

export default function SubscriptionSettings({
  auth
}: { auth: Auth }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function request(next?: Plan) {
    const response = await fetch('/api/subscription', {
      method: next ? 'PATCH' : 'GET',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      ...(next ? {
        body: JSON.stringify({ subscription: next })
      } : {})
    })

    const result = await response.json()

    if (!response.ok) {
      throw Object.assign(
        new Error(result.error || 'Abonnement indisponible'),
        { status: response.status }
      )
    }

    return result.subscription as Plan
  }

  useEffect(() => {
    let active = true

    setPlan(null)
    setError('')

    void request()
      .then(value => {
        if (active) setPlan(value)
      })
      .catch(failure => {
        if (active && !auth.handleProtectedError(failure)) {
          setError(failure.message)
        }
      })

    return () => { active = false }
  }, [auth.token])

  async function change(next: Plan) {
    if (busy || !plan || plan === next) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      setPlan(await request(next))
      setMessage('Abonnement mis à jour.')
    } catch (failure) {
      if (!auth.handleProtectedError(failure)) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Modification impossible'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="profile">
      <h2>Mon abonnement</h2>

      <p className="notice">
        Offre actuelle : {
          plan === 'PREMIUM'
            ? 'Premium'
            : plan === 'FREE'
              ? 'Gratuite'
              : 'Chargement...'
        }
      </p>

      <p>Gratuit : 5 morceaux disponibles.</p>
      <p>Premium : 9 morceaux disponibles.</p>

      <button
        type="button"
        disabled={busy || !plan || plan === 'FREE'}
        onClick={() => void change('FREE')}
      >
        Choisir Gratuit
      </button>

      <button
        type="button"
        disabled={busy || !plan || plan === 'PREMIUM'}
        onClick={() => void change('PREMIUM')}
      >
        Choisir Premium
      </button>

      <p className="notice">
        Abonnement simulé pour le projet étudiant.
        Aucun paiement réel.
      </p>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
