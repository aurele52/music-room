import { useMusicPolicy } from './hooks/useMusicPolicy'
import AccessPolicy from './components/AccessPolicy'
import TimeRestriction from './components/TimeRestriction'
import GeographicRestriction from './components/GeographicRestriction'
import type { Props } from './types'

export default function MusicPolicyEditor(props: Props) {
  const state = useMusicPolicy(props)
  const { form, loading, working, error, message, save } = state

  return (
    <section
      className="music-policy-editor"
      aria-label="Licences musicales"
    >
      <h4>Licences musicales</h4>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {form && (
        <>
          <AccessPolicy state={state} />

          <TimeRestriction state={state} />

          <GeographicRestriction state={state} />

          <p className="notice">
            Les restrictions horaires et GPS s'appliquent aux votes,
            même pour l'organisateur et les participants invités.
            Les playlists conservent leur propre licence d'édition.
          </p>

          <button
            type="button"
            disabled={working}
            onClick={() => { void save() }}
          >
            Enregistrer les licences
          </button>
        </>
      )}
    </section>
  )
}
