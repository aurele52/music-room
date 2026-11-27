import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Mode, AuthResponse } from './types'
import { apiRequest, errorMessage } from '../../services/api'
import type { ApiError } from '../../services/api'
import { useSession } from './hooks/useSession'

const params = new URLSearchParams(window.location.search);
const verifyToken = params.get('verify');
const resetToken = params.get('reset');

function initialMode(): Mode {
  if (verifyToken) return 'verify';
  if (resetToken) return 'reset';
  return 'login';
}

export function useAuth() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');


  const {
    user, setUser, token, checking,
    openSession, clearSession,
    protectedRequest, handleProtectedError
  } = useSession({
    onClear: () => {
      setPassword('')
      setConfirmPassword('')
    },
    onExpired: () => {
      setMode('login')
      setMessage('')
      setError('Ta session a expiré. Reconnecte-toi.')
    },
    setError
  })

  async function handleGoogle(credential: string) {
    if (loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest<AuthResponse>(
        '/auth/google/login',
        {
          method: 'POST',
          body: JSON.stringify({ credential })
        }
      );

      openSession(data);
      setMode('login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  const verificationStarted = useRef(false);

  // Valider automatiquement les liens de vérification.
  useEffect(() => {
    if (!verifyToken || verificationStarted.current) return;

    // Évite deux utilisations du lien avec React StrictMode.
    verificationStarted.current = true;

    setLoading(true);

    apiRequest<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verifyToken })
    })
      .then((data) => {
        setMessage(data.message);
        window.history.replaceState({}, '', '/');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  function logout() {
    clearSession();
    changeMode('login');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'register') {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });

        setPassword('');
        setMode('pending');
        setMessage(
          'Compte créé ! Consulte ton email pour le valider.'
        );
      }

      if (mode === 'login') {
        const data = await apiRequest<AuthResponse>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password })
          }
        );

        openSession(data);
        setPassword('');
      }

      if (mode === 'forgot') {
        await apiRequest('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });

        setMessage(
          'Si ce compte existe, un lien de réinitialisation a été envoyé.'
        );
      }

      if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error(
            'Les deux mots de passe ne correspondent pas.'
          );
        }

        await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: resetToken,
            password
          })
        });

        window.history.replaceState({}, '', '/');
        setPassword('');
        setConfirmPassword('');
        setMode('login');
        setMessage(
          'Mot de passe modifié. Tu peux te connecter.'
        );
      }
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'EMAIL_NOT_VERIFIED') {
        setMode('pending');
        setPassword('');
        setMessage(
          'Ton adresse email doit être validée avant la connexion.'
        );
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email.trim() || loading) {
      setError('Indique ton adresse email.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest<{ message: string }>(
        '/auth/resend-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email })
        }
      );

      setMessage(data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return {
    mode, user, token, checking,
    name, email, password, confirmPassword,
    loading, message, error,
    setName, setEmail, setPassword, setConfirmPassword,
    setError, setMessage, setUser,
    protectedRequest, handleProtectedError,
    handleGoogle, changeMode, logout,
    handleSubmit, resendVerification
  };
}

export type Auth = ReturnType<typeof useAuth>;
