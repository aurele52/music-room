import { clearUserCache } from '../lib/offline/database'
import {
  invalidateUserCacheGeneration,
  serializeCache,
  setCacheSessionGuard
} from '../lib/offline/syncChanges'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { createAutoSync } from '../lib/offline/autoSync'
import { synchronizePendingOperations } from '../lib/offline/syncService'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import * as SecureStore from 'expo-secure-store'
import { closeRealtimeForToken } from '../lib/eventRealtime'
import {
  api,
  setUnauthorizedHandler,
  type User
} from '../lib/api'
import {
  SessionManager,
  type SessionState
} from './SessionManager'

import {
  parseSessionRecord,
  encodeSessionRecord,
  offlineIdentity
} from './sessionRecord'

const STORAGE_KEY = 'musicroom.session.v1'

interface SessionContextValue {
  session: SessionState
  restore: () => Promise<void>
  refreshUser: (expectedToken: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginGoogle: (credential: string) => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(
  null
)

// Le cache peut etre efface sans supprimer les modifications
// locales non synchronisees.

async function purgeSessionCache(userId: string) {
  invalidateUserCacheGeneration(userId)

  try {
    await serializeCache(() => clearUserCache(userId))
  } catch {
    console.warn('Nettoyage du cache local incomplet.')
  }
}

async function storedUserId(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY)

  return parseSessionRecord(raw)?.userId ?? null
}

const manager = new SessionManager(
  {
    get: async () => {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      return parseSessionRecord(raw)?.token ?? null
    },
    set: async (token, userId) => {
      const previousUser = await storedUserId()

      await SecureStore.setItemAsync(
        STORAGE_KEY,
        encodeSessionRecord(token, userId)
      )

      if (previousUser && previousUser !== userId) {
        await purgeSessionCache(previousUser)
      }
    },
    getOfflineUserId: async token => offlineIdentity(
      await SecureStore.getItemAsync(STORAGE_KEY),
      token
    ),
    remove: async () => {
      const userId = await storedUserId().catch(() => null)

      await SecureStore.deleteItemAsync(STORAGE_KEY)

      if (userId) {
        await purgeSessionCache(userId)
      }
    }
  },
  {
    me: async (token) => {
      const result = await api<{ user: User }>(
        '/auth/me',
        { token }
      )
      return result.user
    },
    login: (email, password) => api<{
      token: string
      user: User
    }>('/auth/login', {
      method: 'POST',
      body: { email, password }
    }),
    googleLogin: (credential) => api<{
      token: string
      user: User
    }>('/auth/google/login', {
      method: 'POST',
      body: { credential }
    })
  }
)

setCacheSessionGuard(userId => {
  const state = manager.current

  return state.status === 'authenticated' &&
    state.user.id === userId
})

// Eviter deux restaurations simultanees declenchees par
// NetInfo, le retour au premier plan ou un bouton.

function restoreSession(): Promise<void> {
  if (manager.current.status === 'loading') {
    return Promise.resolve()
  }

  return manager.restore()
}

export function SessionProvider({
  children
}: {
  children: ReactNode
}) {
  const [session, setSession] = useState<SessionState>(
    manager.current
  )

  useEffect(() => {
    let activeToken: string | null = null
    let activeUserId: string | null = null
    let online = false
    let foreground = AppState.currentState === 'active'

    const automaticSync = createAutoSync(
      () => {
        const state = manager.current

        return online &&
          foreground &&
          state.status === 'authenticated'
            ? state
            : null
      },

      (state, current) =>
        synchronizePendingOperations(
          state.user.id,
          state.token,
          current
        )
    )

    function requestSync() {
      void automaticSync.request().catch(() => {
        console.warn('Synchronisation locale indisponible.')
      })
    }

    function requestOnlineWork() {
      if (!online || !foreground) return

      const state = manager.current

      if (
        state.status === 'error' &&
        state.offlineUserId
      ) {
        void restoreSession().catch(() => {
          console.warn('Restauration de session impossible.')
        })

        return
      }

      requestSync()
    }

    const stopNetwork = NetInfo.addEventListener(state => {
      const nextOnline =
        state.isConnected === true &&
        state.isInternetReachable !== false

      const recovered = !online && nextOnline
      online = nextOnline

      if (recovered) requestOnlineWork()
    })

    const appSubscription = AppState.addEventListener(
      'change',
      state => {
        const next = state === 'active'
        const resumed = !foreground && next

        foreground = next

        if (resumed) requestOnlineWork()
      }
    )

    const unsubscribe = manager.subscribe(next => {
      const nextToken = next.status === 'authenticated'
        ? next.token
        : null

      if (activeToken && activeToken !== nextToken) {
        // Fermer les connexions privées avant la mise
        // à jour de la navigation.
        closeRealtimeForToken(activeToken)
      }

      const nextUserId = next.status === 'authenticated'
        ? next.user.id
        : null

      if (
        activeUserId &&
        (
          activeUserId !== nextUserId ||
          activeToken !== nextToken
        )
      ) {
        invalidateUserCacheGeneration(activeUserId)

        if (nextUserId && activeUserId !== nextUserId) {
          void purgeSessionCache(activeUserId)
        }
      }

      activeUserId = nextUserId
      activeToken = nextToken
      setSession(next)

      if (next.status === 'authenticated') {
        requestSync()
      }
    })

    const removeUnauthorizedHandler = setUnauthorizedHandler(
      (token) => manager.unauthorized(token)
    )

    void manager.restore()

    return () => {
      automaticSync.stop()
      stopNetwork()
      appSubscription.remove()
      unsubscribe()
      removeUnauthorizedHandler()
    }
  }, [])

  return (
    <SessionContext.Provider value={{
      session,
      restore: restoreSession,
      refreshUser: token => manager.refreshUser(token),
      login: (email, password) => manager.login(email, password),
      loginGoogle: (credential) => manager.loginGoogle(credential),
      logout: () => manager.logout()
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) {
    throw new Error('SessionProvider manquant')
  }

  return value
}

export function isCurrentSession(
  state: SessionState
): boolean {
  return manager.current === state
}


// Verification directe de la session courante.
export function isCurrentSessionToken(token: string): boolean {
  const state = manager.current

  return (
    state.status === 'authenticated' &&
    state.token === token
  )
}
