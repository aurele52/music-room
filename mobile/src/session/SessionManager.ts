export interface SessionUser {
  id: string
  email: string
  name: string
  createdAt?: string
  emailVerifiedAt?: string | null
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | {
      status: 'error'
      message: string
      offlineUserId?: string
    }
  | {
      status: 'authenticated'
      token: string
      user: SessionUser
    }

export interface TokenStorage {
  get(): Promise<string | null>
  set(token: string, userId?: string): Promise<void>
  getOfflineUserId?(token: string): Promise<string | null>
  remove(): Promise<void>
}

export interface SessionApi {
  me(token: string): Promise<SessionUser>
  login(
    email: string,
    password: string
  ): Promise<{ token: string; user: SessionUser }>
  googleLogin?: (
    credential: string
  ) => Promise<{ token: string; user: SessionUser }>
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Erreur de session'
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  return 'status' in error && (
    error.status === 401 || error.status === 403
  )
}

function isOfflineFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const failure = error as {
    status?: number
    message?: string
  }

  return failure.status === 0 &&
    (
      failure.message === 'Connexion au serveur impossible' ||
      failure.message === 'Le serveur ne répond pas'
    )
}

export class SessionManager {
  private state: SessionState = { status: 'loading' }
  private readonly listeners = new Set<
    (state: SessionState) => void
  >()

  private revision = 0
  private userRefreshRevision = 0
  private storageQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly storage: TokenStorage,
    private readonly api: SessionApi
  ) {}

  get current(): SessionState {
    return this.state
  }

  subscribe(listener: (state: SessionState) => void) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(state: SessionState) {
    this.state = state

    for (const listener of this.listeners) {
      listener(state)
    }
  }

  // Toutes les écritures et lectures du stockage sont
  // sérialisées. Un ancien DELETE ne peut donc pas
  // s'exécuter après un nouveau SET déjà achevé.
  private storageOperation<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const result = this.storageQueue.then(operation)

    this.storageQueue = result.then(
      () => undefined,
      () => undefined
    )

    return result
  }

  async refreshUser(expectedToken: string): Promise<void> {
    const previous = this.state

    if (
      previous.status !== 'authenticated' ||
      previous.token !== expectedToken
    ) return

    const revision = this.revision
    const refreshRevision = ++this.userRefreshRevision

    const current = () =>
      revision === this.revision &&
      refreshRevision === this.userRefreshRevision &&
      this.state === previous

    try {
      const user = await this.api.me(previous.token)

      if (!current()) return

      if (user.id !== previous.user.id) {
        throw new Error('Identité de session incohérente.')
      }

      this.publish({
        ...previous,
        user
      })
    } catch (error) {
      if (!current()) return

      if (isUnauthorized(error)) {
        this.unauthorized(previous.token)
      }

      throw error
    }
  }

  async restore(): Promise<void> {
    const revision = ++this.revision
    this.publish({ status: 'loading' })

    try {
      const token = await this.storageOperation(
        () => this.storage.get()
      )

      if (revision !== this.revision) return

      if (!token) {
        this.publish({ status: 'guest' })
        return
      }

      try {
        const user = await this.api.me(token)

        if (revision !== this.revision) return

        if (this.storage.getOfflineUserId) {
          await this.storageOperation(async () => {
            if (revision !== this.revision) return

            await this.storage.set(token, user.id)
          }).catch(() => {
            // Le stockage local ne doit pas bloquer
            // une session validee par le serveur.
          })
        }

        if (revision !== this.revision) return

        this.publish({
          status: 'authenticated',
          token,
          user
        })
      } catch (error) {
        if (revision !== this.revision) return

        if (isUnauthorized(error)) {
          await this.storageOperation(
            () => this.storage.remove()
          )

          if (revision === this.revision) {
            this.publish({ status: 'guest' })
          }

          return
        }

        let offlineUserId: string | null = null

        if (isOfflineFailure(error)) {
          const readIdentity = this.storage.getOfflineUserId

          if (readIdentity) {
            offlineUserId = await this.storageOperation(
              () => readIdentity.call(this.storage, token)
            ).catch(() => null)
          }
        }

        if (revision !== this.revision) return

        this.publish({
          status: 'error',
          message: message(error),
          ...(offlineUserId ? { offlineUserId } : {})
        })
      }
    } catch (error) {
      if (revision === this.revision) {
        this.publish({
          status: 'error',
          message: message(error)
        })
      }
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<void> {
    return this.authenticate(
      () => this.api.login(email, password)
    )
  }

  async loginGoogle(credential: string): Promise<void> {
    if (!this.api.googleLogin) {
      throw new Error('Connexion Google indisponible')
    }

    return this.authenticate(
      () => this.api.googleLogin!(credential)
    )
  }

  private async authenticate(
    request: () => Promise<{
      token: string
      user: SessionUser
    }>
  ): Promise<void> {
    const revision = ++this.revision
    const previous = this.state

    try {
      const result = await request()

      if (
        !result.token ||
        typeof result.token !== 'string' ||
        !result.user?.id
      ) {
        throw new Error('Réponse de connexion invalide')
      }

      if (revision !== this.revision) {
        throw new Error(
          'Connexion remplacée par une autre opération'
        )
      }

      // Une connexion annulée avant son tour dans la file
      // ne doit jamais écrire son jeton dans Secure Store.
      await this.storageOperation(async () => {
        if (revision !== this.revision) return
        await this.storage.set(result.token, result.user.id)
      })

      if (revision !== this.revision) {
        throw new Error(
          'Connexion remplacée par une autre opération'
        )
      }

      this.publish({
        status: 'authenticated',
        token: result.token,
        user: result.user
      })
    } catch (error) {
      if (revision === this.revision) {
        // La restauration éventuellement en cours a été
        // invalidée au début de la connexion.
        // Ne jamais laisser l'interface en chargement.
        this.publish(
          previous.status === 'loading'
            ? { status: 'guest' }
            : previous
        )
      }

      throw error
    }
  }

  async logout(): Promise<void> {
    const revision = ++this.revision

    // Retirer immédiatement l'accès aux écrans protégés.
    this.publish({ status: 'guest' })

    try {
      await this.storageOperation(
        () => this.storage.remove()
      )
    } catch (error) {
      if (revision === this.revision) {
        this.publish({
          status: 'error',
          message: `Déconnexion locale incomplète : ${message(error)}`
        })
      }
      throw error
    }
  }

  unauthorized(token: string): void {
    if (
      this.state.status !== 'authenticated' ||
      this.state.token !== token
    ) {
      return
    }

    const revision = ++this.revision
    this.publish({ status: 'guest' })

    void this.storageOperation(
      () => this.storage.remove()
    ).catch((error: unknown) => {
      if (revision === this.revision) {
        this.publish({
          status: 'error',
          message: `Session invalide : ${message(error)}`
        })
      }
    })
  }
}
