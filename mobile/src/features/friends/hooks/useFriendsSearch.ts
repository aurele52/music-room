import { errorMessage } from '../../../lib/api'
import {
  searchSocialUsers,
  fetchSocialProfile
} from '../../../lib/socialFriends'
import type { FriendsData } from './useFriendsData'

export function useFriendsSearch(data: FriendsData) {
  const {
    token,
    query,
    setQuery,
    active,
    busy,
    searchGate,
    profileGate,
    closeProfile,
    setSearching,
    setOpening,
    setError,
    setMessage,
    setResults,
    setSearched,
    setSelected
  } = data

  function changeQuery(value: string) {
    searchGate.invalidate()
    closeProfile()
    setQuery(value)
    setResults([])
    setSearched(false)
    setSearching(false)
  }

  async function search() {
    if (!active.current || busy) return

    const latest = searchGate.begin()

    closeProfile()
    setSearching(true)
    setError('')
    setMessage('')
    setResults([])
    setSearched(false)

    try {
      const users = await searchSocialUsers(query, token)

      if (active.current && latest()) {
        setResults(users)
        setSearched(true)
      }
    } catch (failure) {
      if (active.current && latest()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (active.current && latest()) {
        setSearching(false)
      }
    }
  }

  async function openProfile(userId: string) {
    if (!active.current || busy) return

    const latest = profileGate.begin()

    setSelected(null)
    setOpening(true)
    setError('')

    try {
      const profile = await fetchSocialProfile(userId, token)

      if (active.current && latest()) {
        setSelected(profile)
      }
    } catch (failure) {
      if (active.current && latest()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (active.current && latest()) {
        setOpening(false)
      }
    }
  }


  return {
    changeQuery,
    search,
    openProfile
  }
}
