export type GoogleLinkDecision =
  | 'ok'
  | 'already-linked'
  | 'email-mismatch'
  | 'google-in-use';

export function checkGoogleLink(
  musicRoomEmail: string,
  googleEmail: string,
  alreadyLinked: boolean,
  googleInUse: boolean
): GoogleLinkDecision {
  if (alreadyLinked) {
    return 'already-linked';
  }

  if (musicRoomEmail.trim().toLowerCase() !==
      googleEmail.trim().toLowerCase()) {
    return 'email-mismatch';
  }

  if (googleInUse) {
    return 'google-in-use';
  }

  return 'ok';
}
