import { api, errorMessage } from '../../../lib/api'
import { getGoogleIdToken } from '../../../lib/googleSignIn'
import { isCurrentSessionToken } from '../../../session/SessionProvider'
import { parseList } from '../profilePreferences'
import type {
  Visibility,
  ProfileInformation,
  Preferences
} from '../profileTypes'
import type { ProfileData } from './useProfileData'

export function useProfileActions(data: ProfileData) {
  const {
    token,
    refreshUser,
    activeRef,
    busyRef,
    fence,
    googleGate,
    setBusy,
    loading,
    ready,
    setError,
    setMessage,
    googleLinked,
    setGoogleLinked,
    name,
    setName,
    publicBio,
    setPublicBio,
    friendsBio,
    setFriendsBio,
    privateNote,
    setPrivateNote,
    setVisibility,
    genres,
    setGenres,
    artists,
    setArtists
  } = data

  async function perform(
    operation: (
      token: string,
      current: () => boolean
    ) => Promise<void>,
    success: string
  ) {
    if (
      !token ||
      !activeRef.current ||
      busyRef.current ||
      !isCurrentSessionToken(token)
    ) return

    const snapshot = fence.capture()

    const current = () =>
      activeRef.current &&
      fence.isCurrent(snapshot) &&
      isCurrentSessionToken(token)

    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation(token, current)

      if (current()) {
        setMessage(success)
      }
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      // Le verrou reste actif tant que la requete
      // n'est pas terminee, meme apres perte du focus.
      busyRef.current = false

      if (isCurrentSessionToken(token)) {
        setBusy(false)
      }
    }
  }

  function linkGoogle() {
    if (googleLinked) return

    return perform(async (token, current) => {
      const credential = await getGoogleIdToken()

      // Ne pas envoyer le jeton Google si le contexte
      // a change pendant la selection du compte.
      if (!current()) return

      await api('/auth/google/link', {
        method: 'POST',
        token,
        body: { credential }
      })

      if (!isCurrentSessionToken(token)) return

      googleGate.invalidate()
      setGoogleLinked(true)
    }, 'Compte Google associé.')
  }

  function saveName() {
    if (loading || !ready) return

    return perform(async (token, current) => {
      await api('/profile/me', {
        method: 'PATCH',
        token,
        body: { name: name.trim() }
      })

      await refreshUser(token)

      if (current()) {
        setName(name.trim())
      }
    }, 'Nom enregistré.')
  }

  function saveInformation() {
    if (loading || !ready) return

    return perform(async (token, current) => {
      const result = await api<{
        information: ProfileInformation
      }>('/profile/me/information', {
        method: 'PUT',
        token,
        body: {
          publicBio,
          friendsBio,
          privateNote
        }
      })

      if (!current()) return

      setPublicBio(result.information.publicBio)
      setFriendsBio(result.information.friendsBio)
      setPrivateNote(result.information.privateNote)
    }, 'Informations enregistrées.')
  }

  function saveVisibility(value: Visibility) {
    if (loading || !ready) return

    return perform(async (token, current) => {
      await api('/profile/me/visibility', {
        method: 'PATCH',
        token,
        body: { visibility: value }
      })

      if (current()) {
        setVisibility(value)
      }
    }, 'Visibilité enregistrée.')
  }

  function savePreferences() {
    if (loading || !ready) return

    return perform(async (token, current) => {
      const result = await api<{
        preferences: Preferences
      }>('/profile/me/music', {
        method: 'PUT',
        token,
        body: {
          favoriteGenres: parseList(genres),
          favoriteArtists: parseList(artists)
        }
      })

      if (!current()) return

      setGenres(
        result.preferences.favoriteGenres.join(', ')
      )

      setArtists(
        result.preferences.favoriteArtists.join(', ')
      )
    }, 'Préférences enregistrées.')
  }

  return {
    linkGoogle,
    saveName,
    saveInformation,
    saveVisibility,
    savePreferences
  }
}
