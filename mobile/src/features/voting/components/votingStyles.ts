import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  form: {
    gap: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '800'
  },
  track: {
    gap: 6,
    padding: 16,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14
  },
  rank: {
    color: theme.primary,
    fontWeight: '800'
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800'
  },
  detail: {
    color: theme.muted,
    fontSize: 14
  },
  voted: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 14
  }
})
