import type { Auth } from './useAuth'
import type { Mode } from './types'
import AuthForm from './components/AuthForm'
import GoogleAuth from './components/GoogleAuth'
import EmailVerification from './components/EmailVerification'
import AuthNavigation from './components/AuthNavigation'

export default function AuthPage({ auth }: { auth: Auth }) {
  const { mode, message, error } = auth

  const titles: Record<Mode, string> = {
    login: 'Connexion',
    register: 'Créer un compte',
    pending: 'Vérifie ton email',
    forgot: 'Mot de passe oublié',
    reset: 'Nouveau mot de passe',
    verify: 'Validation de ton email'
  };

  return (
    <main className="card">
      <div className="brand">♫ Music Room</div>

      <h1>{titles[mode]}</h1>

      <p className="subtitle">
        {mode === 'pending'
          ? 'Un lien de validation a été envoyé à ton adresse.'
          : mode === 'verify'
            ? 'Vérification du lien de confirmation.'
            : 'Ta musique, tes amis, tes playlists.'}
      </p>

      {message && (
        <p className="success" role="status">{message}</p>
      )}

      {error && (
        <p className="error" role="alert">{error}</p>
      )}


      {(mode === 'login' || mode === 'register') && (
        <GoogleAuth auth={auth} />
      )}

      {mode === 'verify' || mode === 'pending' ? (
        <EmailVerification auth={auth} />
      ) : (
        <AuthForm auth={auth} />
      )}

      {mode !== 'verify' && <AuthNavigation auth={auth} />}

      <p className="version">Music Room</p>
    </main>
  );
}
