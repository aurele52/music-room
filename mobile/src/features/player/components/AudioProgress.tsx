import { StyleSheet, Text, View } from 'react-native'
import { theme } from '../../../ui/theme'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'

  const value = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(value / 60)
  const remaining = String(value % 60).padStart(2, '0')

  return `${minutes}:${remaining}`
}


interface Props {
  position: number
  duration: number
  progress: number
}

export default function AudioProgress({
  position,
  duration,
  progress
}: Props) {
  return (
    <>
      <View style={styles.progress}>
        <View style={[
          styles.position,
          { width: `${progress}%` }
        ]} />
      </View>

      <Text style={styles.time}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>

    </>
  )
}

const styles = StyleSheet.create({
  progress: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 6,
    overflow: 'hidden'
  },
  position: {
    height: 6,
    backgroundColor: theme.primary
  },
  time: {
    color: theme.muted,
    textAlign: 'center'
  },

})
