import { useEffect, useState } from 'react';
import type { Auth } from '../auth/useAuth';
import { errorMessage } from '../../services/api';

import type { FormEvent } from 'react';
import type { User } from '../auth/types';

export default function ProfileDetails({ auth }: { auth: Auth }) {
  const {
    user, setUser, protectedRequest,
    handleProtectedError
  } = auth;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [profileName, setProfileName] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  // Préremplir le formulaire lorsque le profil change.
  useEffect(() => {
    setProfileName(user?.name ?? '');
  }, [user?.name]);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await protectedRequest<{ user: User }>(
        '/profile/me',
        {
          method: 'PATCH',
          body: JSON.stringify({ name: profileName })
        }
      );

      setUser(data.user);
      setProfileName(data.user.name);
      setEditingProfile(false);
      setMessage('Ton profil a été mis à jour.');
    } catch (err) {
      if (!handleProtectedError(err)) {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
<section className="profile">
  <h2>Mon profil</h2>
  {editingProfile && error && (
    <p className="error" role="alert">{error}</p>
  )}
  {editingProfile && message && (
    <p className="success" role="status">{message}</p>
  )}

  {editingProfile ? (
    <form className="form-content" onSubmit={saveProfile}>
      <label>
        Nom affiché
        <input
          type="text"
          value={profileName}
          onChange={(event) => setProfileName(event.target.value)}
          minLength={2}
          maxLength={50}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Enregistrement...' : 'Enregistrer'}
      </button>

      <button
        type="button"
        className="secondary"
        disabled={loading}
        onClick={() => {
          setProfileName(user.name);
          setEditingProfile(false);
          setError('');
        }}
      >
        Annuler
      </button>
    </form>
  ) : (
    <div className="profile-row">
      <span>Nom</span>
      <strong>{user.name}</strong>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setProfileName(user.name);
          setEditingProfile(true);
          setError('');
          setMessage('');
        }}
      >
        Modifier
      </button>
    </div>
  )}

  <div className="profile-row">
    <span>Email</span>
    <strong>{user.email}</strong>
  </div>

  <div className="profile-row">
    <span>Inscription</span>
    <strong>
      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
    </strong>
  </div>
</section>

  );
}
