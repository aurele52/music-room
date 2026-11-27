import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface
  },
  heading: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700'
  },
  detail: {
    color: theme.muted,
    fontSize: 14
  }
})
