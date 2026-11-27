import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { errorMessage } from '../../../lib/api'
import { createAsyncFence } from '../../../lib/asyncFence'
import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import { subscribeFriendsRealtime } from '../../../lib/friendsRealtime'
import {
  fetchSocialLists,
  type SearchUser,
  type SocialProfile,
  type SocialLists
} from '../../../lib/socialFriends'

export function useFriendsData(token: string) {
  const [lists, setLists] = useState<SocialLists | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] =
    useState<SocialProfile | null>(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const active = useRef(false)
  const mutationBusy = useRef(false)

  const [fence] = useState(createAsyncFence)
  const [listGate] = useState(createLatestRequestGate)
  const [searchGate] = useState(createLatestRequestGate)
  const [profileGate] = useState(createLatestRequestGate)

  function closeProfile() {
    profileGate.invalidate()
    setSelected(null)
    setOpening(false)
  }

  const load = useCallback(async () => {
    if (!active.current) return

    const latest = listGate.begin()
    setLoading(true)

    try {
      const result = await fetchSocialLists(token)

      if (active.current && latest()) {
        setLists(result)
      }
    } catch (failure) {
      if (active.current && latest()) {
        setLists(null)
        setError(errorMessage(failure))
      }
    } finally {
      if (active.current && latest()) {
        setLoading(false)
      }
    }
  }, [token, listGate])

  useFocusEffect(useCallback(() => {
    active.current = true
    mutationBusy.current = false

    setBusy(false)
    setSearching(false)
    setOpening(false)
    setSelected(null)
    setResults([])
    setSearched(false)
    setError('')
    setMessage('')
    setLists(null)

    void load()

    let unsubscribe = () => {}

    try {
      unsubscribe = subscribeFriendsRealtime(token, () => {
        if (!active.current) return

        profileGate.invalidate()
        searchGate.invalidate()

        setSelected(null)
        setResults([])
        setSearched(false)
        setOpening(false)
        setSearching(false)

        void load()
      })
    } catch (failure) {
      setError(errorMessage(failure))
    }

    return () => {
      active.current = false

      fence.invalidate()
      listGate.invalidate()
      searchGate.invalidate()
      profileGate.invalidate()

      unsubscribe()
    }
  }, [token, load, fence, listGate, searchGate, profileGate]))


  return {
    token,
    lists,
    query,
    setQuery,
    results,
    setResults,
    searched,
    setSearched,
    selected,
    setSelected,
    loading,
    busy,
    setBusy,
    searching,
    setSearching,
    opening,
    setOpening,
    error,
    setError,
    message,
    setMessage,
    active,
    mutationBusy,
    fence,
    listGate,
    searchGate,
    profileGate,
    closeProfile,
    load
  }
}

export type FriendsData =
  ReturnType<typeof useFriendsData>
