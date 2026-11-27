export type AudioCompletion =
  | 'idle'
  | 'pending'
  | 'sent'

export function advanceAudioCompletion(
  state: AudioCompletion,
  didFinish: boolean,
  canSend: boolean,
  send: () => boolean
): AudioCompletion {
  if (state === 'sent') return state

  if (state === 'idle' && !didFinish) {
    return state
  }

  if (!canSend) return 'pending'

  return send() ? 'sent' : 'pending'
}
