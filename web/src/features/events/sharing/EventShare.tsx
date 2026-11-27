import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validEventId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function buildEventLink(eventId: string): string {
  if (!validEventId(eventId)) {
    throw new Error('Identifiant de soirée invalide')
  }

  // Ne jamais transmettre les paramètres d'authentification,
  // de réinitialisation ou de vérification dans un lien partagé.
  const url = new URL(
    window.location.pathname,
    window.location.origin
  )

  url.searchParams.set('event', eventId)
  return url.toString()
}

export function EventShare({
  eventId
}: {
  eventId: string
}) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  const link = buildEventLink(eventId)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Lien copié.')
    } catch {
      setMessage(
        'Copie automatique indisponible. ' +
        'Sélectionne le lien ci-dessous.'
      )
    }
  }

  return (
    <div className="music-event-share">
      <button
        type="button"
        className="secondary"
        aria-expanded={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible
          ? 'Masquer le partage'
          : 'Partager la soirée'}
      </button>

      {visible && (
        <div className="music-event-share-panel">
          <h4>Rejoindre cette soirée</h4>

          <div className="music-event-share-qr">
            <QRCodeSVG
              value={link}
              size={192}
              marginSize={2}
              title="QR code pour rejoindre la soirée"
            />
          </div>

          <label>
            Lien de la soirée
            <input
              aria-label="Lien de la soirée"
              readOnly
              value={link}
              onFocus={(event) =>
                event.currentTarget.select()
              }
            />
          </label>

          <button
            type="button"
            onClick={() => void copyLink()}
          >
            Copier le lien
          </button>

          {message && <p role="status">{message}</p>}

          <p className="notice">
            Le lien donne accès à la page de la soirée,
            pas à ses permissions. Pour une soirée privée,
            une invitation acceptée reste nécessaire.
          </p>
        </div>
      )}
    </div>
  )
}
