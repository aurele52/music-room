import { errorMessage } from '../../../lib/api'
import {
  requestFriend,
  acceptFriendRequest,
  removeFriendRequest,
  removeFriend
} from '../../../lib/socialFriends'
import type { FriendsData } from './useFriendsData'

export function useFriendsActions(data: FriendsData) {
  const {
    token,
    active,
    mutationBusy,
    loading,
    lists,
    fence,
    setBusy,
    setError,
    setMessage,
    closeProfile,
    searchGate,
    setResults,
    setSearched,
    setSearching,
    load
  } = data

  async function perform(
    operation: () => Promise<void>,
    success: string
  ) {
    if (
      !active.current ||
      mutationBusy.current ||
      loading ||
      !lists
    ) return

    const snapshot = fence.capture()

    mutationBusy.current = true
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation()

      if (
        !active.current ||
        !fence.isCurrent(snapshot)
      ) return

      closeProfile()
      searchGate.invalidate()
      setResults([])
      setSearched(false)
      setSearching(false)
      setMessage(success)

      await load()
    } catch (failure) {
      if (
        active.current &&
        fence.isCurrent(snapshot)
      ) {
        closeProfile()
        setError(errorMessage(failure))
        await load()
      }
    } finally {
      if (
        active.current &&
        fence.isCurrent(snapshot)
      ) {
        mutationBusy.current = false
        setBusy(false)
      }
    }
  }


  function sendRequest(userId: string) {
    void perform(
      () => requestFriend(userId, token),
      'Demande envoyée.'
    )
  }

  function acceptRequest(requestId: string) {
    void perform(
      () => acceptFriendRequest(requestId, token),
      'Demande acceptée.'
    )
  }

  function rejectRequest(requestId: string) {
    void perform(
      () => removeFriendRequest(requestId, token),
      'Demande refusée.'
    )
  }

  function cancelRequest(requestId: string) {
    void perform(
      () => removeFriendRequest(requestId, token),
      'Demande annulée.'
    )
  }

  function deleteFriend(userId: string) {
    void perform(
      () => removeFriend(userId, token),
      'Ami supprimé.'
    )
  }

  return {
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    deleteFriend
  }
}
