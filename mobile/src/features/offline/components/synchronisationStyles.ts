import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14
  },
  comparison: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 12
  },
  heading: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700'
  },
  detail: {
    color: theme.muted,
    fontSize: 14
  }
})
