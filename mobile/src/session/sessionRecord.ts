export interface SessionRecord {
  token: string
  userId: string | null
}

export function parseSessionRecord(
  raw: string | null
): SessionRecord | null {
  if (!raw) return null

  // Une session sans identifiant utilisateur reste utilisable en ligne.
  if (!raw.startsWith('{')) {
    return {
      token: raw,
      userId: null
    }
  }

  try {
    const record = JSON.parse(raw)

    if (
      typeof record.token !== 'string' ||
      !record.token ||
      typeof record.userId !== 'string' ||
      !record.userId
    ) return null

    return {
      token: record.token,
      userId: record.userId
    }
  } catch {
    return null
  }
}

export function encodeSessionRecord(
  token: string,
  userId?: string
): string {
  if (!userId) return token

  return JSON.stringify({
    token,
    userId
  })
}

export function offlineIdentity(
  raw: string | null,
  token: string
): string | null {
  const record = parseSessionRecord(raw)

  if (!record || record.token !== token) {
    return null
  }

  return record.userId
}
