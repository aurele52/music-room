import { GoogleLogin } from '@react-oauth/google'
import type { Auth } from '../useAuth'

export default function GoogleAuth({ auth }: { auth: Auth }) {
  const { handleGoogle, setError } = auth

  return (
    <div className="google-section">
      <div className="google-button">
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) {
              void handleGoogle(response.credential);
            }
          }}
          onError={() => setError('Connexion Google impossible')}
        />
      </div>
      <p>ou continuer avec un email</p>
    </div>

  )
}
