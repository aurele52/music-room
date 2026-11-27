import { io } from 'socket.io-client'

export type AccountEvent =
  | 'friends:changed'
  | 'events:changed'
  | 'events:discovery-changed'
  | 'event:participants-changed'

type Listener = (payload?: unknown) => void

type Subscription = {
  event: AccountEvent
  listener: Listener
}

interface Connection {
  socket: ReturnType<typeof io>
  subscriptions: Set<Subscription>
}

const connections = new Map<string, Connection>()

// TODO : mutualiser dans shared avec le mobile.
export function subscribeAccountRealtime(
  token: string,
  event: AccountEvent,
  listener: Listener
): () => void {
  if (!token.trim()) {
    throw new Error('Session requise.')
  }

  let connection = connections.get(token)

  if (!connection) {
    const socket = io({
      path: '/socket.io',
      auth: { token },
      autoConnect: false,
      reconnection: true
    })

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

export function subscribeFriendsRealtime(
  token: string,
  listener: () => void
): () => void {
  return subscribeAccountRealtime(
    token,
    'friends:changed',
    listener
  )
}
