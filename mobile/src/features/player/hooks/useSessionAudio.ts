import {
  advanceAudioCompletion,
  type AudioCompletion
} from '../audioCompletion'
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio'

export type SessionAudioProps = {
  url: string
  playing: boolean
  canReportEnd: boolean
  onEnded: () => boolean
}


export function useSessionAudio({
  url,
  playing,
  canReportEnd,
  onEnded
}: SessionAudioProps) {
  const player = useAudioPlayer(url)
  const status = useAudioPlayerStatus(player)

  const active = useRef(false)
  const completion = useRef<AudioCompletion>('idle')
  const [error, setError] = useState('')

  const update = useCallback(() => {
    try {
      if (
        active.current &&
        playing &&
        AppState.currentState === 'active'
      ) {
        player.play()
      } else {
        player.pause()
      }

      setError('')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Commande audio impossible.'
      )
    }
  }, [player, playing])

  useFocusEffect(useCallback(() => {
    active.current = true
    update()

    const subscription = AppState.addEventListener(
      'change',
      update
    )

    return () => {
      active.current = false
      subscription.remove()
      player.pause()
    }
  }, [player, update]))

  // Retenter la lecture lorsque le fichier devient disponible.
  useEffect(() => {
    if (active.current && status.isLoaded) {
      update()
    }
  }, [status.isLoaded, update])

  useEffect(() => {
    const focused =
      active.current &&
      AppState.currentState === 'active'

    if (!focused) return

    completion.current = advanceAudioCompletion(
      completion.current,
      playing && status.didJustFinish,
      playing && canReportEnd,
      onEnded
    )
  }, [
    status.didJustFinish,
    playing,
    canReportEnd,
    onEnded
  ])

  const duration = status.duration || 0
  const position = status.currentTime || 0

  const progress = duration > 0
    ? Math.min(100, Math.max(0, position / duration * 100))
    : 0


  return {
    status,
    error,
    update,
    duration,
    position,
    progress
  }
}
