export interface User {
  id: string
  email: string
  name: string
  createdAt?: string
  emailVerifiedAt?: string | null
}

export interface MusicEvent {
  id: string
  title: string
  description: string | null
  location: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
  organizerId: string
  organizer?: {
    id: string
    name: string
  }
}

// Une seule session active : le callback ne reçoit jamais
// la valeur du JWT dans les journaux.
type UnauthorizedHandler = (token: string) => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler
): () => void {
  unauthorizedHandler = handler

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null
    }
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim()

  if (!raw) {
    throw new ApiError(
      0,
      'Configure EXPO_PUBLIC_API_URL dans mobile/.env'
    )
  }

  let url: URL

  try {
    url = new URL(raw)
  } catch {
    throw new ApiError(0, 'Adresse API invalide')
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new ApiError(
      0,
      "L'adresse API doit être une origine sans chemin"
    )
  }

  if (
    url.protocol !== 'https:' &&
    !(
      __DEV__ &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '10.0.2.2'].includes(
        url.hostname
      )
    )
  ) {
    throw new ApiError(0, 'Une API HTTPS est requise')
  }

  return url.origin
}

type MobileLogInfo = {
  platform: 'android' | 'ios'
  device: string
  version: string
}

let mobileLogInfo: MobileLogInfo | null = null

export function configureMobileLogging(
  info: MobileLogInfo
): void {
  mobileLogInfo = {
    platform: info.platform,
    device: info.device.slice(0, 100),
    version: info.version.slice(0, 100)
  }
}

export async function api<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    token?: string
    body?: unknown
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }

  if (mobileLogInfo) {
    headers['X-MusicRoom-Platform'] =
      mobileLogInfo.platform
    headers['X-MusicRoom-Device'] =
      mobileLogInfo.device
    headers['X-MusicRoom-Version'] =
      mobileLogInfo.version
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(
      `${apiOrigin()}/api${path}`,
      {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
        signal: controller.signal
      }
    )

    // Le statut HTTP suffit pour invalider la session.
    if (response.status === 401 && options.token) {
      unauthorizedHandler?.(options.token)
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch {
      if (response.ok && controller.signal.aborted) {
        throw new ApiError(0, 'Le serveur ne répond pas')
      }

      throw new ApiError(
        response.status,
        'Réponse invalide du serveur'
      )
    }

    if (!response.ok) {
      const error = (
        payload && typeof payload === 'object'
          ? payload as {
              error?: unknown
              code?: unknown
            }
          : {}
      )

      throw new ApiError(
        response.status,
        typeof error.error === 'string'
          ? error.error
          : 'Requête refusée',
        typeof error.code === 'string'
          ? error.code
          : undefined
      )
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error

    throw new ApiError(
      0,
      controller.signal.aborted
        ? 'Le serveur ne répond pas'
        : 'Connexion au serveur impossible'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Une erreur est survenue'
}
