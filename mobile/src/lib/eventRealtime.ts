import { io, type Socket } from 'socket.io-client'
import { apiOrigin } from './api'

export type RealtimeChannel =
  | 'tracks'
  | 'playlists'
  | 'session'

export interface RealtimeSubscription {
  onChanged: () => void
  onAccessChanged: () => void
}

interface Connection {
  socket: Socket
  eventId: string
  subscriptions: Record<
    RealtimeChannel,
    Set<RealtimeSubscription>
  >
  channelGeneration: Record<RealtimeChannel, number>
  closed: boolean
}

type SocketFactory = (token: string) => Socket

const channels: readonly RealtimeChannel[] = [
  'tracks',
  'playlists',
  'session'
]

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Un gestionnaire par application.
 *
 * La factory injectable sert uniquement à tester les
 * connexions, les reconnexions et les ACK tardifs sans
 * contacter le serveur.
 *
 * TODO : politique explicite AppState pour la veille.
 */
export function createEventRealtimeManager(
  socketFactory: SocketFactory
) {
  const connections = new Map<string, Connection>()

  function notify(
    connection: Connection,
    channel: RealtimeChannel,
    kind: keyof RealtimeSubscription
  ): void {
    // Snapshot : un callback peut se désabonner.
    const listeners = [
      ...connection.subscriptions[channel]
    ]

    for (const subscription of listeners) {
      if (
        !connection.closed &&
        connection.subscriptions[channel].has(
          subscription
        )
      ) {
        subscription[kind]()
      }
    }
  }

  function join(
    connection: Connection,
    channel: RealtimeChannel
  ): void {
    if (
      connection.closed ||
      !connection.socket.connected ||
      connection.subscriptions[channel].size === 0
    ) {
      return
    }

    // Un ACK d'un ancien abonnement ou d'une ancienne
    // connexion ne doit jamais agir sur l'état actuel.
    const generation =
      ++connection.channelGeneration[channel]

    connection.socket.emit(
      `${channel}:join`,
      connection.eventId,
      (result: { ok?: boolean } | undefined) => {
        if (
          connection.closed ||
          generation !==
            connection.channelGeneration[channel] ||
          !connection.socket.connected ||
          connection.subscriptions[channel].size === 0
        ) {
          return
        }

        if (!result?.ok) {
          // Les permissions peuvent avoir changé :
          // la réponse HTTP doit faire foi.
          notify(
            connection,
            channel,
            'onAccessChanged'
          )
          return
        }

        // ACK reçu : récupérer les modifications manquées
        // entre le premier GET et l'abonnement.
        notify(connection, channel, 'onChanged')
      }
    )
  }

  function createConnection(
    token: string,
    eventId: string
  ): Connection {
    const socket = socketFactory(token)

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
        if (
          connection.subscriptions[channel].size > 0
        ) {
          join(connection, channel)
        }
      }
    })

    socket.on('disconnect', () => {
      for (const channel of channels) {
        connection.channelGeneration[channel]++
      }
    })

    for (const channel of channels) {
      socket.on(`${channel}:changed`, () => {
        notify(connection, channel, 'onChanged')
      })
    }

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
          notify(
            connection,
            channel,
            'onAccessChanged'
          )
        }
      }
    )

    socket.on('connect_error', () => {
      // Pas de JWT ni de données privées dans les logs.
      // La reconnexion automatique reste gérée par Socket.IO.
    })

    return connection
  }

  function subscribe(
    token: string,
    eventId: string,
    channel: RealtimeChannel,
    subscription: RealtimeSubscription
  ): () => void {
    if (!token || !uuid.test(eventId)) {
      throw new Error(
        'Abonnement temps réel invalide.'
      )
    }

    if (!channels.includes(channel)) {
      throw new Error(
        'Canal temps réel invalide.'
      )
    }

    const key = JSON.stringify([token, eventId])
    let connection = connections.get(key)
    const created = !connection

    if (!connection) {
      connection = createConnection(
        token,
        eventId
      )
      connections.set(key, connection)
    }

    const current = connection
    const listeners =
      current.subscriptions[channel]

    const firstSubscriber = listeners.size === 0

    listeners.add(subscription)

    if (created) {
      current.socket.connect()
    } else if (
      firstSubscriber &&
      current.socket.connected
    ) {
      join(current, channel)
    } else if (
      !firstSubscriber &&
      current.socket.connected
    ) {
      // Un second écran abonné au même canal récupère
      // immédiatement la version actuelle par HTTP.
      subscription.onChanged()
    }

    let unsubscribed = false

    return () => {
      if (unsubscribed) return
      unsubscribed = true

      listeners.delete(subscription)

      if (listeners.size === 0) {
        current.channelGeneration[channel]++

        if (
          !current.closed &&
          current.socket.connected
        ) {
          current.socket.emit(
            `${channel}:leave`,
            eventId
          )
        }
      }

      const remaining = channels.reduce(
        (total, name) =>
          total +
          current.subscriptions[name].size,
        0
      )

      if (
        remaining === 0 &&
        !current.closed
      ) {
        current.closed = true

        for (const name of channels) {
          current.channelGeneration[name]++
        }

        current.socket.disconnect()
        connections.delete(key)
      }
    }
  }

  /**
   * Ferme immédiatement les connexions liées à un JWT.
   * Appelé lorsque la session change ou est révoquée.
   *
   * TODO : centraliser les autres abonnements privés.
   */
  function closeToken(token: string): void {
    for (const [key, connection] of connections) {
      const connectionToken = JSON.parse(key)[0] as string

      if (connectionToken !== token) continue

      connection.closed = true

      for (const channel of channels) {
        connection.channelGeneration[channel]++
        connection.subscriptions[channel].clear()
      }

      connection.socket.disconnect()
      connections.delete(key)
    }
  }

  return { subscribe, closeToken }
}

const realtimeManager = createEventRealtimeManager(
  token => io(apiOrigin(), {
    path: '/socket.io',
    auth: { token },
    autoConnect: false,
    reconnection: true
  })
)

export const subscribeEventRealtime =
  realtimeManager.subscribe

export const closeRealtimeForToken =
  realtimeManager.closeToken
