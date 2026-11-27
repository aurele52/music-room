import { createAsyncFence } from '../../../lib/asyncFence'
import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import {
  subscribeFriendsRealtime,
  subscribeAccountRealtime
} from '../../../lib/friendsRealtime'
import {
  eventApi,
  type EventMember
} from '../../../lib/eventParticipation'
import { errorMessage, type MusicEvent } from '../../../lib/api'
import {
  fetchConfirmedFriends,
  type FriendUser
} from '../../../lib/friends'

export interface ParticipationProps {
  event: MusicEvent
  viewerId: string
  token: string
}


export function useParticipationData({
  event,
  viewerId,
  token
}: ParticipationProps) {
  const organizer = event.organizerId === viewerId
  const [members, setMembers] = useState<EventMember[]>([])
  const [friendId, setFriendId] = useState('')
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendsError, setFriendsError] = useState('')
  const [busy, setBusy] = useState(false)
  const activeRef = useRef(false)
  const busyRef = useRef(false)
  const [operationFence] = useState(createAsyncFence)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Deux flux de chargement indépendants.
  // Une notification de participation ne doit pas invalider
  // une requête concernant les amis, et inversement.
  const participantsRequestGate = useRef(
    createLatestRequestGate()
  )
  const friendsRequestGate = useRef(
    createLatestRequestGate()
  )

  const load = useCallback(async (
    active: () => boolean = () => true,
    silent = false
  ) => {
    // Seule la dernière réponse de ce flux peut publier.
    const isLatest = participantsRequestGate.current.begin()
    if (!silent) {
      setLoading(true)
      setError('')
    }

    try {
      if (organizer) {
        const result = await eventApi.members(event.id, token)

        if (active() && isLatest()) {
          setMembers(result.invitations)
        }
      }
    } catch (failure) {
      if (active() && isLatest()) setError(errorMessage(failure))
    } finally {
      if (active() && isLatest()) setLoading(false)
    }

  }, [event.id, organizer, token])

  const loadFriends = useCallback(async (
    active: () => boolean = () => true,
    silent = false
  ) => {
    // Seule la dernière réponse de ce flux peut publier.
    const isLatest = friendsRequestGate.current.begin()
    if (!organizer) return

    if (!silent) {
      setFriendsLoading(true)
      setFriendsError('')
    }

    try {
      const list = await fetchConfirmedFriends(token)

      if (active() && isLatest()) {
        setFriends(list)

        // Une ancienne sélection ne doit pas survivre
        // à la disparition de la relation d'amitié.
        setFriendId(previous =>
          list.some(friend => friend.id === previous)
            ? previous
            : ''
        )
      }
    } catch (failure) {
      if (active() && isLatest()) {
        setFriends([])
        setFriendId('')
        setFriendsError(errorMessage(failure))
      }
    } finally {
      if (active() && isLatest()) {
        setFriendsLoading(false)
      }
    }
  }, [organizer, token])

  useFocusEffect(useCallback(() => {
    let active = true
    activeRef.current = true
    busyRef.current = false
    setBusy(false)

    const current = () => active

    void load(current)
    void loadFriends(current)

    const refresh = () => {
      if (!active) return
      void load(current, true)
      void loadFriends(current, true)
    }

    const stopForeground = subscribeForegroundRefresh(
      AppState,
      refresh
    )

    const stopFriendsRealtime = organizer
      ? subscribeFriendsRealtime(token, () => {
          if (active) void loadFriends(current, true)
        })
      : () => {}

    const stopParticipantsRealtime = subscribeAccountRealtime(
      token,
      'event:participants-changed',
      payload => {
        if (!active) return

        // Connexion/reconnexion : synchronisation complète.
        if (payload === undefined) {
          void load(current, true)
          return
        }

        if (
          typeof payload === 'object' &&
          payload !== null &&
          'eventId' in payload &&
          payload.eventId === event.id
        ) {
          void load(current, true)
        }
      }
    )



    return () => {
      active = false
      activeRef.current = false
      operationFence.invalidate()

      // Invalider les deux flux à la perte du focus.
      participantsRequestGate.current.invalidate()
      friendsRequestGate.current.invalidate()

      stopForeground()
      stopFriendsRealtime()
      stopParticipantsRealtime()
    }
  }, [
    event.id,
    load,
    loadFriends,
    organizer,
    token,
    operationFence
  ]))

  const selectedFriend = friends.find(
    friend => friend.id === friendId
  )


  return {
    event,
    viewerId,
    token,
    organizer,
    members,
    friendId,
    setFriendId,
    friends,
    friendsLoading,
    friendsError,
    selectedFriend,
    loading,
    busy,
    setBusy,
    activeRef,
    busyRef,
    operationFence,
    error,
    setError,
    message,
    setMessage,
    load
  }
}

export type ParticipationData =
  ReturnType<typeof useParticipationData>
