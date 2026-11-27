import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PublicUser, ApiError, Props } from '../searchTypes'

export function useUserSearch({
  token,
  onAuthError,
  onFriendRequestSent
}: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  async function request<T>(path: string): Promise<T> {
    const response = await fetch(`/api${path}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const failure = new Error(
        data.error || 'Erreur du serveur'
      ) as ApiError;

      failure.status = response.status;
      failure.code = data.code;
      throw failure;
    }

    return data as T;
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();

    if (value.length < 2 || value.length > 50 || loading) {
      setError('Saisis entre 2 et 50 caractères.');
      return;
    }

    setLoading(true);
    setError('');
    setUsers([]);
    setSelected(null);
    setSearched(false);
    setMessage('');

    try {
      const data = await request<{ users: PublicUser[] }>(
        `/profile/search?q=${encodeURIComponent(value)}`
      );

      setUsers(data.users);
      setSearched(true);
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Recherche impossible'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function openProfile(id: string) {
    if (loading) return;

    setLoading(true);
    setError('');
    setSelected(null);

    try {
      const data = await request<{ user: PublicUser }>(
        `/profile/${encodeURIComponent(id)}`
      );

      setSelected(data.user);
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Profil inaccessible'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function inviteUser(id: string) {
    if (inviting || invitedIds.includes(id)) return;

    setInviting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: id })
      });

      const data = await response.json();

      if (!response.ok) {
        const failure = new Error(
          data.error || 'Invitation impossible'
        ) as ApiError;

        failure.status = response.status;
        failure.code = data.code;
        throw failure;
      }

      setInvitedIds((current) => [...current, id]);
      setMessage('Demande d’ami envoyée.');
      onFriendRequestSent();
    } catch (err) {
      if (!onAuthError(err)) {
        setError(
          err instanceof Error ? err.message : 'Invitation impossible'
        );
      }
    } finally {
      setInviting(false);
    }
  }


  return {
    query, setQuery, users,
    selected, setSelected,
    loading, error, searched,
    inviting, invitedIds, message,
    search, openProfile, inviteUser
  }
}

export type UserSearchState = ReturnType<typeof useUserSearch>
