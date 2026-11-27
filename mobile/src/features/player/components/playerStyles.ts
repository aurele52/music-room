import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface
  },
  heading: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.text
  },
  track: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text
  },
  muted: {
    fontSize: 14,
    color: theme.muted
  }
})
