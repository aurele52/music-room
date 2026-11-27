import { useEffect, useRef, useState } from 'react'

type Props = {
  url: string
  playing: boolean
  onEnded: () => void
}

export default function SessionAudio({
  url,
  playing,
  onEnded
}: Props) {
  const audio = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const player = audio.current
    if (!player) return

    let active = true

    if (playing) {
      void player.play()
        .then(() => {
          if (active) setBlocked(false)
        })
        .catch(() => {
          if (active) setBlocked(true)
        })
    } else {
      player.pause()
    }

    return () => {
      active = false
      player.pause()
    }
  }, [url, playing])

  return (
    <>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onEnded={() => {
          if (playing) onEnded()
        }}
      />

      {playing && blocked && (
        <button
          type="button"
          onClick={() => {
            void audio.current?.play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true))
          }}
        >
          Activer le son
        </button>
      )}
    </>
  )
}
