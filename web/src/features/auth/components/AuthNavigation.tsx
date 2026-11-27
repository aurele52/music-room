import type { Auth } from '../useAuth'

export default function AuthNavigation({
  auth
}: { auth: Auth }) {
  const { mode, changeMode } = auth

  return (
    <div className="navigation">
      {mode === 'login' && (
        <>
          <button
            className="link"
            onClick={() => changeMode('forgot')}
          >
            Mot de passe oublié ?
          </button>
          <button
            className="link"
            onClick={() => changeMode('register')}
          >
            Créer un compte
          </button>
        </>
      )}

      {mode !== 'login' && (
        <button
          className="link"
          onClick={() => {
            window.history.replaceState({}, '', '/');
            changeMode('login');
          }}
        >
          Retour à la connexion
        </button>
      )}
    </div>

  )
}
