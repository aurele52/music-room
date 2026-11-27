import { useEffect, useState } from 'react';
import type { Auth } from '../auth/useAuth';
import { errorMessage } from '../../services/api';
type ProfileVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

export default function PrivacySettings({ auth }: { auth: Auth }) {
  const {
    user, token, protectedRequest,
    handleProtectedError
  } = auth;

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [visibility, setVisibility] =
    useState<ProfileVisibility>('PRIVATE');
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  // La valeur affichée vient du serveur, pas du navigateur.
  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;

    protectedRequest<{ user: { visibility: ProfileVisibility } }>('/profile/me')
      .then((data) => {
        if (!cancelled) setVisibility(data.user.visibility);
      })
      .catch((err) => {
        if (!cancelled && !handleProtectedError(err)) {
          setError(errorMessage(err));
        }
      });

    return () => { cancelled = true; };
  }, [user?.id, token]);

  async function saveVisibility(next: ProfileVisibility) {
    if (!user || visibilityLoading) return;

    setVisibilityLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await protectedRequest<{
        user: { visibility: ProfileVisibility };
      }>('/profile/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ visibility: next })
      });

      setVisibility(data.user.visibility);
      setMessage('Confidentialité du profil enregistrée.');
    } catch (err) {
      if (!handleProtectedError(err)) {
        setError(errorMessage(err));
      }
    } finally {
      setVisibilityLoading(false);
    }
  }

  return (
<section className="profile">
  <h2>Confidentialité</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}

  <label htmlFor="profile-visibility">
    Qui peut consulter mon profil ?
  </label>

  <select
    id="profile-visibility"
    value={visibility}
    disabled={visibilityLoading}
    onChange={(event) => {
      void saveVisibility(
        event.target.value as ProfileVisibility
      );
    }}
  >
    <option value="PUBLIC">Public</option>
    <option value="FRIENDS">Mes amis</option>
    <option value="PRIVATE">Privé</option>
  </select>

  <p className="notice">
    {visibility === 'PUBLIC'
      ? 'Ton profil est visible par les autres utilisateurs connectés.'
      : visibility === 'FRIENDS'
        ? 'Seuls tes amis peuvent consulter ton profil.'
        : 'Toi seul peux consulter ton profil.'}
  </p>
</section>

  );
}
