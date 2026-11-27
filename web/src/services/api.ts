export type ApiError = Error & { code?: string; status?: number };

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error || 'Erreur du serveur'
    ) as ApiError;

    error.code = data.code;
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Une erreur est survenue';
}
