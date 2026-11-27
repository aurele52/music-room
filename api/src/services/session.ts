import jwt from 'jsonwebtoken';

export function createSession(
  userId: string,
  tokenVersion: number
): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET manquant');
  }

  return jwt.sign(
    {
      sub: userId,
      ver: tokenVersion
    },
    secret,
    {
      expiresIn: '1h',
      issuer: 'music-room',
      audience: 'music-room-api'
    }
  );
}

export function verifySession(token: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET manquant');
  }

  const payload = jwt.verify(token, secret, {
    issuer: 'music-room',
    audience: 'music-room-api'
  });

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    !Number.isInteger(payload.ver) ||
    payload.ver < 0
  ) {
    throw new Error('JWT invalide');
  }

  return {
    userId: payload.sub,
    tokenVersion: payload.ver as number,
    issuedAt: payload.iat
  };
}


// Une opération sensible exige une connexion récente.
// Le paramètre now facilite les tests sans attendre réellement.
export function isRecentSession(
  issuedAt: unknown,
  now = Math.floor(Date.now() / 1000)
): boolean {
  if (!Number.isSafeInteger(issuedAt)) {
    return false;
  }

  const age = now - (issuedAt as number);

  return age >= 0 && age <= 10 * 60;
}
