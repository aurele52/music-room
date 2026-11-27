import { useEffect, useState } from 'react';
import type { Auth } from '../auth/useAuth';
import { errorMessage } from '../../services/api';

import { GoogleLogin } from '@react-oauth/google';

export default function GoogleAccount({ auth }: { auth: Auth }) {
  const {
    user, token, protectedRequest,
    handleProtectedError
  } = auth;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [googleLinked, setGoogleLinked] = useState(false);
  const [unlinkPassword, setUnlinkPassword] = useState('');
  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;

    protectedRequest<{ linked: boolean }>('/auth/google/status')
      .then((data) => {
        if (!cancelled) setGoogleLinked(data.linked);
      })
      .catch((err) => {
        if (!cancelled && !handleProtectedError(err)) {
          setError(
            'Impossible de vérifier le statut Google : ' +
            errorMessage(err)
          );
        }
      });

    return () => { cancelled = true; };
  }, [user?.id, token]);
  async function unlinkGoogle() {
    if (!unlinkPassword || loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await protectedRequest<{ message: string }>(
        '/auth/google/link',
        {
          method: 'DELETE',
          body: JSON.stringify({ password: unlinkPassword })
        }
      );

      setGoogleLinked(false);
      setUnlinkPassword('');
      setMessage(data.message);
    } catch (err) {
      if (!handleProtectedError(err)) {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function linkGoogle(credential: string) {
    if (loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await protectedRequest<{ message: string }>(
        '/auth/google/link',
        {
          method: 'POST',
          body: JSON.stringify({ credential })
        }
      );

      setGoogleLinked(true);
      setMessage(data.message);
    } catch (err) {
      if (!handleProtectedError(err)) {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
<section className="profile">
  <h2>Compte Google</h2>

  {message && <p className="success" role="status">{message}</p>}
  {error && <p className="error" role="alert">{error}</p>}

  {googleLinked ? (
    <div className="form-content">
      <p>Ton compte Google est associé.</p>

      <label>
        Mot de passe Music Room pour dissocier
        <input
          type="password"
          value={unlinkPassword}
          onChange={(e) => setUnlinkPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      <button
        className="secondary"
        disabled={loading || !unlinkPassword}
        onClick={unlinkGoogle}
      >
        Dissocier Google
      </button>
    </div>
  ) : (
    <div className="form-content">
      <p>Associer un compte Google à ton profil.</p>
      <div className="google-button">
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) {
              void linkGoogle(response.credential);
            }
          }}
          onError={() => setError('Connexion Google annulée')}
        />
      </div>
    </div>
  )}
</section>

  );
}
