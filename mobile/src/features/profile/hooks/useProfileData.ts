import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  useSession,
  isCurrentSessionToken
} from '../../../session/SessionProvider'
import { api, errorMessage } from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'
import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import type {
  Visibility,
  ProfileInformation,
  Preferences
} from '../profileTypes'

export function useProfileData() {
  const { session, refreshUser, logout } = useSession()

  const token = session.status === 'authenticated'
    ? session.token
    : null

  const [name, setName] = useState('')
  const [publicBio, setPublicBio] = useState('')
  const [friendsBio, setFriendsBio] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [visibility, setVisibility] =
    useState<Visibility>('PRIVATE')
  const [genres, setGenres] = useState('')
  const [artists, setArtists] = useState('')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [googleLinked, setGoogleLinked] = useState(false)

  const activeRef = useRef(false)
  const busyRef = useRef(false)
  const [fence] = useState(createAsyncFence)
  const [googleGate] = useState(createLatestRequestGate)

  useFocusEffect(useCallback(() => {
    activeRef.current = true

    return () => {
      activeRef.current = false
      fence.invalidate()
    }
  }, [fence]))

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const current = () =>
      !cancelled && isCurrentSessionToken(token)

    Promise.all([
      api<{
        user: ProfileInformation & {
          name: string
          visibility: Visibility
        }
      }>('/profile/me', { token }),

      api<{ preferences: Preferences }>(
        '/profile/me/music',
        { token }
      )
    ]).then(([profile, music]) => {
      if (!current()) return

      setName(profile.user.name)
      setPublicBio(profile.user.publicBio)
      setFriendsBio(profile.user.friendsBio)
      setPrivateNote(profile.user.privateNote)
      setVisibility(profile.user.visibility)
      setGenres(music.preferences.favoriteGenres.join(', '))
      setArtists(music.preferences.favoriteArtists.join(', '))
      setReady(true)
    }).catch(failure => {
      if (current()) setError(errorMessage(failure))
    }).finally(() => {
      if (current()) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [token, attempt])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const latest = googleGate.begin()

    api<{ linked: boolean }>('/auth/google/status', {
      token
    }).then(result => {
      if (
        !cancelled &&
        latest() &&
        isCurrentSessionToken(token)
      ) {
        setGoogleLinked(result.linked)
      }
    }).catch(() => {
      // L'edition du profil reste disponible.
    })

    return () => {
      cancelled = true
      googleGate.invalidate()
    }
  }, [token, googleGate])

  function retry() {
    if (busyRef.current) return

    setReady(false)
    setLoading(true)
    setError('')
    setAttempt(value => value + 1)
  }

  return {
    session,
    refreshUser,
    logout,
    token,
    name,
    setName,
    publicBio,
    setPublicBio,
    friendsBio,
    setFriendsBio,
    privateNote,
    setPrivateNote,
    visibility,
    setVisibility,
    genres,
    setGenres,
    artists,
    setArtists,
    loading,
    ready,
    busy,
    setBusy,
    activeRef,
    busyRef,
    fence,
    googleGate,
    error,
    setError,
    message,
    setMessage,
    googleLinked,
    setGoogleLinked,
    retry
  }
}

export type ProfileData =
  ReturnType<typeof useProfileData>
