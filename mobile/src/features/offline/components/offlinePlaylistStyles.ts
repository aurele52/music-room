import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  container: {
    gap: 12
  },
  card: {
    padding: 12,
    gap: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12
  },
  track: {
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border
  },
  heading: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600'
  },
  detail: {
    color: theme.muted,
    fontSize: 14
  },
  row: {
    flexDirection: 'row',
    gap: 8
  },
  flex: {
    flex: 1
  }
})
