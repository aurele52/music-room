import { useEffect, useState } from 'react'
import type { User, AuthResponse } from '../types'
import { apiRequest, errorMessage } from '../../../services/api'
import type { ApiError } from '../../../services/api'

type SessionOptions = {
  onClear: () => void
  onExpired: () => void
  setError: (message: string) => void
}

export function useSession({
  onClear, onExpired, setError
}: SessionOptions) {

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState(
    () => sessionStorage.getItem('token') || ''
  );

  function protectedRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return apiRequest<T>(path, {
      ...options,
      headers: Object.fromEntries(headers.entries())
    });
  }


  const [checking, setChecking] = useState(true)

  function openSession(data: AuthResponse) {
    sessionStorage.setItem('token', data.token);
    setUser(data.user);
    setToken(data.token);

    window.dispatchEvent(
      new Event('music-room:auth-changed')
    );
  }

  function clearSession() {
    sessionStorage.removeItem('token');
    setToken('');
    setUser(null);
    onClear();

    window.dispatchEvent(
      new Event('music-room:auth-changed')
    );
  }

  // Effacer une session révoquée ou expirée.
  function expireSession() {
    clearSession();
    onExpired();
  }

  // Réagir uniquement aux erreurs d'authentification.
  // Ne pas déconnecter sur une erreur réseau ou HTTP 500.
  function handleProtectedError(err: unknown): boolean {
    if (sessionStorage.getItem('token') !== token) return true;
    const apiError = err as ApiError;

    if (apiError?.status === 401) {
      expireSession();
      return true;
    }

    if (apiError?.status === 403 &&
        apiError.code === 'REAUTH_REQUIRED') {
      setError(
        'Pour modifier ton compte Google, déconnecte-toi puis reconnecte-toi.'
      );
      return true;
    }

    return false;
  }

  // Restaurer la session après un rechargement.
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    protectedRequest<{ user: User }>('/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch((err) => {
        if (!cancelled) {
          if (!handleProtectedError(err)) {
            setError(
              'Impossible de vérifier la session : ' +
              errorMessage(err)
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);


  return {
    user, setUser, token, checking,
    openSession, clearSession,
    protectedRequest, handleProtectedError
  }
}
