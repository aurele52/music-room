import { useEffect, useState } from 'react';
import type { Auth } from '../auth/useAuth';
import { errorMessage } from '../../services/api';

import type { FormEvent } from 'react';

type MusicPreferences = {
  favoriteGenres: string[];
  favoriteArtists: string[];
};

export default function MusicPreferences({ auth }: { auth: Auth }) {
  const {
    user, token, protectedRequest,
    handleProtectedError
  } = auth;

  const [musicGenres, setMusicGenres] = useState('');
  const [musicArtists, setMusicArtists] = useState('');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [musicMessage, setMusicMessage] = useState('');
  const [musicError, setMusicError] = useState('');
  // Une préférence par ligne pour conserver les noms librement.
  function parseMusicLines(value: string): string[] {
    return value
      .split(/\\r?\\n/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  useEffect(() => {
    if (!user || !token) {
      setMusicReady(false);
      return;
    }

    let cancelled = false;

    setMusicReady(false);

    protectedRequest<{ preferences: MusicPreferences }>('/profile/me/music')
      .then(({ preferences }) => {
        if (cancelled) return;

        setMusicGenres(preferences.favoriteGenres.join('\\n'));
        setMusicArtists(preferences.favoriteArtists.join('\\n'));
        setMusicReady(true);
      })
      .catch((err) => {
        if (!cancelled && !handleProtectedError(err)) {
          setMusicError(errorMessage(err));
        }
      });

    return () => { cancelled = true; };
  }, [user?.id, token]);

  async function saveMusicPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !musicReady || musicLoading) return;

    setMusicLoading(true);
    setMusicError('');
    setMusicMessage('');

    try {
      const data = await protectedRequest<{ preferences: MusicPreferences }>(
        '/profile/me/music',
        {
          method: 'PUT',
          body: JSON.stringify({
            favoriteGenres: parseMusicLines(musicGenres),
            favoriteArtists: parseMusicLines(musicArtists)
          })
        }
      );

      setMusicGenres(data.preferences.favoriteGenres.join('\\n'));
      setMusicArtists(data.preferences.favoriteArtists.join('\\n'));
      setMusicMessage('Préférences musicales enregistrées.');
    } catch (err) {
      if (!handleProtectedError(err)) {
        setMusicError(errorMessage(err));
      }
    } finally {
      setMusicLoading(false);
    }
  }

  return (
<section className="profile">
  <h2>Mes goûts musicaux</h2>
  <p className="notice">
    Ajoute un genre ou un artiste par ligne (15 maximum par liste).
  </p>

  {musicError && (
    <p className="error" role="alert">{musicError}</p>
  )}

  {musicMessage && (
    <p className="success" role="status">{musicMessage}</p>
  )}

  {!musicReady ? (
    <p>Chargement des préférences...</p>
  ) : (
    <form className="form-content" onSubmit={saveMusicPreferences}>
      <label htmlFor="music-genres">
        Mes genres favoris
      </label>
      <textarea
        id="music-genres"
        rows={4}
        value={musicGenres}
        onChange={(event) => setMusicGenres(event.target.value)}
        placeholder={'Rock\\nJazz\\nTechno'}
        disabled={musicLoading}
      />

      <label htmlFor="music-artists">
        Mes artistes favoris
      </label>
      <textarea
        id="music-artists"
        rows={4}
        value={musicArtists}
        onChange={(event) => setMusicArtists(event.target.value)}
        placeholder={'Daft Punk\\nMuse\\nJustice'}
        disabled={musicLoading}
      />

      <button type="submit" disabled={musicLoading}>
        {musicLoading ? 'Enregistrement...' : 'Enregistrer mes goûts'}
      </button>
    </form>
  )}
</section>

  );
}
