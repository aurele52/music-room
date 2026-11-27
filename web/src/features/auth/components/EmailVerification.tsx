import type { Auth } from '../useAuth'

export default function EmailVerification({
  auth
}: { auth: Auth }) {
  const {
    mode, email, setEmail,
    loading, resendVerification, changeMode
  } = auth

  if (mode === 'verify') {
    return (
      <div className="form-content">
        {loading && <p>Vérification en cours...</p>}
        <button
          onClick={() => {
            window.history.replaceState({}, '', '/');
            changeMode('login');
          }}
          disabled={loading}
        >
          Aller à la connexion
        </button>
      </div>

    )
  }

  return (
    <div className="form-content">
      <label>
        Adresse email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <button
        onClick={resendVerification}
        disabled={loading}
      >
        {loading ? 'Envoi...' : 'Renvoyer le lien'}
      </button>
    </div>

  )
}
