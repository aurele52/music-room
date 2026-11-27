import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 8
  },
  label: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 9
  },
  value: {
    color: theme.text,
    fontSize: 16
  },
  description: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 23
  }
})
