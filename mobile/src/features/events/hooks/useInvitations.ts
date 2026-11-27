import { createAsyncFence } from '../../../lib/asyncFence'
import { useCallback, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { subscribeForegroundRefresh } from '../../../lib/foregroundRefresh'
import { subscribeAccountRealtime } from '../../../lib/friendsRealtime'
import { createLatestRequestGate } from '../../../lib/latestRequestGate'
import {
  eventApi,
  type Invitation
} from '../../../lib/eventParticipation'
import { errorMessage } from '../../../lib/api'
import { useSession } from '../../../session/SessionProvider'

export function useInvitations() {
  const { session } = useSession()
  const token = session.status === 'authenticated'
    ? session.token
    : ''

  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const activeRef = useRef(false)
  const busyRef = useRef(false)
  const [operationFence] = useState(createAsyncFence)
  const [error, setError] = useState('')
  const requestGate = useRef(createLatestRequestGate())

  const load = useCallback(async (
    active: () => boolean = () => true
  ) => {
    if (!token) return

    // Chaque chargement invalide les précédents.
    const isLatest = requestGate.current.begin()

    setLoading(true)
    setError('')

    try {
      const result = await eventApi.inbox(token)
      if (active() && isLatest()) setInvitations(result.invitations)
    } catch (failure) {
      if (active() && isLatest()) setError(errorMessage(failure))
    } finally {
      if (active() && isLatest()) setLoading(false)
    }
  }, [token])

  // Chargement initial, notifications serveur et reprise au
  // premier plan. Aucun polling périodique.
  useFocusEffect(useCallback(() => {
    let active = true
    activeRef.current = true
    busyRef.current = false
    setBusy(false)

    const current = () => active

    void load(current)

    const refresh = () => {
      if (active) void load(current)
    }

    const stopForeground = subscribeForegroundRefresh(
      AppState,
      refresh
    )

    const stopRealtime = token
      ? subscribeAccountRealtime(
          token,
          'events:changed',
          refresh
        )
      : () => {}

    return () => {
      active = false
      activeRef.current = false
      operationFence.invalidate()
      requestGate.current.invalidate()
      stopForeground()
      stopRealtime()
    }
  }, [load, token, operationFence]))

  async function act(
    operation: () => Promise<unknown>
  ) {
    if (
      !token ||
      !activeRef.current ||
      busyRef.current
    ) return

    busyRef.current = true
    operationFence.invalidate()

    const scope = operationFence.capture()
    const current = () =>
      activeRef.current &&
      operationFence.isCurrent(scope)

    setBusy(true)
    setError('')

    try {
      await operation()

      if (!current()) return

      await load(current)
    } catch (failure) {
      if (current()) {
        setError(errorMessage(failure))
      }
    } finally {
      if (current()) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  function acceptInvitation(invitation: Invitation) {
    if (invitation.status !== 'PENDING' || busy) return

    void act(() =>
      eventApi.accept(invitation.id, token)
    )
  }

  function leaveInvitation(invitation: Invitation) {
    if (busy) return

    const confirmation = operationFence.capture()
    const accepted = invitation.status === 'ACCEPTED'

    Alert.alert(
      accepted
        ? 'Quitter cet événement ?'
        : 'Supprimer cette invitation ?',
      accepted
        ? 'Tu risques de perdre ton accès à cet événement.'
        : 'Cette invitation sera supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: accepted ? 'Quitter' : 'Supprimer',
          style: 'destructive',
          onPress: () => {
            if (
              !activeRef.current ||
              busyRef.current ||
              !operationFence.isCurrent(confirmation)
            ) return

            void act(() =>
              eventApi.leave(invitation.id, token)
            )
          }
        }
      ]
    )
  }

  return {
    invitations,
    loading,
    busy,
    error,
    acceptInvitation,
    leaveInvitation
  }
}

export type InvitationsState =
  ReturnType<typeof useInvitations>
