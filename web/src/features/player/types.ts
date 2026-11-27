export type Session = {
  id: string
  state: 'PAUSED' | 'PLAYING' | 'STOPPED'
  currentIndex: number
  revision: number
  items: {
    id: string
    title: string
    artist: string
    position: number
    audioUrl?: string | null
  }[]
}

export type SessionResponse = {
  session: Session | null
  canControl: boolean
  finished: boolean
}

export type Props = {
  eventId: string
  token: string
  onAuthError: (error: unknown) => boolean
}
