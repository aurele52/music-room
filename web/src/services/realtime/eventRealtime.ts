import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

type Channel = 'tracks' | 'playlists' | 'session'

type Subscription = {
  onChanged: () => void
  onAccessChanged: () => void
}

type Connection = {
  socket: Socket
  eventId: string
  subscriptions: Record<Channel, Set<Subscription>>
  channelGeneration: Record<Channel, number>
  closed: boolean
}

const channels: readonly Channel[] = ['tracks', 'playlists', 'session']
const connections = new Map<string, Connection>()

function notify(
  connection: Connection,
  channel: Channel,
  kind: 'onChanged' | 'onAccessChanged'
): void {
  // Copie pour éviter les problèmes si un rappel se désabonne.
  const subscriptions = [...connection.subscriptions[channel]]

  for (const subscription of subscriptions) {
    if (
      connection.subscriptions[channel].has(subscription) &&
      !connection.closed
    ) {
      subscription[kind]()
    }
  }
}

function join(
  connection: Connection,
  channel: Channel
): void {
  if (
    connection.closed ||
    !connection.socket.connected ||
    connection.subscriptions[channel].size === 0
  ) {
    return
  }

  // Chaque abonnement et reconnexion invalide les anciens ACK.
  const generation = ++connection.channelGeneration[channel]

  connection.socket.emit(
    `${channel}:join`,
    connection.eventId,
    (result: { ok?: boolean } | undefined) => {
      if (connection.closed) return

      if (generation !== connection.channelGeneration[channel]) {
        return
      }

      if (!connection.socket.connected) return

      if (connection.subscriptions[channel].size === 0) return

      if (!result?.ok) {
        console.warn(
          `Abonnement ${channel} refusé pour cet événement`
        )
          // Le refus peut signaler une perte d'accès.
          // La réponse HTTP revalide les droits.
          notify(connection, channel, 'onAccessChanged')
        return
      }

      // Le serveur confirme l'abonnement :
      // on rattrape les changements éventuellement manqués.
      notify(connection, channel, 'onChanged')
    }
  )
}

function createConnection(
  token: string,
  eventId: string
): Connection {
  const socket = io({
    path: '/socket.io',
    auth: { token },
    autoConnect: false
  })

  const connection: Connection = {
    socket,
    eventId,
    subscriptions: {
      tracks: new Set(),
      playlists: new Set(),
      session: new Set()
    },
    channelGeneration: {
      tracks: 0,
      playlists: 0,
      session: 0
    },
    closed: false
  }

  socket.on('connect', () => {
    if (connection.closed) return

    for (const channel of channels) {
      if (connection.subscriptions[channel].size > 0) {
        join(connection, channel)
      }
    }
  })

  socket.on('disconnect', () => {
    // Les accusés de réception précédents sont périmés.
    for (const channel of channels) {
      connection.channelGeneration[channel]++
    }
  })

  socket.on('tracks:changed', () => {
    notify(connection, 'tracks', 'onChanged')
  })

  socket.on('playlists:changed', () => {
    notify(connection, 'playlists', 'onChanged')
  })

  socket.on('session:changed', () => {
    notify(connection, 'session', 'onChanged')
  })

  socket.on(
    'event:access-changed',
    (payload: { eventId?: string } | undefined) => {
      if (
        connection.closed ||
        payload?.eventId !== connection.eventId
      ) {
        return
      }

      for (const channel of channels) {
        notify(connection, channel, 'onAccessChanged')
      }
    }
  )

  socket.on('connect_error', (error: Error) => {
    if (!connection.closed) {
      console.warn('Connexion temps réel :', error.message)
    }
  })

  return connection
}

// Une seule connexion physique pour une session et un événement.
// Les deux canaux restent indépendants.
export function subscribeEventRealtime(
  token: string,
  eventId: string,
  channel: Channel,
  subscription: Subscription
): () => void {
  const key = JSON.stringify([token, eventId])
  let connection = connections.get(key)
  const created = !connection

  if (!connection) {
    connection = createConnection(token, eventId)
    connections.set(key, connection)
  }

  const current = connection
  const listeners = current.subscriptions[channel]
  const firstSubscriber = listeners.size === 0

  listeners.add(subscription)

  if (created) {
    // Une seule tentative de connexion, même avec deux panneaux.
    current.socket.connect()
  } else if (firstSubscriber && current.socket.connected) {
    join(current, channel)
  } else if (!firstSubscriber && current.socket.connected) {
    // Le second panneau récupère immédiatement l'état actuel.
    subscription.onChanged()
  }

  let unsubscribed = false

  return () => {
    if (unsubscribed) return
    unsubscribed = true

    listeners.delete(subscription)

    if (listeners.size === 0) {
      current.channelGeneration[channel]++

      if (!current.closed && current.socket.connected) {
        current.socket.emit(`${channel}:leave`, eventId)
      }
    }

    const remaining =
      current.subscriptions.tracks.size +
      current.subscriptions.playlists.size +
      current.subscriptions.session.size

    if (remaining === 0 && !current.closed) {
      current.closed = true
      current.channelGeneration.tracks++
      current.channelGeneration.playlists++
      current.channelGeneration.session++

      current.socket.disconnect()
      connections.delete(key)
    }
  }
}
