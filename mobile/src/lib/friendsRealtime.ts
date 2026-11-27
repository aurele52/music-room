import { io } from 'socket.io-client'
import { apiOrigin } from './api'

export type AccountEvent =
  | 'friends:changed'
  | 'events:changed'
  | 'events:discovery-changed'
  | 'event:participants-changed'

type Listener = (payload?: unknown) => void

export interface FriendsSocket {
  connected: boolean
  on(event: string, listener: Listener): unknown
  connect(): unknown
  disconnect(): unknown
}

export type FriendsSocketFactory =
  (token: string) => FriendsSocket

export function createFriendsRealtimeManager(
  factory: FriendsSocketFactory
) {
  type Subscription = {
    event: AccountEvent
    listener: Listener
  }

  type Connection = {
    socket: FriendsSocket
    subscriptions: Set<Subscription>
  }

  const connections = new Map<string, Connection>()

  function subscribeAccount(
    token: string,
    event: AccountEvent,
    listener: Listener
  ) {
    if (!token.trim()) {
      throw new Error('Session requise.')
    }

    let connection = connections.get(token)

    if (!connection) {
      const socket = factory(token)

      connection = {
        socket,
        subscriptions: new Set<Subscription>()
      }

      connections.set(token, connection)
      const current = connection

      function dispatch(
        selectedEvent: AccountEvent | null,
        payload?: unknown
      ) {
        for (const item of [...current.subscriptions]) {
          if (
            current.subscriptions.has(item) &&
            (
              selectedEvent === null ||
              item.event === selectedEvent
            )
          ) {
            item.listener(payload)
          }
        }
      }

      // Rattrapage à chaque connexion ou reconnexion.
      socket.on('connect', () => dispatch(null))

      for (const name of [
        'friends:changed',
        'events:changed',
        'events:discovery-changed',
        'event:participants-changed'
      ] as const) {
        socket.on(name, payload => dispatch(name, payload))
      }
    }

    const current = connection
    const subscription: Subscription = {
      event,
      listener
    }

    const connected = current.socket.connected
    current.subscriptions.add(subscription)

    if (current.subscriptions.size === 1 && !connected) {
      current.socket.connect()
    } else if (connected) {
      listener()
    }

    let removed = false

    return () => {
      if (removed) return
      removed = true

      current.subscriptions.delete(subscription)

      if (current.subscriptions.size === 0) {
        current.socket.disconnect()

        if (connections.get(token) === current) {
          connections.delete(token)
        }
      }
    }
  }

  function subscribeFriends(
    token: string,
    listener: () => void
  ) {
    return subscribeAccount(
      token,
      'friends:changed',
      listener
    )
  }

  function closeToken(token: string) {
    const connection = connections.get(token)
    if (!connection) return

    connection.subscriptions.clear()
    connection.socket.disconnect()
    connections.delete(token)
  }

  return {
    subscribe: subscribeFriends,
    subscribeAccount,
    closeToken
  }
}

const manager = createFriendsRealtimeManager(
  token => io(apiOrigin(), {
    path: '/socket.io',
    auth: { token },
    autoConnect: false,
    reconnection: true
  })
)

export const subscribeFriendsRealtime =
  manager.subscribe

export const subscribeAccountRealtime =
  manager.subscribeAccount

export const closeFriendsRealtimeForToken =
  manager.closeToken
